// Texas Hold'em hand evaluation (standard poker, no Balatro extras)

import { RANK_ORDER } from '../cards.js';

const CATEGORY = {
  HIGH_CARD: 1,
  PAIR: 2,
  TWO_PAIR: 3,
  THREE_KIND: 4,
  STRAIGHT: 5,
  FLUSH: 6,
  FULL_HOUSE: 7,
  FOUR_KIND: 8,
  STRAIGHT_FLUSH: 9
};

const ROYAL_RANKS = new Set(['10', 'J', 'Q', 'K', 'A']);

function rankVal(rank) {
  return RANK_ORDER[rank];
}

function sortedRanksDesc(cards) {
  return cards.map(c => rankVal(c.rank)).sort((a, b) => b - a);
}

function isFlush(cards) {
  return cards.length === 5 && cards.every(c => c.suit === cards[0].suit);
}

function straightHigh(cards) {
  if (cards.length !== 5) return 0;
  const order = sortedRanksDesc(cards);
  const uniq = [...new Set(order)];
  if (uniq.length !== 5) return 0;
  if (uniq.every((v, i) => i === 0 || v === uniq[i - 1] - 1)) return uniq[0];
  if (uniq.join(',') === '14,5,4,3,2') return 5; // wheel
  return 0;
}

function rankCounts(cards) {
  const m = new Map();
  for (const c of cards) m.set(c.rank, (m.get(c.rank) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || rankVal(b[0]) - rankVal(a[0]));
}

/** @returns {{ category: number, kickers: number[] }} */
export function evaluateFive(cards) {
  if (cards.length !== 5) {
    const high = sortedRanksDesc(cards)[0] || 0;
    return { category: CATEGORY.HIGH_CARD, kickers: [high] };
  }

  const flush = isFlush(cards);
  const sh = straightHigh(cards);
  const counts = rankCounts(cards);
  const vals = counts.map(([r, n]) => ({ r, n, v: rankVal(r) }));

  if (flush && sh) {
    return { category: CATEGORY.STRAIGHT_FLUSH, kickers: [sh] };
  }
  if (vals[0].n === 4) {
    return { category: CATEGORY.FOUR_KIND, kickers: [vals[0].v, vals[1].v] };
  }
  if (vals[0].n === 3 && vals[1].n === 2) {
    return { category: CATEGORY.FULL_HOUSE, kickers: [vals[0].v, vals[1].v] };
  }
  if (flush) {
    return { category: CATEGORY.FLUSH, kickers: sortedRanksDesc(cards) };
  }
  if (sh) {
    return { category: CATEGORY.STRAIGHT, kickers: [sh] };
  }
  if (vals[0].n === 3) {
    const kickers = vals.slice(1).map(x => x.v).sort((a, b) => b - a);
    return { category: CATEGORY.THREE_KIND, kickers: [vals[0].v, ...kickers] };
  }
  if (vals[0].n === 2 && vals[1]?.n === 2) {
    const pairs = vals.filter(x => x.n === 2).map(x => x.v).sort((a, b) => b - a);
    const kicker = vals.find(x => x.n === 1)?.v ?? 0;
    return { category: CATEGORY.TWO_PAIR, kickers: [...pairs, kicker] };
  }
  if (vals[0].n === 2) {
    const kickers = vals.slice(1).map(x => x.v).sort((a, b) => b - a);
    return { category: CATEGORY.PAIR, kickers: [vals[0].v, ...kickers] };
  }
  return { category: CATEGORY.HIGH_CARD, kickers: sortedRanksDesc(cards) };
}

export function compareRank(a, b) {
  if (a.category !== b.category) return a.category - b.category;
  const len = Math.max(a.kickers.length, b.kickers.length);
  for (let i = 0; i < len; i++) {
    const d = (a.kickers[i] || 0) - (b.kickers[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

export function bestHandFromSeven(cards7) {
  let best = null;
  let bestCards = null;
  for (let a = 0; a < 3; a++) {
    for (let b = a + 1; b < 4; b++) {
      for (let c = b + 1; c < 5; c++) {
        for (let d = c + 1; d < 6; d++) {
          for (let e = d + 1; e < 7; e++) {
            const five = [cards7[a], cards7[b], cards7[c], cards7[d], cards7[e]];
            const rank = evaluateFive(five);
            if (!best || compareRank(rank, best) > 0) {
              best = rank;
              bestCards = five;
            }
          }
        }
      }
    }
  }
  return { rank: best, cards: bestCards };
}

export const CATEGORY_LABEL = {
  [CATEGORY.HIGH_CARD]: '高牌',
  [CATEGORY.PAIR]: '一对',
  [CATEGORY.TWO_PAIR]: '两对',
  [CATEGORY.THREE_KIND]: '三条',
  [CATEGORY.STRAIGHT]: '顺子',
  [CATEGORY.FLUSH]: '同花',
  [CATEGORY.FULL_HOUSE]: '葫芦',
  [CATEGORY.FOUR_KIND]: '四条',
  [CATEGORY.STRAIGHT_FLUSH]: '同花顺'
};

export function describeRank(rank) {
  return CATEGORY_LABEL[rank.category] || '高牌';
}
