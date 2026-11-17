// render.js — Canvas 2D drawing: pre-rendered radial glow sprites (no per-frame
// shadowBlur), geometric enemies with distinct silhouettes, the player
// firefly boat, bullets, orbs, particles, shockwave rings and screen shake.
import { TAU } from './rng.js';
import { WORLD_W, WORLD_H } from './world.js';

const glowCache = new Map();

export function glowSprite(color, size = 128) {
  const key = color + ':' + size;
  let c = glowCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = size; c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, color);
  grad.addColorStop(0.35, color + 'cc');
  grad.addColorStop(1, color + '00');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  glowCache.set(key, c);
  return c;
}

function drawGlow(ctx, x, y, r, color, alpha = 1) {
  const s = glowSprite(color);
  ctx.globalAlpha = alpha;
  ctx.drawImage(s, x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

function poly(ctx, x, y, r, sides, rot) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * TAU;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function render(ctx, S, world) {
  ctx.save();
  if (S.shake > 0.2) {
    // deterministic wobble tied to game time, so frozen ?shot= frames are stable
    ctx.translate(
      Math.sin(S.time * 47) * S.shake * 0.5,
      Math.cos(S.time * 39) * S.shake * 0.5,
    );
  }
  world.draw(ctx, S.time);

  // lumen orbs
  for (const o of S.orbs) {
    const bob = Math.sin(o.t * 5) * 1.5;
    drawGlow(ctx, o.x, o.y + bob, 16, '#ffd76a', 0.8);
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath(); ctx.arc(o.x, o.y + bob, o.r, 0, TAU); ctx.fill();
  }

  // enemies
  for (const e of S.enemies) drawEnemy(ctx, e, S.time);

  // player
  const p = S.player;
  if (p && S.state !== 'over') drawPlayer(ctx, p, S.time);

  // bullets: tracer streak + hot core so fire reads at a glance
  for (const b of S.bullets) {
    ctx.strokeStyle = 'rgba(255,233,168,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.022, b.y - b.vy * 0.022);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    drawGlow(ctx, b.x, b.y, 16, '#ffe9a8', 0.9);
    ctx.fillStyle = '#fff6cf';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
  }
  for (const b of S.ebullets) {
    drawGlow(ctx, b.x, b.y, 16, '#37e0c8', 0.8);
    ctx.fillStyle = '#a9fff2';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
  }

  // particles
  for (const pt of S.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // shockwave rings: a soft filled energy disc plus the bright rim,
  // so a burst reads as a shockwave, not an empty wire circle
  for (const r of S.rings) {
    const fade = Math.max(0, r.life / r.maxLife);
    const g = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, Math.max(1, r.r));
    g.addColorStop(0, r.color + '30');
    g.addColorStop(0.75, r.color + '14');
    g.addColorStop(1, r.color + '00');
    ctx.globalAlpha = fade;
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(r.x, r.y, Math.max(1, r.r), 0, TAU); ctx.fill();
    ctx.globalAlpha = fade * 0.9;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(r.x, r.y, Math.max(1, r.r * 0.85), 0, TAU); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // floating texts
  ctx.textAlign = 'center';
  for (const t of S.texts) {
    ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
    ctx.font = 'bold ' + t.size + 'px sans-serif';
    ctx.fillStyle = t.color;
    ctx.fillText(t.str, t.x, t.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // hurt flash (screen space, after shake restore)
  if (S.flash > 0) {
    ctx.fillStyle = `rgba(255,40,60,${(S.flash * 0.55).toFixed(3)})`;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  }
}

function drawEnemy(ctx, e, time) {
  const flash = e.flash > 0;
  drawGlow(ctx, e.x, e.y, e.r * 2.6, e.color, e.charging ? 1 : 0.55);
  ctx.lineWidth = e.elite ? 3.5 : 2;
  ctx.strokeStyle = e.elite ? '#ffd76a' : e.color;
  ctx.fillStyle = flash ? '#ffffff' : e.color + '55';
  if (e.type === 'urchin') {
    // spiked triangle, pointing at the player
    poly(ctx, e.x, e.y, e.r, 3, e.angle || 0);
    ctx.fill(); ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const a = (e.angle || 0) + (i / 3) * TAU;
      ctx.beginPath();
      ctx.moveTo(e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r);
      ctx.lineTo(e.x + Math.cos(a) * (e.r + 9), e.y + Math.sin(a) * (e.r + 9));
      ctx.stroke();
    }
  } else if (e.type === 'jelly') {
    // dome + waving tentacles
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, Math.PI, 0);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    for (let i = -2; i <= 2; i++) {
      const x = e.x + i * (e.r / 2.6);
      const sway = Math.sin(time * 3 + e.wobble + i) * 5;
      ctx.moveTo(x, e.y + 2);
      ctx.quadraticCurveTo(x + sway, e.y + e.r * 0.8, x + sway * 1.4, e.y + e.r * 1.3);
    }
    ctx.stroke();
    ctx.fillStyle = '#eafffb';
    ctx.beginPath(); ctx.arc(e.x - 5, e.y - 4, 2.5, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(e.x + 5, e.y - 4, 2.5, 0, TAU); ctx.fill();
  } else if (e.type === 'eel') {
    // wavy body: a chain of segments trailing behind the head
    const segs = 5;
    for (let i = segs; i >= 0; i--) {
      const k = i / segs;
      const sway = Math.sin(time * 6 - i * 0.9 + e.wobble) * 7 * k;
      const px = e.x - Math.cos(e.angle) * i * 9 + Math.cos(e.angle + Math.PI / 2) * sway;
      const py = e.y - Math.sin(e.angle) * i * 9 + Math.sin(e.angle + Math.PI / 2) * sway;
      const rr = e.r * (1 - k * 0.55);
      ctx.beginPath(); ctx.arc(px, py, Math.max(2, rr), 0, TAU);
      ctx.fillStyle = flash ? '#ffffff' : e.color + (i === 0 ? 'cc' : '66');
      ctx.fill();
    }
    if (e.charging) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 6 + Math.sin(time * 20) * 3, 0, TAU); ctx.stroke();
    }
  } else { // mother: rotating hexagon with pulsing core
    poly(ctx, e.x, e.y, e.r, 6, e.angle);
    ctx.fill(); ctx.stroke();
    const pulse = 0.5 + 0.3 * Math.sin(time * 4 + e.wobble);
    drawGlow(ctx, e.x, e.y, e.r * pulse, '#ffb35c', 0.9);
    ctx.fillStyle = '#fff1d6';
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 0.32, 0, TAU); ctx.fill();
    for (let i = 0; i < 6; i++) {
      const a = e.angle + (i / 6) * TAU;
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(e.x + Math.cos(a) * e.r * 0.62, e.y + Math.sin(a) * e.r * 0.62, 3.5, 0, TAU);
      ctx.fill();
    }
  }
  // hp bar for tough enemies
  if (e.maxHp >= 60 || e.elite) {
    const w = e.r * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(e.x - w / 2, e.y - e.r - 12, w, 4);
    ctx.fillStyle = e.color;
    ctx.fillRect(e.x - w / 2, e.y - e.r - 12, w * Math.max(0, e.hp / e.maxHp), 4);
  }
}

function drawPlayer(ctx, p, time) {
  const blink = p.invuln > 0 && Math.floor(time * 14) % 2 === 0;
  if (blink) ctx.globalAlpha = 0.35;
  drawGlow(ctx, p.x, p.y, 46, '#ffd76a', 0.9);
  // hull: little firefly boat pointing along aim
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffdf8a';
  ctx.beginPath();
  ctx.moveTo(18, 0); ctx.lineTo(-10, -10); ctx.lineTo(-6, 0); ctx.lineTo(-10, 10);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#fff3c4';
  ctx.lineWidth = 2;
  ctx.stroke();
  // lantern
  ctx.fillStyle = '#fff8dc';
  ctx.beginPath(); ctx.arc(2, 0, 5, 0, TAU); ctx.fill();
  ctx.restore();
  // dash cooldown ring
  if (p.dashCd > 0) {
    ctx.strokeStyle = 'rgba(255,215,106,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 8, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - p.dashCd / p.dashCdMax));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
