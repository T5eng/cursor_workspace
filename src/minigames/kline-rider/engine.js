// K线摩托 · 物理与地形

export const SEGMENT_WIDTH = 88;
export const GRAVITY = 1650;
export const BASE_SPEED = 210;
export const MAX_SPEED = 420;
export const BOOST = 520;
export const BRAKE = 380;
export const JUMP_VELOCITY = -520;
export const WHEEL_BASE = 34;
export const BIKE_RADIUS = 14;
// 允许偏离轨道的垂直距离（世界坐标像素），超出才算坠落
export const FALL_OFF_TOLERANCE = 130;
// 地面吸附：空中贴地时的额外容差
export const GROUND_STICK = 18;
// 翻车坡度阈值（弧度，约 86°）
export const FLIP_ANGLE = 1.5;

export function buildTerrain(candles, segmentWidth = SEGMENT_WIDTH) {
  // 赛道高度只按收盘价（加缓冲）映射，影线仅作背景装饰，不参与碰撞
  const closes = candles.map((c) => c.close);
  const bodiesLow = candles.map((c) => Math.min(c.open, c.close));
  const bodiesHigh = candles.map((c) => Math.max(c.open, c.close));
  const closeMin = Math.min(...closes);
  const closeMax = Math.max(...closes);
  const closeSpan = closeMax - closeMin || closeMax * 0.08 || 1;
  const margin = closeSpan * 0.22;
  const minPrice = closeMin - margin;
  const maxPrice = closeMax + margin;
  const span = maxPrice - minPrice;

  const track = candles.map((candle, i) => {
    const x = i * segmentWidth + segmentWidth * 0.5;
    const prevClose = i > 0 ? candles[i - 1].close : candle.open;
    const ride = (prevClose + candle.close) / 2;
    return {
      index: i,
      x,
      x0: i * segmentWidth,
      x1: (i + 1) * segmentWidth,
      candle,
      ride,
      open: candle.open,
      close: candle.close,
      high: candle.high,
      low: candle.low,
      bodyTop: bodiesHigh[i],
      bodyBottom: bodiesLow[i]
    };
  });

  const worldLength = candles.length * segmentWidth;

  function priceToWorldY(price, worldHeight, padding = 120) {
    const t = (price - minPrice) / span;
    return padding + (1 - t) * (worldHeight - padding * 2);
  }

  function getGroundY(x, worldHeight, padding = 120) {
    const clamped = Math.max(0, Math.min(worldLength, x));
    const idx = clamped / segmentWidth;
    const i0 = Math.floor(idx);
    const i1 = Math.min(track.length - 1, i0 + 1);
    const t = idx - i0;
    const p0 = track[Math.max(0, i0)];
    const p1 = track[i1];
    const y0 = priceToWorldY(p0.ride, worldHeight, padding);
    const y1 = priceToWorldY(p1.ride, worldHeight, padding);
    return y0 + (y1 - y0) * t;
  }

  function getSlope(x, worldHeight, padding = 120) {
    const eps = 4;
    const y1 = getGroundY(x - eps, worldHeight, padding);
    const y2 = getGroundY(x + eps, worldHeight, padding);
    return Math.atan2(y2 - y1, eps * 2);
  }

  function getCandleAt(x) {
    const i = Math.floor(x / segmentWidth);
    return track[Math.max(0, Math.min(track.length - 1, i))];
  }

  return {
    candles,
    track,
    segmentWidth,
    minPrice,
    maxPrice,
    worldLength,
    priceToWorldY,
    getGroundY,
    getSlope,
    getCandleAt
  };
}

export function createGameState(terrain, meta) {
  const startY = terrain.getGroundY(40, 720) - BIKE_RADIUS;
  return {
    phase: 'play',
    terrain,
    meta,
    worldHeight: 720,
    padding: 120,
    bike: {
      x: 40,
      y: startY,
      vx: BASE_SPEED,
      vy: 0,
      angle: 0,
      onGround: true,
      wheelSpin: 0,
      airTime: 0
    },
    cameraX: 0,
    distance: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    crashes: 0,
    finished: false,
    message: '',
    messageTimer: 0,
    elapsed: 0,
    input: {
      gas: false,
      brake: false,
      jump: false,
      jumpQueued: false
    },
    particles: [],
    shake: 0
  };
}

function spawnDust(state, count = 4) {
  const { bike } = state;
  for (let i = 0; i < count; i++) {
    state.particles.push({
      x: bike.x - 8 + Math.random() * 16,
      y: bike.y + 8,
      vx: -80 - Math.random() * 120,
      vy: -30 - Math.random() * 60,
      life: 0.25 + Math.random() * 0.25,
      size: 2 + Math.random() * 3,
      color: 'rgba(210, 170, 110, 0.8)'
    });
  }
}

function spawnSpark(state) {
  const { bike } = state;
  for (let i = 0; i < 8; i++) {
    state.particles.push({
      x: bike.x,
      y: bike.y,
      vx: (Math.random() - 0.5) * 260,
      vy: (Math.random() - 0.8) * 260,
      life: 0.35 + Math.random() * 0.2,
      size: 2 + Math.random() * 2,
      color: 'rgba(255, 120, 80, 0.9)'
    });
  }
}

export function updateGame(state, dt) {
  if (state.phase !== 'play' || state.finished) return state;

  state.elapsed += dt;
  const { bike, terrain, input } = state;
  const groundY = terrain.getGroundY(bike.x, state.worldHeight, state.padding);
  const slope = terrain.getSlope(bike.x, state.worldHeight, state.padding);

  if (input.jumpQueued && bike.onGround) {
    bike.vy = JUMP_VELOCITY;
    bike.onGround = false;
    input.jumpQueued = false;
    spawnDust(state, 6);
    state.combo += 1;
  }

  let targetVx = BASE_SPEED;
  if (input.gas) targetVx += BOOST;
  if (input.brake) targetVx -= BRAKE;
  targetVx = Math.max(80, Math.min(MAX_SPEED, targetVx));
  bike.vx += (targetVx - bike.vx) * Math.min(1, dt * 4);

  bike.vy += GRAVITY * dt;
  bike.x += bike.vx * dt;
  bike.y += bike.vy * dt;
  bike.angle += (slope - bike.angle) * Math.min(1, dt * 8);

  const wheelCenterY = bike.y + BIKE_RADIUS * 0.6;
  const penetration = wheelCenterY - groundY;

  if (penetration > -GROUND_STICK) {
    if (penetration > 0) bike.y -= penetration;
    bike.vy = Math.min(bike.vy, 0);
    if (!bike.onGround && bike.vy >= -40) {
      bike.onGround = true;
      state.combo = Math.max(0, state.combo);
      if (Math.abs(bike.vy) > 120) spawnDust(state, 5);
    }
    bike.onGround = true;
    bike.airTime = 0;
  } else {
    bike.onGround = false;
    bike.airTime += dt;
  }

  bike.wheelSpin += bike.vx * dt * 0.05;

  // 只判断是否摔离轨道，不再用 K 线高低点做“天花板/地板”
  const fallBelow = wheelCenterY - groundY;
  if (fallBelow > FALL_OFF_TOLERANCE) {
    return endRun(state, '摔离赛道！');
  }

  const tilt = Math.abs(bike.angle);
  if (tilt > FLIP_ANGLE && bike.onGround) {
    return endRun(state, '坡度太陡，翻车！');
  }

  if (bike.x >= terrain.worldLength - 20) {
    state.finished = true;
    state.won = true;
    state.phase = 'result';
    state.score += 1000 + state.combo * 20;
    state.message = '冲线！完整跑完这段行情';
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    return state;
  }

  state.distance = bike.x / terrain.worldLength;
  state.score += bike.vx * dt * 0.04;
  const candle = terrain.getCandleAt(bike.x);
  if (bike.onGround && candle?.candle.bullish) state.score += dt * 6;

  state.cameraX = Math.max(0, bike.x - 220);

  state.particles = state.particles
    .map((p) => ({
      ...p,
      x: p.x + p.vx * dt,
      y: p.y + p.vy * dt,
      vy: p.vy + GRAVITY * 0.35 * dt,
      life: p.life - dt
    }))
    .filter((p) => p.life > 0);

  if (state.messageTimer > 0) state.messageTimer -= dt;

  return state;
}

function endRun(state, reason) {
  state.phase = 'result';
  state.finished = true;
  state.won = false;
  state.crashes += 1;
  state.message = reason;
  state.shake = 0.35;
  spawnSpark(state);
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  return state;
}

export function queueJump(state) {
  if (state.phase !== 'play') return;
  state.input.jumpQueued = true;
}

export function setInput(state, key, value) {
  if (!state?.input) return;
  state.input[key] = value;
}

export function loadHighScore() {
  try {
    return Number(localStorage.getItem('kline_rider_highscore_v1')) || 0;
  } catch {
    return 0;
  }
}

export function saveHighScore(score) {
  const prev = loadHighScore();
  if (score > prev) {
    localStorage.setItem('kline_rider_highscore_v1', String(Math.floor(score)));
    return score;
  }
  return prev;
}
