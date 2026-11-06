const assert = require('assert');
global.window = global;
global.WebSocket = WebSocket;
global.location = { href: 'http://localhost:8080/index.html' };
const storage = {};
global.localStorage = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => storage[k] = String(v),
  removeItem: (k) => delete storage[k],
  clear: () => {}
};

// Load Paho MQTT
require('../js/paho-mqtt.min.js');
// Load Multiplayer Module
require('../js/multiplayer.js');

console.log('--- Running Multiplayer & P2P Synchronization Tests ---');

// 1. Test Room Creation & Colors & Custom Timer
{
  const mp = new ChessMultiplayer();
  const roomId = mp.createRoom('w', { w: 600, b: 600 });
  assert.strictEqual(typeof roomId, 'string');
  assert.strictEqual(roomId.length, 6);
  assert.strictEqual(mp.myColor, 'w');
  assert.strictEqual(mp.assignedGuestColor, 'b');
  assert.strictEqual(mp.isHost, true);
  assert.deepStrictEqual(mp.timeSettings, { w: 600, b: 600 });
  mp.disconnect();
  console.log('✓ Room creation, Host White assignment & Custom 10m timer verified');

  const mpCustom = new ChessMultiplayer();
  mpCustom.createRoom('random', { w: 300, b: 300 });
  assert.deepStrictEqual(mpCustom.timeSettings, { w: 300, b: 300 });
  mpCustom.disconnect();
  console.log('✓ Room creation & Custom 5m stepper timer verified');

  const mpBlack = new ChessMultiplayer();
  mpBlack.createRoom('b');
  assert.strictEqual(mpBlack.myColor, 'b');
  assert.strictEqual(mpBlack.assignedGuestColor, 'w');
  assert.deepStrictEqual(mpBlack.timeSettings, { w: 'infinite', b: 'infinite' });
  mpBlack.disconnect();
  console.log('✓ Room creation & Host Black assignment verified');

  const mpRandom = new ChessMultiplayer();
  mpRandom.createRoom('random');
  assert.ok(mpRandom.myColor === 'w' || mpRandom.myColor === 'b');
  assert.notStrictEqual(mpRandom.myColor, mpRandom.assignedGuestColor);
  mpRandom.disconnect();
  console.log('✓ Room creation & Random assignment verified');
}

// 2. Test Live 2-Player Message & Connection Flow over Broker
async function testTwoPlayerSync() {
  const host = new ChessMultiplayer();
  const guest = new ChessMultiplayer();

  const testRoomId = 'test_' + Math.random().toString(36).substring(2, 8);
  host.roomId = testRoomId;
  host.isHost = true;
  host.myColor = 'w';
  host.assignedGuestColor = 'b';
  host.timeSettings = { w: 180, b: 180 };

  let hostConnected = false;
  let guestConnected = false;
  let guestReceivedTimeSettings = null;
  let moveReceivedByGuest = null;
  let moveReceivedByHost = null;

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Multiplayer broker test timed out'));
    }, 12000);

    host.onStatusChange = (status) => {
      if (status === 'connected') {
        hostConnected = true;
        console.log('✓ Host detected peer connection (DOT TURNS GREEN on Host!)');
        // Host makes move e2 -> e4
        setTimeout(() => {
          host.sendMove({ from: 'e2', to: 'e4' }, 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', { w: 180, b: 180 });
        }, 300);
      }
    };

    guest.onPeerJoin = (data) => {
      guestReceivedTimeSettings = data.timeSettings;
      console.log('✓ Guest received synchronized time settings from Host:', data.timeSettings);
    };

    guest.onStatusChange = (status) => {
      if (status === 'connected') {
        guestConnected = true;
        console.log('✓ Guest detected peer connection (DOT TURNS GREEN on Guest!)');
      }
    };

    guest.onMoveReceived = (data) => {
      moveReceivedByGuest = data.move;
      console.log('✓ Guest received move from Host:', data.move);
      assert.deepStrictEqual(data.move, { from: 'e2', to: 'e4' });
      // Guest responds with e7 -> e5
      setTimeout(() => {
        guest.sendMove({ from: 'e7', to: 'e5' }, 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2', { w: 180, b: 178 });
      }, 300);
    };

    host.onMoveReceived = (data) => {
      moveReceivedByHost = data.move;
      console.log('✓ Host received move from Guest:', data.move);
      assert.deepStrictEqual(data.move, { from: 'e7', to: 'e5' });

      clearTimeout(timeout);
      host.disconnect();
      guest.disconnect();
      resolve();
    };

    // Host connects first
    host.connect();
    setTimeout(() => {
      // Guest joins room
      guest.joinRoom(testRoomId);
    }, 600);
  });

  assert.strictEqual(hostConnected, true, 'Host should be connected to peer');
  assert.strictEqual(guestConnected, true, 'Guest should be connected to peer');
  assert.deepStrictEqual(guestReceivedTimeSettings, { w: 180, b: 180 }, 'Guest must receive host synchronized time control');
  console.log('✓ Bidirectional move exchange and real-time synchronization verified!');
}

testTwoPlayerSync().then(() => {
  console.log('--- ALL MULTIPLAYER TESTS PASSED SUCCESSFULLY! ---');
  process.exit(0);
}).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
