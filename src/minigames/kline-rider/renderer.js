// K线摩托 · Canvas 渲染

import { BIKE_RADIUS, WHEEL_BASE } from './engine.js';

const SKY_TOP = '#0a1628';
const SKY_BOTTOM = '#1a3a52';
const GROUND_FILL = '#2d2418';
const GROUND_TOP = '#5a4630';
const BULL_COLOR = '#3ecf8e';
const BEAR_COLOR = '#ff5c7a';
const WICK_COLOR = 'rgba(255,255,255,0.35)';

export function resizeCanvas(canvas, wrap) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = wrap.getBoundingClientRect();
  const w = Math.max(320, Math.floor(rect.width));
  const h = Math.max(200, Math.floor(rect.height));
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width: w, height: h, dpr };
}

export function drawFrame(ctx, size, state) {
  const { width, height } = size;
  const { terrain, bike, cameraX, particles, shake } = state;
  const worldH = state.worldHeight;
  const pad = state.padding;

  ctx.save();
  if (shake > 0) {
    const s = shake * 8;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    state.shake = Math.max(0, shake - 0.02);
  }

  drawSky(ctx, width, height);
  drawBackdropCandles(ctx, width, height, terrain, cameraX, worldH, pad);
  drawTrack(ctx, width, height, terrain, cameraX, worldH, pad);
  drawGoal(ctx, width, height, terrain, cameraX, worldH, pad);

  for (const p of particles) {
    drawParticle(ctx, p, cameraX, worldH, pad, height);
  }

  drawBike(ctx, width, height, bike, cameraX, worldH, pad);
  drawHud(ctx, width, height, state);
  ctx.restore();
}

function worldToScreen(x, y, cameraX, worldH, pad, canvasH) {
  const scale = (canvasH - 40) / worldH;
  return {
    sx: x - cameraX,
    sy: y * scale + 20
  };
}

function drawSky(ctx, width, height) {
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, SKY_TOP);
  g.addColorStop(0.55, SKY_BOTTOM);
  g.addColorStop(1, '#243c2a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 24; i++) {
    const x = ((i * 97) % width) + ((i % 3) * 40);
    const y = 16 + (i % 5) * 14;
    const r = 1 + (i % 3);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBackdropCandles(ctx, width, height, terrain, cameraX, worldH, pad) {
  const scale = (height - 40) / worldH;
  const viewStart = cameraX - 40;
  const viewEnd = cameraX + width + 40;

  for (const seg of terrain.track) {
    if (seg.x1 < viewStart || seg.x0 > viewEnd) continue;
    const color = seg.candle.bullish ? BULL_COLOR : BEAR_COLOR;
    const bodyTop = terrain.priceToWorldY(seg.bodyTop ?? Math.max(seg.open, seg.close), worldH, pad);
    const bodyBot = terrain.priceToWorldY(seg.bodyBottom ?? Math.min(seg.open, seg.close), worldH, pad);
    const highY = terrain.priceToWorldY(seg.high, worldH, pad);
    const lowY = terrain.priceToWorldY(seg.low, worldH, pad);
    const cx = seg.x - cameraX;
    const bw = Math.max(10, terrain.segmentWidth * 0.42);

    const top = bodyTop * scale + 20;
    const bot = bodyBot * scale + 20;
    const hi = highY * scale + 20;
    const lo = lowY * scale + 20;

    // 影线仅作背景装饰，半透明，不表示碰撞区
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, hi);
    ctx.lineTo(cx, lo);
    ctx.stroke();

    ctx.fillStyle = color + '44';
    ctx.strokeStyle = color + '88';
    ctx.lineWidth = 1.5;
    const h = Math.max(4, bot - top);
    ctx.fillRect(cx - bw / 2, top, bw, h);
    ctx.strokeRect(cx - bw / 2, top, bw, h);
  }
}

function drawTrack(ctx, width, height, terrain, cameraX, worldH, pad) {
  const scale = (height - 40) / worldH;
  const step = 6;
  const startX = Math.max(0, Math.floor((cameraX - 20) / step) * step);
  const endX = cameraX + width + 40;

  ctx.beginPath();
  let first = true;
  for (let x = startX; x <= endX; x += step) {
    const gy = terrain.getGroundY(x, worldH, pad);
    const sx = x - cameraX;
    const sy = gy * scale + 20;
    if (first) {
      ctx.moveTo(sx, sy);
      first = false;
    } else {
      ctx.lineTo(sx, sy);
    }
  }

  const baseY = height - 8;
  ctx.lineTo(width + 20, baseY);
  ctx.lineTo(-20, baseY);
  ctx.closePath();

  const fill = ctx.createLinearGradient(0, 40, 0, height);
  fill.addColorStop(0, GROUND_TOP);
  fill.addColorStop(0.35, GROUND_FILL);
  fill.addColorStop(1, '#1a1208');
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.beginPath();
  first = true;
  for (let x = startX; x <= endX; x += step) {
    const gy = terrain.getGroundY(x, worldH, pad);
    const sx = x - cameraX;
    const sy = gy * scale + 20;
    if (first) {
      ctx.moveTo(sx, sy);
      first = false;
    } else {
      ctx.lineTo(sx, sy);
    }
  }
  ctx.strokeStyle = '#c9a45c';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(201,164,92,0.25)';
  ctx.lineWidth = 8;
  ctx.stroke();
}

function drawGoal(ctx, width, height, terrain, cameraX, worldH, pad) {
  const scale = (height - 40) / worldH;
  const gx = terrain.worldLength - cameraX;
  if (gx < -40 || gx > width + 40) return;
  const gy = terrain.getGroundY(terrain.worldLength - 10, worldH, pad) * scale + 20;

  ctx.fillStyle = 'rgba(245,197,74,0.85)';
  ctx.fillRect(gx - 4, gy - 70, 8, 70);
  ctx.beginPath();
  ctx.moveTo(gx - 4, gy - 70);
  ctx.lineTo(gx + 46, gy - 54);
  ctx.lineTo(gx - 4, gy - 38);
  ctx.closePath();
  ctx.fill();

  ctx.font = 'bold 12px JetBrains Mono, monospace';
  ctx.fillStyle = '#f5c54a';
  ctx.fillText('终点', gx + 8, gy - 58);
}

function drawBike(ctx, width, height, bike, cameraX, worldH, pad) {
  const scale = (height - 40) / worldH;
  const sx = bike.x - cameraX;
  const sy = bike.y * scale + 20;

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(bike.angle);

  const spin = bike.wheelSpin;

  ctx.strokeStyle = '#f5c54a';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-WHEEL_BASE * 0.5, 4);
  ctx.lineTo(WHEEL_BASE * 0.35, -16);
  ctx.lineTo(WHEEL_BASE * 0.55, -20);
  ctx.stroke();

  ctx.fillStyle = '#ff6b35';
  ctx.beginPath();
  ctx.ellipse(WHEEL_BASE * 0.45, -22, 9, 7, 0.2, 0, Math.PI * 2);
  ctx.fill();

  drawWheel(ctx, -WHEEL_BASE * 0.5, 6, 11, spin);
  drawWheel(ctx, WHEEL_BASE * 0.55, 6, 11, spin);

  if (!bike.onGround) {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(-WHEEL_BASE * 0.5, 6);
    ctx.lineTo(-WHEEL_BASE * 0.5, 26);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

function drawWheel(ctx, x, y, r, spin) {
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) {
    const a = spin + (i * Math.PI) / 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    ctx.stroke();
  }
}

function drawParticle(ctx, p, cameraX, worldH, pad, canvasH) {
  const scale = (canvasH - 40) / worldH;
  const sx = p.x - cameraX;
  const sy = p.y * scale + 20;
  ctx.fillStyle = p.color;
  ctx.globalAlpha = Math.max(0, p.life * 2);
  ctx.beginPath();
  ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawHud(ctx, width, height, state) {
  const { meta, bike, distance, score, combo, won, phase } = state;
  const progress = Math.min(100, distance * 100);

  ctx.fillStyle = 'rgba(8, 12, 20, 0.55)';
  ctx.fillRect(12, 10, width - 24, 34);
  ctx.strokeStyle = 'rgba(245,197,74,0.35)';
  ctx.strokeRect(12, 10, width - 24, 34);

  ctx.font = '600 12px "Noto Serif SC", serif';
  ctx.fillStyle = '#f5c54a';
  ctx.fillText(`${meta?.label || ''} · ${meta?.start || ''} → ${meta?.end || ''}`, 22, 30);

  ctx.font = '700 12px JetBrains Mono, monospace';
  ctx.fillStyle = '#e8edf5';
  ctx.textAlign = 'right';
  ctx.fillText(`进度 ${progress.toFixed(0)}%`, width - 22, 30);
  ctx.textAlign = 'left';

  const barX = 22;
  const barY = height - 22;
  const barW = width - 44;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(barX, barY, barW, 8);
  ctx.fillStyle = won ? '#3ecf8e' : '#f5c54a';
  ctx.fillRect(barX, barY, barW * (progress / 100), 8);

  ctx.font = '700 13px JetBrains Mono, monospace';
  ctx.fillStyle = '#fff';
  ctx.fillText(`速度 ${Math.round(bike.vx)}`, barX, barY - 8);
  ctx.fillText(`得分 ${Math.floor(score)}`, barX + 120, barY - 8);
  if (combo > 0) {
    ctx.fillStyle = '#3ecf8e';
    ctx.fillText(`连跳 x${combo}`, barX + 240, barY - 8);
  }

  if (phase === 'result' && state.message) {
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(width * 0.2, height * 0.32, width * 0.6, 72);
    ctx.strokeStyle = 'rgba(245,197,74,0.5)';
    ctx.strokeRect(width * 0.2, height * 0.32, width * 0.6, 72);
    ctx.textAlign = 'center';
    ctx.font = '700 18px "Noto Serif SC", serif';
    ctx.fillStyle = won ? '#3ecf8e' : '#ff7b8d';
    ctx.fillText(state.message, width / 2, height * 0.36 + 14);
    ctx.font = '13px JetBrains Mono, monospace';
    ctx.fillStyle = '#e8edf5';
    ctx.fillText('点击重试或返回菜单', width / 2, height * 0.36 + 38);
    ctx.textAlign = 'left';
  }
}
