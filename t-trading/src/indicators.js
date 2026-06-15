// 技术指标计算

/** @param {number[]} values @param {number} period */
export function sma(values, period) {
  const result = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += values[j];
    result.push(sum / period);
  }
  return result;
}

/** @param {number[]} closes @param {number} period */
export function rsi(closes, period = 14) {
  const result = [];
  if (closes.length < period + 1) return closes.map(() => null);

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = 0; i < closes.length; i++) {
    if (i < period) {
      result.push(null);
      continue;
    }
    if (i > period) {
      const diff = closes[i] - closes[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(100 - 100 / (1 + rs));
  }
  return result;
}

/** @param {{ close: number, volume: number, amount?: number }[]} candles */
export function vwap(candles) {
  let cumVol = 0;
  let cumAmt = 0;
  return candles.map((c) => {
    const typical = (c.high + c.low + c.close) / 3;
    const amt = c.amount > 0 ? c.amount : typical * c.volume;
    cumVol += c.volume;
    cumAmt += amt;
    return cumVol > 0 ? cumAmt / cumVol : typical;
  });
}

/** @param {number[]} closes @param {number} period @param {number} mult */
export function bollinger(closes, period = 20, mult = 2) {
  const mid = sma(closes, period);
  const upper = [];
  const lower = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      upper.push(null);
      lower.push(null);
      continue;
    }
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = closes[j] - mid[i];
      sumSq += d * d;
    }
    const std = Math.sqrt(sumSq / period);
    upper.push(mid[i] + mult * std);
    lower.push(mid[i] - mult * std);
  }
  return { mid, upper, lower };
}

/** 经典枢轴点（基于前一日 OHLC） */
export function pivotPoints(prevHigh, prevLow, prevClose) {
  const p = (prevHigh + prevLow + prevClose) / 3;
  const r1 = 2 * p - prevLow;
  const s1 = 2 * p - prevHigh;
  const r2 = p + (prevHigh - prevLow);
  const s2 = p - (prevHigh - prevLow);
  const r3 = prevHigh + 2 * (p - prevLow);
  const s3 = prevLow - 2 * (prevHigh - p);
  return { p, r1, r2, r3, s1, s2, s3 };
}

/** 识别局部极值（swing high/low） */
export function findSwings(candles, lookback = 3) {
  const highs = [];
  const lows = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (candles[j].high >= candles[i].high) isHigh = false;
      if (candles[j].low <= candles[i].low) isLow = false;
    }
    if (isHigh) highs.push({ index: i, price: candles[i].high, candle: candles[i] });
    if (isLow) lows.push({ index: i, price: candles[i].low, candle: candles[i] });
  }
  return { highs, lows };
}

/** 按日期分组 K 线 */
export function groupByDate(candles) {
  const groups = new Map();
  for (const c of candles) {
    const d = c.date;
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d).push(c);
  }
  return groups;
}

export function formatPrice(n, digits = 2) {
  if (n == null || Number.isNaN(n)) return '—';
  return Number(n).toFixed(digits);
}

export function formatPct(n) {
  if (n == null || Number.isNaN(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${Number(n).toFixed(2)}%`;
}
