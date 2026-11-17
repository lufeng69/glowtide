// world.js — the deep-sea arena: gradient water, drifting plankton motes,
// faint god-rays and a vignette. Background only; gameplay lives in entities.js.
import { TAU } from './rng.js';

export const WORLD_W = 1280;
export const WORLD_H = 720;

export class World {
  constructor(rng) {
    this.rng = rng;
    this.motes = [];
    for (let i = 0; i < 170; i++) {
      this.motes.push({
        x: rng.range(0, WORLD_W), y: rng.range(0, WORLD_H),
        r: rng.range(0.6, 3.2), speed: rng.range(4, 16),
        drift: rng.range(-6, 6), phase: rng.range(0, TAU),
        hue: rng.pick(['#7dd8ff', '#9ff5e0', '#ffd76a', '#c9b8ff']),
      });
    }
    // distant bioluminescent blooms: huge soft glows drifting far below,
    // they give the water column depth instead of flat navy.
    // Each bloom is pre-rendered once to an offscreen sprite (like the
    // glow sprites in render.js) so frames stay cheap.
    this.blooms = [];
    const bloomHues = ['#1d6f8e', '#1a7a6a', '#7a5fb0', '#8e6a1d', '#1d5f8e'];
    for (let i = 0; i < 5; i++) {
      const r = rng.range(130, 260);
      const hue = bloomHues[i % bloomHues.length];
      const c = document.createElement('canvas');
      c.width = r * 2; c.height = r * 2;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(r, r, 0, r, r, r);
      grad.addColorStop(0, hue + '2e');
      grad.addColorStop(1, hue + '00');
      g.fillStyle = grad;
      g.fillRect(0, 0, r * 2, r * 2);
      this.blooms.push({
        x: rng.range(80, WORLD_W - 80), y: rng.range(90, WORLD_H - 120),
        r, speed: rng.range(3, 8),
        phase: rng.range(0, TAU), hue, sprite: c,
      });
    }
    // seabed ridge: precomputed wavy silhouette along the bottom, with
    // tiny glowing anemone dots on its crest
    this.ridge = [];
    let ry = WORLD_H - rng.range(46, 70);
    for (let x = -20; x <= WORLD_W + 20; x += 40) {
      ry += rng.range(-14, 14);
      ry = Math.max(WORLD_H - 110, Math.min(WORLD_H - 30, ry));
      this.ridge.push({ x, y: ry });
    }
    this.anemones = [];
    for (let i = 0; i < 26; i++) {
      const rp = this.ridge[Math.floor(rng.range(0, this.ridge.length))];
      this.anemones.push({
        x: rp.x + rng.range(-16, 16), y: rp.y - rng.range(2, 10),
        r: rng.range(1.2, 2.6), phase: rng.range(0, TAU),
        hue: rng.pick(['#7df9ff', '#ffd76a', '#ff8fd0', '#9ff5e0']),
      });
    }
    this.rays = [];
    for (let i = 0; i < 6; i++) {
      this.rays.push({ x: rng.range(100, 1180), w: rng.range(40, 110), a: rng.range(0.03, 0.06), phase: rng.range(0, TAU) });
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
    for (const b of this.blooms) {
      b.y -= b.speed * dt;
      b.x += Math.sin(time * 0.2 + b.phase) * 6 * dt;
      if (b.y < -b.r) { b.y = WORLD_H + b.r; b.x = this.rng.range(80, WORLD_W - 80); }
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
      v.addColorStop(1, 'rgba(0,0,0,0.42)');
      this._vig = v;
    }
    ctx.fillStyle = this._bg;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    // distant blooms: big soft additive glows so the water has depth
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.blooms) {
      const pulse = 0.05 + 0.03 * Math.sin(time * 0.4 + b.phase);
      ctx.globalAlpha = pulse / 0.08;
      ctx.drawImage(b.sprite, b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
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
    // seabed ridge + glowing anemones along its crest
    ctx.fillStyle = '#020a16';
    ctx.beginPath();
    ctx.moveTo(-20, WORLD_H + 20);
    ctx.lineTo(-20, this.ridge[0].y);
    for (const p of this.ridge) ctx.lineTo(p.x, p.y);
    ctx.lineTo(WORLD_W + 20, this.ridge[this.ridge.length - 1].y);
    ctx.lineTo(WORLD_W + 20, WORLD_H + 20);
    ctx.closePath(); ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const a of this.anemones) {
      const tw = 0.35 + 0.35 * Math.sin(time * 1.8 + a.phase);
      ctx.globalAlpha = tw;
      ctx.fillStyle = a.hue;
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    // vignette
    ctx.fillStyle = this._vig;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  }
}
