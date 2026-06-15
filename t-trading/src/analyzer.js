// 做T点位分析引擎

import {
  rsi, vwap, bollinger, pivotPoints, findSwings, groupByDate, sma
} from './indicators.js';

const RSI_OVERSOLD = 32;
const RSI_OVERBOUGHT = 68;
const VWAP_DEVIATION = 0.003;
const MIN_STRENGTH = 2;

/**
 * 综合分析做T信号
 * @param {{ candles: object[], dailyCandles?: object[], quote?: object }} data
 */
export function analyzeTPoints({ candles, dailyCandles = [], quote = null }) {
  const closes = candles.map((c) => c.close);
  const rsiValues = rsi(closes, 14);
  const vwapValues = vwap(candles);
  const { mid, upper, lower } = bollinger(closes, 20, 2);
  const ma5 = sma(closes, 5);
  const swings = findSwings(candles, 2);

  const levels = computeLevels(candles, dailyCandles, quote);
  const signals = detectSignals(candles, {
    rsiValues, vwapValues, upper, lower, mid, ma5, swings, levels
  });

  const strategy = buildStrategy(candles, signals, levels, quote, rsiValues);

  return { levels, signals, strategy, indicators: { rsiValues, vwapValues, upper, lower, mid, ma5 } };
}

function computeLevels(candles, dailyCandles, quote) {
  const lastCandle = candles[candles.length - 1];
  const todayGroup = groupByDate(candles);
  const dates = [...todayGroup.keys()].sort();
  const today = dates[dates.length - 1];
  const todayCandles = todayGroup.get(today) || candles;

  const todayHigh = Math.max(...todayCandles.map((c) => c.high));
  const todayLow = Math.min(...todayCandles.map((c) => c.low));
  const todayOpen = todayCandles[0]?.open || lastCandle.open;

  let prevDay = null;
  if (dailyCandles.length >= 2) {
    prevDay = dailyCandles[dailyCandles.length - 2];
  } else if (dates.length >= 2) {
    const prevDate = dates[dates.length - 2];
    const prevCandles = todayGroup.get(prevDate) || [];
    if (prevCandles.length) {
      prevDay = {
        high: Math.max(...prevCandles.map((c) => c.high)),
        low: Math.min(...prevCandles.map((c) => c.low)),
        close: prevCandles[prevCandles.length - 1].close,
        open: prevCandles[0].open
      };
    }
  }

  const prevClose = quote?.prevClose || prevDay?.close || todayOpen;
  const prevHigh = prevDay?.high || todayHigh;
  const prevLow = prevDay?.low || todayLow;

  const pivots = pivotPoints(prevHigh, prevLow, prevClose);

  const vwapLast = vwap(candles);
  const currentVwap = vwapLast[vwapLast.length - 1];

  return {
    prevClose,
    todayOpen,
    todayHigh,
    todayLow,
    currentPrice: quote?.price || lastCandle.close,
    currentVwap,
    ...pivots,
    resistZone: [pivots.r1, pivots.r2],
    supportZone: [pivots.s1, pivots.s2]
  };
}

function detectSignals(candles, ctx) {
  const { rsiValues, vwapValues, upper, lower, mid, ma5, swings, levels } = ctx;
  const signals = [];
  const usedIndices = new Set();

  for (let i = 20; i < candles.length; i++) {
    const c = candles[i];
    const reasons = [];
    let buyScore = 0;
    let sellScore = 0;

    const r = rsiValues[i];
    const v = vwapValues[i];
    const devFromVwap = v > 0 ? (c.close - v) / v : 0;

    if (r != null && r <= RSI_OVERSOLD) {
      buyScore += 2;
      reasons.push(`RSI超卖 ${r.toFixed(1)}`);
    }
    if (r != null && r >= RSI_OVERBOUGHT) {
      sellScore += 2;
      reasons.push(`RSI超买 ${r.toFixed(1)}`);
    }

    if (devFromVwap < -VWAP_DEVIATION) {
      buyScore += 1;
      reasons.push('低于VWAP');
    }
    if (devFromVwap > VWAP_DEVIATION) {
      sellScore += 1;
      reasons.push('高于VWAP');
    }

    if (lower[i] != null && c.low <= lower[i] * 1.002) {
      buyScore += 2;
      reasons.push('触及布林下轨');
    }
    if (upper[i] != null && c.high >= upper[i] * 0.998) {
      sellScore += 2;
      reasons.push('触及布林上轨');
    }

    if (c.low <= levels.s1 * 1.002) {
      buyScore += 1;
      reasons.push(`近S1 ${levels.s1.toFixed(2)}`);
    }
    if (c.high >= levels.r1 * 0.998) {
      sellScore += 1;
      reasons.push(`近R1 ${levels.r1.toFixed(2)}`);
    }

    if (ma5[i] != null && i > 0 && ma5[i - 1] != null) {
      if (c.close > ma5[i] && candles[i - 1].close <= ma5[i - 1] && buyScore > 0) {
        buyScore += 1;
        reasons.push('站上MA5');
      }
      if (c.close < ma5[i] && candles[i - 1].close >= ma5[i - 1] && sellScore > 0) {
        sellScore += 1;
        reasons.push('跌破MA5');
      }
    }

    const isSwingLow = swings.lows.some((s) => s.index === i);
    const isSwingHigh = swings.highs.some((s) => s.index === i);

    if (isSwingLow) buyScore += 1;
    if (isSwingHigh) sellScore += 1;

    if (buyScore >= MIN_STRENGTH && buyScore > sellScore && !usedIndices.has(i)) {
      signals.push({
        type: 'buy',
        label: '低吸',
        index: i,
        price: c.low,
        datetime: c.datetime,
        strength: buyScore,
        reasons: [...new Set(reasons.filter((r) =>
          r.includes('RSI') || r.includes('VWAP') || r.includes('布林') || r.includes('S1') || r.includes('MA5')
        ))].slice(0, 4)
      });
      usedIndices.add(i);
    } else if (sellScore >= MIN_STRENGTH && sellScore > buyScore && !usedIndices.has(i)) {
      signals.push({
        type: 'sell',
        label: '高抛',
        index: i,
        price: c.high,
        datetime: c.datetime,
        strength: sellScore,
        reasons: [...new Set(reasons.filter((r) =>
          r.includes('RSI') || r.includes('VWAP') || r.includes('布林') || r.includes('R1') || r.includes('MA5')
        ))].slice(0, 4)
      });
      usedIndices.add(i);
    }
  }

  return dedupeSignals(signals).slice(-30);
}

function dedupeSignals(signals) {
  const result = [];
  for (const sig of signals) {
    const last = result[result.length - 1];
    if (last && last.type === sig.type && sig.index - last.index < 3) {
      if (sig.strength > last.strength) result[result.length - 1] = sig;
      continue;
    }
    result.push(sig);
  }
  return result;
}

function buildStrategy(candles, signals, levels, quote, rsiValues) {
  const price = levels.currentPrice;
  const lastRsi = rsiValues[rsiValues.length - 1];
  const recentBuy = signals.filter((s) => s.type === 'buy').slice(-3);
  const recentSell = signals.filter((s) => s.type === 'sell').slice(-3);

  let bias = 'neutral';
  let biasLabel = '震荡';
  const distToR1 = (levels.r1 - price) / price;
  const distToS1 = (price - levels.s1) / price;

  if (lastRsi != null) {
    if (lastRsi > 65 && price > levels.currentVwap) {
      bias = 'bearish';
      biasLabel = '偏高抛';
    } else if (lastRsi < 35 && price < levels.currentVwap) {
      bias = 'bullish';
      biasLabel = '偏低吸';
    }
  }

  const lines = [];

  lines.push(`<span class="strategy-tag ${bias === 'bullish' ? 'bearish' : bias === 'bearish' ? 'bullish' : 'neutral'}">${biasLabel}</span>`);

  if (bias === 'bearish') {
    lines.push(`当前价 <strong>${price.toFixed(2)}</strong> 接近阻力区，适合<strong>正T</strong>（先卖后买）。`);
    lines.push(`建议高抛区间：<strong>${levels.r1.toFixed(2)} ~ ${levels.r2.toFixed(2)}</strong>，低吸回补：<strong>${levels.s1.toFixed(2)} ~ ${levels.currentVwap.toFixed(2)}</strong>。`);
  } else if (bias === 'bullish') {
    lines.push(`当前价 <strong>${price.toFixed(2)}</strong> 接近支撑区，适合<strong>反T</strong>（先买后卖）或低吸加仓。`);
    lines.push(`建议低吸区间：<strong>${levels.s1.toFixed(2)} ~ ${levels.s2.toFixed(2)}</strong>，高抛止盈：<strong>${levels.r1.toFixed(2)} ~ ${levels.currentVwap.toFixed(2)}</strong>。`);
  } else {
    lines.push(`当前价 <strong>${price.toFixed(2)}</strong> 在 VWAP（<strong>${levels.currentVwap.toFixed(2)}</strong>）附近震荡。`);
    lines.push(`高抛低吸参考：阻力 <strong>${levels.r1.toFixed(2)}</strong>，支撑 <strong>${levels.s1.toFixed(2)}</strong>。`);
  }

  if (distToR1 < 0.005) {
    lines.push('⚠ 价格已逼近 R1 阻力位，注意冲高回落风险。');
  }
  if (distToS1 < 0.005) {
    lines.push('⚠ 价格已逼近 S1 支撑位，可关注反弹低吸机会。');
  }

  if (recentSell.length) {
    const last = recentSell[recentSell.length - 1];
    lines.push(`最近高抛信号：<strong>${last.price.toFixed(2)}</strong>（${last.datetime}）`);
  }
  if (recentBuy.length) {
    const last = recentBuy[recentBuy.length - 1];
    lines.push(`最近低吸信号：<strong>${last.price.toFixed(2)}</strong>（${last.datetime}）`);
  }

  lines.push('<br><em>A股 T+1 规则：做T需有底仓。正T=高位卖出低位买回；反T=低位买入高位卖出（需昨日持仓）。</em>');

  return lines.join('<br>');
}
