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

/** @param {number[]} values @param {number} period */
export function ema(values, period) {
  const result = [];
  const k = 2 / (period + 1);
  let prev = null;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null || Number.isNaN(v)) {
      result.push(null);
      continue;
    }
    if (prev == null) {
      if (i < period - 1) {
        result.push(null);
        continue;
      }
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += values[j];
      prev = sum / period;
    } else {
      prev = v * k + prev * (1 - k);
    }
    result.push(prev);
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

/** @param {{ high: number, low: number, close: number, volume: number, amount?: number }[]} candles */
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

/** 肯特纳通道 */
export function keltner(candles, period = 20, mult = 1.5) {
  const closes = candles.map((c) => c.close);
  const mid = ema(closes, period);
  const atrValues = atr(candles, period);
  const upper = [];
  const lower = [];
  for (let i = 0; i < candles.length; i++) {
    if (mid[i] == null || atrValues[i] == null) {
      upper.push(null);
      lower.push(null);
    } else {
      upper.push(mid[i] + mult * atrValues[i]);
      lower.push(mid[i] - mult * atrValues[i]);
    }
  }
  return { mid, upper, lower, atr: atrValues };
}

/** MACD */
export function macd(closes, fast = 12, slow = 26, signal = 9) {
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const macdLine = closes.map((_, i) => {
    if (emaFast[i] == null || emaSlow[i] == null) return null;
    return emaFast[i] - emaSlow[i];
  });
  const validMacd = macdLine.map((v) => v ?? 0);
  const signalLine = ema(validMacd, signal);
  const histogram = macdLine.map((m, i) =>
    m != null && signalLine[i] != null ? m - signalLine[i] : null
  );
  return { macdLine, signalLine, histogram };
}

/** KDJ */
export function kdj(candles, n = 9) {
  const k = [];
  const d = [];
  const j = [];
  let prevK = 50;
  let prevD = 50;

  for (let i = 0; i < candles.length; i++) {
    if (i < n - 1) {
      k.push(null);
      d.push(null);
      j.push(null);
      continue;
    }
    let highest = -Infinity;
    let lowest = Infinity;
    for (let x = i - n + 1; x <= i; x++) {
      highest = Math.max(highest, candles[x].high);
      lowest = Math.min(lowest, candles[x].low);
    }
    const rsv = highest === lowest
      ? 50
      : ((candles[i].close - lowest) / (highest - lowest)) * 100;
    const curK = (2 / 3) * prevK + (1 / 3) * rsv;
    const curD = (2 / 3) * prevD + (1 / 3) * curK;
    const curJ = 3 * curK - 2 * curD;
    k.push(curK);
    d.push(curD);
    j.push(curJ);
    prevK = curK;
    prevD = curD;
  }
  return { k, d, j };
}

/** OBV 能量潮 */
export function obv(candles) {
  let total = 0;
  return candles.map((c, i) => {
    if (i === 0) return 0;
    const prev = candles[i - 1].close;
    if (c.close > prev) total += c.volume;
    else if (c.close < prev) total -= c.volume;
    return total;
  });
}

/** ATR 平均真实波幅 */
export function atr(candles, period = 14) {
  const trs = candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const prevClose = candles[i - 1].close;
    return Math.max(
      c.high - c.low,
      Math.abs(c.high - prevClose),
      Math.abs(c.low - prevClose)
    );
  });
  return sma(trs, period);
}

/** CCI */
export function cci(candles, period = 14) {
  const result = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    const slice = candles.slice(i - period + 1, i + 1);
    const tp = slice.map((c) => (c.high + c.low + c.close) / 3);
    const mean = tp.reduce((s, v) => s + v, 0) / period;
    const md = tp.reduce((s, v) => s + Math.abs(v - mean), 0) / period;
    const cur = tp[tp.length - 1];
    result.push(md === 0 ? 0 : (cur - mean) / (0.015 * md));
  }
  return result;
}

/** 量比：当前量 / 近 N 根均量 */
export function volumeRatio(candles, period = 5) {
  const vols = candles.map((c) => c.volume);
  const avg = sma(vols, period);
  return vols.map((v, i) => (avg[i] && avg[i] > 0 ? v / avg[i] : null));
}

/** 斐波那契回撤位 */
export function fibonacciLevels(high, low) {
  const span = high - low;
  return {
    high,
    low,
    fib382: high - span * 0.382,
    fib500: high - span * 0.5,
    fib618: high - span * 0.618
  };
}

/** 检测跳空缺口 */
export function findGaps(dailyCandles) {
  const gaps = [];
  for (let i = 1; i < dailyCandles.length; i++) {
    const prev = dailyCandles[i - 1];
    const cur = dailyCandles[i];
    if (cur.low > prev.high) {
      gaps.push({
        type: 'up',
        top: cur.low,
        bottom: prev.high,
        date: cur.date,
        label: '向上缺口'
      });
    } else if (cur.high < prev.low) {
      gaps.push({
        type: 'down',
        top: prev.low,
        bottom: cur.high,
        date: cur.date,
        label: '向下缺口'
      });
    }
  }
  return gaps.slice(-3);
}

/** 经典枢轴点 */
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

/** 识别局部极值 */
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

/** OBV 背离：价创新高但 OBV 未创新高 → 顶背离 */
export function obvDivergence(candles, obvValues, lookback = 20) {
  if (candles.length < lookback + 2) return null;
  const slice = candles.slice(-lookback);
  const obvSlice = obvValues.slice(-lookback);
  const priceHighIdx = slice.reduce((best, c, i) =>
    (c.high > slice[best].high ? i : best), 0);
  const lastIdx = slice.length - 1;
  const priceMakingHigh = slice[lastIdx].high >= slice[priceHighIdx].high * 0.998;
  const obvNotConfirming = obvSlice[lastIdx] < obvSlice[priceHighIdx];

  if (priceMakingHigh && obvNotConfirming) {
    return { type: 'bearish', label: 'OBV顶背离', hint: '价升量衰，冲高乏力' };
  }

  const priceLowIdx = slice.reduce((best, c, i) =>
    (c.low < slice[best].low ? i : best), 0);
  const priceMakingLow = slice[lastIdx].low <= slice[priceLowIdx].low * 1.002;
  const obvNotConfirmingLow = obvSlice[lastIdx] > obvSlice[priceLowIdx];

  if (priceMakingLow && obvNotConfirmingLow) {
    return { type: 'bullish', label: 'OBV底背离', hint: '价跌量缩，杀跌动能减弱' };
  }
  return null;
}

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

export function lastValid(arr) {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] != null && !Number.isNaN(arr[i])) return arr[i];
  }
  return null;
}
