// K线摩托 · 物理与地形（无失败，自由特技）

export const SEGMENT_WIDTH = 88;
export const GRAVITY = 1400;
export const BASE_SPEED = 200;
export const MAX_SPEED = 480;
export const BOOST = 560;
export const BRAKE = 320;
export const JUMP_VELOCITY = -540;
export const WHEEL_BASE = 34;
export const BIKE_RADIUS = 14;
export const GROUND_STICK = 28;
export const FLIP_TORQUE = 10.5;
export const FLIP_IMPULSE = 5.2;
export const AIR_GRAVITY_SCALE = 0.92;
export const TRACK_PULL = 11;

export function buildTerrain(candles, segmentWidth = SEGMENT_WIDTH) {
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
      angularVel: 0,
      onGround: true,
      wheelSpin: 0,
      airTime: 0,
      airRotation: 0
    },
    cameraX: 0,
    distance: 0,
    score: 0,
    combo: 0,
    flipCount: 0,
    finished: false,
    won: false,
    message: '',
    stuntText: '',
    stuntTimer: 0,
    elapsed: 0,
    input: {
      gas: false,
      brake: false,
      jumpQueued: false,
      flipBack: false,
      flipFront: false
    },
    particles: []
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

function spawnFlipBurst(state, color) {
  const { bike } = state;
  for (let i = 0; i < 6; i++) {
    state.particles.push({
      x: bike.x + (Math.random() - 0.5) * 20,
      y: bike.y + (Math.random() - 0.5) * 12,
      vx: (Math.random() - 0.5) * 180,
      vy: -60 - Math.random() * 100,
      life: 0.3 + Math.random() * 0.25,
      size: 2 + Math.random() * 3,
      color
    });
  }
}

function showStunt(state, text, bonus = 0) {
  state.stuntText = text;
  state.stuntTimer = 1.6;
  if (bonus > 0) state.score += bonus;
}

function settleAirRotation(state) {
  const { bike } = state;
  const spins = Math.floor(Math.abs(bike.airRotation) / (Math.PI * 2));
  if (spins <= 0) {
    bike.airRotation = 0;
    return;
  }

  const dir = bike.airRotation < 0 ? '后空翻' : '前空翻';
  state.flipCount += spins;
  state.combo += spins;
  const bonus = spins * 280 + state.combo * 30;
  showStunt(state, `${dir} x${spins}！`, bonus);
  spawnFlipBurst(state, bike.airRotation < 0 ? 'rgba(245,197,74,0.9)' : 'rgba(62,207,142,0.9)');
  bike.airRotation = 0;
}

export function updateGame(state, dt) {
  if (state.phase !== 'play') return state;

  state.elapsed += dt;
  if (state.stuntTimer > 0) state.stuntTimer -= dt;

  const { bike, terrain, input } = state;
  const groundY = terrain.getGroundY(bike.x, state.worldHeight, state.padding);
  const slope = terrain.getSlope(bike.x, state.worldHeight, state.padding);

  if (input.jumpQueued && bike.onGround) {
    bike.vy = JUMP_VELOCITY;
    bike.onGround = false;
    input.jumpQueued = false;
    spawnDust(state, 6);
    showStunt(state, '起跳！', 40);
  }

  let targetVx = BASE_SPEED;
  if (input.gas) targetVx += BOOST;
  if (input.brake) targetVx -= BRAKE;
  targetVx = Math.max(60, Math.min(MAX_SPEED, targetVx));
  bike.vx += (targetVx - bike.vx) * Math.min(1, dt * 4);

  const grav = bike.onGround ? GRAVITY : GRAVITY * AIR_GRAVITY_SCALE;
  bike.vy += grav * dt;
  bike.x += bike.vx * dt;
  bike.y += bike.vy * dt;

  if (!bike.onGround) {
    if (input.flipBack) bike.angularVel -= FLIP_TORQUE * dt;
    if (input.flipFront) bike.angularVel += FLIP_TORQUE * dt;
    bike.angularVel *= 0.992;
    bike.angle += bike.angularVel * dt;
    bike.airRotation += bike.angularVel * dt;
    bike.airTime += dt;
  }

  const wheelCenterY = bike.y + BIKE_RADIUS * 0.6;
  const penetration = wheelCenterY - groundY;
  const wasAir = !bike.onGround;

  if (penetration > -GROUND_STICK) {
    if (penetration > 0) bike.y -= penetration;
    if (!bike.onGround && bike.vy >= -30) {
      if (wasAir) settleAirRotation(state);
      if (Math.abs(bike.vy) > 100) spawnDust(state, 5);
    }
    bike.vy = Math.min(bike.vy, 0);
    bike.onGround = true;
    bike.airTime = 0;
    bike.angularVel = 0;
    bike.angle += (slope - bike.angle) * Math.min(1, dt * 10);
  } else {
    if (bike.onGround) {
      bike.onGround = false;
      bike.airRotation = 0;
    }
    const pull = (groundY - wheelCenterY) * TRACK_PULL * dt;
    bike.vy += pull;
  }

  bike.wheelSpin += bike.vx * dt * 0.05;

  if (bike.x >= terrain.worldLength - 20 && !state.finished) {
    state.finished = true;
    state.won = true;
    state.phase = 'result';
    state.score += 1500 + state.flipCount * 120 + state.combo * 40;
    state.message = '冲线！跑完这段行情';
    spawnFlipBurst(state, 'rgba(245,197,74,0.95)');
  }

  state.distance = Math.min(1, bike.x / terrain.worldLength);
  state.score += bike.vx * dt * 0.05;
  const candle = terrain.getCandleAt(bike.x);
  if (bike.onGround && candle?.candle.bullish) state.score += dt * 5;

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

  return state;
}

export function queueJump(state) {
  if (state.phase !== 'play') return;
  state.input.jumpQueued = true;
}

export function triggerFlip(state, direction) {
  if (state.phase !== 'play' || state.bike.onGround) return;
  const sign = direction === 'back' ? -1 : 1;
  state.bike.angularVel += sign * FLIP_IMPULSE;
  showStunt(state, direction === 'back' ? '后翻！' : '前翻！', 20);
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
