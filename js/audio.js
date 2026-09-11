// Subtle Web Audio API Procedural Sound Effects
// Realistic wooden chess sounds with zero external dependencies

class ChessAudio {
  constructor() {
    this.ctx = null;
    this.muted = (typeof localStorage !== 'undefined' && localStorage.getItem('minimal_chess_muted') === 'true');
  }

  initContext() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('minimal_chess_muted', this.muted);
    }
    return this.muted;
  }

  isMuted() {
    return this.muted;
  }

  // Soft wooden move sound
  playMove() {
    if (this.muted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, this.ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.08);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(45, this.ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.085);
    } catch (e) {}
  }

  // Crisp wooden capture sound
  playCapture() {
    if (this.muted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, this.ctx.currentTime);
      filter.Q.setValueAtTime(2, this.ctx.currentTime);

      osc.type = 'square';
      osc.frequency.setValueAtTime(320, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(70, this.ctx.currentTime + 0.09);

      gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.09);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.095);
    } catch (e) {}
  }

  // Subtle check warning tone
  playCheck() {
    if (this.muted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      [440, 554].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const t = this.ctx.currentTime + i * 0.07;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t);
        osc.stop(t + 0.22);
      });
    } catch (e) {}
  }

  // Gentle victory chime on checkmate
  playVictory() {
    if (this.muted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const notes = [392, 523.25, 659.25, 783.99]; // G4, C5, E5, G5
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const t = this.ctx.currentTime + idx * 0.08;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t);
        osc.stop(t + 0.5);
      });
    } catch (e) {}
  }

  // Soft procedural clock tick (< 10s warning)
  playTick() {
    if (this.muted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.025);

      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.025);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.028);
    } catch (e) {}
  }

  // Gentle timeout chime when clock expires
  playTimeout() {
    if (this.muted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const tones = [330, 220]; // E4 down to A3
      tones.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const t = this.ctx.currentTime + idx * 0.15;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t);
        osc.stop(t + 0.35);
      });
    } catch (e) {}
  }
}

// Minimal, clean tactile haptic feedback system
class ChessHaptics {
  constructor() {
    this.enabled = true;
  }

  isSupported() {
    return typeof window !== 'undefined' && typeof window.navigator !== 'undefined' && typeof window.navigator.vibrate === 'function';
  }

  vibrate(pattern) {
    if (!this.enabled || !this.isSupported()) return;
    try {
      window.navigator.vibrate(pattern);
    } catch (e) {}
  }

  // 1. Move: ultra-clean, crisp micro-tap (feels like a precise mechanical switch)
  move() {
    this.vibrate(12);
  }

  // 2. Capture: firmer distinct double-tap
  capture() {
    this.vibrate([18, 25, 18]);
  }

  // 3. Check: sharper warning pulse
  check() {
    this.vibrate([25, 35, 25]);
  }

  // 4. Greater haptic feedback for the last 10 seconds of timer (urgent tactile heartbeat)
  countdownTick() {
    this.vibrate(45);
  }

  // 5. Timeout / Game over
  timeout() {
    this.vibrate([50, 40, 80]);
  }

  // 6. UI interaction / Pill / Button tap
  tap() {
    this.vibrate(8);
  }
}

var chessAudio = new ChessAudio();
var chessHaptics = new ChessHaptics();

if (typeof window !== 'undefined') {
  window.ChessAudio = ChessAudio;
  window.chessAudio = chessAudio;
  window.ChessHaptics = ChessHaptics;
  window.chessHaptics = chessHaptics;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ChessAudio, chessAudio, ChessHaptics, chessHaptics };
}
