// K线摩托 · UI 入口

import {
  fetchKline,
  defaultFormValues,
  summarizeCandles
} from './chart.js';
import {
  buildTerrain,
  createGameState,
  updateGame,
  setInput,
  queueJump,
  saveHighScore,
  loadHighScore
} from './engine.js';
import { resizeCanvas, drawFrame } from './renderer.js';

let root = null;
let rafId = 0;
let lastTs = 0;
let gameState = null;
let canvas = null;
let canvasWrap = null;
let size = { width: 800, height: 400 };
const listeners = [];

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setRootMode(mode) {
  root?.classList.remove('kline-mode-menu', 'kline-mode-play', 'kline-mode-loading');
  if (mode) root?.classList.add(`kline-mode-${mode}`);
}

function on(el, type, fn, opts) {
  el.addEventListener(type, fn, opts);
  listeners.push({ el, type, fn, opts });
}

function tryLockLandscape() {
  try {
  const o = screen.orientation;
    if (o?.lock) o.lock('landscape').catch(() => {});
  } catch {
    /* unsupported */
  }
}

function unlockOrientation() {
  try {
    screen.orientation?.unlock?.();
  } catch {
    /* unsupported */
  }
}

function setLandscapeMode(on) {
  document.documentElement.classList.toggle('kline-landscape', on);
  document.getElementById('minigameApp')?.classList.toggle('kline-active', on);
}

function renderMenu(error = '') {
  setLandscapeMode(false);
  setRootMode('menu');
  const form = defaultFormValues();
  const high = loadHighScore();

  root.innerHTML = `
    <div class="kline-shell">
      <div class="mg-panel kline-panel">
        <p class="kline-eyebrow">🏍️ 横版越野</p>
        <h2 class="kline-title">K线摩托</h2>
        <p class="kline-desc">查询任意股票、任意时间段的 K 线，把蜡烛图变成越野赛道。手机请<strong>横屏</strong>游玩。</p>
        <form class="kline-form" id="klineForm">
          <label class="kline-field">
            <span>股票代码</span>
            <input name="symbol" type="text" inputmode="text" autocomplete="off"
              placeholder="如 600519 / AAPL / SH600519" value="${escapeHtml(form.symbol)}" required />
          </label>
          <div class="kline-field-row">
            <label class="kline-field">
              <span>开始日期</span>
              <input name="start" type="date" value="${escapeHtml(form.start)}" required />
            </label>
            <label class="kline-field">
              <span>结束日期</span>
              <input name="end" type="date" value="${escapeHtml(form.end)}" required />
            </label>
          </div>
          <label class="kline-field">
            <span>K 线周期</span>
            <select name="period">
              <option value="day" ${form.period === 'day' ? 'selected' : ''}>日 K</option>
              <option value="week" ${form.period === 'week' ? 'selected' : ''}>周 K</option>
              <option value="month" ${form.period === 'month' ? 'selected' : ''}>月 K</option>
            </select>
          </label>
          ${error ? `<p class="kline-error">${escapeHtml(error)}</p>` : ''}
          <div class="mg-actions">
            <button type="submit" class="btn btn-play">
              <span class="btn-main">发车</span>
              <span class="btn-sub">拉取 K 线并进入赛道</span>
            </button>
          </div>
        </form>
        <p class="kline-hint">数据来源：东方财富公开接口。若跨域失败将自动使用模拟 K 线。</p>
        <p class="kline-high">最高分 <strong>${high}</strong></p>
      </div>
    </div>
  `;

  const formEl = root.querySelector('#klineForm');
  on(formEl, 'submit', async (e) => {
    e.preventDefault();
    const data = new FormData(formEl);
    await startGame({
      symbol: data.get('symbol'),
      start: data.get('start'),
      end: data.get('end'),
      period: data.get('period')
    });
  });
}

function renderLoading(symbol) {
  setRootMode('loading');
  root.innerHTML = `
    <div class="kline-shell kline-loading">
      <div class="mg-panel kline-panel">
        <p class="kline-eyebrow">正在绘制赛道</p>
        <h2 class="kline-title">${escapeHtml(symbol)}</h2>
        <p class="kline-desc">拉取 K 线数据中…</p>
        <div class="kline-spinner" aria-hidden="true"></div>
      </div>
    </div>
  `;
}

function renderPlay(data) {
  setLandscapeMode(true);
  setRootMode('play');
  const summary = summarizeCandles(data.candles);
  const sourceNote =
    data.meta.source === 'mock'
      ? `<p class="kline-source warn">网络拉取失败，当前为模拟 K 线</p>`
      : `<p class="kline-source">已加载 ${data.meta.count} 根 K 线 · ${summary.change >= 0 ? '涨幅' : '跌幅'} ${summary.change.toFixed(2)}%</p>`;

  root.innerHTML = `
    <div class="kline-play-wrap">
      ${sourceNote}
      <div class="kline-canvas-wrap" id="klineCanvasWrap">
        <canvas id="klineCanvas"></canvas>
      </div>
      <div class="kline-touch-controls" aria-label="触控">
        <button type="button" class="kline-touch-btn" data-input="brake" aria-label="刹车">刹车</button>
        <button type="button" class="kline-touch-btn kline-touch-jump" data-input="jump" aria-label="跳跃">跳跃</button>
        <button type="button" class="kline-touch-btn kline-touch-gas" data-input="gas" aria-label="油门">油门</button>
      </div>
      <div class="kline-desktop-hint">键盘：← → 油门/刹车 · 空格或 ↑ 跳跃</div>
      <div class="kline-result-actions hidden" id="klineResultActions">
        <button type="button" class="btn btn-play" id="klineRetry">
          <span class="btn-main">再来一局</span>
        </button>
        <button type="button" class="btn btn-sort" id="klineBackMenu">
          <span class="btn-main">换股票</span>
        </button>
      </div>
    </div>
  `;

  canvasWrap = root.querySelector('#klineCanvasWrap');
  canvas = root.querySelector('#klineCanvas');

  const terrain = buildTerrain(data.candles);
  gameState = createGameState(terrain, data.meta);
  lastTs = 0;

  const doResize = () => {
    size = resizeCanvas(canvas, canvasWrap);
    gameState.worldHeight = 720;
  };
  doResize();
  on(window, 'resize', doResize);
  on(window, 'orientationchange', () => setTimeout(doResize, 120));
  if (window.visualViewport) {
    on(window.visualViewport, 'resize', doResize);
  }

  wireInput();
  tryLockLandscape();
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

function wireInput() {
  const touchBtns = root.querySelectorAll('[data-input]');
  for (const btn of touchBtns) {
    const key = btn.dataset.input;
    const down = (e) => {
      e.preventDefault();
      if (key === 'jump') queueJump(gameState);
      else setInput(gameState, key, true);
    };
    const up = (e) => {
      e.preventDefault();
      if (key !== 'jump') setInput(gameState, key, false);
    };
    on(btn, 'pointerdown', down);
    on(btn, 'pointerup', up);
    on(btn, 'pointerleave', up);
    on(btn, 'pointercancel', up);
  }

  on(window, 'keydown', onKeyDown);
  on(window, 'keyup', onKeyUp);

  const retry = root.querySelector('#klineRetry');
  const back = root.querySelector('#klineBackMenu');
  on(retry, 'click', () => {
    if (!gameState?.meta) return;
    const { symbol, start, end, period } = gameState.meta;
    startGame({ symbol, start, end, period });
  });
  on(back, 'click', () => renderMenu());
}

function onKeyDown(e) {
  if (!gameState || gameState.phase !== 'play') return;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') setInput(gameState, 'gas', true);
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') setInput(gameState, 'brake', true);
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    queueJump(gameState);
  }
}

function onKeyUp(e) {
  if (!gameState) return;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') setInput(gameState, 'gas', false);
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') setInput(gameState, 'brake', false);
}

function loop(ts) {
  if (!canvas || !gameState) return;
  const ctx = canvas.getContext('2d');
  const dt = lastTs ? Math.min(0.033, (ts - lastTs) / 1000) : 0.016;
  lastTs = ts;

  updateGame(gameState, dt);
  drawFrame(ctx, size, gameState);

  if (gameState.phase === 'result') {
    saveHighScore(gameState.score);
    root.querySelector('#klineResultActions')?.classList.remove('hidden');
  }

  rafId = requestAnimationFrame(loop);
}

async function startGame(opts) {
  renderLoading(opts.symbol);
  try {
    const data = await fetchKline(opts);
    renderPlay(data);
  } catch (err) {
    renderMenu(err?.message || '加载失败');
  }
}

export function bootKlineRider(container) {
  root = container;
  renderMenu();
}

export function unmountKlineRider() {
  cancelAnimationFrame(rafId);
  rafId = 0;
  gameState = null;
  canvas = null;
  canvasWrap = null;

  for (const { el, type, fn, opts } of listeners) {
    el.removeEventListener(type, fn, opts);
  }
  listeners.length = 0;

  unlockOrientation();
  setLandscapeMode(false);
  root?.classList.remove('kline-mode-menu', 'kline-mode-play', 'kline-mode-loading');
  if (root) root.innerHTML = '';
  root = null;
}
