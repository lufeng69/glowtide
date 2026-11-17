// main.js — GLOWTIDE: a 2D bioluminescent deep-sea arena survival game.
// You are a little firefly boat in the dark at 2000 m. Survive wave after
// wave of glowing abyss creatures, collect lumen, pick upgrades, and chase
// the high score. Pure Canvas 2D + synthesized WebAudio, no libraries,
// no network, no assets. Fixed 60 Hz timestep; rendering is separate.
import { makeRng, clamp } from './rng.js';
import { SoundBank } from './audio.js';
import { Input } from './input.js';
import { World, WORLD_W, WORLD_H } from './world.js';
import {
  createState, resetRun, spawnEnemy, updatePlayer, updateEnemies,
  updateBullets, updateOrbs, updateFx, tideBurst, addRing,
  spawnExplosion, dropOrbs,
} from './entities.js';
import { startWave, updateWaves, pickUpgrades } from './waves.js';
import { Hud } from './hud.js';
import { render } from './render.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot') || '';
const SEED = Number(params.get('seed') || '1') || 1;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const rng = makeRng(SEED);
const S = createState(rng);
const world = new World(rng);
const sound = new SoundBank();
const input = new Input(canvas);
const hud = new Hud(document);

let muted = false;
let upgradeChoices = [];
let shotFrozen = false;
let shotFrames = 0;

window.__game = { S, startGame, restart };

// ---------- flow ----------
function startGame() {
  sound.ensure(); sound.click();
  resetRun(S);
  S.state = 'playing';
  hud.hideScreens();
  startWave(S, 1);
}

function restart() { startGame(); }

function applyUpgrade(card) {
  card.apply(S.player);
  sound.upgrade();
  S.state = 'playing';
  hud.hideScreens();
  startWave(S, S.wave + 1);
}

function gameOver() {
  S.best = Math.max(S.best, S.score);
  hud.showEnd(S);
  sound.gameOver();
}

function togglePause() {
  if (S.state === 'playing') { S.state = 'paused'; hud.showPause(true); }
  else if (S.state === 'paused') { S.state = 'playing'; hud.showPause(false); }
}

// ---------- per-tick update ----------
function step(dt) {
  S.time += dt;
  world.update(dt, S.time);
  if (S.state === 'title') {
    updateEnemies(S, dt, null);
    updateFx(S, dt);
    return;
  }
  if (S.state !== 'playing') { updateFx(S, dt); return; }

  updatePlayer(S, dt, input, sound);
  updateEnemies(S, dt, sound);
  updateBullets(S, dt, sound);
  updateOrbs(S, dt, sound);
  updateFx(S, dt);
  if (S.state === 'over') { gameOver(); return; }
  const res = updateWaves(S, dt);
  if (res === 'clear') {
    S.player.hp = clamp(S.player.hp + 20, 0, S.player.maxHp);
    // wave-clear celebration: a gold ring + sparks on the player
    addRing(S, S.player.x, S.player.y, '#ffd76a', 200);
    spawnExplosion(S, S.player.x, S.player.y, '#ffd76a', 18, 220);
    upgradeChoices = pickUpgrades(S.rng, 3);
    S.state = 'upgrade';
    sound.waveClear();
    hud.showUpgrade(upgradeChoices, S, applyUpgrade);
  }
}

function handleKeys() {
  if (input.wasPressed('Space')) {
    if (S.state === 'playing') tideBurst(S, sound);
  }
  if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
    if (S.state === 'playing' || S.state === 'paused') togglePause();
  }
  if (input.wasPressed('KeyM')) {
    muted = !muted;
    sound.setMuted(muted);
  }
  if (input.wasPressed('KeyR')) {
    if (S.state === 'over' || S.state === 'paused') restart();
  }
  if (input.wasPressed('Enter')) {
    if (S.state === 'title' || S.state === 'over') startGame();
  }
  if (S.state === 'upgrade') {
    for (let i = 0; i < 3; i++) {
      if (input.wasPressed('Digit' + (i + 1)) || input.wasPressed('Numpad' + (i + 1))) {
        applyUpgrade(upgradeChoices[i]);
        break;
      }
    }
  }
  input.endFrame();
}

// ---------- screenshot modes (?shot=title|combat|upgrade|end&seed=1) ----------
// Each renders a frozen, deterministic frame of the real game and then sets
// window.__shotReady so the screenshot tool knows the frame is settled.
function setupShot() {
  if (!SHOT) return;
  sound.setMuted(true);
  if (SHOT === 'title') {
    resetRun(S);
    S.state = 'title';
    spawnEnemy(S, 'urchin', false, 300, 260);
    spawnEnemy(S, 'jelly', false, 950, 220);
    spawnEnemy(S, 'eel', false, 880, 500);
    spawnEnemy(S, 'mother', false, 220, 520);
    spawnEnemy(S, 'urchin', false, 640, 180);
    hud.showTitle(S.best);
  } else if (SHOT === 'combat') {
    resetRun(S);
    S.state = 'playing';
    S.score = 1250; S.kills = 18; S.combo = 4; S.comboTimer = 2.5;
    S.player.hp = 78; S.player.energy = 100;
    hud.hideScreens();
    startWave(S, 3);
    // simulate ~2.5 s of real play: auto-aim at the nearest enemy, hold fire
    for (let stepN = 0; stepN < 150; stepN++) {
      let best = null, bestD = Infinity;
      for (const e of S.enemies) {
        const d = (e.x - S.player.x) ** 2 + (e.y - S.player.y) ** 2;
        if (d < bestD) { bestD = d; best = e; }
      }
      if (best) { input.mouseX = best.x; input.mouseY = best.y; }
      input.mouseDown = true;
      if (stepN === 110) tideBurst(S, null);
      step(1 / 60);
      if (S.state !== 'playing') break;
    }
    input.mouseDown = false;
    // freeze a lively frame: hide the wave banner, restage a fresh burst
    // ring mid-expansion, refill energy, and ring the player with enemies
    S.banner = ''; S.bannerT = 0;
    S.player.energy = 100;
    const px = S.player.x, py = S.player.y;
    const ringSpots = [
      ['urchin', -190, -110], ['jelly', 210, -140], ['eel', -230, 90],
      ['mother', 180, 150], ['urchin', 40, -230], ['jelly', -80, 210],
    ];
    for (const [type, dx, dy] of ringSpots) {
      spawnEnemy(S, type, false, px + dx, py + dy);
    }
    addRing(S, px, py, '#7df9ff', 240);
    const ring = S.rings[S.rings.length - 1];
    ring.r = 175; ring.life = 0.35;
    addRing(S, px, py, '#ffd76a', 190);
    const ring2 = S.rings[S.rings.length - 1];
    ring2.r = 130; ring2.life = 0.3;
    spawnExplosion(S, px, py, '#7df9ff', 18, 260);
    dropOrbs(S, px + 60, py - 40, 4);
  } else if (SHOT === 'upgrade') {
    resetRun(S);
    S.wave = 3; S.score = 2450; S.kills = 31; S.combo = 0;
    S.player.hp = 80; S.player.energy = 64;
    S.state = 'upgrade';
    spawnEnemy(S, 'jelly', false, 200, 200);
    spawnEnemy(S, 'urchin', false, 1050, 480);
    upgradeChoices = pickUpgrades(S.rng, 3);
    hud.showUpgrade(upgradeChoices, S, () => {});
  } else if (SHOT === 'end') {
    resetRun(S);
    S.wave = 4; S.score = 3120; S.kills = 47; S.maxCombo = 5; S.best = 3120;
    S.state = 'over';
    S.player.hp = 0;
    hud.showEnd(S);
  }
  shotFrozen = true;
}

// ---------- boot ----------
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', restart);
document.getElementById('resume-btn').addEventListener('click', togglePause);
document.getElementById('mute-btn').addEventListener('click', () => {
  muted = !muted;
  sound.setMuted(muted);
  document.getElementById('mute-btn').textContent = muted ? '🔇 已静音 (M)' : '🔊 音效 (M)';
});
window.addEventListener('pointerdown', () => sound.ensure(), { once: true });
window.addEventListener('keydown', () => sound.ensure(), { once: true });

if (SHOT) {
  setupShot();
} else {
  resetRun(S);
  S.state = 'title';
  spawnEnemy(S, 'urchin', false, 300, 260);
  spawnEnemy(S, 'jelly', false, 950, 220);
  spawnEnemy(S, 'eel', false, 880, 500);
  spawnEnemy(S, 'mother', false, 220, 520);
  spawnEnemy(S, 'urchin', false, 640, 180);
  hud.showTitle(S.best);
}

// ---------- main loop: fixed 60 Hz steps, render decoupled ----------
let last = performance.now();
let acc = 0;
const DT = 1 / 60;

function frame(now) {
  requestAnimationFrame(frame);
  let elapsed = (now - last) / 1000;
  last = now;
  if (elapsed > 0.25) elapsed = 0.25;
  if (!shotFrozen) {
    acc += elapsed;
    let n = 0;
    while (acc >= DT && n < 5) { step(DT); acc -= DT; n++; }
    if (n === 5) acc = 0;
    handleKeys();
  }
  hud.update(S);
  render(ctx, S, world);
  if (shotFrozen) {
    shotFrames++;
    if (shotFrames >= 3 && !window.__shotReady) window.__shotReady = true;
  }
}
requestAnimationFrame(frame);
