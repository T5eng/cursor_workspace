// =============================================================
// tutorial.js — interactive beginner tutorial
// =============================================================

import { Card, evaluateHand } from './cards.js';
import { JOKERS_BY_ID } from './jokers.js';

const STORAGE_KEY = 'jokerCardsTutorialDone';

/** @typedef {'dialog'|'highlight'|'action'|'shop'} StepKind */

/**
 * @typedef {object} TutorialStep
 * @property {string} id
 * @property {StepKind} kind
 * @property {string} title
 * @property {string} body
 * @property {string} [target] - CSS selector for highlight
 * @property {string} [action] - wait condition for action steps
 * @property {() => void} [onEnter]
 * @property {string} [nextLabel]
 */

const STEPS = /** @type {TutorialStep[]} */ ([
  {
    id: 'welcome',
    kind: 'dialog',
    title: '欢迎来到小丑牌',
    body:
      '这是一款扑克 Roguelike：用手牌组成<strong>牌型</strong>得分，击败<strong>盲注</strong>赚取金币，在商店购买<strong>小丑</strong>强化 combo，连过 8 关即可通关。\n\n接下来几分钟，我会带你亲手完成一局「教学关」。',
    nextLabel: '开始教程'
  },
  {
    id: 'goal',
    kind: 'highlight',
    target: '.blind-panel',
    title: '① 本轮目标',
    body:
      '左侧<strong>本轮目标</strong>显示本关需要达到的分数。下方<strong>当前得分</strong>会累加你每次出牌的总分——达到目标即过关。'
  },
  {
    id: 'resources',
    kind: 'highlight',
    target: '.stats-panel',
    title: '② 手牌与弃牌',
    body:
      '每轮你有固定次数的<strong>出牌</strong>（默认 4 次）和<strong>弃牌</strong>（默认 3 次）。手牌用尽仍未达标则游戏结束。'
  },
  {
    id: 'formula',
    kind: 'highlight',
    target: '#handPreview',
    title: '③ 筹码 × 倍数',
    body:
      '每次出牌得分 = <span class="chips-pill" style="display:inline;padding:2px 6px;font-size:12px;">筹码</span> × <span class="mult-pill" style="display:inline;padding:2px 6px;font-size:12px;">倍数</span>。牌型越好，基础筹码和倍数越高；计分牌还会按点数叠加筹码。'
  },
  {
    id: 'select-pair',
    kind: 'action',
    action: 'select-pair',
    target: '#handRow',
    targets: ['#handPreview', '#handRow'],
    title: '④ 组成对子',
    body: '请点击手牌，选中<strong>两张 A</strong>（任意花色）。上方预览应显示「对子」。',
    onEnter(api) {
      api.setHand([
        ['A', '♥'], ['A', '♦'], ['K', '♠'], ['Q', '♣'],
        ['J', '♥'], ['10', '♠'], ['9', '♦'], ['8', '♣']
      ]);
      api.setTarget(40);
      api.startRound();
    }
  },
  {
    id: 'play-hand',
    kind: 'action',
    action: 'play-hand',
    target: '#playBtn',
    targets: ['#handPreview', '#playBtn'],
    title: '⑤ 出牌计分',
    body: '牌型确认后，点击<strong>出牌</strong>（或按 Space / Enter）。留意逐张高亮与浮动数字：蓝色 +筹码、红色 +倍数。'
  },
  {
    id: 'after-play',
    kind: 'dialog',
    title: '计分小结',
    body:
      '你刚才看到的是完整计分流程：先应用牌型基础值，再逐张累加计分牌的点数筹码，最后小丑等加成介入。\n\n<strong>目标：用更少的出牌次数，叠出更高的筹码 × 倍数。</strong>'
  },
  {
    id: 'discard',
    kind: 'action',
    action: 'discard',
    target: '.play-area',
    targets: ['#handRow', '#discardBtn', '#handPreview'],
    title: '⑥ 弃牌换牌',
    body: '手牌不顺时，选中 1–5 张后点<strong>弃牌</strong>（Backspace / D），会从牌堆补牌。请弃掉两张<strong>最差的牌</strong>（2 和 3）。',
    onEnter(api) {
      api.setHand([
        ['2', '♣'], ['3', '♦'], ['7', '♠'], ['8', '♥'],
        ['9', '♣'], ['J', '♦'], ['Q', '♠'], ['K', '♥']
      ]);
      api.clearSelection();
    }
  },
  {
    id: 'joker-intro',
    kind: 'dialog',
    title: '⑦ 小丑牌',
    body:
      '小丑是构筑核心：装备后会改变计分规则（+倍数、+筹码、按花色触发等）。我已为你装备一张「小丑」——下一手看看它的效果。'
  },
  {
    id: 'joker-play',
    kind: 'action',
    action: 'play-with-joker',
    target: '#handRow',
    targets: ['#jokerRow', '#handPreview', '#handRow'],
    title: '⑧ 感受小丑加成',
    body: '请再出一手<strong>对子</strong>（任选两张相同点数）。留意顶部小丑闪光与「+4 倍数」弹出。',
    onEnter(api) {
      api.setJokers(['joker']);
      api.setHand([
        ['5', '♥'], ['5', '♦'], ['6', '♣'], ['7', '♠'],
        ['8', '♥'], ['9', '♦'], ['10', '♣'], ['J', '♠']
      ]);
      api.clearSelection();
    }
  },
  {
    id: 'blind-win',
    kind: 'dialog',
    title: '⑨ 击败盲注',
    body:
      '当<strong>当前得分</strong>达到<strong>本轮目标</strong>，本关结束。你会获得金币奖励、剩余手牌奖金和利息，然后进入商店。'
  },
  {
    id: 'shop',
    kind: 'shop',
    title: '⑩ 商店',
    body:
      '用金币购买小丑或升级券。买不起可以<strong>重抽</strong>货架；花光或买完后点<strong>下一轮</strong>继续冒险。'
  },
  {
    id: 'complete',
    kind: 'dialog',
    title: '教程完成 ★',
    body:
      '你已经掌握了：目标分数、筹码×倍数、出牌/弃牌、小丑 combo、商店与过关流程。\n\n正式游戏中盲注会越来越难，试着搭配不同小丑打出高分吧！',
    nextLabel: '开始正式游戏'
  }
]);

export class TutorialController {
  constructor(api) {
    this.api = api;
    this.stepIndex = 0;
    this.active = false;
    this.overlay = null;
    this._spotlightRect = null;
    this._onResize = () => {
      const step = this.step;
      const sel = step?.targets || step?.target;
      if (sel) this.updateSpotlight(sel);
      else this.positionPanel();
    };
  }

  static hasCompleted() {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }

  static markCompleted() {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch { /* ignore */ }
  }

  start() {
    this.active = true;
    this.stepIndex = 0;
    this.api.run.isTutorial = true;
    this.api.run.tutorialStep = null;
    this.api.initTutorialRun();
    this.ensureOverlay();
    this.goToStep(0);
  }

  exitToGame() {
    this.finish(false);
    TutorialController.markCompleted();
    this.api.startNormalRun();
  }

  finish(markDone = true) {
    if (markDone) TutorialController.markCompleted();
    this.active = false;
    this.api.run.isTutorial = false;
    this.api.run.tutorialStep = null;
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('orientationchange', this._onResize);
    window.visualViewport?.removeEventListener('resize', this._onResize);
    window.visualViewport?.removeEventListener('scroll', this._onResize);
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    document.body.classList.remove('tutorial-active');
    this.api.closeAllModals();
  }

  ensureOverlay() {
    if (this.overlay) return;
    const root = document.createElement('div');
    root.id = 'tutorialOverlay';
    root.className = 'tutorial-overlay hidden';
    root.innerHTML = `
      <div class="tutorial-dim"></div>
      <div class="tutorial-spotlight" aria-hidden="true"></div>
      <div class="tutorial-panel">
        <div class="tutorial-progress" id="tutorialProgress"></div>
        <h3 class="tutorial-title" id="tutorialTitle"></h3>
        <div class="tutorial-body" id="tutorialBody"></div>
        <footer class="tutorial-footer">
          <button type="button" class="tutorial-skip ghost-btn" id="tutorialSkip">跳过教程</button>
          <button type="button" class="btn btn-play tutorial-next" id="tutorialNext">
            <span class="btn-main" id="tutorialNextMain">继续</span>
            <span class="btn-sub">Next</span>
          </button>
        </footer>
      </div>
    `;
    document.body.appendChild(root);
    this.overlay = root;
    root.querySelector('#tutorialSkip').addEventListener('click', () => this.exitToGame());
    root.querySelector('#tutorialNext').addEventListener('click', () => this.onNextClick());
    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', this._onResize);
    window.visualViewport?.addEventListener('resize', this._onResize);
    window.visualViewport?.addEventListener('scroll', this._onResize);
  }

  get step() {
    return STEPS[this.stepIndex];
  }

  goToStep(index) {
    if (index >= STEPS.length) {
      this.exitToGame();
      return;
    }
    this.stepIndex = index;
    const step = this.step;
    this.api.run.tutorialStep = step.id;
    step.onEnter?.(this.api);
    this.renderStep();
  }

  advance() {
    this.goToStep(this.stepIndex + 1);
  }

  onNextClick() {
    const step = this.step;
    if (step.kind === 'shop') {
      this.api.closeAllModals();
      this.advance();
      return;
    }
    if (step.kind === 'dialog' || step.kind === 'highlight') {
      this.advance();
      return;
    }
    if (step.id === 'complete') {
      this.exitToGame();
    }
  }

  renderStep() {
    const step = this.step;
    const progress = this.overlay.querySelector('#tutorialProgress');
    const title = this.overlay.querySelector('#tutorialTitle');
    const body = this.overlay.querySelector('#tutorialBody');
    const nextBtn = this.overlay.querySelector('#tutorialNext');
    const nextMain = this.overlay.querySelector('#tutorialNextMain');
    const skipBtn = this.overlay.querySelector('#tutorialSkip');

    progress.textContent = `新手教程 · ${this.stepIndex + 1} / ${STEPS.length}`;
    title.textContent = step.title;
    body.innerHTML = step.body.replace(/\n/g, '<br/>');

    const isAction = step.kind === 'action' || step.kind === 'shop';
    const isLast = step.id === 'complete';

    nextBtn.classList.toggle('hidden', isAction && step.kind !== 'shop');
    skipBtn.style.visibility = isLast ? 'hidden' : 'visible';
    nextMain.textContent = step.nextLabel || (isLast ? '开始正式游戏' : '继续');

    this.overlay.classList.remove('hidden');
    document.body.classList.add('tutorial-active');

    const spotlightSel = step.targets || step.target;
    if (step.kind === 'highlight' || (step.kind === 'action' && spotlightSel)) {
      this.overlay.classList.add('has-spotlight');
      this.updateSpotlight(spotlightSel);
    } else {
      this.overlay.classList.remove('has-spotlight');
      this.hideSpotlight();
    }

    this.positionPanel();

    if (step.kind === 'shop') {
      this.api.openTutorialShop();
      const nextBtn = this.overlay.querySelector('#tutorialNext');
      nextBtn.classList.remove('hidden');
      this.overlay.classList.add('has-spotlight');
      setTimeout(() => this.updateSpotlight('#shopModal .modal-card'), 80);
    }
  }

  updateSpotlight(selector) {
    const step = this.step;
    const sel = selector || step?.targets || step?.target;
    const spot = this.overlay?.querySelector('.tutorial-spotlight');
    if (!spot || !sel) {
      this.hideSpotlight();
      return;
    }
    const list = Array.isArray(sel) ? sel : [sel];
    const rects = list
      .map(s => document.querySelector(s))
      .filter(Boolean)
      .map(el => el.getBoundingClientRect());
    if (rects.length === 0) {
      this.hideSpotlight();
      return;
    }
    const pad = 8;
    const union = rects.reduce((u, r) => ({
      left: Math.min(u.left, r.left),
      top: Math.min(u.top, r.top),
      right: Math.max(u.right, r.right),
      bottom: Math.max(u.bottom, r.bottom)
    }), {
      left: rects[0].left,
      top: rects[0].top,
      right: rects[0].right,
      bottom: rects[0].bottom
    });
    spot.style.display = 'block';
    spot.style.left = `${union.left - pad}px`;
    spot.style.top = `${union.top - pad}px`;
    spot.style.width = `${union.right - union.left + pad * 2}px`;
    spot.style.height = `${union.bottom - union.top + pad * 2}px`;
    this._spotlightRect = union;
    this.positionPanel();
  }

  /** Place tutorial card away from the interactive target */
  positionPanel() {
    const panel = this.overlay?.querySelector('.tutorial-panel');
    if (!panel) return;

    const step = this.step;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const isMobile = window.matchMedia('(max-width: 768px)').matches;

    panel.classList.remove('tutorial-panel-top', 'tutorial-panel-bottom');

    // Dialogs: bottom on desktop, top on mobile to leave table visible
    if (step?.kind === 'dialog') {
      panel.classList.add(isMobile ? 'tutorial-panel-top' : 'tutorial-panel-bottom');
      return;
    }

    let focusBottom = vh * 0.5;
    if (this._spotlightRect) {
      focusBottom = this._spotlightRect.top + (this._spotlightRect.bottom - this._spotlightRect.top) / 2;
    } else if (step?.target) {
      const el = document.querySelector(step.target);
      if (el) {
        const r = el.getBoundingClientRect();
        focusBottom = r.top + r.height / 2;
      }
    }

    // Interactive targets in lower half → panel on top
    const useTop = isMobile
      ? focusBottom > vh * 0.38
      : focusBottom > vh * 0.55;

    panel.classList.add(useTop ? 'tutorial-panel-top' : 'tutorial-panel-bottom');
  }

  hideSpotlight() {
    const spot = this.overlay?.querySelector('.tutorial-spotlight');
    if (spot) spot.style.display = 'none';
    this._spotlightRect = null;
  }

  /** Called from game loop when player acts */
  onGameEvent(event, data = {}) {
    if (!this.active) return;
    const step = this.step;
    if (!step || step.kind !== 'action') return;

    if (step.action === 'select-pair' && event === 'selection-changed') {
      const cards = this.api.getSelectedCards();
      if (cards.length !== 2) return;
      const ranks = cards.map(c => c.rank);
      if (ranks[0] !== ranks[1]) return;
      const { type } = evaluateHand(cards);
      if (type !== 'Pair') return;
      this.advance();
      return;
    }

    if (step.action === 'play-hand' && event === 'hand-played') {
      this.advance();
      return;
    }

    if (step.action === 'discard' && event === 'discarded') {
      const discarded = data.cards || [];
      if (discarded.length !== 2) return;
      const ranks = new Set(discarded.map(c => c.rank));
      if (ranks.has('2') && ranks.has('3')) this.advance();
      return;
    }

    if (step.action === 'play-with-joker' && event === 'hand-played') {
      const cards = data.played || [];
      const { type } = evaluateHand(cards);
      if (type === 'Pair' || type === 'Two Pair' || type === 'Three of a Kind' ||
          type === 'Full House' || type === 'Four of a Kind') {
        this.advance();
      }
    }
  }

  onShopFinished() {
    if (!this.active || this.step?.kind !== 'shop') return;
    this.advance();
  }

  /** Whether UI action is allowed during current step */
  canSelectCard(card) {
    if (!this.active) return true;
    const step = this.step;
    if (step?.action === 'select-pair') {
      return card.rank === 'A';
    }
    if (step?.action === 'discard') {
      return true;
    }
    if (step?.action === 'play-with-joker') {
      return true;
    }
    return false;
  }

  canPlay() {
    if (!this.active) return true;
    return this.step?.action === 'play-hand' || this.step?.action === 'play-with-joker';
  }

  canDiscard() {
    if (!this.active) return true;
    return this.step?.action === 'discard';
  }

  shouldBlockBlindModal() {
    return this.active;
  }

}

/** Build hand from [rank, suit] pairs */
export function cardsFromSpecs(specs) {
  return specs.map(([rank, suit]) => new Card(rank, suit));
}

export function jokerFromId(id) {
  return JOKERS_BY_ID[id] ?? null;
}
