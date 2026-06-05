// 记忆翻牌 · Card Memory Match

import { Card, SUITS, RANKS } from '../cards.js';
import { makeCardEl } from './card-ui.js';

const BEST_KEY = 'mg_memory_best_v1';

let root = null;
let cards = [];
let flipped = [];
let matched = 0;
let moves = 0;
let lock = false;
let startedAt = 0;
let timerId = null;

function pickPairs(count) {
  const pool = [];
  for (const r of RANKS) for (const s of SUITS) pool.push(new Card(r, s));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const chosen = pool.slice(0, count);
  const pairs = [...chosen, ...chosen.map(c => new Card(c.rank, c.suit))];
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  return pairs;
}

function pairKey(card) {
  return `${card.rank}${card.suit}`;
}

function elapsed() {
  if (!startedAt) return 0;
  return Math.floor((Date.now() - startedAt) / 1000);
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function bestMoves() {
  const n = Number(localStorage.getItem(BEST_KEY));
  return Number.isFinite(n) ? n : null;
}

function saveBest() {
  const prev = bestMoves();
  if (prev === null || moves < prev) {
    localStorage.setItem(BEST_KEY, String(moves));
  }
}

function stopTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

function startTimer() {
  stopTimer();
  timerId = setInterval(() => {
    const el = root?.querySelector('#memTime');
    if (el) el.textContent = formatTime(elapsed());
  }, 1000);
}

function newGame() {
  stopTimer();
  cards = pickPairs(8);
  flipped = [];
  matched = 0;
  moves = 0;
  lock = false;
  startedAt = 0;
  render();
}

function onFlip(idx) {
  if (lock || flipped.includes(idx) || cards[idx]._matched) return;
  if (!startedAt) {
    startedAt = Date.now();
    startTimer();
  }
  flipped.push(idx);
  render();

  if (flipped.length < 2) return;

  moves += 1;
  lock = true;
  const [a, b] = flipped;
  const match = pairKey(cards[a]) === pairKey(cards[b]);

  setTimeout(() => {
    if (match) {
      cards[a]._matched = true;
      cards[b]._matched = true;
      matched += 1;
      flipped = [];
      lock = false;
      if (matched === cards.length / 2) {
        stopTimer();
        saveBest();
      }
      render();
      return;
    }
    flipped = [];
    lock = false;
    render();
  }, match ? 350 : 700);
}

function render() {
  if (!root) return;
  const done = matched === cards.length / 2 && cards.length > 0;
  const best = bestMoves();

  root.innerHTML = `
    <div class="mg-panel mg-memory">
      <div class="mg-stats">
        <span>步数 <strong id="memMoves">${moves}</strong></span>
        <span>时间 <strong id="memTime">${formatTime(elapsed())}</strong></span>
        <span>最佳 <strong>${best ?? '—'}</strong> 步</span>
      </div>
      <div class="mg-memory-grid" id="memGrid"></div>
      ${done ? '<p class="mg-message mg-win">全部配对成功！</p>' : '<p class="mg-message">翻开两张相同的牌</p>'}
      <div class="mg-actions">
        <button type="button" class="btn btn-play" id="memRestart">
          <span class="btn-main">${done ? '再玩一局' : '重新开始'}</span>
        </button>
      </div>
    </div>
  `;

  const grid = root.querySelector('#memGrid');
  cards.forEach((card, i) => {
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = 'mg-memory-slot';
    slot.disabled = lock && !flipped.includes(i);
    const show = flipped.includes(i) || card._matched;
    if (show) {
      const face = makeCardEl(card, { small: true, className: card._matched ? 'mg-matched' : '' });
      face.tabIndex = -1;
      slot.appendChild(face);
      if (card._matched) slot.classList.add('matched');
    } else {
      slot.appendChild(makeCardEl(card, { faceDown: true, small: true }));
    }
    if (!card._matched) {
      slot.addEventListener('click', () => onFlip(i));
    }
    grid.appendChild(slot);
  });

  root.querySelector('#memRestart')?.addEventListener('click', newGame);
}

export function bootMemory(container) {
  root = container;
  newGame();
}

export function unmountMemory() {
  stopTimer();
  root = null;
}
