// Hold'em table persistence (localStorage)

import { cardToJSON, cardFromJSON } from '../run-save.js';
import { createPlayer, createTable } from './engine.js';

export const HOLDEM_SAVE_KEY = 'holdem_save_v1';

function storage() {
  return typeof localStorage !== 'undefined' ? localStorage : null;
}

export function serializeTable(table, meta) {
  if (!table || table.phase === 'tournamentOver') return null;
  return {
    version: 1,
    savedAt: Date.now(),
    meta: { ...meta },
    smallBlind: table.smallBlind,
    bigBlind: table.bigBlind,
    dealerIndex: table.dealerIndex,
    handNumber: table.handNumber,
    street: table.street,
    phase: table.phase,
    pot: table.pot,
    board: table.board.map(cardToJSON),
    deck: table.deck.map(cardToJSON),
    currentBet: table.currentBet,
    minRaise: table.minRaise,
    lastRaiseSize: table.lastRaiseSize,
    actorIndex: table.actorIndex,
    message: table.message || '',
    winners: table.winners,
    players: table.players.map(p => ({
      id: p.id,
      name: p.name,
      stack: p.stack,
      isHuman: p.isHuman,
      botType: p.botType,
      hole: p.hole.map(cardToJSON),
      folded: p.folded,
      allIn: p.allIn,
      betStreet: p.betStreet,
      betHand: p.betHand,
      actedSinceRaise: p.actedSinceRaise
    }))
  };
}

export function deserializeTable(data) {
  if (!data || data.version !== 1) return null;
  const players = data.players.map(p => {
    const pl = createPlayer({
      id: p.id,
      name: p.name,
      stack: p.stack,
      isHuman: p.isHuman,
      botType: p.botType
    });
    pl.hole = p.hole.map(cardFromJSON);
    pl.folded = p.folded;
    pl.allIn = p.allIn;
    pl.betStreet = p.betStreet;
    pl.betHand = p.betHand;
    pl.actedSinceRaise = p.actedSinceRaise;
    return pl;
  });
  const table = createTable({
    players,
    smallBlind: data.smallBlind,
    bigBlind: data.bigBlind,
    dealerIndex: data.dealerIndex
  });
  table.handNumber = data.handNumber;
  table.street = data.street;
  table.phase = data.phase;
  table.pot = data.pot;
  table.board = data.board.map(cardFromJSON);
  table.deck = data.deck.map(cardFromJSON);
  table.currentBet = data.currentBet;
  table.minRaise = data.minRaise;
  table.lastRaiseSize = data.lastRaiseSize;
  table.actorIndex = data.actorIndex;
  table.message = data.message;
  table.winners = data.winners;
  table.showdownRanks = null;
  return { table, meta: data.meta };
}

export function saveHoldem(table, meta, logLines = []) {
  const s = storage();
  if (!s) return;
  const payload = serializeTable(table, meta);
  if (!payload) {
    s.removeItem(HOLDEM_SAVE_KEY);
    return;
  }
  payload.logLines = logLines.slice(0, 30);
  s.setItem(HOLDEM_SAVE_KEY, JSON.stringify(payload));
}

export function loadHoldem() {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(HOLDEM_SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const restored = deserializeTable(data);
    if (!restored) return null;
    return { ...restored, logLines: data.logLines || [], savedAt: data.savedAt };
  } catch {
    return null;
  }
}

export function clearHoldemSave() {
  storage()?.removeItem(HOLDEM_SAVE_KEY);
}

export function formatSaveSummary(savedAt) {
  if (!savedAt) return '已保存的牌局';
  const d = new Date(savedAt);
  return `继续牌局 · ${d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
}
