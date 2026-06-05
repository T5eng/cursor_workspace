// 贪吃蛇 · Poker Snake

const BEST_KEY = 'mg_snake_best_v1';
const FOODS = ['♠', '♥', '♦', '♣'];
const COLORS = { '♠': '#efe3c8', '♥': '#e2455a', '♦': '#e2455a', '♣': '#efe3c8' };

let root = null;
let canvas = null;
let ctx = null;
let grid = 16;
let cell = 20;
let snake = [];
let dir = { x: 1, y: 0 };
let nextDir = { x: 1, y: 0 };
let food = { x: 0, y: 0, icon: '♠' };
let score = 0;
let best = 0;
let running = false;
let paused = false;
let loopId = null;
let lastTick = 0;
let tickMs = 140;
let keyHandler = null;
let touchStart = null;

function loadBest() {
  const n = Number(localStorage.getItem(BEST_KEY));
  return Number.isFinite(n) ? n : 0;
}

function saveBest() {
  if (score > best) {
    best = score;
    localStorage.setItem(BEST_KEY, String(best));
  }
}

function randCell() {
  return {
    x: Math.floor(Math.random() * grid),
    y: Math.floor(Math.random() * grid)
  };
}

function spawnFood() {
  let pos;
  do {
    pos = randCell();
  } while (snake.some(s => s.x === pos.x && s.y === pos.y));
  food = { ...pos, icon: FOODS[Math.floor(Math.random() * FOODS.length)] };
}

function reset() {
  snake = [
    { x: 4, y: 8 },
    { x: 3, y: 8 },
    { x: 2, y: 8 }
  ];
  dir = { x: 1, y: 0 };
  nextDir = { x: 1, y: 0 };
  score = 0;
  paused = false;
  spawnFood();
  updateHud();
  draw();
}

function updateHud() {
  const scoreEl = root?.querySelector('#snakeScore');
  const bestEl = root?.querySelector('#snakeBest');
  const statusEl = root?.querySelector('#snakeStatus');
  if (scoreEl) scoreEl.textContent = String(score);
  if (bestEl) bestEl.textContent = String(best);
  if (statusEl) {
    if (!running) statusEl.textContent = '按开始或空格键';
    else if (paused) statusEl.textContent = '已暂停';
    else statusEl.textContent = '方向键 / 滑动控制';
  }
}

function startLoop() {
  if (loopId) return;
  running = true;
  lastTick = 0;
  loopId = requestAnimationFrame(tick);
  updateHud();
}

function stopLoop() {
  running = false;
  if (loopId) {
    cancelAnimationFrame(loopId);
    loopId = null;
  }
  updateHud();
}

function tick(ts) {
  if (!running) return;
  loopId = requestAnimationFrame(tick);
  if (paused) return;
  if (ts - lastTick < tickMs) return;
  lastTick = ts;
  step();
}

function step() {
  dir = nextDir;
  const head = snake[0];
  const nh = { x: head.x + dir.x, y: head.y + dir.y };

  if (nh.x < 0 || nh.y < 0 || nh.x >= grid || nh.y >= grid) {
    gameOver();
    return;
  }
  if (snake.some(s => s.x === nh.x && s.y === nh.y)) {
    gameOver();
    return;
  }

  snake.unshift(nh);
  if (nh.x === food.x && nh.y === food.y) {
    score += 1;
    if (score % 5 === 0 && tickMs > 80) tickMs -= 8;
    spawnFood();
    updateHud();
  } else {
    snake.pop();
  }
  draw();
}

function gameOver() {
  saveBest();
  stopLoop();
  const status = root?.querySelector('#snakeStatus');
  if (status) status.textContent = `游戏结束！得分 ${score}`;
}

function draw() {
  if (!ctx) return;
  const size = grid * cell;
  ctx.fillStyle = '#1a0820';
  ctx.fillRect(0, 0, size, size);

  // grid lines
  ctx.strokeStyle = 'rgba(245, 197, 74, 0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= grid; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cell, 0);
    ctx.lineTo(i * cell, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * cell);
    ctx.lineTo(size, i * cell);
    ctx.stroke();
  }

  // food
  ctx.fillStyle = COLORS[food.icon];
  ctx.font = `${cell - 4}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(food.icon, food.x * cell + cell / 2, food.y * cell + cell / 2 + 1);

  // snake
  snake.forEach((seg, i) => {
    const t = i / Math.max(snake.length - 1, 1);
    const r = Math.round(90 + t * 50);
    const g = Math.round(197 - t * 80);
    const b = Math.round(74 - t * 30);
    ctx.fillStyle = i === 0 ? '#f5c54a' : `rgb(${r},${g},${b})`;
    const pad = i === 0 ? 1 : 2;
    ctx.fillRect(seg.x * cell + pad, seg.y * cell + pad, cell - pad * 2, cell - pad * 2);
  });
}

function setDir(x, y) {
  if (!running || paused) return;
  if (x === -dir.x && y === -dir.y) return;
  nextDir = { x, y };
}

function onKey(e) {
  if (!root) return;
  if (e.key === ' ' || e.code === 'Space') {
    e.preventDefault();
    if (!running) {
      reset();
      startLoop();
      return;
    }
    paused = !paused;
    updateHud();
    return;
  }
  const map = {
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    w: [0, -1],
    s: [0, 1],
    a: [-1, 0],
    d: [1, 0]
  };
  const move = map[e.key];
  if (move) {
    e.preventDefault();
    setDir(move[0], move[1]);
  }
}

function onTouchStart(e) {
  touchStart = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
}

function onTouchEnd(e) {
  if (!touchStart) return;
  const dx = e.changedTouches[0].clientX - touchStart.x;
  const dy = e.changedTouches[0].clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
  if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 1 : -1, 0);
  else setDir(0, dy > 0 ? 1 : -1);
}

function render() {
  if (!root) return;
  best = loadBest();
  const size = grid * cell;

  root.innerHTML = `
    <div class="mg-panel mg-snake">
      <div class="mg-stats">
        <span>得分 <strong id="snakeScore">0</strong></span>
        <span>最佳 <strong id="snakeBest">${best}</strong></span>
      </div>
      <div class="mg-snake-wrap">
        <canvas id="snakeCanvas" width="${size}" height="${size}" aria-label="贪吃蛇游戏区域"></canvas>
      </div>
      <p class="mg-message" id="snakeStatus">按开始或空格键</p>
      <div class="mg-actions">
        <button type="button" class="btn btn-play" id="snakeStart">
          <span class="btn-main">开始</span>
        </button>
        <button type="button" class="btn btn-sort" id="snakePause">
          <span class="btn-main">暂停</span>
        </button>
        <button type="button" class="btn btn-discard" id="snakeReset">
          <span class="btn-main">重置</span>
        </button>
      </div>
      <p class="mg-snake-hint">键盘方向键 / WASD · 手机滑动 · 空格暂停</p>
    </div>
  `;

  canvas = root.querySelector('#snakeCanvas');
  ctx = canvas.getContext('2d');
  reset();

  root.querySelector('#snakeStart')?.addEventListener('click', () => {
    if (!running) {
      reset();
      startLoop();
    }
  });
  root.querySelector('#snakePause')?.addEventListener('click', () => {
    if (!running) return;
    paused = !paused;
    updateHud();
  });
  root.querySelector('#snakeReset')?.addEventListener('click', () => {
    stopLoop();
    reset();
  });

  canvas.addEventListener('touchstart', onTouchStart, { passive: true });
  canvas.addEventListener('touchend', onTouchEnd, { passive: true });
}

export function bootSnake(container) {
  root = container;
  keyHandler = onKey;
  document.addEventListener('keydown', keyHandler);
  render();
}

export function unmountSnake() {
  stopLoop();
  if (keyHandler) {
    document.removeEventListener('keydown', keyHandler);
    keyHandler = null;
  }
  root = null;
  canvas = null;
  ctx = null;
}
