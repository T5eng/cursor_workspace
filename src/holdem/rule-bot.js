// Rule-based opponent (preflop tiers + simple pot odds)

import { RANK_ORDER } from '../cards.js';

const PREMIUM = new Set(['AA', 'KK', 'QQ', 'JJ', 'AK', 'AQ', 'KQ']);
const PLAYABLE = new Set([
  'TT', '99', '88', '77', 'AJ', 'AT', 'KJ', 'KT', 'QJ', 'QT', 'JT', 'T9s', '98s', '87s', '76s'
]);

function holeKey(c1, c2) {
  const v1 = RANK_ORDER[c1.rank];
  const v2 = RANK_ORDER[c2.rank];
  const hi = v1 >= v2 ? c1.rank : c2.rank;
  const lo = v1 >= v2 ? c2.rank : c1.rank;
  const suited = c1.suit === c2.suit;
  if (hi === lo) return `${hi}${lo}`;
  const pair = `${hi}${lo}`;
  if (suited && RANK_ORDER[hi] - RANK_ORDER[lo] <= 4) return `${pair}s`;
  return pair;
}

function preflopStrength(hole) {
  if (!hole || hole.length < 2 || hole[0].hidden) return 0.35;
  const key = holeKey(hole[0], hole[1]);
  if (PREMIUM.has(key)) return 0.88;
  if (PLAYABLE.has(key) || PLAYABLE.has(key.replace('s', ''))) return 0.62;
  const v1 = RANK_ORDER[hole[0].rank];
  const v2 = RANK_ORDER[hole[1].rank];
  if (Math.max(v1, v2) >= 12) return 0.45;
  return 0.28;
}

function boardStrength(hole, board) {
  if (!board.length) return preflopStrength(hole);
  const ranks = [...hole, ...board].map(c => RANK_ORDER[c.rank]);
  const counts = {};
  for (const r of ranks) counts[r] = (counts[r] || 0) + 1;
  const max = Math.max(...Object.values(counts));
  if (max >= 4) return 0.98;
  if (max === 3) return 0.85;
  if (max === 2 && Object.values(counts).filter(n => n === 2).length >= 2) return 0.78;
  if (max === 2) return 0.55 + board.length * 0.04;
  const suits = {};
  for (const c of [...hole, ...board]) {
    suits[c.suit] = (suits[c.suit] || 0) + 1;
  }
  if (Math.max(...Object.values(suits)) >= 4) return 0.5 + board.length * 0.05;
  return 0.32 + board.length * 0.06;
}

function pickRaiseAmount(legal, pot, street) {
  const { min, max } = legal.raise;
  const target = street === 'preflop'
    ? Math.min(max, Math.max(min, Math.floor(pot * 0.6)))
    : Math.min(max, Math.max(min, Math.floor(pot * 0.55)));
  return target;
}

export function ruleBotDecide(table, seatId, legal) {
  const p = table.players[seatId];
  const hole = p.hole;
  const board = table.board;
  const strength = boardStrength(hole, board);
  const toCall = table.currentBet - p.betStreet;
  const potOdds = toCall > 0 ? toCall / (table.pot + toCall) : 0;

  if (legal.check) {
    if (strength > 0.72 && legal.raise && Math.random() < 0.55) {
      return { action: 'raise', amount: pickRaiseAmount(legal, table.pot, table.street) };
    }
    if (strength > 0.4 && Math.random() < 0.15 && legal.raise) {
      return { action: 'raise', amount: pickRaiseAmount(legal, table.pot, table.street) };
    }
    return { action: 'check' };
  }

  if (legal.call) {
    if (strength < potOdds - 0.08 && toCall > table.bigBlind * 2) {
      return { action: 'fold' };
    }
    if (strength > 0.8 && legal.raise && Math.random() < 0.5) {
      return { action: 'raise', amount: pickRaiseAmount(legal, table.pot, table.street) };
    }
    if (strength >= potOdds || toCall <= table.bigBlind) {
      return { action: 'call' };
    }
    return { action: 'fold' };
  }

  return { action: 'fold' };
}
