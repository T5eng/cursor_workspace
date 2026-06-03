// No-limit Texas Hold'em engine (6-max capable)

import { createDeck, shuffle, Card } from '../cards.js';
import { bestHandFromSeven, compareRank } from './hand-rank.js';

export const STREETS = ['preflop', 'flop', 'turn', 'river'];

let _hid = 0;

export function createPlayer({ id, name, stack, isHuman = false, botType = 'rule' }) {
  return {
    id,
    name,
    stack,
    isHuman,
    botType,
    hole: [],
    folded: false,
    allIn: false,
    betStreet: 0,
    betHand: 0,
    actedSinceRaise: false
  };
}

export function createTable({
  players,
  smallBlind = 5,
  bigBlind = 10,
  dealerIndex = 0
}) {
  return {
    players,
    smallBlind,
    bigBlind,
    dealerIndex,
    deck: [],
    board: [],
    street: 'preflop',
    pot: 0,
    sidePots: [],
    currentBet: 0,
    minRaise: bigBlind,
    lastRaiseSize: bigBlind,
    actorIndex: -1,
    handNumber: 0,
    phase: 'idle',
    message: '',
    winners: null,
    showdownRanks: null
  };
}

function activePlayers(t) {
  return t.players.filter(p => p.stack > 0 || p.betHand > 0 || !p.folded);
}

function inHand(t) {
  return t.players.filter(p => !p.folded && (p.stack > 0 || p.betHand > 0 || p.allIn));
}

function canAct(p) {
  return !p.folded && !p.allIn && p.stack > 0;
}

function resetStreetBets(t) {
  for (const p of t.players) {
    p.betStreet = 0;
    p.actedSinceRaise = false;
  }
  t.currentBet = 0;
  t.minRaise = t.bigBlind;
  t.lastRaiseSize = t.bigBlind;
}

function postBlind(t, seat, amount) {
  const p = t.players[seat];
  const pay = Math.min(amount, p.stack);
  p.stack -= pay;
  p.betStreet += pay;
  p.betHand += pay;
  t.pot += pay;
  if (p.stack === 0) p.allIn = true;
  return pay;
}

function nextSeat(t, from, pred) {
  const n = t.players.length;
  if (!n) return -1;
  const start = ((from % n) + n) % n;
  for (let i = 1; i <= n; i++) {
    const idx = (start + i) % n;
    if (pred(t.players[idx])) return idx;
  }
  return -1;
}

function firstToActPreflop(t) {
  const n = t.players.length;
  if (n === 2) return t.dealerIndex;
  return nextSeat(t, t.dealerIndex, p => canAct(p));
}

function firstToActPostflop(t) {
  return nextSeat(t, t.dealerIndex, p => canAct(p));
}

function bettingComplete(t) {
  const contenders = t.players.filter(p => !p.folded && !p.allIn);
  if (contenders.length <= 1) return true;
  for (const p of contenders) {
    if (p.betStreet < t.currentBet) return false;
    if (!p.actedSinceRaise) return false;
  }
  return true;
}

function aliveCount(t) {
  return t.players.filter(p => !p.folded).length;
}

function awardPotTo(t, seatIndices, amount) {
  if (!amount) return;
  const share = Math.floor(amount / seatIndices.length);
  let rem = amount - share * seatIndices.length;
  for (const i of seatIndices) {
    t.players[i].stack += share + (rem > 0 ? 1 : 0);
    if (rem > 0) rem--;
  }
}

function computeSidePots(t) {
  const contrib = t.players.map(p => ({ seat: p.id, amount: p.betHand, folded: p.folded }));
  const levels = [...new Set(contrib.filter(c => c.amount > 0).map(c => c.amount))].sort((a, b) => a - b);
  const pots = [];
  let prev = 0;
  for (const level of levels) {
    const slice = level - prev;
    const eligible = contrib.filter(c => c.amount >= level && !c.folded).map(c => c.seat);
    const contributors = contrib.filter(c => c.amount >= level);
    const size = slice * contributors.length;
    if (size > 0) pots.push({ amount: size, eligible });
    prev = level;
  }
  return pots;
}

function resolveShowdown(t) {
  const live = t.players.filter(p => !p.folded);
  const ranks = live.map(p => {
    const seven = [...p.hole, ...t.board];
    const { rank, cards } = bestHandFromSeven(seven);
    return { seat: p.id, rank, cards, name: p.name };
  });
  ranks.sort((a, b) => compareRank(b.rank, a.rank));
  t.showdownRanks = ranks;

  const pots = computeSidePots(t);
  if (!pots.length) {
    awardPotTo(t, [ranks[0].seat], t.pot);
  } else {
    for (const pot of pots) {
      const eligibleRanks = ranks.filter(r => pot.eligible.includes(r.seat));
      if (!eligibleRanks.length) continue;
      const best = eligibleRanks[0].rank;
      const winners = eligibleRanks.filter(r => compareRank(r.rank, best) === 0).map(r => r.seat);
      awardPotTo(t, winners, pot.amount);
    }
  }
  t.pot = 0;
  const names = [...new Set(ranks.filter(r =>
    compareRank(r.rank, ranks[0].rank) === 0
  ).map(r => r.name))];
  t.winners = names;
  t.phase = 'handOver';
  t.message = `摊牌：${names.join('、')} 获胜`;
}

function endHandEarly(t, winnerSeat) {
  awardPotTo(t, [winnerSeat], t.pot);
  t.pot = 0;
  t.winners = [t.players[winnerSeat].name];
  t.phase = 'handOver';
  t.message = `${t.players[winnerSeat].name} 赢得底池`;
}

function advanceStreet(t) {
  if (aliveCount(t) === 1) {
    const w = t.players.findIndex(p => !p.folded);
    endHandEarly(t, w);
    return;
  }

  resetStreetBets(t);

  if (t.street === 'preflop') {
    t.street = 'flop';
    t.board.push(t.deck.pop(), t.deck.pop(), t.deck.pop());
  } else if (t.street === 'flop') {
    t.street = 'turn';
    t.board.push(t.deck.pop());
  } else if (t.street === 'turn') {
    t.street = 'river';
    t.board.push(t.deck.pop());
  } else if (t.street === 'river') {
    t.phase = 'showdown';
    resolveShowdown(t);
    return;
  }

  t.actorIndex = firstToActPostflop(t);
  if (t.actorIndex < 0 || bettingComplete(t)) advanceStreet(t);
}

function afterAction(t) {
  if (aliveCount(t) === 1) {
    const w = t.players.findIndex(p => !p.folded);
    endHandEarly(t, w);
    return;
  }
  if (bettingComplete(t)) {
    advanceStreet(t);
    return;
  }
  t.actorIndex = nextSeat(t, t.actorIndex, p => canAct(p));
  if (t.actorIndex < 0) advanceStreet(t);
}

export function startHand(t) {
  for (const p of t.players) {
    p.hole = [];
    p.folded = false;
    p.allIn = false;
    p.betStreet = 0;
    p.betHand = 0;
    p.actedSinceRaise = false;
  }
  t.board = [];
  t.pot = 0;
  t.street = 'preflop';
  t.winners = null;
  t.showdownRanks = null;
  t.phase = 'betting';
  t.handNumber += 1;

  const withChips = t.players.map((p, i) => ({ p, i })).filter(x => x.p.stack > 0);
  if (withChips.length < 2) {
    t.phase = 'tournamentOver';
    t.message = '比赛结束';
    return false;
  }

  const beforeDealer = t.dealerIndex < 0 ? t.players.length - 1 : t.dealerIndex;
  t.dealerIndex = nextSeat(t, beforeDealer, p => p.stack > 0);
  const n = t.players.length;
  const sbSeat = n === 2 ? t.dealerIndex : nextSeat(t, t.dealerIndex, p => p.stack > 0);
  const bbSeat = nextSeat(t, sbSeat, p => p.stack > 0);

  t.deck = shuffle(createDeck());
  for (const p of t.players) {
    if (p.stack > 0) {
      p.hole.push(t.deck.pop(), t.deck.pop());
    }
  }

  resetStreetBets(t);
  const sbPaid = postBlind(t, sbSeat, t.smallBlind);
  const bbPaid = postBlind(t, bbSeat, t.bigBlind);
  t.currentBet = Math.max(sbPaid, bbPaid);
  t.minRaise = t.bigBlind;
  t.lastRaiseSize = t.bigBlind;

  for (const p of t.players) {
    if (p.betStreet >= t.currentBet) p.actedSinceRaise = true;
  }
  t.players[bbSeat].actedSinceRaise = false;

  t.actorIndex = firstToActPreflop(t);
  if (n === 2) {
    t.players[t.dealerIndex].actedSinceRaise = false;
  }
  t.message = `第 ${t.handNumber} 手 · ${t.street}`;
  return true;
}

export function getLegalActions(t, seatId) {
  const p = t.players[seatId];
  if (!p || t.phase !== 'betting' || t.actorIndex !== seatId || !canAct(p)) return null;

  const toCall = t.currentBet - p.betStreet;
  const minRaiseTotal = t.currentBet + Math.max(t.lastRaiseSize, t.bigBlind);
  const maxTotal = p.betStreet + p.stack;

  const actions = { fold: true, seatId };

  if (toCall === 0) {
    actions.check = true;
  } else {
    actions.call = { amount: Math.min(toCall, p.stack) };
  }

  if (p.stack > toCall) {
    const raiseMin = Math.min(minRaiseTotal, maxTotal);
    if (maxTotal >= minRaiseTotal) {
      actions.raise = { min: raiseMin, max: maxTotal };
    }
  }
  if (p.stack > 0) {
    actions.allIn = { amount: p.betStreet + p.stack };
  }
  return actions;
}

export function applyAction(t, seatId, action, amount = 0) {
  const legal = getLegalActions(t, seatId);
  if (!legal) return { ok: false, error: '不是你的行动回合' };

  const p = t.players[seatId];
  const toCall = t.currentBet - p.betStreet;

  if (action === 'fold') {
    p.folded = true;
    p.actedSinceRaise = true;
    afterAction(t);
    return { ok: true };
  }

  if (action === 'check') {
    if (toCall !== 0) return { ok: false, error: '不能过牌' };
    p.actedSinceRaise = true;
    afterAction(t);
    return { ok: true };
  }

  if (action === 'call') {
    const pay = Math.min(toCall, p.stack);
    p.stack -= pay;
    p.betStreet += pay;
    p.betHand += pay;
    t.pot += pay;
    if (p.stack === 0) p.allIn = true;
    p.actedSinceRaise = true;
    afterAction(t);
    return { ok: true };
  }

  if (action === 'allIn' || action === 'raise') {
    let targetTotal = action === 'allIn' ? p.betStreet + p.stack : amount;
    if (targetTotal < p.betStreet + toCall && action === 'raise') {
      return { ok: false, error: '加注过小' };
    }
    const add = Math.min(targetTotal - p.betStreet, p.stack);
    const newStreet = p.betStreet + add;
    const raiseBy = newStreet - t.currentBet;
    p.stack -= add;
    p.betStreet = newStreet;
    p.betHand += add;
    t.pot += add;

    if (raiseBy > 0 && newStreet > t.currentBet) {
      t.lastRaiseSize = Math.max(raiseBy, t.bigBlind);
      t.minRaise = newStreet + t.lastRaiseSize;
      t.currentBet = newStreet;
      for (const o of t.players) {
        if (o.id !== seatId && canAct(o)) o.actedSinceRaise = false;
      }
    } else if (newStreet > t.currentBet) {
      t.currentBet = newStreet;
      for (const o of t.players) {
        if (o.id !== seatId && canAct(o)) o.actedSinceRaise = false;
      }
    }

    if (p.stack === 0) p.allIn = true;
    p.actedSinceRaise = true;
    afterAction(t);
    return { ok: true };
  }

  return { ok: false, error: '未知动作' };
}

export function publicState(t, viewerSeat = 0) {
  return {
    handNumber: t.handNumber,
    street: t.street,
    phase: t.phase,
    pot: t.pot,
    board: [...t.board],
    currentBet: t.currentBet,
    actorIndex: t.actorIndex,
    dealerIndex: t.dealerIndex,
    message: t.message,
    winners: t.winners,
    smallBlind: t.smallBlind,
    bigBlind: t.bigBlind,
    players: t.players.map(p => ({
      id: p.id,
      name: p.name,
      stack: p.stack,
      betStreet: p.betStreet,
      folded: p.folded,
      allIn: p.allIn,
      isHuman: p.isHuman,
      botType: p.botType,
      hole: p.isHuman || t.phase === 'showdown' || t.phase === 'handOver'
        ? [...p.hole]
        : p.hole.length ? [{ hidden: true }, { hidden: true }] : []
    })),
    legal: getLegalActions(t, viewerSeat),
    viewerSeat
  };
}
