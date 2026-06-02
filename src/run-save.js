// =============================================================
// run-save.js — 正式局进度 localStorage 持久化
// =============================================================

import { Card } from './cards.js';
import { JOKERS_BY_ID } from './jokers.js';

export const RUN_SAVE_KEY = 'joker-cards-run-save-v1';

function storage() {
  return typeof localStorage !== 'undefined' ? localStorage : null;
}

export function cardToJSON(c) {
  return {
    rank: c.rank,
    suit: c.suit,
    id: c.id,
    debuffed: !!c.debuffed
  };
}

export function cardFromJSON(o) {
  const c = new Card(o.rank, o.suit);
  c.id = o.id;
  if (o.debuffed) c.debuffed = true;
  return c;
}

function jokerFromId(id) {
  const def = JOKERS_BY_ID[id];
  return def ? { ...def, hooks: def.hooks } : null;
}

/** @returns {object|null} */
export function serializeRun(run, opts = {}) {
  const { includeTutorial = false } = opts;
  if (!includeTutorial && run.isTutorial) return null;
  if (!includeTutorial && (run.phase === 'win' || run.phase === 'gameover')) return null;

  return {
    version: 1,
    savedAt: Date.now(),
    deck: run.deck.map(cardToJSON),
    drawPile: run.drawPile.map(cardToJSON),
    discardPile: run.discardPile.map(cardToJSON),
    hand: run.hand.map(cardToJSON),
    selected: [...run.selected],
    jokers: run.jokers.map(j => j.id),
    money: run.money,
    ante: run.ante,
    blindKey: run.blindKey,
    anteProgress: { ...run.anteProgress },
    boss: run.boss ? { ...run.boss } : null,
    seenBosses: [...run.seenBosses],
    pillarPlayedIds: [...run.pillarPlayedIds],
    discoveredHands: [...run.discoveredHands],
    handsLeft: run.handsLeft,
    discardsLeft: run.discardsLeft,
    roundScore: run.roundScore,
    levels: { ...run.levels },
    rerollCost: run.rerollCost,
    shopDiscount: run.shopDiscount,
    freePlanetNextShop: run.freePlanetNextShop,
    bonusHandsNextBlind: run.bonusHandsNextBlind,
    bonusDiscardsNextBlind: run.bonusDiscardsNextBlind,
    forcedSelectId: run.forcedSelectId,
    cashOutSummary: run.cashOutSummary,
    lastHand: run._lastHandSave || null,
    shop: run.shop ? {
      jokers: run.shop.jokers.map(j => j.id),
      planets: run.shop.planets.map(p => ({ ...p })),
      sold: [...run.shop.sold]
    } : null,
    phase: run.phase
  };
}

export function applySerializedRun(run, data) {
  if (!data || data.version !== 1) return false;

  run.deck = data.deck.map(cardFromJSON);
  run.drawPile = data.drawPile.map(cardFromJSON);
  run.discardPile = (data.discardPile || []).map(cardFromJSON);
  run.hand = data.hand.map(cardFromJSON);
  run.selected = new Set(data.selected || []);
  run.jokers = data.jokers.map(id => jokerFromId(id)).filter(Boolean);
  run.money = data.money;
  run.ante = data.ante;
  run.blindKey = data.blindKey;
  run.anteProgress = { ...data.anteProgress };
  run.boss = data.boss ? { ...data.boss } : null;
  run.seenBosses = new Set(data.seenBosses || []);
  run.pillarPlayedIds = new Set(data.pillarPlayedIds || []);
  run.discoveredHands = new Set(data.discoveredHands || []);
  run.handsLeft = data.handsLeft;
  run.discardsLeft = data.discardsLeft;
  run.roundScore = data.roundScore;
  run.levels = { ...data.levels };
  run.rerollCost = data.rerollCost;
  run.shopDiscount = data.shopDiscount || 0;
  run.freePlanetNextShop = data.freePlanetNextShop || false;
  run.bonusHandsNextBlind = data.bonusHandsNextBlind || 0;
  run.bonusDiscardsNextBlind = data.bonusDiscardsNextBlind || 0;
  run.forcedSelectId = data.forcedSelectId || null;
  run.cashOutSummary = data.cashOutSummary || null;
  run._lastHandSave = data.lastHand || null;
  run.isTutorial = false;
  run.tutorialStep = null;
  run.phase = data.phase;
  run.bossRound = null;

  if (data.shop) {
    run.shop = {
      jokers: data.shop.jokers.map(id => jokerFromId(id)).filter(Boolean),
      planets: data.shop.planets.map(p => ({ ...p })),
      sold: new Set(data.shop.sold)
    };
  } else {
    run.shop = null;
  }
  return true;
}

export function saveRun(run) {
  const data = serializeRun(run);
  if (!data) {
    clearSavedRun();
    return false;
  }
  storage()?.setItem(RUN_SAVE_KEY, JSON.stringify(data));
  return true;
}

/** @returns {object|null} */
export function loadRun() {
  try {
    const raw = storage()?.getItem(RUN_SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function hasSavedRun() {
  return loadRun() != null;
}

export function clearSavedRun() {
  storage()?.removeItem(RUN_SAVE_KEY);
}

export function formatSaveSummary(data) {
  if (!data) return '';
  const phaseLabels = {
    blindSelect: '选择盲注',
    playing: '对局中',
    cashOut: '结算',
    shop: '商店'
  };
  const phase = phaseLabels[data.phase] || data.phase;
  const d = new Date(data.savedAt);
  const time = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `第 ${data.ante} 关 · $${data.money} · ${phase} · ${time}`;
}
