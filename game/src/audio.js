// audio.js — all sound effects are synthesized with WebAudio, zero audio files.
// A tiny synth: short oscillator blips, filtered noise bursts and sweeps.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.combo = 0;
  }

  // Must be called from a user gesture at least once; safe to call anytime.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    } catch { /* audio unavailable: game stays silent */ }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.35;
  }

  _tone(freq, dur, type, vol, slideTo, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  _noise(dur, vol, cutoff, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = cutoff;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filt); filt.connect(g); g.connect(this.master);
    src.start(t0);
  }

  shoot() { this._tone(880 + this.combo * 30, 0.07, 'square', 0.10, 520); }
  hit() { this._tone(220, 0.05, 'triangle', 0.12, 140); }
  explode() {
    this._noise(0.35, 0.35, 900);
    this._tone(160, 0.3, 'sine', 0.30, 40);
  }
  pickup(combo) {
    const base = 660 * Math.pow(1.059, Math.min(combo, 12));
    this._tone(base, 0.08, 'sine', 0.14);
    this._tone(base * 1.5, 0.12, 'sine', 0.12, null, 0.06);
  }
  burst() {
    this._tone(90, 0.6, 'sine', 0.4, 30);
    this._noise(0.5, 0.25, 500);
  }
  hurt() {
    this._tone(110, 0.25, 'sawtooth', 0.25, 60);
    this._noise(0.15, 0.2, 400);
  }
  dash() { this._noise(0.22, 0.18, 2400); this._tone(300, 0.18, 'sine', 0.08, 900); }
  waveClear() {
    [523, 659, 784, 1047].forEach((f, i) => this._tone(f, 0.18, 'sine', 0.16, null, i * 0.09));
  }
  upgrade() {
    [392, 523, 659].forEach((f, i) => this._tone(f, 0.15, 'triangle', 0.15, null, i * 0.07));
  }
  gameOver() {
    [392, 330, 262, 196].forEach((f, i) => this._tone(f, 0.35, 'triangle', 0.18, null, i * 0.22));
  }
  click() { this._tone(700, 0.05, 'sine', 0.10); }
}
