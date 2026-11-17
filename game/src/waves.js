// waves.js — wave director (composition per wave, spawn pacing, clear check)
// and the 8-card upgrade pool offered three-at-a-time after each wave.
import { spawnAtEdge } from './entities.js';

export const UPGRADES = [
  { id: 'fire', name: '急速光弹', desc: '射速 +25%', apply: (p) => { p.fireRate *= 1.25; } },
  { id: 'dmg', name: '聚光核心', desc: '伤害 +30%', apply: (p) => { p.damage *= 1.3; } },
  { id: 'speed', name: '洋流之翼', desc: '移速 +15%', apply: (p) => { p.speed *= 1.15; } },
  { id: 'hp', name: '深潜外壳', desc: '最大血量 +25，并恢复 25', apply: (p) => { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); } },
  { id: 'dash', name: '潮汐滑行', desc: '冲刺冷却 −30%', apply: (p) => { p.dashCdMax *= 0.7; } },
  { id: 'multi', name: '分光棱镜', desc: '多重射击 +1 发', apply: (p) => { p.multishot += 1; } },
  { id: 'lumen', name: '萤光虹吸', desc: '光能获取 +50%', apply: (p) => { p.lumenGain *= 1.5; } },
  { id: 'magnet', name: '引力潮汐', desc: '光珠吸附半径 +60%', apply: (p) => { p.magnet *= 1.6; } },
];

export function pickUpgrades(rng, n = 3) {
  return rng.shuffle(UPGRADES).slice(0, n);
}

// Wave composition: returns a spawn list of {type, elite} in order.
export function buildWave(wave) {
  const list = [];
  const push = (type, count, elite = false) => {
    for (let i = 0; i < count; i++) list.push({ type, elite });
  };
  const urchins = 6 + (wave - 1) * 3;
  push('urchin', urchins);
  if (wave >= 2) push('jelly', 1 + Math.floor(wave / 2));
  if (wave >= 3) push('eel', 1 + Math.floor((wave - 1) / 2));
  if (wave >= 4) push('mother', Math.floor((wave - 2) / 2));
  if (wave >= 5) {
    const elites = Math.min(3, Math.floor((wave - 3) / 2));
    // mark some of the queued enemies elite (deterministic-ish spread)
    for (let i = 0; i < elites && list.length > 0; i++) {
      list[list.length - 1 - i * 4].elite = true;
    }
  }
  return list;
}

export function startWave(S, wave) {
  S.wave = wave;
  S.spawnQueue = buildWave(wave);
  // shuffle spawn order so kinds mix instead of arriving in blocks
  S.spawnQueue = S.rng.shuffle(S.spawnQueue);
  S.spawnTimer = 0.4;
  S.waveActive = true;
  S.banner = 'WAVE ' + wave;
  S.bannerT = 2.2;
}

export function updateWaves(S, dt) {
  if (!S.waveActive) return;
  if (S.spawnQueue.length > 0) {
    S.spawnTimer -= dt;
    if (S.spawnTimer <= 0) {
      // spawn in small bursts; later waves come faster
      const burst = S.wave >= 4 ? 2 : 1;
      for (let i = 0; i < burst && S.spawnQueue.length > 0; i++) {
        const s = S.spawnQueue.shift();
        spawnAtEdge(S, s.type, s.elite);
      }
      S.spawnTimer = Math.max(0.35, 1.1 - S.wave * 0.06);
    }
  } else if (S.enemies.length === 0) {
    S.waveActive = false;
    return 'clear';
  }
  return null;
}
