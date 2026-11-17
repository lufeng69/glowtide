// hud.js — DOM HUD (health/energy bars, score, combo, wave) and the
// title / upgrade / pause / game-over screens. Canvas draws the world;
// the DOM draws the chrome so text stays crisp at any window size.
export class Hud {
  constructor(doc) {
    this.doc = doc;
    this.hpFill = doc.getElementById('hp-fill');
    this.hpText = doc.getElementById('hp-text');
    this.enFill = doc.getElementById('en-fill');
    this.enText = doc.getElementById('en-text');
    this.scoreEl = doc.getElementById('score');
    this.comboEl = doc.getElementById('combo');
    this.waveEl = doc.getElementById('wave');
    this.dashEl = doc.getElementById('dash-cd');
    this.burstEl = doc.getElementById('burst-hint');
    this.bannerEl = doc.getElementById('banner');
    this.titleEl = doc.getElementById('title-screen');
    this.upgradeEl = doc.getElementById('upgrade-screen');
    this.upgradeCards = doc.getElementById('upgrade-cards');
    this.upgradeScore = doc.getElementById('upgrade-score');
    this.endEl = doc.getElementById('end-screen');
    this.pauseEl = doc.getElementById('pause-screen');
    this.bestEl = doc.getElementById('best-score');
    this._bannerText = '';
  }

  update(S) {
    const p = S.player;
    if (!p) return;
    this.hpFill.style.width = Math.max(0, (p.hp / p.maxHp) * 100) + '%';
    this.hpText.textContent = Math.ceil(p.hp) + ' / ' + p.maxHp;
    this.enFill.style.width = p.energy + '%';
    this.enText.textContent = Math.floor(p.energy) + ' / 100';
    this.scoreEl.textContent = S.score;
    const mult = Math.min(8, 1 + S.combo);
    this.comboEl.textContent = S.combo > 0 ? '连击 ×' + mult : '';
    this.comboEl.classList.toggle('hot', mult >= 4);
    this.waveEl.textContent = '第 ' + S.wave + ' 波';
    this.dashEl.textContent = p.dashCd > 0
      ? '冲刺 ' + p.dashCd.toFixed(1) + 's'
      : '冲刺就绪 [Shift]';
    this.dashEl.classList.toggle('ready', p.dashCd <= 0);
    this.burstEl.textContent = p.energy >= 100
      ? '潮汐爆裂就绪 [空格]'
      : '潮汐爆裂 ' + Math.floor(p.energy) + '%';
    this.burstEl.classList.toggle('ready', p.energy >= 100);
    if (S.bannerT > 0 && S.banner !== this._bannerText) {
      this._bannerText = S.banner;
      this.bannerEl.textContent = S.banner;
      this.bannerEl.classList.add('show');
    } else if (S.bannerT <= 0 && this._bannerText) {
      this._bannerText = '';
      this.bannerEl.classList.remove('show');
    }
  }

  showOnly(el) {
    for (const s of [this.titleEl, this.upgradeEl, this.endEl, this.pauseEl]) {
      if (s) s.classList.toggle('hidden', s !== el);
    }
  }
  hideScreens() { this.showOnly(null); }

  showTitle(best) {
    this.bestEl.textContent = best > 0 ? '最佳得分：' + best : '深海 2000 米 · 活下去';
    this.showOnly(this.titleEl);
  }

  showUpgrade(cards, S, onPick) {
    this.upgradeScore.textContent = '得分 ' + S.score + ' · 已通过第 ' + S.wave + ' 波 · 血量恢复 +20';
    this.upgradeCards.innerHTML = '';
    cards.forEach((card, i) => {
      const div = this.doc.createElement('div');
      div.className = 'card';
      div.innerHTML = '<div class="card-key">' + (i + 1) + '</div>' +
        '<div class="card-name">' + card.name + '</div>' +
        '<div class="card-desc">' + card.desc + '</div>';
      div.addEventListener('click', () => onPick(card));
      this.upgradeCards.appendChild(div);
    });
    this.showOnly(this.upgradeEl);
  }

  showEnd(S) {
    this.doc.getElementById('end-score').textContent = S.score;
    this.doc.getElementById('end-wave').textContent = S.wave;
    this.doc.getElementById('end-kills').textContent = S.kills;
    this.doc.getElementById('end-combo').textContent = '×' + Math.min(8, 1 + S.maxCombo);
    this.doc.getElementById('end-best').textContent = '最佳 ' + S.best;
    this.showOnly(this.endEl);
  }

  showPause(on) { this.pauseEl.classList.toggle('hidden', !on); }
}
