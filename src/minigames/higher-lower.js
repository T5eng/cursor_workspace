// 比大小 · Higher or Lower

import { randomCard, makeCardEl, rankValue } from './card-ui.js';

const BEST_KEY = 'mg_hilo_best_v1';

let root = null;
let current = null;
let next = null;
let streak = 0;
let phase = 'ready'; // ready | guess | reveal | over
let lastResult = '';

function bestStreak() {
  const n = Number(localStorage.getItem(BEST_KEY));
  return Number.isFinite(n) ? n : 0;
}

function saveBest() {
  if (streak > bestStreak()) {
    localStorage.setItem(BEST_KEY, String(streak));
  }
}

function compare(a, b) {
  const va = rankValue(a.rank);
  const vb = rankValue(b.rank);
  if (va === vb) return 0;
  return va > vb ? 1 : -1;
}

function startGame() {
  current = randomCard();
  next = null;
  streak = 0;
  phase = 'guess';
  lastResult = '';
  render();
}

function guess(dir) {
  if (phase !== 'guess') return;
  next = randomCard();
  phase = 'reveal';
  const cmp = compare(next, current);
  let win = false;
  if (dir === 'higher' && cmp >= 0) win = true;
  if (dir === 'lower' && cmp <= 0) win = true;

  if (win) {
    streak += 1;
    if (cmp === 0) lastResult = '点数相同，连胜继续！';
    else lastResult = dir === 'higher' ? '猜对了，下一张更高！' : '猜对了，下一张更低！';
    render();
    setTimeout(() => {
      current = next;
      next = null;
      phase = 'guess';
      render();
    }, 900);
  } else {
    saveBest();
    lastResult = cmp === 0
      ? '点数相同，但你的方向错了'
      : dir === 'higher'
        ? `错了，${next.rank} 并不比 ${current.rank} 高`
        : `错了，${next.rank} 并不比 ${current.rank} 低`;
    phase = 'over';
    render();
  }
}

function render() {
  if (!root) return;
  const best = bestStreak();

  root.innerHTML = `
    <div class="mg-panel mg-hilo">
      <div class="mg-stats">
        <span>连胜 <strong class="gold">${streak}</strong></span>
        <span>最佳 <strong>${best}</strong></span>
      </div>

      <div class="mg-hilo-cards">
        <div class="mg-hilo-slot">
          <div class="mg-zone-label">当前</div>
          <div class="mg-hand" id="hiloCurrent"></div>
        </div>
        ${phase === 'reveal' || phase === 'over' ? `
        <div class="mg-hilo-arrow">→</div>
        <div class="mg-hilo-slot">
          <div class="mg-zone-label">下一张</div>
          <div class="mg-hand" id="hiloNext"></div>
        </div>` : ''}
      </div>

      <p class="mg-message">${message()}</p>

      <div class="mg-actions" id="hiloActions"></div>
    </div>
  `;

  if (current) {
    root.querySelector('#hiloCurrent')?.appendChild(makeCardEl(current));
  }
  if (next) {
    root.querySelector('#hiloNext')?.appendChild(makeCardEl(next));
  }

  const actions = root.querySelector('#hiloActions');
  if (phase === 'ready') {
    addBtn(actions, 'btn-play', '开始挑战', startGame);
  } else if (phase === 'guess') {
    addBtn(actions, 'btn-play', '更高 ▲', () => guess('higher'));
    addBtn(actions, 'btn-discard', '更低 ▼', () => guess('lower'));
  } else if (phase === 'over') {
    addBtn(actions, 'btn-play', '再来一次', startGame);
  }
}

function message() {
  if (phase === 'ready') return '猜下一张牌比当前更高还是更低，连胜越多越好！';
  if (phase === 'guess') return '下一张会更高还是更低？（相同也算对）';
  if (phase === 'reveal') return lastResult;
  return `${lastResult} · 最终连胜 ${streak}`;
}

function addBtn(parent, cls, label, fn) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `btn ${cls}`;
  btn.innerHTML = `<span class="btn-main">${label}</span>`;
  btn.addEventListener('click', fn);
  parent.appendChild(btn);
}

export function bootHigherLower(container) {
  root = container;
  phase = 'ready';
  streak = 0;
  current = null;
  render();
}

export function unmountHigherLower() {
  root = null;
}
