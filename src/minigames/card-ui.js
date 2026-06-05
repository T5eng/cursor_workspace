// Shared card rendering for mini-games

import { Card, SUITS, RANKS } from '../cards.js';

export function makeCardEl(card, { small = false, faceDown = false, className = '' } = {}) {
  const el = document.createElement('div');
  if (faceDown) {
    el.className = `mg-card mg-card-back${small ? ' mg-card-sm' : ''}${className ? ` ${className}` : ''}`;
    el.innerHTML = '<span class="mg-card-back-mark">♠♥♦♣</span>';
    return el;
  }
  const red = card.suit === '♥' || card.suit === '♦';
  el.className = `card ${red ? 'red' : 'black'}${small ? ' mg-card-sm' : ''}${className ? ` ${className}` : ''}`;
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
  return el;
}

export function randomCard() {
  const rank = RANKS[Math.floor(Math.random() * RANKS.length)];
  const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
  return new Card(rank, suit);
}

export function freshDeck() {
  const deck = [];
  for (const s of SUITS) for (const r of RANKS) deck.push(new Card(r, s));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function blackjackValue(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.rank === 'A') {
      aces += 1;
      total += 11;
    } else if (['J', 'Q', 'K'].includes(c.rank)) {
      total += 10;
    } else {
      total += Number(c.rank);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

export function rankValue(rank) {
  if (rank === 'A') return 14;
  if (rank === 'K') return 13;
  if (rank === 'Q') return 12;
  if (rank === 'J') return 11;
  return Number(rank);
}
