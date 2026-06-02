// =============================================================
// game.js — main game loop, state, and UI rendering
// =============================================================

import {
  createDeck, shuffle, evaluateHand,
  HAND_TYPES, HAND_LABELS, HAND_BASE, chipsAndMultFor, defaultHandLevels
} from './cards.js';
import { JOKER_DEFS, JOKERS_BY_ID, rollShopJokers } from './jokers.js';
import { scoreHand } from './scorer.js';
import { TutorialController, cardsFromSpecs, jokerFromId } from './tutorial.js';

// ---------- Constants ----------
const STARTING_HANDS = 4;
const STARTING_DISCARDS = 3;
const HAND_SIZE = 8;
const JOKER_SLOTS = 5;
const ANTES_TO_WIN = 8;

// Blind structure per ante. Score requirement scales with ante.
const BLIND_TYPES = [
  { key: 'small', name: '小盲', emoji: '◐', mult: 1.0, reward: 3 },
  { key: 'big',   name: '大盲', emoji: '●', mult: 1.5, reward: 4 },
  { key: 'boss',  name: 'BOSS', emoji: '☠', mult: 2.0, reward: 5 }
];

// Base score requirement for ante 1's small blind; scales per ante.
const BASE_REQ = [300, 800, 2000, 5000, 11000, 20000, 35000, 50000];

function requirementFor(ante, blindIndex) {
  const base = BASE_REQ[Math.min(ante - 1, BASE_REQ.length - 1)];
  return Math.floor(base * BLIND_TYPES[blindIndex].mult);
}

// ---------- Run state ----------
const run = {
  deck: [],          // master deck (does not shrink between rounds)
  drawPile: [],      // current draw pile (shrinks during a round)
  hand: [],          // cards in player's hand
  selected: new Set(),
  jokers: [],        // active jokers
  money: 4,
  ante: 1,
  blindIndex: 0,     // 0=small, 1=big, 2=boss
  blindBeaten: [false, false, false],
  handsLeft: STARTING_HANDS,
  discardsLeft: STARTING_DISCARDS,
  roundScore: 0,
  levels: defaultHandLevels(),
  rerollCost: 5,
  shop: null,       // current shop offer
  phase: 'blindSelect', // 'blindSelect' | 'playing' | 'shop' | 'gameover' | 'win'
  isTutorial: false,
  tutorialStep: null,
  tutorialTarget: 40
};

// ---------- DOM refs ----------
const $ = (id) => document.getElementById(id);
const els = {
  handRow: $('handRow'),
  playedRow: $('playedRow'),
  jokerRow: $('jokerRow'),
  handPreview: $('handPreview'),
  playBtn: $('playBtn'),
  discardBtn: $('discardBtn'),
  sortRankBtn: $('sortRankBtn'),
  sortSuitBtn: $('sortSuitBtn'),
  runInfoBtn: $('runInfoBtn'),

  blindPanel: $('blindPanel'),
  blindName: $('blindName'),
  blindTarget: $('blindTarget'),
  blindReward: $('blindReward'),
  roundScore: $('roundScore'),
  lastHand: $('lastHand'),

  handsLeft: $('handsLeft'),
  discardsLeft: $('discardsLeft'),
  money: $('money'),
  ante: $('ante'),
  round: $('round'),
  deckCount: $('deckCount'),
  deckTotal: $('deckTotal'),

  handLevelsModal: $('handLevelsModal'),
  handLevelsList: $('handLevelsList'),
  shopModal: $('shopModal'),
  shopGrid: $('shopGrid'),
  shopMoney: $('shopMoney'),
  rerollBtn: $('rerollBtn'),
  rerollCost: $('rerollCost'),
  nextRoundBtn: $('nextRoundBtn'),

  blindSelectModal: $('blindSelectModal'),
  blindOptions: $('blindOptions'),

  endModal: $('endModal'),
  endTitle: $('endTitle'),
  endText: $('endText'),
  restartBtn: $('restartBtn'),

  popupLayer: $('popupLayer'),

  welcomeModal: $('welcomeModal'),
  startGameBtn: $('startGameBtn'),
  startTutorialBtn: $('startTutorialBtn'),
  resumeTutorialBtn: $('resumeTutorialBtn'),
  openTutorialBtn: $('openTutorialBtn')
};

let tutorialController = null;

function requirementForRun() {
  if (run.isTutorial) return run.tutorialTarget;
  return requirementFor(run.ante, run.blindIndex);
}

function notifyTutorial(event, data) {
  tutorialController?.onGameEvent(event, data);
}

const gameApi = {
  get run() { return run; },
  get els() { return els; },
  initTutorialRun,
  startNormalRun,
  closeAllModals,
  setHand(specs) {
    run.hand = cardsFromSpecs(specs);
    run.drawPile = [];
    run.selected.clear();
    renderAll();
  },
  setJokers(ids) {
    run.jokers = ids.map(id => jokerFromId(id)).filter(Boolean);
    renderJokers();
  },
  setTarget(n) {
    run.tutorialTarget = n;
    renderBlind();
  },
  startRound() {
    run.phase = 'playing';
    run.handsLeft = STARTING_HANDS;
    run.discardsLeft = STARTING_DISCARDS;
    run.roundScore = 0;
    run.selected.clear();
    els.blindSelectModal.classList.add('hidden');
    renderAll();
  },
  clearSelection() {
    run.selected.clear();
    renderHandPreview();
    for (const el of els.handRow.querySelectorAll('.card')) {
      el.classList.remove('selected');
    }
  },
  getSelectedCards() {
    return run.hand.filter(c => run.selected.has(c.id));
  },
  openTutorialShop() {
    run.phase = 'shop';
    const lusty = jokerFromId('lusty');
    const greedy = jokerFromId('greedy');
    run.shop = {
      jokers: [lusty, greedy].filter(Boolean),
      boosters: [],
      sold: new Set()
    };
    run.rerollCost = 5;
    renderShop({ blindReward: 3, handBonus: 2, interest: 0 });
    els.shopModal.classList.remove('hidden');
    setTimeout(() => tutorialController?.updateSpotlight('#shopModal .modal-card'), 80);
  }
};

// ---------- Rendering helpers ----------

function cardEl(card, { dealing = false, interactive = true } = {}) {
  const el = document.createElement('div');
  el.className = `card ${card.isRed ? 'red' : 'black'}${dealing ? ' dealing' : ''}`;
  el.dataset.id = card.id;
  el.innerHTML = `
    <div class="corner tl">
      <div class="r">${card.rank}</div>
      <div class="s">${card.suit}</div>
    </div>
    <div class="pip">${card.suit}</div>
    <div class="corner br">
      <div class="r">${card.rank}</div>
      <div class="s">${card.suit}</div>
    </div>
  `;
  if (interactive) {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      toggleSelect(card);
    });
  }
  if (run.selected.has(card.id)) el.classList.add('selected');
  return el;
}

function jokerEl(j) {
  const el = document.createElement('div');
  el.className = 'joker';
  el.dataset.id = j.id;
  el.dataset.tip = `${j.name}\n${j.desc}`;
  if (j.color) el.style.borderColor = j.color;
  el.innerHTML = `
    <div class="joker-art" style="${j.color ? `color:${j.color};` : ''}">${j.art}</div>
    <div class="joker-name">${j.name}</div>
  `;
  return el;
}

function renderHand() {
  els.handRow.innerHTML = '';
  for (const c of run.hand) els.handRow.appendChild(cardEl(c, { dealing: c._justDealt }));
  for (const c of run.hand) c._justDealt = false;
}

function renderJokers() {
  els.jokerRow.innerHTML = '';
  for (const j of run.jokers) els.jokerRow.appendChild(jokerEl(j));
  // fill empty slots
  for (let i = run.jokers.length; i < JOKER_SLOTS; i++) {
    const slot = document.createElement('div');
    slot.className = 'joker-slot';
    els.jokerRow.appendChild(slot);
  }
}

function renderStats() {
  els.handsLeft.textContent = run.handsLeft;
  els.discardsLeft.textContent = run.discardsLeft;
  els.money.textContent = `$${run.money}`;
  els.ante.textContent = `${run.ante} / ${ANTES_TO_WIN}`;
  els.round.textContent = (run.ante - 1) * 3 + run.blindIndex + 1;
  els.deckCount.textContent = run.drawPile.length;
  els.deckTotal.textContent = run.deck.length;
  els.roundScore.textContent = run.roundScore;
}

function renderBlind() {
  const b = BLIND_TYPES[run.blindIndex];
  els.blindName.textContent = run.isTutorial ? '教学关' : b.name;
  els.blindTarget.textContent = requirementForRun();
  els.blindReward.textContent = b.reward;
}

const MOBILE_PREVIEW = window.matchMedia('(max-width: 768px)');
function handPreviewHint() {
  return MOBILE_PREVIEW.matches ? '点选手牌组牌型' : '选择牌组成牌型';
}

function renderHandPreview() {
  const cards = run.hand.filter(c => run.selected.has(c.id));
  if (cards.length === 0) {
    els.handPreview.classList.remove('active');
    els.handPreview.querySelector('.hand-preview-name').textContent = handPreviewHint();
    els.handPreview.querySelector('.chips-pill').textContent = '0';
    els.handPreview.querySelector('.mult-pill').textContent = '0';
    els.playBtn.disabled = true;
    els.discardBtn.disabled = run.discardsLeft <= 0;
    return;
  }
  const { type } = evaluateHand(cards);
  const { chips, mult, level } = chipsAndMultFor(type, run.levels);
  els.handPreview.classList.add('active');
  els.handPreview.querySelector('.hand-preview-name').textContent =
    `${HAND_LABELS[type]} · Lv.${level}`;
  els.handPreview.querySelector('.chips-pill').textContent = chips;
  els.handPreview.querySelector('.mult-pill').textContent = mult;
  els.playBtn.disabled = false;
  els.discardBtn.disabled = run.discardsLeft <= 0;
}

function renderHandLevels() {
  els.handLevelsList.innerHTML = '';
  for (const t of HAND_TYPES) {
    const lvl = run.levels[t];
    const { chips, mult } = chipsAndMultFor(t, run.levels);
    const row = document.createElement('div');
    row.className = 'hand-level-row';
    row.innerHTML = `
      <div class="level-badge">Lv.${lvl}</div>
      <div class="level-name">${HAND_LABELS[t]} <span style="opacity:.5;font-size:11px;">${t}</span></div>
      <div class="chips-pill">${chips}</div>
      <div class="x">×</div>
      <div class="mult-pill">${mult}</div>
    `;
    els.handLevelsList.appendChild(row);
  }
}

// ---------- Popup animations ----------
function spawnPopup(text, kind, anchor) {
  const rect = anchor.getBoundingClientRect();
  const popup = document.createElement('div');
  popup.className = `popup ${kind}`;
  popup.textContent = text;
  popup.style.left = `${rect.left + rect.width / 2}px`;
  popup.style.top = `${rect.top - 6}px`;
  els.popupLayer.appendChild(popup);
  setTimeout(() => popup.remove(), 900);
}

// ---------- Selection ----------
function toggleSelect(card) {
  if (run.phase !== 'playing') return;
  if (tutorialController?.active && !tutorialController.canSelectCard(card)) return;
  if (run.selected.has(card.id)) {
    run.selected.delete(card.id);
  } else {
    if (run.selected.size >= 5) return;
    run.selected.add(card.id);
  }
  // update visual selected state without rerender
  for (const el of els.handRow.querySelectorAll('.card')) {
    el.classList.toggle('selected', run.selected.has(el.dataset.id));
  }
  renderHandPreview();
  notifyTutorial('selection-changed');
}

// ---------- Round flow ----------
function startBlind() {
  run.phase = 'playing';
  run.handsLeft = STARTING_HANDS;
  run.discardsLeft = STARTING_DISCARDS;
  run.roundScore = 0;
  run.selected.clear();
  // Recreate shuffled draw pile from master deck
  run.drawPile = shuffle([...run.deck]);
  run.hand = [];
  drawToFull();
  els.lastHand.querySelector('.last-hand-name').textContent = '—';
  els.lastHand.querySelector('.chips-pill').textContent = '0';
  els.lastHand.querySelector('.mult-pill').textContent = '0';
  renderAll();
}

function drawToFull() {
  while (run.hand.length < HAND_SIZE && run.drawPile.length > 0) {
    const c = run.drawPile.pop();
    c._justDealt = true;
    run.hand.push(c);
  }
}

function sortHandByRank() {
  const order = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };
  run.hand.sort((a, b) => order[b.rank] - order[a.rank] || a.suit.localeCompare(b.suit));
  renderHand();
}

function sortHandBySuit() {
  const sOrder = { '♠':0, '♥':1, '♦':2, '♣':3 };
  const rOrder = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };
  run.hand.sort((a, b) => sOrder[a.suit] - sOrder[b.suit] || rOrder[b.rank] - rOrder[a.rank]);
  renderHand();
}

async function playSelected() {
  if (run.selected.size === 0 || run.phase !== 'playing') return;
  if (tutorialController?.active && !tutorialController.canPlay()) return;
  const playedCards = run.hand.filter(c => run.selected.has(c.id));

  // 1) move played cards from hand → played row
  for (const c of playedCards) {
    const idx = run.hand.indexOf(c);
    if (idx >= 0) run.hand.splice(idx, 1);
  }
  run.selected.clear();
  renderHand();
  renderHandPreview();

  els.playedRow.innerHTML = '';
  const cardEls = new Map();
  for (const c of playedCards) {
    const el = cardEl(c, { interactive: false, dealing: true });
    els.playedRow.appendChild(el);
    cardEls.set(c.id, el);
  }

  els.playBtn.disabled = true;
  els.discardBtn.disabled = true;

  await sleep(260);

  // 2) compute score events
  const result = scoreHand(playedCards, run, run.levels);

  // 3) animate through events
  const preview = els.handPreview;
  preview.classList.add('active');
  preview.querySelector('.hand-preview-name').textContent =
    `${HAND_LABELS[result.hand.type]} · Lv.${chipsAndMultFor(result.hand.type, run.levels).level}`;

  const chipsPill = preview.querySelector('.chips-pill');
  const multPill = preview.querySelector('.mult-pill');
  chipsPill.textContent = '0';
  multPill.textContent = '0';

  // Scoring loop
  for (const ev of result.events) {
    if (ev.kind === 'base') {
      chipsPill.textContent = ev.snapshot.chips;
      multPill.textContent = ev.snapshot.mult;
      await sleep(220);
      continue;
    }
    if (ev.kind === 'card-chips') {
      const el = cardEls.get(ev.card.id);
      if (el) {
        el.classList.add('scoring');
        spawnPopup(`+${ev.amount}`, 'chips', el);
        setTimeout(() => el.classList.remove('scoring'), 360);
      }
      chipsPill.textContent = ev.snapshot.chips;
      await sleep(220);
      continue;
    }
    if (ev.kind === 'chips' || ev.kind === 'mult' || ev.kind === 'xmult') {
      const jEl = ev.joker ? els.jokerRow.querySelector(`.joker[data-id="${ev.joker.id}"]`) : null;
      const anchor = jEl || preview;
      if (jEl) {
        jEl.classList.add('flash');
        setTimeout(() => jEl.classList.remove('flash'), 360);
      }
      if (ev.kind === 'chips')  spawnPopup(`+${ev.amount} 筹码`, 'chips', anchor);
      if (ev.kind === 'mult')   spawnPopup(`+${ev.amount} 倍数`, 'mult', anchor);
      if (ev.kind === 'xmult')  spawnPopup(`×${ev.amount} 倍数`, 'xmult', anchor);
      chipsPill.textContent = Math.round(ev.snapshot.chips);
      multPill.textContent  = Number.isInteger(ev.snapshot.mult) ? ev.snapshot.mult : ev.snapshot.mult.toFixed(2);
      await sleep(280);
      continue;
    }
    if (ev.kind === 'final') {
      // big score bump
      run.roundScore += ev.score;
      els.roundScore.textContent = run.roundScore;
      els.roundScore.classList.add('bump');
      setTimeout(() => els.roundScore.classList.remove('bump'), 200);
      await sleep(380);
    }
  }

  // 4) fly cards out, refill hand
  for (const [, el] of cardEls) el.classList.add('flying-out');
  await sleep(360);
  els.playedRow.innerHTML = '';

  // Persist "last hand" stats
  const lastChips = chipsPill.textContent;
  const lastMult = multPill.textContent;
  els.lastHand.querySelector('.last-hand-name').textContent =
    `${HAND_LABELS[result.hand.type]}  ▸  ${result.total}`;
  els.lastHand.querySelector('.chips-pill').textContent = lastChips;
  els.lastHand.querySelector('.mult-pill').textContent = lastMult;

  run.handsLeft -= 1;
  drawToFull();
  renderAll();

  notifyTutorial('hand-played', { played: playedCards });

  // Check round outcome (skipped during tutorial — shop is scripted)
  const target = requirementForRun();
  if (!run.isTutorial && run.roundScore >= target) {
    await sleep(360);
    winBlind();
  } else if (!run.isTutorial && run.handsLeft <= 0) {
    await sleep(360);
    gameOver();
  } else if (run.isTutorial && run.handsLeft <= 0) {
    run.handsLeft = 1;
    renderStats();
  }
}

function discardSelected() {
  if (run.discardsLeft <= 0 || run.selected.size === 0 || run.phase !== 'playing') return;
  if (tutorialController?.active && !tutorialController.canDiscard()) return;
  const cards = run.hand.filter(c => run.selected.has(c.id));
  for (const c of cards) {
    const idx = run.hand.indexOf(c);
    if (idx >= 0) run.hand.splice(idx, 1);
  }
  run.selected.clear();
  run.discardsLeft -= 1;
  drawToFull();
  renderAll();
  notifyTutorial('discarded', { cards });
}

function winBlind() {
  // Reward: blind reward + $1 per remaining hand + interest (capped at $5)
  const b = BLIND_TYPES[run.blindIndex];
  const handBonus = run.handsLeft;
  const interest = Math.min(5, Math.floor(run.money / 5));
  const total = b.reward + handBonus + interest;
  run.money += total;
  run.blindBeaten[run.blindIndex] = true;

  // Open shop with summary popups
  openShop({ blindReward: b.reward, handBonus, interest });
}

function openShop(summary) {
  run.phase = 'shop';
  run.shop = {
    jokers: rollShopJokers(2, new Set(run.jokers.map(j => j.id))),
    boosters: rollBoosters(2),
    sold: new Set()
  };
  run.rerollCost = 5;
  renderShop(summary);
  els.shopModal.classList.remove('hidden');
}

function rollBoosters(n) {
  // simple "boosters" — these immediately level up a hand type
  const options = HAND_TYPES.map(t => ({ kind: 'level', handType: t, cost: 6, art: '📜', name: `${HAND_LABELS[t]} 升级券` }));
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(options[Math.floor(Math.random() * options.length)]);
  }
  return out;
}

function renderShop(summary) {
  els.shopMoney.textContent = `$${run.money}`;
  els.rerollCost.textContent = run.rerollCost;
  els.shopGrid.innerHTML = '';

  if (summary) {
    const win = document.createElement('div');
    win.className = 'shop-item';
    win.style.gridColumn = '1 / -1';
    win.innerHTML = `
      <div style="text-align:center;line-height:1.6;">
        <div style="color:var(--gold);font-size:18px;font-weight:900;letter-spacing:.08em;">击败盲注 · +$${summary.blindReward + summary.handBonus + summary.interest}</div>
        <div style="color:var(--ink-dim);font-family:var(--mono);font-size:12px;">
          盲注奖励 $${summary.blindReward} · 剩余手牌 $${summary.handBonus} · 利息 $${summary.interest}
        </div>
      </div>
    `;
    els.shopGrid.appendChild(win);
  }

  run.shop.jokers.forEach((j, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'shop-item' + (run.shop.sold.has(`j${i}`) ? ' sold' : '');
    const card = jokerEl(j);
    wrap.appendChild(card);
    const price = document.createElement('button');
    price.className = 'price';
    price.textContent = `$${j.cost}`;
    price.onclick = () => buyJoker(i);
    wrap.appendChild(price);
    els.shopGrid.appendChild(wrap);
  });

  run.shop.boosters.forEach((b, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'shop-item' + (run.shop.sold.has(`b${i}`) ? ' sold' : '');
    const card = document.createElement('div');
    card.className = 'joker';
    card.style.borderColor = 'var(--blue)';
    card.dataset.tip = `${b.name}\n升级一次 ${HAND_LABELS[b.handType]}\n该牌型基础筹码与倍数提升`;
    card.innerHTML = `
      <div class="joker-art" style="color:var(--blue);">${b.art}</div>
      <div class="joker-name" style="color:var(--blue);">${b.name}</div>
    `;
    wrap.appendChild(card);
    const price = document.createElement('button');
    price.className = 'price';
    price.textContent = `$${b.cost}`;
    price.onclick = () => buyBooster(i);
    wrap.appendChild(price);
    els.shopGrid.appendChild(wrap);
  });
}

function buyJoker(i) {
  const j = run.shop.jokers[i];
  if (!j || run.shop.sold.has(`j${i}`)) return;
  if (run.money < j.cost) return;
  if (run.jokers.length >= JOKER_SLOTS) return;
  run.money -= j.cost;
  run.jokers.push(j);
  run.shop.sold.add(`j${i}`);
  renderShop();
}

function buyBooster(i) {
  const b = run.shop.boosters[i];
  if (!b || run.shop.sold.has(`b${i}`)) return;
  if (run.money < b.cost) return;
  run.money -= b.cost;
  run.levels[b.handType] = (run.levels[b.handType] || 1) + 1;
  run.shop.sold.add(`b${i}`);
  renderShop();
  renderHandLevels();
}

function reroll() {
  if (run.money < run.rerollCost) return;
  run.money -= run.rerollCost;
  run.rerollCost += 1;
  run.shop.jokers = rollShopJokers(2, new Set(run.jokers.map(j => j.id)));
  run.shop.boosters = rollBoosters(2);
  run.shop.sold = new Set();
  renderShop();
}

function nextRound() {
  els.shopModal.classList.add('hidden');
  if (run.isTutorial && tutorialController?.active) {
    tutorialController.onShopFinished();
    return;
  }
  // advance blind
  run.blindIndex += 1;
  if (run.blindIndex > 2) {
    run.blindIndex = 0;
    run.blindBeaten = [false, false, false];
    run.ante += 1;
    if (run.ante > ANTES_TO_WIN) {
      win();
      return;
    }
  }
  showBlindSelect();
}

function showBlindSelect() {
  if (run.isTutorial && tutorialController?.shouldBlockBlindModal()) {
    run.phase = 'playing';
    renderAll();
    return;
  }
  run.phase = 'blindSelect';
  const b = BLIND_TYPES[run.blindIndex];
  const target = requirementFor(run.ante, run.blindIndex);
  els.blindOptions.innerHTML = '';
  const opt = document.createElement('div');
  opt.className = 'blind-option' + (b.key === 'boss' ? ' boss' : '');
  opt.innerHTML = `
    <div class="blind-emoji">${b.emoji}</div>
    <h3>${b.name}</h3>
    <div class="blind-info">
      关卡 ${run.ante} / ${ANTES_TO_WIN}<br/>
      目标得分 <b style="color:var(--gold)">${target}</b><br/>
      奖励 <b style="color:var(--gold)">$${b.reward}</b>
    </div>
    <button class="btn btn-play">
      <span class="btn-main">开始</span>
      <span class="btn-sub">Start Round</span>
    </button>
  `;
  opt.querySelector('button').onclick = () => {
    els.blindSelectModal.classList.add('hidden');
    startBlind();
  };
  els.blindOptions.appendChild(opt);
  els.blindSelectModal.classList.remove('hidden');
  renderAll();
}

function gameOver() {
  run.phase = 'gameover';
  els.endTitle.textContent = '游戏结束';
  els.endText.innerHTML = `
    你倒在了第 <b>${run.ante}</b> 关 · <b>${BLIND_TYPES[run.blindIndex].name}</b><br/>
    本轮得分 <b style="color:var(--gold)">${run.roundScore}</b> /
    目标 <b>${requirementFor(run.ante, run.blindIndex)}</b>
  `;
  els.endModal.classList.remove('hidden');
}

function win() {
  run.phase = 'win';
  els.endTitle.textContent = '通关 ★';
  els.endText.innerHTML = `
    恭喜击败了全部 ${ANTES_TO_WIN} 关！<br/>
    剩余资金 <b style="color:var(--gold)">$${run.money}</b> ·
    小丑数量 <b>${run.jokers.length}</b>
  `;
  els.endModal.classList.remove('hidden');
}

function restart() {
  els.endModal.classList.add('hidden');
  initRun();
}

// ---------- Init ----------
function initRun() {
  run.deck = createDeck();
  run.drawPile = [];
  run.hand = [];
  run.selected = new Set();
  run.jokers = [];
  run.money = 4;
  run.ante = 1;
  run.blindIndex = 0;
  run.blindBeaten = [false, false, false];
  run.handsLeft = STARTING_HANDS;
  run.discardsLeft = STARTING_DISCARDS;
  run.roundScore = 0;
  run.levels = defaultHandLevels();
  run.isTutorial = false;
  run.tutorialStep = null;
  run.phase = 'blindSelect';
  renderHandLevels();
  showBlindSelect();
  renderAll();
}

function initTutorialRun() {
  run.deck = createDeck();
  run.drawPile = [];
  run.hand = [];
  run.selected = new Set();
  run.jokers = [];
  run.money = 8;
  run.ante = 1;
  run.blindIndex = 0;
  run.blindBeaten = [false, false, false];
  run.handsLeft = STARTING_HANDS;
  run.discardsLeft = STARTING_DISCARDS;
  run.roundScore = 0;
  run.levels = defaultHandLevels();
  run.isTutorial = true;
  run.tutorialTarget = 40;
  run.phase = 'blindSelect';
  renderHandLevels();
  els.blindSelectModal.classList.add('hidden');
  els.shopModal.classList.add('hidden');
  els.endModal.classList.add('hidden');
  renderAll();
}

function startNormalRun() {
  tutorialController?.finish(false);
  els.welcomeModal.classList.add('hidden');
  initRun();
}

function closeAllModals() {
  els.handLevelsModal.classList.add('hidden');
  els.shopModal.classList.add('hidden');
  els.blindSelectModal.classList.add('hidden');
  els.endModal.classList.add('hidden');
}

function showWelcome() {
  const done = TutorialController.hasCompleted();
  els.resumeTutorialBtn?.classList.toggle('hidden', done);
  els.welcomeModal.classList.remove('hidden');
}

function startTutorial() {
  els.welcomeModal.classList.add('hidden');
  if (!tutorialController) tutorialController = new TutorialController(gameApi);
  tutorialController.start();
}

function renderAll() {
  renderHand();
  renderJokers();
  renderStats();
  renderBlind();
  renderHandPreview();
  renderHandLevels();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ---------- Event wiring ----------
els.playBtn.addEventListener('click', playSelected);
els.discardBtn.addEventListener('click', discardSelected);
els.sortRankBtn.addEventListener('click', sortHandByRank);
els.sortSuitBtn.addEventListener('click', sortHandBySuit);
els.runInfoBtn.addEventListener('click', () => els.handLevelsModal.classList.remove('hidden'));
els.rerollBtn.addEventListener('click', reroll);
els.nextRoundBtn.addEventListener('click', nextRound);
els.restartBtn.addEventListener('click', restart);

document.querySelectorAll('[data-close]').forEach(b => {
  b.addEventListener('click', () => b.closest('.modal').classList.add('hidden'));
});

document.addEventListener('keydown', (e) => {
  if (run.phase === 'playing') {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      if (!els.playBtn.disabled) playSelected();
    } else if (e.code === 'Backspace' || e.code === 'KeyD') {
      if (!els.discardBtn.disabled) discardSelected();
    }
  }
});

// Boot
tutorialController = new TutorialController(gameApi);
els.startGameBtn?.addEventListener('click', startNormalRun);
els.startTutorialBtn?.addEventListener('click', startTutorial);
els.resumeTutorialBtn?.addEventListener('click', startTutorial);
els.openTutorialBtn?.addEventListener('click', () => {
  closeAllModals();
  startTutorial();
});
showWelcome();
