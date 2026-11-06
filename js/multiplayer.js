/**
 * MINIMAL CHESS — Multiplayer Network Module (Zero-Backend, 100% Static GitHub Pages)
 * Enables real-time pass-by-link multiplayer with zero server/database setup.
 * Uses public secure WebSockets with auto-failover between EMQX and HiveMQ brokers.
 */

(function () {
  'use strict';

  const BROKERS = [
    { host: 'broker.emqx.io', port: 8084, path: '/mqtt' },
    { host: 'broker.hivemq.com', port: 8884, path: '/mqtt' }
  ];

  class ChessMultiplayer {
    constructor() {
      this.roomId = null;
      this.isHost = false;
      this.myPlayerId = 'p_' + Math.random().toString(36).substring(2, 10);
      this.opponentPlayerId = null;
      this.myColor = null; // 'w' or 'b'
      this.assignedGuestColor = null;

      this.client = null;
      this.brokerIndex = 0;
      this.isBrokerConnected = false;
      this.isPeerConnected = false;

      this.heartbeatTimer = null;
      this.peerCheckTimer = null;
      this.lastPeerSeen = 0;

      // Event handlers
      this.onStatusChange = null;   // (status: 'disconnected'|'waiting'|'connected')
      this.onPeerJoin = null;       // (data)
      this.onPeerLeave = null;      // ()
      this.onMoveReceived = null;   // (moveObj)
      this.onSyncReceived = null;   // (syncObj)
      this.onRematchRequested = null;
      this.onRematchAccepted = null;
    }

    getTopic() {
      if (!this.roomId) return null;
      return `minchess/v2/room/${this.roomId}`;
    }

    /**
     * Create a new room as host
     */
    createRoom(preferredColor = 'random') {
      const chars = '23456789abcdefghjkmnpqrstuvwxyz';
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      this.roomId = code;
      this.isHost = true;

      // Determine colors
      if (preferredColor === 'w') {
        this.myColor = 'w';
        this.assignedGuestColor = 'b';
      } else if (preferredColor === 'b') {
        this.myColor = 'b';
        this.assignedGuestColor = 'w';
      } else {
        // Random
        const hostIsWhite = Math.random() < 0.5;
        this.myColor = hostIsWhite ? 'w' : 'b';
        this.assignedGuestColor = hostIsWhite ? 'b' : 'w';
      }

      this.connect();
      return this.roomId;
    }

    /**
     * Join an existing room from link
     */
    joinRoom(roomId) {
      this.roomId = roomId.trim().toLowerCase();
      this.isHost = false;
      // myColor will be set once host replies with sync packet
      this.connect();
    }

    /**
     * Connect to the public WebSocket broker
     */
    connect() {
      if (typeof Paho === 'undefined' || !Paho.MQTT) {
        console.error('Paho MQTT library not loaded');
        return;
      }

      this.disconnect(false);

      const broker = BROKERS[this.brokerIndex];
      const clientId = `minchess_${this.myPlayerId}_${Date.now()}`;

      try {
        this.client = new Paho.MQTT.Client(broker.host, broker.port, broker.path, clientId);

        this.client.onConnectionLost = (responseObject) => {
          this.isBrokerConnected = false;
          this.setPeerConnected(false);
          if (responseObject.errorCode !== 0) {
            console.warn('MQTT Connection lost:', responseObject.errorMessage);
            // Try next broker on unexpected disconnect
            this.brokerIndex = (this.brokerIndex + 1) % BROKERS.length;
            setTimeout(() => {
              if (this.roomId) this.connect();
            }, 2000);
          }
        };

        this.client.onMessageArrived = (message) => {
          this.handleIncomingMessage(message);
        };

        const connectOptions = {
          useSSL: true,
          timeout: 5,
          keepAliveInterval: 30,
          cleanSession: true,
          onSuccess: () => {
            this.isBrokerConnected = true;
            this.subscribeToRoom();
          },
          onFailure: (err) => {
            console.warn(`Failed to connect to broker ${broker.host}:`, err.errorMessage || err);
            // Fallback to next broker
            this.brokerIndex = (this.brokerIndex + 1) % BROKERS.length;
            setTimeout(() => {
              if (this.roomId) this.connect();
            }, 1500);
          }
        };

        this.client.connect(connectOptions);
      } catch (e) {
        console.error('MQTT initialization error:', e);
      }
    }

    subscribeToRoom() {
      const topic = this.getTopic();
      if (!topic || !this.client) return;

      this.client.subscribe(topic, {
        qos: 0,
        onSuccess: () => {
          this.startHeartbeat();
          // Broadcast presence
          if (this.isHost) {
            this.sendPacket({
              type: 'host_present',
              color: this.myColor,
              guestColor: this.assignedGuestColor
            });
          } else {
            this.sendPacket({
              type: 'guest_join'
            });
          }
          this.updateStatus();
        },
        onFailure: (err) => {
          console.error('Failed to subscribe to room topic:', err);
        }
      });
    }

    handleIncomingMessage(message) {
      try {
        const payload = JSON.parse(message.payloadString);
        if (!payload || payload.senderId === this.myPlayerId) {
          // Ignore own messages
          return;
        }

        // We received a message from another player in this room
        this.opponentPlayerId = payload.senderId;
        this.lastPeerSeen = Date.now();
        if (!this.isPeerConnected) {
          this.setPeerConnected(true);
        }

        switch (payload.type) {
          case 'ping':
            // Opponent heartbeat
            break;

          case 'guest_join':
            if (this.isHost) {
              // Host welcomes guest with current state
              if (this.onPeerJoin) this.onPeerJoin(payload);
            }
            break;

          case 'host_present':
            if (!this.isHost && payload.guestColor) {
              this.myColor = payload.guestColor;
              if (this.onPeerJoin) this.onPeerJoin(payload);
            }
            break;

          case 'sync_state':
            if (payload.guestColor && !this.isHost) {
              this.myColor = payload.guestColor;
            }
            if (this.onSyncReceived) {
              this.onSyncReceived(payload);
            }
            break;

          case 'move':
            if (this.onMoveReceived) {
              this.onMoveReceived(payload);
            }
            break;

          case 'rematch_request':
            if (this.onRematchRequested) {
              this.onRematchRequested(payload);
            }
            break;

          case 'rematch_accept':
            if (this.onRematchAccepted) {
              this.onRematchAccepted(payload);
            }
            break;

          case 'leave':
            this.setPeerConnected(false);
            if (this.onPeerLeave) {
              this.onPeerLeave();
            }
            break;
        }
      } catch (e) {
        console.error('Error handling incoming message:', e);
      }
    }

    sendPacket(data) {
      if (!this.client || !this.isBrokerConnected || !this.roomId) return;
      try {
        data.senderId = this.myPlayerId;
        data.timestamp = Date.now();

        const msg = new Paho.MQTT.Message(JSON.stringify(data));
        msg.destinationName = this.getTopic();
        msg.qos = 0;
        this.client.send(msg);
      } catch (e) {
        console.warn('Failed to send packet:', e);
      }
    }

    sendMove(moveObj, fen, clocks) {
      this.sendPacket({
        type: 'move',
        move: moveObj,
        fen: fen,
        clocks: clocks
      });
    }

    sendSyncState(state) {
      this.sendPacket({
        type: 'sync_state',
        fen: state.fen,
        moves: state.moves,
        turn: state.turn,
        hostColor: this.myColor,
        guestColor: this.assignedGuestColor,
        timeSettings: state.timeSettings,
        timeLeft: state.timeLeft,
        historyMoves: state.historyMoves
      });
    }

    requestRematch() {
      this.sendPacket({ type: 'rematch_request' });
    }

    acceptRematch(newHostColor = null) {
      if (newHostColor) {
        this.myColor = newHostColor;
        this.assignedGuestColor = newHostColor === 'w' ? 'b' : 'w';
      }
      this.sendPacket({
        type: 'rematch_accept',
        hostColor: this.myColor,
        guestColor: this.assignedGuestColor
      });
    }

    startHeartbeat() {
      this.stopHeartbeat();
      // Send heartbeat ping every 2.5 seconds
      this.heartbeatTimer = setInterval(() => {
        this.sendPacket({ type: 'ping' });
      }, 2500);

      // Check if peer is still responding every 1 second
      this.peerCheckTimer = setInterval(() => {
        if (this.isPeerConnected && Date.now() - this.lastPeerSeen > 7000) {
          // No ping received for > 7s -> peer disconnected
          this.setPeerConnected(false);
          if (this.onPeerLeave) this.onPeerLeave();
        }
      }, 1000);
    }

    stopHeartbeat() {
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }
      if (this.peerCheckTimer) {
        clearInterval(this.peerCheckTimer);
        this.peerCheckTimer = null;
      }
    }

    setPeerConnected(connected) {
      const changed = (this.isPeerConnected !== connected);
      this.isPeerConnected = connected;
      if (changed) {
        this.updateStatus();
      }
    }

    updateStatus() {
      if (!this.onStatusChange) return;
      if (!this.roomId) {
        this.onStatusChange('disconnected');
      } else if (!this.isPeerConnected) {
        this.onStatusChange('waiting');
      } else {
        this.onStatusChange('connected');
      }
    }

    getShareableLink() {
      if (!this.roomId) return '';
      const url = new URL(window.location.href);
      url.searchParams.set('game', this.roomId);
      return url.toString();
    }

    disconnect(clearRoom = true) {
      this.stopHeartbeat();
      if (this.client && this.isBrokerConnected) {
        try {
          this.sendPacket({ type: 'leave' });
          this.client.disconnect();
        } catch (e) {}
      }
      this.client = null;
      this.isBrokerConnected = false;
      this.setPeerConnected(false);

      if (clearRoom) {
        this.roomId = null;
        this.isHost = false;
        this.myColor = null;
        this.assignedGuestColor = null;
        this.updateStatus();
      }
    }
  }

  window.ChessMultiplayer = ChessMultiplayer;
  window.chessMultiplayer = new ChessMultiplayer();
})();
