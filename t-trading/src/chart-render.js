// Canvas 分时图渲染

const COLORS = {
  bg: '#0d1117',
  grid: '#21262d',
  text: '#8b949e',
  candleUp: '#f85149',
  candleDown: '#3fb950',
  vwap: '#a371f7',
  buy: '#3fb950',
  sell: '#f85149',
  level: 'rgba(88,166,255,0.5)',
  bollFill: 'rgba(163,113,247,0.06)'
};

export function renderChart(canvas, { candles, indicators, signals, levels }) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width || canvas.width;
  const h = rect.height || 380;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const pad = { top: 24, right: 56, bottom: 36, left: 8 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, w, h);

  if (!candles.length) return;

  const prices = candles.flatMap((c) => [c.high, c.low]);
  if (indicators.upper) prices.push(...indicators.upper.filter(Boolean));
  if (indicators.lower) prices.push(...indicators.lower.filter(Boolean));
  let minP = Math.min(...prices);
  let maxP = Math.max(...prices);
  const margin = (maxP - minP) * 0.06 || maxP * 0.02;
  minP -= margin;
  maxP += margin;

  const n = candles.length;
  const barW = Math.max(1.5, plotW / n * 0.6);
  const gap = plotW / n;

  function xAt(i) { return pad.left + i * gap + gap / 2; }
  function yAt(p) { return pad.top + (1 - (p - minP) / (maxP - minP)) * plotH; }

  drawGrid(ctx, w, h, pad, minP, maxP, yAt);

  if (indicators.upper && indicators.lower) {
    ctx.fillStyle = COLORS.bollFill;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < n; i++) {
      if (indicators.upper[i] == null) continue;
      const x = xAt(i);
      const y = yAt(indicators.upper[i]);
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    }
    for (let i = n - 1; i >= 0; i--) {
      if (indicators.lower[i] == null) continue;
      ctx.lineTo(xAt(i), yAt(indicators.lower[i]));
    }
    ctx.closePath();
    ctx.fill();
  }

  if (indicators.vwapValues) {
    ctx.strokeStyle = COLORS.vwap;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    let vStarted = false;
    for (let i = 0; i < n; i++) {
      const x = xAt(i);
      const y = yAt(indicators.vwapValues[i]);
      if (!vStarted) { ctx.moveTo(x, y); vStarted = true; }
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  for (let i = 0; i < n; i++) {
    const c = candles[i];
    const x = xAt(i);
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

  const signalSet = new Set(signals.map((s) => s.index));
  for (const sig of signals) {
    const x = xAt(sig.index);
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

  drawTimeLabels(ctx, candles, pad, plotW, h, gap);
}

function drawGrid(ctx, w, h, pad, minP, maxP, yAt) {
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

function drawTimeLabels(ctx, candles, pad, plotW, h, gap) {
  const n = candles.length;
  const step = Math.max(1, Math.floor(n / 6));
  ctx.fillStyle = COLORS.text;
  ctx.font = '9px JetBrains Mono, monospace';
  ctx.textAlign = 'center';

  for (let i = 0; i < n; i += step) {
    const label = candles[i].datetime.slice(5, 16);
    const x = pad.left + i * gap + gap / 2;
    ctx.fillText(label, x, h - 10);
  }
}
