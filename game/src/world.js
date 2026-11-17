// world.js — the deep-sea arena: gradient water, drifting plankton motes,
// faint god-rays and a vignette. Background only; gameplay lives in entities.js.
import { TAU } from './rng.js';

export const WORLD_W = 1280;
export const WORLD_H = 720;

export class World {
  constructor(rng) {
    this.rng = rng;
    this.motes = [];
    for (let i = 0; i < 90; i++) {
      this.motes.push({
        x: rng.range(0, WORLD_W), y: rng.range(0, WORLD_H),
        r: rng.range(0.6, 2.4), speed: rng.range(4, 16),
        drift: rng.range(-6, 6), phase: rng.range(0, TAU),
        hue: rng.pick(['#7dd8ff', '#9ff5e0', '#ffd76a', '#c9b8ff']),
      });
    }
    this.rays = [];
    for (let i = 0; i < 5; i++) {
      this.rays.push({ x: rng.range(100, 1180), w: rng.range(40, 110), a: rng.range(0.02, 0.05), phase: rng.range(0, TAU) });
    }
    this._bg = null; // cached gradient, built lazily against a canvas
    this._vig = null;
  }

  update(dt, time) {
    for (const m of this.motes) {
      m.y -= m.speed * dt;
      m.x += m.drift * dt + Math.sin(time * 0.5 + m.phase) * 4 * dt;
      if (m.y < -4) { m.y = WORLD_H + 4; m.x = this.rng.range(0, WORLD_W); }
      if (m.x < -4) m.x = WORLD_W + 4;
      if (m.x > WORLD_W + 4) m.x = -4;
    }
  }

  draw(ctx, time) {
    if (!this._bg) {
      const g = ctx.createLinearGradient(0, 0, 0, WORLD_H);
      g.addColorStop(0, '#071a2e');
      g.addColorStop(0.5, '#04101f');
      g.addColorStop(1, '#020a16');
      this._bg = g;
      const v = ctx.createRadialGradient(640, 360, 260, 640, 360, 780);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(0,0,0,0.55)');
      this._vig = v;
    }
    ctx.fillStyle = this._bg;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    // faint god-rays from the surface
    ctx.save();
    for (const r of this.rays) {
      const a = r.a * (0.7 + 0.3 * Math.sin(time * 0.3 + r.phase));
      const g = ctx.createLinearGradient(r.x, 0, r.x, WORLD_H);
      g.addColorStop(0, `rgba(140,220,255,${a})`);
      g.addColorStop(1, 'rgba(140,220,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(r.x - r.w / 2, 0);
      ctx.lineTo(r.x + r.w / 2, 0);
      ctx.lineTo(r.x + r.w, WORLD_H);
      ctx.lineTo(r.x - r.w, WORLD_H);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // drifting plankton motes
    for (const m of this.motes) {
      const tw = 0.35 + 0.3 * Math.sin(time * 1.4 + m.phase);
      ctx.globalAlpha = tw;
      ctx.fillStyle = m.hue;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // vignette
    ctx.fillStyle = this._vig;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  }
}
