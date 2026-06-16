// Canvas 分时图渲染 · 仅当日 · 时间轴对齐开盘/收盘

import {
  timeToSessionMinute, totalSessionMinutes, minutesToTime, timeToMinutes
} from './session.js';

const COLORS = {
  bg: '#0d1117',
  grid: '#21262d',
  text: '#8b949e',
  candleUp: '#f85149',
  candleDown: '#3fb950',
  vwap: '#a371f7',
  ma10: '#58a6ff',
  ma20: '#d29922',
  buy: '#3fb950',
  sell: '#f85149',
  fib: 'rgba(210,153,34,0.45)',
  bollFill: 'rgba(163,113,247,0.06)',
  lunch: 'rgba(48,54,61,0.5)'
};

function drawLine(ctx, points, color, dash = []) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  ctx.setLineDash(dash);
  ctx.beginPath();
  let started = false;
  for (const { x, y } of points) {
    if (x == null || y == null || Number.isNaN(y)) continue;
    if (!started) { ctx.moveTo(x, y); started = true; }
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

export function renderChart(canvas, { candles, indicators, signals, levels, market = 'cn', session, today }) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width || canvas.width;
  const h = rect.height || 380;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const pad = { top: 28, right: 56, bottom: 40, left: 44 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, w, h);

  if (!candles.length) {
    ctx.fillStyle = COLORS.text;
    ctx.font = '13px Noto Sans SC, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('暂无当日分时数据', w / 2, h / 2);
    return;
  }

  const sess = session || { open: '09:30', close: '15:00', segments: [{ start: '09:30', end: '15:00' }] };
  const totalMins = totalSessionMinutes(market);
  const periodMins = inferPeriodMinutes(candles, market);

  function xAtTime(time) {
    const sm = timeToSessionMinute(time, market);
    return pad.left + (sm / totalMins) * plotW;
  }

  function xAtIndex(i) {
    const c = candles[i];
    if (!c?.time) return pad.left + (i / Math.max(1, candles.length - 1)) * plotW;
    const sm = timeToSessionMinute(c.time, market);
    // K 线中心取周期中点
    return pad.left + ((sm + periodMins * 0.5) / totalMins) * plotW;
  }

  function yAt(p) {
    return pad.top + (1 - (p - minP) / (maxP - minP)) * plotH;
  }

  const prices = candles.flatMap((c) => [c.high, c.low]);
  if (indicators.upper) prices.push(...indicators.upper.filter(Boolean));
  if (indicators.lower) prices.push(...indicators.lower.filter(Boolean));
  if (levels.fib382) prices.push(levels.fib382, levels.fib618);
  let minP = Math.min(...prices);
  let maxP = Math.max(...prices);
  const margin = (maxP - minP) * 0.06 || maxP * 0.02;
  minP -= margin;
  maxP += margin;

  const n = candles.length;
  const barW = Math.max(2, (periodMins / totalMins) * plotW * 0.75);

  drawSessionGrid(ctx, w, h, pad, plotW, plotH, minP, maxP, yAt, sess, market, totalMins, xAtTime);

  // Bollinger fill
  if (indicators.upper && indicators.lower) {
    ctx.fillStyle = COLORS.bollFill;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < n; i++) {
      if (indicators.upper[i] == null) continue;
      const x = xAtIndex(i);
      const y = yAt(indicators.upper[i]);
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    }
    for (let i = n - 1; i >= 0; i--) {
      if (indicators.lower[i] == null) continue;
      ctx.lineTo(xAtIndex(i), yAt(indicators.lower[i]));
    }
    ctx.closePath();
    ctx.fill();
  }

  if (indicators.ma10) {
    drawLine(ctx, indicators.ma10.map((v, i) => ({ x: xAtIndex(i), y: v != null ? yAt(v) : null })), COLORS.ma10);
  }
  if (indicators.ma20) {
    drawLine(ctx, indicators.ma20.map((v, i) => ({ x: xAtIndex(i), y: v != null ? yAt(v) : null })), COLORS.ma20, [3, 2]);
  }
  if (indicators.vwapValues) {
    drawLine(ctx, indicators.vwapValues.map((v, i) => ({ x: xAtIndex(i), y: yAt(v) })), COLORS.vwap, [4, 3]);
  }

  for (let i = 0; i < n; i++) {
    const c = candles[i];
    const x = xAtIndex(i);
    const yO = yAt(c.open);
    const yC = yAt(c.close);
    const yH = yAt(c.high);
    const yL = yAt(c.low);
    const up = c.close >= c.open;
    const color = up ? COLORS.candleUp : COLORS.candleDown;

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, yH);
    ctx.lineTo(x, yL);
    ctx.stroke();

    const bodyTop = Math.min(yO, yC);
    const bodyH = Math.max(1, Math.abs(yC - yO));
    ctx.fillRect(x - barW / 2, bodyTop, barW, bodyH);
  }

  drawLevelLine(ctx, pad, plotW, yAt, levels.r1, 'R1', COLORS.sell);
  drawLevelLine(ctx, pad, plotW, yAt, levels.s1, 'S1', COLORS.buy);
  drawLevelLine(ctx, pad, plotW, yAt, levels.currentVwap, 'VWAP', COLORS.vwap);
  drawLevelLine(ctx, pad, plotW, yAt, levels.fib382, 'Fib38', COLORS.fib);
  drawLevelLine(ctx, pad, plotW, yAt, levels.fib618, 'Fib62', COLORS.fib);

  for (const sig of signals) {
    if (sig.index < 0 || sig.index >= n) continue;
    const x = xAtIndex(sig.index);
    const y = yAt(sig.price);
    const isBuy = sig.type === 'buy';

    ctx.beginPath();
    ctx.arc(x, y + (isBuy ? 12 : -12), 5, 0, Math.PI * 2);
    ctx.fillStyle = isBuy ? COLORS.buy : COLORS.sell;
    ctx.fill();

    ctx.fillStyle = isBuy ? COLORS.buy : COLORS.sell;
    ctx.font = 'bold 9px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(isBuy ? 'B' : 'S', x, y + (isBuy ? 15 : -9));
  }

  drawTimeAxis(ctx, w, h, pad, plotW, sess, market, totalMins, xAtTime, today);
}

function inferPeriodMinutes(candles, market = 'cn') {
  if (candles.length < 2) return 5;
  const a = timeToSessionMinute(candles[0].time, market);
  const b = timeToSessionMinute(candles[1].time, market);
  const diff = Math.abs(b - a);
  return diff > 0 ? diff : 5;
}

function drawSessionGrid(ctx, w, h, pad, plotW, plotH, minP, maxP, yAt, sess, market, totalMins, xAtTime) {
  // 午休分隔（多段市场）
  if (sess.segments?.length > 1) {
    const lunchStart = timeToSessionMinute(sess.segments[0].end, market);
    const xMid = pad.left + (lunchStart / totalMins) * plotW;
    ctx.fillStyle = COLORS.lunch;
    ctx.fillRect(xMid - 1, pad.top, 2, plotH);
  }

  // 水平价格格
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  const steps = 5;
  for (let i = 0; i <= steps; i++) {
    const p = minP + (maxP - minP) * i / steps;
    const y = yAt(p);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();

    ctx.fillStyle = COLORS.text;
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(p.toFixed(2), w - pad.right + 4, y + 3);
  }

  // 垂直时间格
  const tickTimes = buildTickTimes(sess, market);
  for (const t of tickTimes) {
    const x = xAtTime(t);
    ctx.strokeStyle = COLORS.grid;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, pad.top + plotH);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function buildTickTimes(sess, market) {
  const ticks = [];
  for (const seg of sess.segments) {
    const start = timeToMinutes(seg.start);
    const end = timeToMinutes(seg.end);
    for (let m = start; m <= end; m += 30) {
      ticks.push(minutesToTime(m));
    }
  }
  return ticks;
}

function drawTimeAxis(ctx, w, h, pad, plotW, sess, market, totalMins, xAtTime, today) {
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 10px JetBrains Mono, monospace';

  const openX = pad.left;
  ctx.textAlign = 'left';
  ctx.fillText(sess.open, openX, h - 8);

  const closeX = pad.left + plotW;
  ctx.textAlign = 'right';
  ctx.fillText(sess.close, closeX, h - 8);

  ctx.font = '9px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  const midTimes = buildTickTimes(sess, market).filter((t) => t !== sess.open && t !== sess.close);
  for (const t of midTimes) {
    const x = xAtTime(t);
    if (x < pad.left + 30 || x > pad.left + plotW - 30) continue;
    ctx.fillText(t, x, h - 8);
  }

  if (today) {
    ctx.textAlign = 'left';
    ctx.font = '9px Noto Sans SC, sans-serif';
    ctx.fillStyle = 'rgba(139,148,158,0.75)';
    ctx.fillText(today, openX, pad.top - 8);
  }
}

function drawLevelLine(ctx, pad, plotW, yAt, price, label, color) {
  if (!price) return;
  const y = yAt(price);
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(pad.left, y);
  ctx.lineTo(pad.left + plotW, y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  ctx.fillStyle = color;
  ctx.font = '9px JetBrains Mono, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`${label} ${price.toFixed(2)}`, pad.left + 4, y - 3);
}

/** 日线 K 线图 + 布林 BS 点 */
export function renderDailyChart(canvas, { candles, indicators, signals, levels }) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width || canvas.width;
  const h = rect.height || 380;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const pad = { top: 28, right: 56, bottom: 40, left: 44 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, w, h);

  if (!candles.length) {
    ctx.fillStyle = COLORS.text;
    ctx.font = '13px Noto Sans SC, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('暂无日线数据', w / 2, h / 2);
    return;
  }

  const n = candles.length;
  const prices = candles.flatMap((c) => [c.high, c.low]);
  if (indicators.upper) prices.push(...indicators.upper.filter(Boolean));
  if (indicators.lower) prices.push(...indicators.lower.filter(Boolean));
  let minP = Math.min(...prices);
  let maxP = Math.max(...prices);
  const margin = (maxP - minP) * 0.06 || maxP * 0.02;
  minP -= margin;
  maxP += margin;

  function xAtIndex(i) {
    const slot = plotW / Math.max(1, n);
    return pad.left + slot * i + slot * 0.5;
  }

  function yAt(p) {
    return pad.top + (1 - (p - minP) / (maxP - minP)) * plotH;
  }

  const barW = Math.max(2, (plotW / n) * 0.65);

  // Grid
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const p = minP + (maxP - minP) * i / 5;
    const y = yAt(p);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
    ctx.fillStyle = COLORS.text;
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(p.toFixed(2), w - pad.right + 4, y + 3);
  }

  // Bollinger fill
  if (indicators.upper && indicators.lower) {
    ctx.fillStyle = COLORS.bollFill;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < n; i++) {
      if (indicators.upper[i] == null) continue;
      const x = xAtIndex(i);
      const y = yAt(indicators.upper[i]);
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    }
    for (let i = n - 1; i >= 0; i--) {
      if (indicators.lower[i] == null) continue;
      ctx.lineTo(xAtIndex(i), yAt(indicators.lower[i]));
    }
    ctx.closePath();
    ctx.fill();
  }

  if (indicators.mid) {
    drawLine(ctx, indicators.mid.map((v, i) => ({ x: xAtIndex(i), y: v != null ? yAt(v) : null })), COLORS.vwap);
  }
  if (indicators.upper) {
    drawLine(ctx, indicators.upper.map((v, i) => ({ x: xAtIndex(i), y: v != null ? yAt(v) : null })), COLORS.ma10, [3, 2]);
  }
  if (indicators.lower) {
    drawLine(ctx, indicators.lower.map((v, i) => ({ x: xAtIndex(i), y: v != null ? yAt(v) : null })), COLORS.ma10, [3, 2]);
  }
  if (indicators.ma20) {
    drawLine(ctx, indicators.ma20.map((v, i) => ({ x: xAtIndex(i), y: v != null ? yAt(v) : null })), COLORS.ma20);
  }

  // Candles
  for (let i = 0; i < n; i++) {
    const c = candles[i];
    const x = xAtIndex(i);
    const yO = yAt(c.open);
    const yC = yAt(c.close);
    const yH = yAt(c.high);
    const yL = yAt(c.low);
    const up = c.close >= c.open;
    const color = up ? COLORS.candleUp : COLORS.candleDown;

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, yH);
    ctx.lineTo(x, yL);
    ctx.stroke();

    const bodyTop = Math.min(yO, yC);
    const bodyH = Math.max(1, Math.abs(yC - yO));
    ctx.fillRect(x - barW / 2, bodyTop, barW, bodyH);
  }

  // BS signals
  for (const sig of signals) {
    if (sig.index < 0 || sig.index >= n) continue;
    const x = xAtIndex(sig.index);
    const y = yAt(sig.price);
    const isBuy = sig.type === 'buy';

    ctx.beginPath();
    ctx.arc(x, y + (isBuy ? 14 : -14), 6, 0, Math.PI * 2);
    ctx.fillStyle = isBuy ? COLORS.buy : COLORS.sell;
    ctx.fill();

    ctx.fillStyle = isBuy ? COLORS.buy : COLORS.sell;
    ctx.font = 'bold 10px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(isBuy ? 'B' : 'S', x, y + (isBuy ? 18 : -10));
  }

  // Date axis
  ctx.fillStyle = COLORS.text;
  ctx.font = '9px JetBrains Mono, monospace';
  const step = Math.max(1, Math.floor(n / 6));
  for (let i = 0; i < n; i += step) {
    const x = xAtIndex(i);
    ctx.textAlign = 'center';
    ctx.fillText(candles[i].date.slice(5), x, h - 10);
  }
  if (levels?.upper) {
    ctx.textAlign = 'left';
    ctx.font = '9px Noto Sans SC, sans-serif';
    ctx.fillStyle = 'rgba(139,148,158,0.75)';
    ctx.fillText('日线 · 布林带(20,2)', pad.left, pad.top - 8);
  }
}
