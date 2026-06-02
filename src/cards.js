// =============================================================
// cards.js — deck, cards, poker hand evaluation (Balatro rules)
// =============================================================

export const SUITS = ['♠', '♥', '♦', '♣'];
export const SUIT_KEY = { '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs' };
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export const RANK_CHIPS = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 10, 'Q': 10, 'K': 10, 'A': 11
};
export const RANK_ORDER = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

const ROYAL_RANKS = new Set(['10', 'J', 'Q', 'K', 'A']);

let _cardId = 0;
export class Card {
  constructor(rank, suit) {
    this.rank = rank;
    this.suit = suit;
    this.id = `c${++_cardId}`;
    this.chips = RANK_CHIPS[rank];
    this.debuffed = false;
  }
  get isRed() { return this.suit === '♥' || this.suit === '♦'; }
  get isFace() { return this.rank === 'J' || this.rank === 'Q' || this.rank === 'K'; }
  get isAce()  { return this.rank === 'A'; }
  get isEven() { const v = RANK_ORDER[this.rank]; return this.rank !== 'A' && v % 2 === 0; }
  get isOdd()  { const v = RANK_ORDER[this.rank]; return this.rank === 'A' || (v <= 10 && v % 2 === 1); }
  get suitName() { return SUIT_KEY[this.suit]; }
}

export function createDeck() {
  const deck = [];
  for (const s of SUITS) for (const r of RANKS) deck.push(new Card(r, s));
  return deck;
}

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// =============================================================
// Hand types & levels (Balatro base values)
// =============================================================

export const HAND_TYPES = [
  'High Card', 'Pair', 'Two Pair', 'Three of a Kind',
  'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush',
  'Royal Flush',
  'Five of a Kind', 'Flush House', 'Flush Five'
];

export const HAND_LABELS = {
  'High Card':       '高牌',
  'Pair':            '对子',
  'Two Pair':        '两对',
  'Three of a Kind': '三条',
  'Straight':        '顺子',
  'Flush':           '同花',
  'Full House':      '葫芦',
  'Four of a Kind':  '四条',
  'Straight Flush':  '同花顺',
  'Royal Flush':     '皇家同花顺',
  'Five of a Kind':  '五条',
  'Flush House':     '同花葫芦',
  'Flush Five':      '同花五条'
};

/** Secret hands use Straight Flush level upgrades (Royal) or own base */
export const HAND_BASE = {
  'High Card':       { chips: 5,   mult: 1,  dChips: 10, dMult: 1 },
  'Pair':            { chips: 10,  mult: 2,  dChips: 15, dMult: 1 },
  'Two Pair':        { chips: 20,  mult: 2,  dChips: 20, dMult: 1 },
  'Three of a Kind': { chips: 30,  mult: 3,  dChips: 20, dMult: 2 },
  'Straight':        { chips: 30,  mult: 4,  dChips: 30, dMult: 3 },
  'Flush':           { chips: 35,  mult: 4,  dChips: 15, dMult: 2 },
  'Full House':      { chips: 40,  mult: 4,  dChips: 25, dMult: 2 },
  'Four of a Kind':  { chips: 60,  mult: 7,  dChips: 30, dMult: 3 },
  'Straight Flush':  { chips: 100, mult: 8,  dChips: 40, dMult: 4 },
  'Royal Flush':     { chips: 100, mult: 8,  dChips: 40, dMult: 4 },
  'Five of a Kind':  { chips: 120, mult: 12, dChips: 35, dMult: 3 },
  'Flush House':     { chips: 140, mult: 14, dChips: 40, dMult: 4 },
  'Flush Five':      { chips: 160, mult: 16, dChips: 50, dMult: 3 }
};

export const SECRET_HANDS = new Set(['Five of a Kind', 'Flush House', 'Flush Five']);

export function defaultHandLevels() {
  const out = {};
  for (const t of HAND_TYPES) out[t] = 1;
  return out;
}

export function chipsAndMultFor(handType, levels) {
  const levelKey = handType === 'Royal Flush' ? 'Straight Flush' : handType;
  const base = HAND_BASE[levelKey] || HAND_BASE['High Card'];
  const lvl = (levels && levels[levelKey]) || (levels && levels[handType]) || 1;
  const extra = lvl - 1;
  return {
    chips: base.chips + extra * base.dChips,
    mult:  base.mult  + extra * base.dMult,
    level: lvl
  };
}

function checkStraight(cards) {
  if (cards.length !== 5) return false;
  const order = cards.map(c => RANK_ORDER[c.rank]).sort((a, b) => a - b);
  if (new Set(order).size !== 5) return false;
  if (order.every((v, i) => i === 0 || v === order[i - 1] + 1)) return true;
  return order.join(',') === '2,3,4,5,14';
}

function checkFlush(cards) {
  return cards.length === 5 && cards.every(c => c.suit === cards[0].suit);
}

function isRoyalFlush(cards) {
  if (!checkStraight(cards) || !checkFlush(cards)) return false;
  return [...cards].every(c => ROYAL_RANKS.has(c.rank));
}

/**
 * Classify played cards (1–5) into a poker hand.
 * Straight / Flush require exactly 5 cards (vanilla Balatro).
 */
export function evaluateHand(cards) {
  if (!cards.length) {
    return { type: 'High Card', scoringCards: [], allPlayed: [] };
  }

  const counts = {};
  for (const c of cards) counts[c.rank] = (counts[c.rank] || 0) + 1;
  const countVals = Object.values(counts).sort((a, b) => b - a);

  const isFlush = checkFlush(cards);
  const isStraight = checkStraight(cards);

  const matches = (n) => {
    const target = Object.keys(counts).find(r => counts[r] === n);
    return cards.filter(c => c.rank === target);
  };

  // Secret / top tiers (need 5 cards)
  if (cards.length === 5) {
    if (isFlush && countVals[0] === 5) {
      return { type: 'Flush Five', scoringCards: [...cards], allPlayed: [...cards] };
    }
    if (countVals[0] === 5) {
      return { type: 'Five of a Kind', scoringCards: [...cards], allPlayed: [...cards] };
    }
    if (countVals[0] === 3 && countVals[1] === 2 && isFlush) {
      return { type: 'Flush House', scoringCards: [...cards], allPlayed: [...cards] };
    }
    if (isFlush && isStraight) {
      const type = isRoyalFlush(cards) ? 'Royal Flush' : 'Straight Flush';
      return { type, scoringCards: [...cards], allPlayed: [...cards] };
    }
  }

  if (countVals[0] === 4) {
    return { type: 'Four of a Kind', scoringCards: matches(4), allPlayed: [...cards] };
  }
  if (countVals[0] === 3 && countVals[1] === 2) {
    return { type: 'Full House', scoringCards: [...cards], allPlayed: [...cards] };
  }
  if (isFlush) {
    return { type: 'Flush', scoringCards: [...cards], allPlayed: [...cards] };
  }
  if (isStraight) {
    return { type: 'Straight', scoringCards: [...cards], allPlayed: [...cards] };
  }
  if (countVals[0] === 3) {
    return { type: 'Three of a Kind', scoringCards: matches(3), allPlayed: [...cards] };
  }
  if (countVals[0] === 2 && countVals[1] === 2) {
    const pairs = Object.keys(counts).filter(r => counts[r] === 2);
    const scoring = cards.filter(c => pairs.includes(c.rank));
    return { type: 'Two Pair', scoringCards: scoring, allPlayed: [...cards] };
  }
  if (countVals[0] === 2) {
    return { type: 'Pair', scoringCards: matches(2), allPlayed: [...cards] };
  }

  const sorted = [...cards].sort((a, b) => RANK_ORDER[b.rank] - RANK_ORDER[a.rank]);
  return { type: 'High Card', scoringCards: [sorted[0]], allPlayed: [...cards] };
}

export function markHandDiscovered(run, handType) {
  if (!run.discoveredHands) run.discoveredHands = new Set();
  run.discoveredHands.add(handType);
  if (SECRET_HANDS.has(handType)) run.discoveredHands.add(handType);
}
