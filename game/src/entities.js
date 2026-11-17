// entities.js — player, 4 enemy kinds, bullets, lumen orbs, particles and
// floating text. Enemies are plain objects in state arrays; particles and
// floating texts recycle through free-lists so the hot loop allocates nothing.
import { TAU, clamp, dist2, angleTo } from './rng.js';
import { WORLD_W, WORLD_H } from './world.js';

export const ENEMY_TYPES = {
  urchin: { name: '刺胆', r: 16, hp: 20, speed: 72, score: 50, orbs: 1, color: '#ff4d8d', contact: 10 },
  jelly:  { name: '水母', r: 18, hp: 30, speed: 42, score: 80, orbs: 2, color: '#37e0c8', contact: 12 },
  eel:    { name: '电鳗', r: 14, hp: 25, speed: 58, score: 100, orbs: 2, color: '#a78bfa', contact: 12 },
  mother: { name: '孢子母体', r: 30, hp: 95, speed: 28, score: 200, orbs: 3, color: '#ff9f43', contact: 16 },
};

export function createState(rng) {
  return {
    rng, time: 0, state: 'title', wave: 0, score: 0, kills: 0,
    combo: 0, comboTimer: 0, maxCombo: 0, best: 0,
    player: null, enemies: [], bullets: [], ebullets: [], orbs: [],
    particles: [], texts: [], rings: [],
    particleFree: [], textFree: [],
    spawnQueue: [], spawnTimer: 0, waveActive: false,
    shake: 0, flash: 0, banner: '', bannerT: 0,
    stats: { shots: 0, hits: 0 },
  };
}

export function resetRun(S) {
  const p = {
    x: WORLD_W / 2, y: WORLD_H / 2 + 60, vx: 0, vy: 0, r: 14, angle: -Math.PI / 2,
    hp: 100, maxHp: 100, speed: 265, fireRate: 7, damage: 12, multishot: 1,
    magnet: 95, lumenGain: 1, dashCdMax: 2.5,
    energy: 0, dashCd: 0, dashT: 0, invuln: 0, fireCd: 0, trailT: 0,
  };
  S.player = p;
  S.enemies.length = 0; S.bullets.length = 0; S.ebullets.length = 0;
  S.orbs.length = 0; S.particles.length = 0; S.texts.length = 0; S.rings.length = 0;
  S.spawnQueue.length = 0;
  S.wave = 0; S.score = 0; S.kills = 0; S.combo = 0; S.comboTimer = 0; S.maxCombo = 0;
  S.shake = 0; S.flash = 0; S.waveActive = false; S.spawnTimer = 0;
  S.stats = { shots: 0, hits: 0 };
}

export function spawnEnemy(S, type, elite, x, y) {
  const t = ENEMY_TYPES[type];
  const hpMul = elite ? 3 : 1;
  const e = {
    type, x, y, vx: 0, vy: 0, r: t.r * (elite ? 1.5 : 1),
    hp: t.hp * hpMul, maxHp: t.hp * hpMul, speed: t.speed * S.rng.range(0.9, 1.1),
    score: t.score * (elite ? 3 : 1), orbs: t.orbs + (elite ? 4 : 0),
    color: t.color, contact: t.contact * (elite ? 1.5 : 1), elite,
    angle: S.rng.range(0, TAU), t: S.rng.range(0, 2), shootCd: S.rng.range(1.2, 2.5),
    chargeT: 0, charging: false, wobble: S.rng.range(0, TAU), flash: 0,
  };
  S.enemies.push(e);
  return e;
}

export function spawnAtEdge(S, type, elite) {
  const m = 30;
  const side = S.rng.int(0, 3);
  let x, y;
  if (side === 0) { x = S.rng.range(0, WORLD_W); y = -m; }
  else if (side === 1) { x = WORLD_W + m; y = S.rng.range(0, WORLD_H); }
  else if (side === 2) { x = S.rng.range(0, WORLD_W); y = WORLD_H + m; }
  else { x = -m; y = S.rng.range(0, WORLD_H); }
  return spawnEnemy(S, type, elite, x, y);
}

// ---- particles / floating text (pooled) ----
export function spawnExplosion(S, x, y, color, n, speed = 160) {
  for (let i = 0; i < n; i++) {
    const p = S.particleFree.pop() || {};
    const a = S.rng.range(0, TAU);
    const sp = S.rng.range(speed * 0.3, speed);
    p.x = x; p.y = y; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
    p.life = S.rng.range(0.35, 0.8); p.maxLife = p.life;
    p.r = S.rng.range(2, 5); p.color = color;
    S.particles.push(p);
  }
}

export function addText(S, x, y, str, color, size = 15) {
  const t = S.textFree.pop() || {};
  t.x = x; t.y = y; t.str = str; t.color = color; t.size = size;
  t.life = 0.9; t.maxLife = 0.9;
  S.texts.push(t);
}

export function addRing(S, x, y, color, maxR) {
  S.rings.push({ x, y, color, r: 10, maxR, life: 0.5, maxLife: 0.5 });
}

export function dropOrbs(S, x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = S.rng.range(0, TAU);
    S.orbs.push({
      x, y, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60,
      r: 6, t: S.rng.range(0, TAU), value: 1,
    });
  }
}

// ---- combat ----
export function comboMult(S) { return Math.min(8, 1 + S.combo); }

export function hurtEnemy(S, e, dmg, angle) {
  e.hp -= dmg;
  e.flash = 0.12;
  S.stats.hits++;
  addText(S, e.x + S.rng.range(-8, 8), e.y - e.r, String(Math.round(dmg)), '#ffe9a8', 14);
  spawnExplosion(S, e.x, e.y, e.color, 3, 90);
  if (e.hp <= 0) killEnemy(S, e, angle);
}

export function killEnemy(S, e, angle) {
  const idx = S.enemies.indexOf(e);
  if (idx === -1) return;
  S.enemies.splice(idx, 1);
  S.kills++;
  S.combo++;
  S.comboTimer = 3;
  if (S.combo > S.maxCombo) S.maxCombo = S.combo;
  const gained = e.score * comboMult(S);
  S.score += gained;
  addText(S, e.x, e.y - e.r - 8, '+' + gained, '#ffd76a', 17);
  spawnExplosion(S, e.x, e.y, e.color, e.elite ? 26 : 14, e.elite ? 240 : 170);
  addRing(S, e.x, e.y, e.color, e.r + 26);
  dropOrbs(S, e.x, e.y, e.orbs);
  if (e.type === 'mother') {
    // split into 3 small urchins
    for (let i = 0; i < 3; i++) {
      const a = angle + (i - 1) * 0.9;
      const child = spawnEnemy(S, 'urchin', false,
        clamp(e.x + Math.cos(a) * 26, 20, WORLD_W - 20),
        clamp(e.y + Math.sin(a) * 26, 20, WORLD_H - 20));
      child.r = 11; child.hp = 12; child.maxHp = 12; child.score = 25;
      child.vx = Math.cos(a) * 140; child.vy = Math.sin(a) * 140;
    }
  }
  if (S.shake < 6) S.shake = Math.min(9, S.shake + (e.elite ? 5 : 2));
}

export function damagePlayer(S, dmg, srcX, srcY) {
  const p = S.player;
  if (!p || p.invuln > 0 || p.dashT > 0 || S.state !== 'playing') return;
  p.hp -= dmg;
  p.invuln = 0.8;
  S.flash = 0.35;
  S.shake = 10;
  S.combo = 0; S.comboTimer = 0;
  spawnExplosion(S, p.x, p.y, '#ff5d5d', 12, 180);
  if (p.hp <= 0) {
    p.hp = 0;
    S.state = 'over';
    spawnExplosion(S, p.x, p.y, '#ffd76a', 40, 260);
    spawnExplosion(S, p.x, p.y, '#ff5d5d', 30, 200);
    addRing(S, p.x, p.y, '#ffd76a', 220);
  }
}

export function fireBullets(S, aimX, aimY, sound) {
  const p = S.player;
  const n = p.multishot;
  const base = Math.atan2(aimY - p.y, aimX - p.x);
  p.angle = base;
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * 0.14;
    const a = base + off;
    S.bullets.push({
      x: p.x + Math.cos(a) * (p.r + 6), y: p.y + Math.sin(a) * (p.r + 6),
      vx: Math.cos(a) * 620, vy: Math.sin(a) * 620, r: 5, dmg: p.damage,
    });
  }
  S.stats.shots++;
  if (sound) sound.shoot();
}

export function tideBurst(S, sound) {
  const p = S.player;
  if (!p || p.energy < 100 || S.state !== 'playing') return false;
  p.energy = 0;
  addRing(S, p.x, p.y, '#7df9ff', 240);
  addRing(S, p.x, p.y, '#ffd76a', 190);
  S.shake = 12;
  spawnExplosion(S, p.x, p.y, '#7df9ff', 30, 300);
  const R = 190;
  for (let i = S.enemies.length - 1; i >= 0; i--) {
    const e = S.enemies[i];
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < R) {
      hurtEnemy(S, e, 60, 0);
    } else if (d < R + 140) {
      const a = angleTo(p.x, p.y, e.x, e.y);
      e.vx += Math.cos(a) * 420; e.vy += Math.sin(a) * 420;
    }
  }
  if (sound) sound.burst();
  return true;
}

// ---- per-frame updates ----
export function updatePlayer(S, dt, input, sound) {
  const p = S.player;
  if (!p) return;
  const mx = input.moveX(), my = input.moveY();
  const len = Math.hypot(mx, my) || 1;
  const accel = p.dashT > 0 ? 0 : 2400;
  p.vx += (mx / len) * accel * dt;
  p.vy += (my / len) * accel * dt;
  const drag = p.dashT > 0 ? 0.4 : 5.2;
  p.vx -= p.vx * drag * dt;
  p.vy -= p.vy * drag * dt;
  const sp = Math.hypot(p.vx, p.vy);
  const maxSp = p.dashT > 0 ? 780 : p.speed;
  if (sp > maxSp) { p.vx *= maxSp / sp; p.vy *= maxSp / sp; }
  p.x = clamp(p.x + p.vx * dt, p.r, WORLD_W - p.r);
  p.y = clamp(p.y + p.vy * dt, p.r, WORLD_H - p.r);
  p.angle = Math.atan2(input.mouseY - p.y, input.mouseX - p.x);
  if (p.invuln > 0) p.invuln -= dt;
  if (p.dashCd > 0) p.dashCd -= dt;
  if (p.dashT > 0) {
    p.dashT -= dt;
    p.trailT -= dt;
    if (p.trailT <= 0) {
      p.trailT = 0.03;
      spawnExplosion(S, p.x, p.y, '#ffd76a', 1, 20);
    }
  }
  // dash
  if (input.dash && p.dashCd <= 0 && (mx !== 0 || my !== 0)) {
    p.dashT = 0.35; p.dashCd = p.dashCdMax; p.invuln = Math.max(p.invuln, 0.4);
    p.vx = (mx / len) * 780; p.vy = (my / len) * 780;
    if (sound) sound.dash();
  }
  // fire
  p.fireCd -= dt;
  if (input.mouseDown && p.fireCd <= 0) {
    p.fireCd = 1 / p.fireRate;
    fireBullets(S, input.mouseX, input.mouseY, sound);
  }
}

export function updateEnemies(S, dt, sound) {
  const p = S.player;
  const dmgMul = S.wave >= 6 ? 1.25 : 1;
  for (let i = S.enemies.length - 1; i >= 0; i--) {
    const e = S.enemies[i];
    e.t += dt;
    if (e.flash > 0) e.flash -= dt;
    const d = Math.hypot(p.x - e.x, p.y - e.y) || 1;
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    if (e.type === 'urchin') {
      e.vx += (Math.cos(a) * e.speed - e.vx) * Math.min(1, 3 * dt);
      e.vy += (Math.sin(a) * e.speed - e.vy) * Math.min(1, 3 * dt);
    } else if (e.type === 'jelly') {
      const wob = Math.sin(e.t * 2 + e.wobble) * 0.6;
      e.vx += (Math.cos(a + wob) * e.speed - e.vx) * Math.min(1, 2 * dt);
      e.vy += (Math.sin(a + wob) * e.speed - e.vy) * Math.min(1, 2 * dt);
      e.shootCd -= dt;
      if (e.shootCd <= 0 && d < 520) {
        e.shootCd = 2.4;
        S.ebullets.push({
          x: e.x, y: e.y, vx: Math.cos(a) * 130, vy: Math.sin(a) * 130,
          r: 6, dmg: 8 * dmgMul,
        });
        spawnExplosion(S, e.x, e.y, e.color, 3, 60);
      }
    } else if (e.type === 'eel') {
      if (e.charging) {
        e.chargeT -= dt;
        if (e.chargeT <= 0) {
          e.charging = false;
          e.vx = Math.cos(e.angle) * 520; e.vy = Math.sin(e.angle) * 520;
        }
      } else {
        // circle near the player, then telegraph and lunge
        const orbit = a + Math.PI / 2;
        const want = d > 190 ? a : orbit;
        e.vx += (Math.cos(want) * e.speed - e.vx) * Math.min(1, 2.5 * dt);
        e.vy += (Math.sin(want) * e.speed - e.vy) * Math.min(1, 2.5 * dt);
        if (d < 260 && S.rng.chance(dt * 0.55)) {
          e.charging = true; e.chargeT = 0.6; e.angle = a;
          e.vx *= 0.15; e.vy *= 0.15;
        }
      }
    } else { // mother: slow drift, slight spin
      e.vx += (Math.cos(a) * e.speed - e.vx) * Math.min(1, 1.5 * dt);
      e.vy += (Math.sin(a) * e.speed - e.vy) * Math.min(1, 1.5 * dt);
      e.angle += dt * 0.5;
    }
    // velocity decay for knockback
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.x = clamp(e.x, -60, WORLD_W + 60);
    e.y = clamp(e.y, -60, WORLD_H + 60);
    // separation between enemies (cheap n^2, counts are small)
    for (let j = i + 1; j < S.enemies.length; j++) {
      const o = S.enemies[j];
      const dx = o.x - e.x, dy = o.y - e.y;
      const dd = dx * dx + dy * dy;
      const min = e.r + o.r;
      if (dd > 0.01 && dd < min * min) {
        const dist = Math.sqrt(dd);
        const push = (min - dist) / dist * 0.5;
        e.x -= dx * push * 0.5; e.y -= dy * push * 0.5;
        o.x += dx * push * 0.5; o.y += dy * push * 0.5;
      }
    }
    // contact damage
    if (d < e.r + p.r + 2) damagePlayer(S, Math.round(e.contact * dmgMul), e.x, e.y);
  }
}

export function updateBullets(S, dt, sound) {
  for (let i = S.bullets.length - 1; i >= 0; i--) {
    const b = S.bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt;
    let dead = b.x < -20 || b.x > WORLD_W + 20 || b.y < -20 || b.y > WORLD_H + 20;
    if (!dead) {
      for (let j = S.enemies.length - 1; j >= 0; j--) {
        const e = S.enemies[j];
        const rr = e.r + b.r;
        if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
          dead = true;
          hurtEnemy(S, e, b.dmg, Math.atan2(b.vy, b.vx));
          if (sound) sound.hit();
          break;
        }
      }
    }
    if (dead) S.bullets.splice(i, 1);
  }
  const p = S.player;
  for (let i = S.ebullets.length - 1; i >= 0; i--) {
    const b = S.ebullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt;
    let dead = b.x < -20 || b.x > WORLD_W + 20 || b.y < -20 || b.y > WORLD_H + 20;
    if (!dead && p) {
      const rr = p.r + b.r;
      if (dist2(b.x, b.y, p.x, p.y) < rr * rr) {
        dead = true;
        damagePlayer(S, b.dmg, b.x, b.y);
        if (sound) sound.hurt();
      }
    }
    if (dead) S.ebullets.splice(i, 1);
  }
}

export function updateOrbs(S, dt, sound) {
  const p = S.player;
  for (let i = S.orbs.length - 1; i >= 0; i--) {
    const o = S.orbs[i];
    o.t += dt;
    o.vx -= o.vx * 3 * dt; o.vy -= o.vy * 3 * dt;
    if (p) {
      const dx = p.x - o.x, dy = p.y - o.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < p.magnet) {
        o.vx += (dx / d) * 900 * dt;
        o.vy += (dy / d) * 900 * dt;
      }
      if (d < p.r + o.r + 4) {
        S.orbs.splice(i, 1);
        p.energy = clamp(p.energy + 8 * p.lumenGain, 0, 100);
        if (sound) sound.pickup(S.combo);
        continue;
      }
    }
    o.x += o.vx * dt; o.y += o.vy * dt;
  }
}

export function updateFx(S, dt) {
  for (let i = S.particles.length - 1; i >= 0; i--) {
    const p = S.particles[i];
    p.life -= dt;
    if (p.life <= 0) { S.particleFree.push(p); S.particles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx -= p.vx * 2.5 * dt; p.vy -= p.vy * 2.5 * dt;
  }
  for (let i = S.texts.length - 1; i >= 0; i--) {
    const t = S.texts[i];
    t.life -= dt;
    t.y -= 34 * dt;
    if (t.life <= 0) { S.textFree.push(t); S.texts.splice(i, 1); }
  }
  for (let i = S.rings.length - 1; i >= 0; i--) {
    const r = S.rings[i];
    r.life -= dt;
    const k = 1 - r.life / r.maxLife;
    r.r = 10 + (r.maxR - 10) * k;
    if (r.life <= 0) S.rings.splice(i, 1);
  }
  if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 26);
  if (S.flash > 0) S.flash -= dt;
  if (S.bannerT > 0) S.bannerT -= dt;
  if (S.comboTimer > 0) {
    S.comboTimer -= dt;
    if (S.comboTimer <= 0) S.combo = 0;
  }
}
