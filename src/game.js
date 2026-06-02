// =============================================================
// game.js — main game loop, state, and UI rendering
// =============================================================

import {
  createDeck, shuffle, evaluateHand,
  HAND_TYPES, HAND_LABELS, chipsAndMultFor, defaultHandLevels,
  markHandDiscovered, SECRET_HANDS
} from './cards.js';
import { rollShopJokers } from './jokers.js';
import { scoreHand } from './scorer.js';
import { TutorialController, cardsFromSpecs, jokerFromId } from './tutorial.js';
import {
  rollBossBlind, bossScoreMult, applyBossRoundStart, clearBossCardDebuffs,
  validateBossPlay, afterBossHandPlayed, getRoundHandSize, getRoundHands, getRoundDiscards
} from './bosses.js';
import { rollShopPlanets, planetLabel } from './planets.js';
import { rollSkipTag } from './tags.js';
import {
  markJokerObtained, markPlanetObtained, markHandObtained, markShopOffer,
  syncDiscoveredHandsToRun, wireCodexUI
} from './codex.js';

// ---------- Constants ----------
const STARTING_HANDS = 4;
const STARTING_DISCARDS = 3;
const HAND_SIZE = 8;
const JOKER_SLOTS = 5;
const ANTES_TO_WIN = 8;

// Balatro blind rewards & base chip requirements (ante 1–8)
const BLIND_META = {
  small: { name: '小盲', emoji: '◐', reward: 3 },
  big:   { name: '大盲', emoji: '●', reward: 4 },
  boss:  { name: 'Boss', emoji: '☠', reward: 5 }
};
const BASE_REQ = [300, 800, 2000, 5000, 11000, 20000, 35000, 50000];

function requirementForBlind(ante, blindKey, boss = null) {
  const base = BASE_REQ[Math.min(ante - 1, BASE_REQ.length - 1)];
  const mult = blindKey === 'boss' ? bossScoreMult(boss, 'boss')
    : blindKey === 'big' ? 1.5 : 1;
  return Math.floor(base * mult);
}

function freshAnteProgress() {
  return { small: 'open', big: 'open', boss: 'open' };
}

// ---------- Run state ----------
const run = {
  deck: [],
  drawPile: [],
  discardPile: [],
  hand: [],
  selected: new Set(),
  jokers: [],
  money: 4,
  ante: 1,
  blindKey: null,       // 'small' | 'big' | 'boss'
  anteProgress: freshAnteProgress(),
  boss: null,
  seenBosses: new Set(),
  pillarPlayedIds: new Set(),
  discoveredHands: new Set(['High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush']),
  handsLeft: STARTING_HANDS,
  discardsLeft: STARTING_DISCARDS,
  roundScore: 0,
  levels: defaultHandLevels(),
  rerollCost: 5,
  shop: null,
  phase: 'blindSelect',
  isTutorial: false,
  tutorialStep: null,
  tutorialTarget: 40,
  bonusHandsNextBlind: 0,
  bonusDiscardsNextBlind: 0,
  shopDiscount: 0,
  freePlanetNextShop: false,
  forcedSelectId: null,
  bossRound: null,
  cashOutSummary: null
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
  cashOutModal: $('cashOutModal'),
  cashOutBody: $('cashOutBody'),
  cashOutContinueBtn: $('cashOutContinueBtn'),

  endModal: $('endModal'),
  endTitle: $('endTitle'),
  endText: $('endText'),
  restartBtn: $('restartBtn'),

  popupLayer: $('popupLayer'),

  welcomeModal: $('welcomeModal'),
  startGameBtn: $('startGameBtn'),
  startTutorialBtn: $('startTutorialBtn'),
  resumeTutorialBtn: $('resumeTutorialBtn'),
  openTutorialBtn: $('openTutorialBtn'),
  openCodexBtn: $('openCodexBtn'),
  welcomeCodexBtn: $('welcomeCodexBtn'),
  codexModal: $('codexModal'),
  codexStats: $('codexStats'),
  codexTabs: $('codexTabs'),
  codexFilters: $('codexFilters'),
  codexGrid: $('codexGrid')
};

let tutorialController = null;

function requirementForRun() {
  if (run.isTutorial) return run.tutorialTarget;
  return requirementForBlind(run.ante, run.blindKey || 'small', run.boss);
}

function anteRoundNumber() {
  const done = ['small', 'big', 'boss'].filter(k =>
    run.anteProgress[k] === 'beaten' || run.anteProgress[k] === 'skipped'
  ).length;
  return (run.ante - 1) * 3 + done + (run.phase === 'playing' ? 1 : 0);
}

function sellValue(joker) {
  return Math.max(1, Math.floor(joker.cost / 2));
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
    for (const id of ids) markJokerObtained(id);
    renderJokers();
  },
  setTarget(n) {
    run.tutorialTarget = n;
    renderBlind();
  },
  startRound() {
    run.blindKey = 'small';
    els.blindSelectModal.classList.add('hidden');
    startBlind('small');
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
      planets: [],
      sold: new Set()
    };
    run.rerollCost = 5;
    renderShop({ blindReward: 3, handBonus: 2, interest: 0 });
    markShopOffer(run.shop);
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

function jokerEl(j, index) {
  const el = document.createElement('div');
  el.className = 'joker';
  el.dataset.id = j.id;
  el.dataset.index = String(index);
  el.dataset.tip = `${j.name}\n${j.desc}${index >= 0 ? `\n右键出售 $${sellValue(j)}` : ''}`;
  if (j.color) el.style.borderColor = j.color;
  if (index >= 0 && run.bossRound?.disabledJokerIndex === index) el.classList.add('joker-disabled');
  el.innerHTML = `
    <div class="joker-art" style="${j.color ? `color:${j.color};` : ''}">${j.art}</div>
    <div class="joker-name">${j.name}</div>
  `;
  if (index >= 0) {
    el.draggable = true;
    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/joker-index', String(index));
      el.classList.add('joker-dragging');
    });
    el.addEventListener('dragend', () => el.classList.remove('joker-dragging'));
    el.addEventListener('dragover', (e) => e.preventDefault());
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      const from = Number(e.dataTransfer.getData('text/joker-index'));
      const to = index;
      if (Number.isNaN(from) || from === to) return;
      const [item] = run.jokers.splice(from, 1);
      run.jokers.splice(to, 0, item);
      renderJokers();
    });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      sellJoker(index);
    });
  }
  return el;
}

function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'game-toast';
  t.textContent = msg;
  els.popupLayer.appendChild(t);
  setTimeout(() => t.remove(), 2400);
}

function sellJoker(index) {
  if (run.phase !== 'shop' && run.phase !== 'playing') return;
  const j = run.jokers[index];
  if (!j) return;
  run.money += sellValue(j);
  run.jokers.splice(index, 1);
  renderJokers();
  renderStats();
  if (run.phase === 'shop') renderShop(run.cashOutSummary);
}

function renderHand() {
  els.handRow.innerHTML = '';
  for (const c of run.hand) els.handRow.appendChild(cardEl(c, { dealing: c._justDealt }));
  for (const c of run.hand) c._justDealt = false;
}

function renderJokers() {
  els.jokerRow.innerHTML = '';
  run.jokers.forEach((j, i) => els.jokerRow.appendChild(jokerEl(j, i)));
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
  els.round.textContent = run.isTutorial ? 1 : anteRoundNumber();
  els.deckCount.textContent = run.drawPile.length;
  els.deckTotal.textContent = run.deck.length;
  els.roundScore.textContent = run.roundScore;
}

function renderBlind() {
  if (run.isTutorial) {
    els.blindName.textContent = '教学关';
    els.blindTarget.textContent = run.tutorialTarget;
    els.blindReward.textContent = 3;
    return;
  }
  const meta = BLIND_META[run.blindKey || 'small'];
  const bossLabel = run.boss ? ` · ${run.boss.nameZh}` : '';
  els.blindName.textContent = `${meta.name}${bossLabel}`;
  els.blindTarget.textContent = requirementForRun();
  els.blindReward.textContent = run.blindKey === 'boss' && run.ante >= 8 ? 8 : meta.reward;
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
  const visible = HAND_TYPES.filter(t =>
    !SECRET_HANDS.has(t) || run.discoveredHands.has(t)
  );
  for (const t of visible) {
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
  if (run.forcedSelectId && card.id === run.forcedSelectId) return;
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
function startBlind(blindKey) {
  run.blindKey = blindKey;
  if (blindKey === 'boss' && !run.isTutorial) {
    run.boss = rollBossBlind(run);
  } else if (blindKey !== 'boss') {
    run.boss = null;
  }

  run.phase = 'playing';
  run.handsLeft = getRoundHands(run);
  run.discardsLeft = getRoundDiscards(run);
  run.bonusHandsNextBlind = 0;
  run.bonusDiscardsNextBlind = 0;
  run.roundScore = 0;
  run.selected.clear();
  run.forcedSelectId = null;

  clearBossCardDebuffs(run);
  applyBossRoundStart(run);

  run.drawPile = shuffle([...run.deck]);
  run.discardPile = [];
  run.hand = [];
  drawToFull();

  if (run.boss?.id === 'cerulean_bell' && run.hand.length) {
    const c = run.hand[Math.floor(Math.random() * run.hand.length)];
    run.forcedSelectId = c.id;
    run.selected.add(c.id);
  }
  els.lastHand.querySelector('.last-hand-name').textContent = '—';
  els.lastHand.querySelector('.chips-pill').textContent = '0';
  els.lastHand.querySelector('.mult-pill').textContent = '0';
  renderAll();
}

function drawToFull() {
  const target = run.isTutorial ? HAND_SIZE : getRoundHandSize(run);
  while (run.hand.length < target) {
    if (run.drawPile.length === 0) {
      if (run.discardPile.length === 0) break;
      run.drawPile = shuffle(run.discardPile);
      run.discardPile = [];
    }
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
  const preType = evaluateHand(playedCards).type;
  if (!run.isTutorial) {
    const bossCheck = validateBossPlay(run, playedCards, preType);
    if (!bossCheck.ok) {
      showToast(bossCheck.reason);
      return;
    }
  }

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
    if (ev.kind === 'boss') {
      chipsPill.textContent = ev.snapshot.chips;
      multPill.textContent = ev.snapshot.mult;
      spawnPopup(ev.label, 'mult', preview);
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
  run.discardPile.push(...playedCards);
  if (!run.isTutorial && (run.blindKey === 'small' || run.blindKey === 'big')) {
    for (const c of playedCards) run.pillarPlayedIds.add(c.id);
  }
  markHandDiscovered(run, result.hand.type);
  markHandObtained(result.hand.type);
  if (!run.isTutorial) afterBossHandPlayed(run, playedCards, result.hand.type);

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
    run.discardPile.push(c);
  }
  run.selected.clear();
  run.discardsLeft -= 1;
  drawToFull();
  renderAll();
  notifyTutorial('discarded', { cards });
}

function winBlind() {
  const meta = BLIND_META[run.blindKey];
  const blindReward = run.blindKey === 'boss' && run.ante >= 8 ? 8 : meta.reward;
  const handBonus = run.handsLeft;
  const interest = Math.min(5, Math.floor(run.money / 5));
  run.anteProgress[run.blindKey] = 'beaten';
  run.cashOutSummary = { blindReward, handBonus, interest, tagNote: run.lastTagDetail || '' };
  run.lastTagDetail = null;
  openCashOut();
}

function openCashOut() {
  run.phase = 'cashOut';
  const s = run.cashOutSummary;
  const total = s.blindReward + s.handBonus + s.interest;
  const meta = BLIND_META[run.blindKey];
  els.cashOutBody.innerHTML = `
    <div class="cashout-title">击败 ${meta.name}${run.boss ? ` · ${run.boss.nameZh}` : ''}</div>
    <div class="cashout-lines">
      <div>盲注奖励 <span class="gold">$${s.blindReward}</span></div>
      <div>剩余手牌 <span class="gold">$${s.handBonus}</span> <span class="muted">($1/次)</span></div>
      <div>利息 <span class="gold">$${s.interest}</span> <span class="muted">(每 $5 → $1，上限 $5)</span></div>
    </div>
    <div class="cashout-total">合计 <span class="gold">$${total}</span></div>
    ${s.tagNote ? `<div class="cashout-tag">${s.tagNote}</div>` : ''}
  `;
  els.cashOutModal.classList.remove('hidden');
}

function finishCashOut() {
  const s = run.cashOutSummary;
  run.money += s.blindReward + s.handBonus + s.interest;
  els.cashOutModal.classList.add('hidden');

  if (run.blindKey === 'boss') {
    if (run.ante >= ANTES_TO_WIN) {
      win();
      return;
    }
    run.ante += 1;
    run.anteProgress = freshAnteProgress();
    run.pillarPlayedIds = new Set();
    run.boss = null;
    clearBossCardDebuffs(run);
  }
  openShop(s);
}

function shopPrice(base) {
  return Math.max(1, base - (run.shopDiscount || 0));
}

function openShop(summary) {
  run.phase = 'shop';
  run.cashOutSummary = summary;
  const planets = rollShopPlanets(2, run.discoveredHands);
  if (run.freePlanetNextShop && planets.length) {
    planets.push({ ...planets[0], cost: 0, free: true, name: planets[0].name + ' (赠)' });
    run.freePlanetNextShop = false;
  }
  run.shop = {
    jokers: rollShopJokers(2, new Set(run.jokers.map(j => j.id))),
    planets,
    sold: new Set()
  };
  run.rerollCost = 5;
  run.shopDiscount = 0;
  markShopOffer(run.shop);
  renderShop(summary);
  els.shopModal.classList.remove('hidden');
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
    const card = jokerEl(j, -1);
    wrap.appendChild(card);
    const price = document.createElement('button');
    price.className = 'price';
    const cost = shopPrice(j.cost);
    price.textContent = cost === 0 ? '免费' : `$${cost}`;
    price.onclick = () => buyJoker(i);
    wrap.appendChild(price);
    els.shopGrid.appendChild(wrap);
  });

  run.shop.planets.forEach((p, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'shop-item' + (run.shop.sold.has(`p${i}`) ? ' sold' : '');
    const card = document.createElement('div');
    card.className = 'joker planet-card';
    card.style.borderColor = 'var(--blue)';
    card.dataset.tip = `${planetLabel(p)}\n${p.desc || '牌型等级 +1'}`;
    card.innerHTML = `
      <div class="joker-art" style="color:var(--blue);">${p.art}</div>
      <div class="joker-name" style="color:var(--blue);">${p.name}</div>
    `;
    wrap.appendChild(card);
    const price = document.createElement('button');
    price.className = 'price';
    const cost = p.free ? 0 : shopPrice(p.cost);
    price.textContent = cost === 0 ? '免费' : `$${cost}`;
    price.onclick = () => buyPlanet(i);
    wrap.appendChild(price);
    els.shopGrid.appendChild(wrap);
  });
}

function buyJoker(i) {
  const j = run.shop.jokers[i];
  if (!j || run.shop.sold.has(`j${i}`)) return;
  const cost = shopPrice(j.cost);
  if (run.money < cost) return;
  if (run.jokers.length >= JOKER_SLOTS) return;
  run.money -= cost;
  run.jokers.push(j);
  markJokerObtained(j.id);
  run.shop.sold.add(`j${i}`);
  renderShop(run.cashOutSummary);
  renderJokers();
  renderStats();
}

function buyPlanet(i) {
  const p = run.shop.planets[i];
  if (!p || run.shop.sold.has(`p${i}`)) return;
  const cost = p.free ? 0 : shopPrice(p.cost);
  if (run.money < cost) return;
  run.money -= cost;
  const key = p.handType === 'Royal Flush' ? 'Straight Flush' : p.handType;
  run.levels[key] = (run.levels[key] || 1) + 1;
  markPlanetObtained(p.id);
  run.shop.sold.add(`p${i}`);
  renderShop(run.cashOutSummary);
  renderHandLevels();
}

function reroll() {
  if (run.money < run.rerollCost) return;
  run.money -= run.rerollCost;
  run.rerollCost += 1;
  run.shop.jokers = rollShopJokers(2, new Set(run.jokers.map(j => j.id)));
  run.shop.planets = rollShopPlanets(2, run.discoveredHands);
  run.shop.sold = new Set();
  markShopOffer(run.shop);
  renderShop(run.cashOutSummary);
}

function nextRound() {
  els.shopModal.classList.add('hidden');
  if (run.isTutorial && tutorialController?.active) {
    tutorialController.onShopFinished();
    return;
  }
  showBlindSelect();
}

function skipBlind(key) {
  const tag = rollSkipTag();
  tag.apply(run);
  run.anteProgress[key] = 'skipped';
  run.lastTagDetail = `${tag.name}：${tag.desc}`;
  showBlindSelect();
  showToast(`跳过盲注 · ${tag.name}`);
}

function beginBlind(key) {
  els.blindSelectModal.classList.add('hidden');
  startBlind(key);
}

function showBlindSelect() {
  if (run.isTutorial && tutorialController?.shouldBlockBlindModal()) {
    run.phase = 'playing';
    renderAll();
    return;
  }
  run.phase = 'blindSelect';
  els.blindOptions.innerHTML = '';

  for (const key of ['small', 'big', 'boss']) {
    const status = run.anteProgress[key];
    if (status === 'beaten' || status === 'skipped') continue;

    const meta = BLIND_META[key];
    const previewBoss = key === 'boss' ? run.boss : null;
    const target = requirementForBlind(run.ante, key, previewBoss);
    const reward = key === 'boss' && run.ante >= 8 ? 8 : meta.reward;

    const opt = document.createElement('div');
    opt.className = 'blind-option' + (key === 'boss' ? ' boss' : '');
    const bossLine = key === 'boss'
      ? `<div class="blind-boss-hint">${previewBoss ? previewBoss.nameZh + ' — ' + previewBoss.desc : '随机 Boss 盲注（含特殊规则）'}</div>`
      : '';
    opt.innerHTML = `
      <div class="blind-emoji">${meta.emoji}</div>
      <h3>${meta.name}</h3>
      <div class="blind-info">
        关卡 ${run.ante} / ${ANTES_TO_WIN}<br/>
        目标 <b style="color:var(--gold)">${target}</b><br/>
        奖励 <b style="color:var(--gold)">$${reward}</b>
      </div>
      ${bossLine}
      <div class="blind-actions">
        ${key !== 'boss' ? '<button type="button" class="btn btn-sort blind-skip"><span class="btn-main">跳过</span><span class="btn-sub">Tag</span></button>' : ''}
        <button type="button" class="btn btn-play blind-start">
          <span class="btn-main">挑战</span>
          <span class="btn-sub">Play</span>
        </button>
      </div>
    `;
    if (key !== 'boss') opt.querySelector('.blind-skip').onclick = () => skipBlind(key);
    opt.querySelector('.blind-start').onclick = () => beginBlind(key);
    els.blindOptions.appendChild(opt);
  }

  els.blindSelectModal.classList.remove('hidden');
  renderAll();
}

function gameOver() {
  run.phase = 'gameover';
  const meta = BLIND_META[run.blindKey || 'small'];
  els.endTitle.textContent = '游戏结束';
  els.endText.innerHTML = `
    你倒在了第 <b>${run.ante}</b> 关 · <b>${meta.name}</b>${run.boss ? ` (${run.boss.nameZh})` : ''}<br/>
    本轮得分 <b style="color:var(--gold)">${run.roundScore}</b> /
    目标 <b>${requirementForRun()}</b>
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
function resetRunState(tutorial = false) {
  run.deck = createDeck();
  run.drawPile = [];
  run.discardPile = [];
  run.hand = [];
  run.selected = new Set();
  run.jokers = [];
  run.money = tutorial ? 8 : 4;
  run.ante = 1;
  run.blindKey = null;
  run.anteProgress = freshAnteProgress();
  run.boss = null;
  run.seenBosses = new Set();
  run.pillarPlayedIds = new Set();
  run.discoveredHands = new Set([
    'High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight',
    'Flush', 'Full House', 'Four of a Kind', 'Straight Flush'
  ]);
  run.handsLeft = STARTING_HANDS;
  run.discardsLeft = STARTING_DISCARDS;
  run.roundScore = 0;
  run.levels = defaultHandLevels();
  run.isTutorial = tutorial;
  run.tutorialTarget = 40;
  run.bonusHandsNextBlind = 0;
  run.bonusDiscardsNextBlind = 0;
  run.shopDiscount = 0;
  run.freePlanetNextShop = false;
  run.forcedSelectId = null;
  clearBossCardDebuffs(run);
}

function initRun() {
  resetRunState(false);
  syncDiscoveredHandsToRun(run);
  run.phase = 'blindSelect';
  renderHandLevels();
  showBlindSelect();
  renderAll();
}

function initTutorialRun() {
  resetRunState(true);
  syncDiscoveredHandsToRun(run);
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
  els.codexModal.classList.add('hidden');
  els.cashOutModal.classList.add('hidden');
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
els.cashOutContinueBtn?.addEventListener('click', finishCashOut);
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
wireCodexUI(els);
tutorialController = new TutorialController(gameApi);
els.startGameBtn?.addEventListener('click', startNormalRun);
els.startTutorialBtn?.addEventListener('click', startTutorial);
els.resumeTutorialBtn?.addEventListener('click', startTutorial);
els.openTutorialBtn?.addEventListener('click', () => {
  closeAllModals();
  startTutorial();
});
showWelcome();
