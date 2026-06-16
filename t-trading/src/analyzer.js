// 做T点位分析引擎 · 四大组合 + 扩展指标

import {
  rsi, vwap, bollinger, keltner, pivotPoints, findSwings, groupByDate,
  sma, macd, kdj, obv, atr, cci, volumeRatio, fibonacciLevels, findGaps,
  obvDivergence, lastValid
} from './indicators.js';

const RSI_OVERSOLD = 32;
const RSI_OVERBOUGHT = 68;
const KDJ_OVERSOLD = 20;
const KDJ_OVERBOUGHT = 80;
const CCI_OVERSOLD = -100;
const CCI_OVERBOUGHT = 100;
const VWAP_DEVIATION = 0.003;
const MIN_STRENGTH = 3;

export function analyzeTPoints({ candles, dailyCandles = [], quote = null }) {
  const closes = candles.map((c) => c.close);
  const rsiValues = rsi(closes, 14);
  const vwapValues = vwap(candles);
  const boll = bollinger(closes, 20, 2);
  const kelt = keltner(candles, 20, 1.5);
  const ma5 = sma(closes, 5);
  const ma10 = sma(closes, 10);
  const ma20 = sma(closes, 20);
  const macdData = macd(closes);
  const kdjData = kdj(candles, 9);
  const obvValues = obv(candles);
  const atrValues = atr(candles, 14);
  const cciValues = cci(candles, 14);
  const volRatio = volumeRatio(candles, 5);
  const swings = findSwings(candles, 2);

  const levels = computeLevels(candles, dailyCandles, quote);
  const obvDiv = obvDivergence(candles, obvValues);

  const indicators = {
    rsiValues, vwapValues,
    upper: boll.upper, lower: boll.lower, mid: boll.mid,
    keltUpper: kelt.upper, keltLower: kelt.lower,
    ma5, ma10, ma20,
    macdLine: macdData.macdLine,
    signalLine: macdData.signalLine,
    histogram: macdData.histogram,
    kdjK: kdjData.k, kdjD: kdjData.d, kdjJ: kdjData.j,
    obvValues, atrValues, cciValues, volRatio
  };

  const combos = analyzeCombos(candles, indicators, levels, obvDiv);
  const signals = detectSignals(candles, { ...indicators, swings, levels, obvDiv });
  const strategy = buildStrategy(candles, signals, levels, quote, indicators, combos, obvDiv);
  const snapshot = buildSnapshot(indicators, levels, obvDiv);

  return { levels, signals, strategy, combos, snapshot, indicators };
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
        open: prevCandles[0].open,
        date: prevDate
      };
    }
  }

  const prevClose = quote?.prevClose || prevDay?.close || todayOpen;
  const prevHigh = prevDay?.high || todayHigh;
  const prevLow = prevDay?.low || todayLow;

  const pivots = pivotPoints(prevHigh, prevLow, prevClose);
  const currentVwap = lastValid(vwap(candles)) || lastCandle.close;
  const currentAtr = lastValid(atr(candles, 14)) || 0;
  const price = quote?.price || lastCandle.close;

  const fib = fibonacciLevels(todayHigh, todayLow);
  const gaps = findGaps(dailyCandles.length >= 2 ? dailyCandles : []);

  return {
    prevClose,
    prevHigh,
    prevLow,
    todayOpen,
    todayHigh,
    todayLow,
    currentPrice: price,
    currentVwap,
    currentAtr,
    atrStopBuy: price - currentAtr * 1.5,
    atrStopSell: price + currentAtr * 1.5,
    ...pivots,
    ...fib,
    gaps,
    resistZone: [pivots.r1, pivots.r2],
    supportZone: [pivots.s1, pivots.s2]
  };
}

/** 四大有效组合评分 */
function analyzeCombos(candles, ind, levels, obvDiv) {
  const i = candles.length - 1;
  const price = candles[i].close;
  const r = ind.rsiValues[i];
  const j = ind.kdjJ[i];
  const cciVal = ind.cciValues[i];
  const vr = ind.volRatio[i];
  const vwapV = ind.vwapValues[i];
  const ma10 = ind.ma10[i];
  const ma20 = ind.ma20[i];
  const hist = ind.histogram[i];
  const prevHist = i > 0 ? ind.histogram[i - 1] : null;

  // ① 趋势+位置：VWAP + MA + 枢轴
  let trendScore = 0;
  const trendNotes = [];
  if (price > vwapV) { trendScore += 1; trendNotes.push('价>VWAP'); }
  else { trendScore -= 1; trendNotes.push('价<VWAP'); }
  if (ma10 != null && ma20 != null) {
    if (price > ma10 && ma10 > ma20) { trendScore += 2; trendNotes.push('均线多头'); }
    else if (price < ma10 && ma10 < ma20) { trendScore -= 2; trendNotes.push('均线空头'); }
    else trendNotes.push('均线缠绕');
  }
  if (price >= levels.r1 * 0.998) { trendScore -= 1; trendNotes.push('近R1阻力'); }
  if (price <= levels.s1 * 1.002) { trendScore += 1; trendNotes.push('近S1支撑'); }

  // ② 反转：RSI + KDJ + 布林
  let reversalScore = 0;
  const reversalNotes = [];
  if (r != null && r <= RSI_OVERSOLD) { reversalScore += 2; reversalNotes.push(`RSI超卖${r.toFixed(0)}`); }
  if (r != null && r >= RSI_OVERBOUGHT) { reversalScore -= 2; reversalNotes.push(`RSI超买${r.toFixed(0)}`); }
  if (j != null && j <= KDJ_OVERSOLD) { reversalScore += 2; reversalNotes.push(`KDJ超卖J=${j.toFixed(0)}`); }
  if (j != null && j >= KDJ_OVERBOUGHT) { reversalScore -= 2; reversalNotes.push(`KDJ超买J=${j.toFixed(0)}`); }
  if (ind.lower[i] != null && price <= ind.lower[i] * 1.003) {
    reversalScore += 1; reversalNotes.push('布林下轨');
  }
  if (ind.upper[i] != null && price >= ind.upper[i] * 0.997) {
    reversalScore -= 1; reversalNotes.push('布林上轨');
  }
  if (cciVal != null && cciVal <= CCI_OVERSOLD) { reversalScore += 1; reversalNotes.push('CCI超卖'); }
  if (cciVal != null && cciVal >= CCI_OVERBOUGHT) { reversalScore -= 1; reversalNotes.push('CCI超买'); }

  // ③ 价量：量比 + OBV
  let volumeScore = 0;
  const volumeNotes = [];
  if (vr != null) {
    if (vr > 2) { volumeNotes.push(`放量${vr.toFixed(1)}倍`); volumeScore += price > candles[i].open ? 1 : -1; }
    else if (vr < 0.6) { volumeNotes.push('缩量'); }
    else volumeNotes.push(`量比${vr.toFixed(1)}`);
  }
  if (obvDiv?.type === 'bearish') { volumeScore -= 2; volumeNotes.push(obvDiv.label); }
  if (obvDiv?.type === 'bullish') { volumeScore += 2; volumeNotes.push(obvDiv.label); }

  // ④ 动能：MACD + 均线
  let momentumScore = 0;
  const momentumNotes = [];
  if (hist != null && prevHist != null) {
    if (hist > 0 && prevHist <= 0) { momentumScore += 2; momentumNotes.push('MACD金叉'); }
    if (hist < 0 && prevHist >= 0) { momentumScore -= 2; momentumNotes.push('MACD死叉'); }
    if (hist > prevHist && hist > 0) momentumNotes.push('红柱放大');
    if (hist < prevHist && hist < 0) momentumNotes.push('绿柱放大');
  }
  if (ma10 != null && i > 0 && ind.ma10[i - 1] != null) {
    if (price > ma10 && candles[i - 1].close <= ind.ma10[i - 1]) {
      momentumScore += 1; momentumNotes.push('站上MA10');
    }
    if (price < ma10 && candles[i - 1].close >= ind.ma10[i - 1]) {
      momentumScore -= 1; momentumNotes.push('跌破MA10');
    }
  }

  return [
    comboCard('trend', '趋势+位置', 'VWAP · MA · 枢轴', trendScore, trendNotes),
    comboCard('reversal', '反转信号', 'RSI · KDJ · 布林 · CCI', reversalScore, reversalNotes),
    comboCard('volume', '价量确认', '量比 · OBV背离', volumeScore, volumeNotes),
    comboCard('momentum', '动能方向', 'MACD · 分时均线', momentumScore, momentumNotes)
  ];
}

function comboCard(id, name, desc, score, notes) {
  let bias = 'neutral';
  let biasLabel = '中性';
  if (score >= 2) { bias = 'bullish'; biasLabel = '偏多/低吸'; }
  else if (score <= -2) { bias = 'bearish'; biasLabel = '偏空/高抛'; }
  return { id, name, desc, score, bias, biasLabel, notes: notes.slice(0, 4) };
}

function buildSnapshot(ind, levels, obvDiv) {
  const last = (arr) => lastValid(arr);
  return {
    rsi: last(ind.rsiValues),
    kdjJ: last(ind.kdjJ),
    cci: last(ind.cciValues),
    volRatio: last(ind.volRatio),
    macdHist: last(ind.histogram),
    atr: levels.currentAtr,
    obvTrend: obvDiv?.label || '无背离'
  };
}

function detectSignals(candles, ctx) {
  const {
    rsiValues, vwapValues, upper, lower, keltUpper, keltLower,
    ma5, ma10, ma20, kdjJ, cciValues, volRatio, histogram,
    swings, levels, obvDiv
  } = ctx;
  const signals = [];
  const usedIndices = new Set();

  for (let i = 25; i < candles.length; i++) {
    const c = candles[i];
    const reasons = [];
    let buyScore = 0;
    let sellScore = 0;

    const r = rsiValues[i];
    const j = kdjJ[i];
    const cciVal = cciValues[i];
    const v = vwapValues[i];
    const vr = volRatio[i];
    const devFromVwap = v > 0 ? (c.close - v) / v : 0;
    const hist = histogram[i];
    const prevHist = histogram[i - 1];

    // 反转组合
    if (r != null && r <= RSI_OVERSOLD) { buyScore += 2; reasons.push(`RSI${r.toFixed(0)}`); }
    if (r != null && r >= RSI_OVERBOUGHT) { sellScore += 2; reasons.push(`RSI${r.toFixed(0)}`); }
    if (j != null && j <= KDJ_OVERSOLD) { buyScore += 2; reasons.push(`KDJ${j.toFixed(0)}`); }
    if (j != null && j >= KDJ_OVERBOUGHT) { sellScore += 2; reasons.push(`KDJ${j.toFixed(0)}`); }
    if (cciVal != null && cciVal <= CCI_OVERSOLD) { buyScore += 1; reasons.push('CCI超卖'); }
    if (cciVal != null && cciVal >= CCI_OVERBOUGHT) { sellScore += 1; reasons.push('CCI超买'); }

    // 趋势+位置
    if (devFromVwap < -VWAP_DEVIATION) { buyScore += 1; reasons.push('低于VWAP'); }
    if (devFromVwap > VWAP_DEVIATION) { sellScore += 1; reasons.push('高于VWAP'); }
    if (lower[i] != null && c.low <= lower[i] * 1.002) { buyScore += 2; reasons.push('布林下轨'); }
    if (upper[i] != null && c.high >= upper[i] * 0.998) { sellScore += 2; reasons.push('布林上轨'); }
    if (keltLower[i] != null && c.low <= keltLower[i] * 1.002) { buyScore += 1; reasons.push('肯特纳下轨'); }
    if (keltUpper[i] != null && c.high >= keltUpper[i] * 0.998) { sellScore += 1; reasons.push('肯特纳上轨'); }
    if (c.low <= levels.s1 * 1.002) { buyScore += 1; reasons.push('近S1'); }
    if (c.high >= levels.r1 * 0.998) { sellScore += 1; reasons.push('近R1'); }
    if (c.low <= levels.fib618 * 1.002) { buyScore += 1; reasons.push('Fib61.8%'); }
    if (c.high >= levels.fib382 * 0.998) { sellScore += 1; reasons.push('Fib38.2%'); }

    // 动能
    if (hist != null && prevHist != null) {
      if (hist > 0 && prevHist <= 0) { buyScore += 2; reasons.push('MACD金叉'); }
      if (hist < 0 && prevHist >= 0) { sellScore += 2; reasons.push('MACD死叉'); }
    }
    if (ma10[i] != null && i > 0 && ma10[i - 1] != null) {
      if (c.close > ma10[i] && candles[i - 1].close <= ma10[i - 1]) {
        buyScore += 1; reasons.push('站上MA10');
      }
      if (c.close < ma10[i] && candles[i - 1].close >= ma10[i - 1]) {
        sellScore += 1; reasons.push('跌破MA10');
      }
    }
    if (ma20[i] != null && c.close > ma20[i]) buyScore += 0.5;
    if (ma20[i] != null && c.close < ma20[i]) sellScore += 0.5;

    // 价量
    if (vr != null && vr > 2.5) {
      if (c.close < c.open) { sellScore += 1; reasons.push('放量下跌'); }
      else { buyScore += 1; reasons.push('放量上涨'); }
    }
    if (vr != null && vr < 0.5 && buyScore > 0) {
      buyScore -= 0.5; reasons.push('缩量反弹');
    }

    const isSwingLow = swings.lows.some((s) => s.index === i);
    const isSwingHigh = swings.highs.some((s) => s.index === i);
    if (isSwingLow) buyScore += 1;
    if (isSwingHigh) sellScore += 1;

    buyScore = Math.round(buyScore);
    sellScore = Math.round(sellScore);

    if (buyScore >= MIN_STRENGTH && buyScore > sellScore && !usedIndices.has(i)) {
      signals.push(makeSignal('buy', i, c, buyScore, reasons));
      usedIndices.add(i);
    } else if (sellScore >= MIN_STRENGTH && sellScore > buyScore && !usedIndices.has(i)) {
      signals.push(makeSignal('sell', i, c, sellScore, reasons));
      usedIndices.add(i);
    }
  }

  return dedupeSignals(signals).slice(-30);
}

function makeSignal(type, i, c, strength, reasons) {
  return {
    type,
    label: type === 'buy' ? '低吸' : '高抛',
    index: i,
    price: type === 'buy' ? c.low : c.high,
    datetime: c.datetime,
    strength: Math.min(strength, 10),
    reasons: [...new Set(reasons)].slice(0, 5)
  };
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

function buildStrategy(candles, signals, levels, quote, ind, combos, obvDiv) {
  const price = levels.currentPrice;
  const lastRsi = lastValid(ind.rsiValues);
  const lastJ = lastValid(ind.kdjJ);
  const lines = [];

  const dominant = combos.reduce((a, b) =>
    Math.abs(b.score) > Math.abs(a.score) ? b : a, combos[0]);

  lines.push(`<span class="strategy-tag ${dominant.bias === 'bullish' ? 'bearish' : dominant.bias === 'bearish' ? 'bullish' : 'neutral'}">${dominant.biasLabel}</span>`);
  lines.push(`主导组合：<strong>${dominant.name}</strong>（${dominant.desc}）`);

  if (dominant.bias === 'bearish') {
    lines.push(`当前价 <strong>${price.toFixed(2)}</strong>，综合指标偏空，适合<strong>正T</strong>（先卖后买）。`);
    lines.push(`高抛参考 <strong>${levels.r1.toFixed(2)} ~ ${levels.r2.toFixed(2)}</strong>，回补 <strong>${levels.s1.toFixed(2)} ~ ${levels.currentVwap.toFixed(2)}</strong>。`);
  } else if (dominant.bias === 'bullish') {
    lines.push(`当前价 <strong>${price.toFixed(2)}</strong>，综合指标偏多，适合<strong>反T</strong>或低吸。`);
    lines.push(`低吸参考 <strong>${levels.s1.toFixed(2)} ~ ${levels.fib618.toFixed(2)}</strong>，止盈 <strong>${levels.r1.toFixed(2)}</strong>。`);
  } else {
    lines.push(`当前价 <strong>${price.toFixed(2)}</strong> 震荡，围绕 VWAP <strong>${levels.currentVwap.toFixed(2)}</strong> 高抛低吸。`);
  }

  if (levels.currentAtr > 0) {
    lines.push(`ATR=${levels.currentAtr.toFixed(2)}，止损参考：低吸 <strong>${levels.atrStopBuy.toFixed(2)}</strong> / 高抛 <strong>${levels.atrStopSell.toFixed(2)}</strong>。`);
  }

  if (obvDiv) lines.push(`⚠ ${obvDiv.label}：${obvDiv.hint}`);

  if (levels.gaps?.length) {
    const g = levels.gaps[levels.gaps.length - 1];
    lines.push(`${g.label}：<strong>${g.bottom.toFixed(2)} ~ ${g.top.toFixed(2)}</strong>（${g.date}）`);
  }

  const recentSell = signals.filter((s) => s.type === 'sell').slice(-1)[0];
  const recentBuy = signals.filter((s) => s.type === 'buy').slice(-1)[0];
  if (recentSell) lines.push(`最近高抛：<strong>${recentSell.price.toFixed(2)}</strong>（${recentSell.datetime}）`);
  if (recentBuy) lines.push(`最近低吸：<strong>${recentBuy.price.toFixed(2)}</strong>（${recentBuy.datetime}）`);

  lines.push('<br><em>A股 T+1：做T需底仓。美股 T+0 可日内双向。港股 T+0 无限制。</em>');
  return lines.join('<br>');
}

const MIN_DAILY_BS_BARS = 30;

/** 日线布林 BS 点分析 */
export function analyzeDailyBS({ candles, quote = null }) {
  if (!candles?.length) {
    throw new Error(`数据不足，BS 分析至少需要 ${MIN_DAILY_BS_BARS} 根 K 线`);
  }
  if (candles.length < MIN_DAILY_BS_BARS) {
    throw new Error(
      `数据不足，BS 分析至少需要 ${MIN_DAILY_BS_BARS} 根 K 线（当前 ${candles.length} 根` +
      `${candles.length < 15 ? '，该股票可能上市不久' : ''}）`
    );
  }

  const closes = candles.map((c) => c.close);
  const boll = bollinger(closes, 20, 2);
  const rsiValues = rsi(closes, 14);
  const ma20 = sma(closes, 20);
  const ma60 = sma(closes, 60);
  const macdData = macd(closes);
  const kdjData = kdj(candles, 9);

  const indicators = {
    upper: boll.upper,
    mid: boll.mid,
    lower: boll.lower,
    ma20,
    ma60,
    rsiValues,
    macdLine: macdData.macdLine,
    signalLine: macdData.signalLine,
    histogram: macdData.histogram,
    kdjK: kdjData.k,
    kdjD: kdjData.d,
    kdjJ: kdjData.j
  };

  const signals = detectDailyBSSignals(candles, indicators);
  const last = candles.length - 1;
  const price = quote?.price || candles[last].close;
  const upper = boll.upper[last];
  const lower = boll.lower[last];
  const mid = boll.mid[last];
  const lastRsi = rsiValues[last];

  let position = '中轨附近';
  let bias = 'neutral';
  if (upper != null && price >= upper * 0.995) {
    position = '上轨压力区';
    bias = 'sell';
  } else if (lower != null && price <= lower * 1.005) {
    position = '下轨支撑区';
    bias = 'buy';
  } else if (mid != null && price > mid) {
    position = '中轨上方';
    bias = 'neutral-bull';
  } else if (mid != null) {
    position = '中轨下方';
    bias = 'neutral-bear';
  }

  const strategy = buildDailyBSStrategy({ price, upper, lower, mid, lastRsi, signals, bias, position });
  const snapshot = {
    rsi: lastRsi,
    kdjJ: kdjData.j[last],
    macdHist: macdData.histogram[last],
    cci: null,
    volRatio: null,
    atr: null,
    obvTrend: ma60[last] != null && price > ma60[last] ? '站上MA60' : 'MA60下方'
  };

  const levels = {
    currentPrice: price,
    upper,
    lower,
    mid,
    ma20: ma20[last],
    ma60: ma60[last],
    prevClose: quote?.prevClose || candles[last - 1]?.close,
    prevHigh: candles[last - 1]?.high,
    prevLow: candles[last - 1]?.low,
    todayOpen: candles[last].open,
    todayHigh: candles[last].high,
    todayLow: candles[last].low,
    currentVwap: mid,
    currentAtr: 0,
    atrStopBuy: lower,
    atrStopSell: upper,
    p: mid,
    r1: upper,
    s1: lower
  };

  return { signals, strategy, snapshot, indicators, levels, combos: [], bias, position };
}

function detectDailyBSSignals(candles, ind) {
  const { upper, lower, mid, rsiValues, kdjJ, histogram } = ind;
  const signals = [];
  const used = new Set();

  for (let i = 20; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    const reasons = [];
    let buyScore = 0;
    let sellScore = 0;

    const r = rsiValues[i];
    const j = kdjJ[i];
    const hist = histogram[i];
    const prevHist = histogram[i - 1];

    // 布林下轨反弹 → B 点
    if (lower[i] != null && prev.low <= lower[i - 1] * 1.005 && c.close > c.open) {
      buyScore += 3;
      reasons.push('布林下轨反弹');
    }
    if (lower[i] != null && c.low <= lower[i] * 1.003 && c.close > lower[i]) {
      buyScore += 2;
      reasons.push('触及下轨收回');
    }

    // 布林上轨回落 → S 点
    if (upper[i] != null && prev.high >= upper[i - 1] * 0.995 && c.close < c.open) {
      sellScore += 3;
      reasons.push('布林上轨回落');
    }
    if (upper[i] != null && c.high >= upper[i] * 0.997 && c.close < upper[i]) {
      sellScore += 2;
      reasons.push('触及上轨收回');
    }

    // 中轨穿越
    if (mid[i] != null && mid[i - 1] != null) {
      if (prev.close <= mid[i - 1] && c.close > mid[i]) {
        buyScore += 1;
        reasons.push('上穿中轨');
      }
      if (prev.close >= mid[i - 1] && c.close < mid[i]) {
        sellScore += 1;
        reasons.push('跌破中轨');
      }
    }

    if (r != null && r <= 35) { buyScore += 1; reasons.push(`RSI${r.toFixed(0)}`); }
    if (r != null && r >= 65) { sellScore += 1; reasons.push(`RSI${r.toFixed(0)}`); }
    if (j != null && j <= 25) { buyScore += 1; reasons.push(`KDJ${j.toFixed(0)}`); }
    if (j != null && j >= 75) { sellScore += 1; reasons.push(`KDJ${j.toFixed(0)}`); }
    if (hist != null && prevHist != null) {
      if (hist > 0 && prevHist <= 0) { buyScore += 1; reasons.push('MACD金叉'); }
      if (hist < 0 && prevHist >= 0) { sellScore += 1; reasons.push('MACD死叉'); }
    }

    if (buyScore >= 3 && buyScore > sellScore && !used.has(i)) {
      signals.push({
        type: 'buy',
        label: 'B点',
        index: i,
        price: c.low,
        datetime: c.date,
        strength: Math.min(buyScore, 10),
        reasons: [...new Set(reasons)].slice(0, 5)
      });
      used.add(i);
    } else if (sellScore >= 3 && sellScore > buyScore && !used.has(i)) {
      signals.push({
        type: 'sell',
        label: 'S点',
        index: i,
        price: c.high,
        datetime: c.date,
        strength: Math.min(sellScore, 10),
        reasons: [...new Set(reasons)].slice(0, 5)
      });
      used.add(i);
    }
  }

  return dedupeSignals(signals).slice(-40);
}

function buildDailyBSStrategy({ price, upper, lower, mid, lastRsi, signals, bias, position }) {
  const lines = [];
  const biasLabel = bias === 'sell' ? '偏空 · 关注S点' : bias === 'buy' ? '偏多 · 关注B点' : '震荡 · 中轨附近';
  lines.push(`<span class="strategy-tag ${bias === 'buy' ? 'bullish' : bias === 'sell' ? 'bearish' : 'neutral'}">${biasLabel}</span>`);
  lines.push(`当前价 <strong>${price.toFixed(2)}</strong>，处于<strong>${position}</strong>。`);

  if (upper != null && lower != null && mid != null) {
    lines.push(`布林通道：上轨 <strong>${upper.toFixed(2)}</strong> / 中轨 <strong>${mid.toFixed(2)}</strong> / 下轨 <strong>${lower.toFixed(2)}</strong>。`);
  }

  if (lastRsi != null) {
    lines.push(`RSI(14) = <strong>${lastRsi.toFixed(1)}</strong>${lastRsi <= 35 ? '，超卖区' : lastRsi >= 65 ? '，超买区' : ''}。`);
  }

  const recentB = signals.filter((s) => s.type === 'buy').slice(-1)[0];
  const recentS = signals.filter((s) => s.type === 'sell').slice(-1)[0];
  if (recentB) lines.push(`最近 B 点：<strong>${recentB.price.toFixed(2)}</strong>（${recentB.datetime}）`);
  if (recentS) lines.push(`最近 S 点：<strong>${recentS.price.toFixed(2)}</strong>（${recentS.datetime}）`);

  if (bias === 'sell') {
    lines.push(`策略：接近上轨可考虑减仓，止损参考中轨 <strong>${mid?.toFixed(2) ?? '—'}</strong>。`);
  } else if (bias === 'buy') {
    lines.push(`策略：接近下轨可考虑低吸，目标参考中轨 <strong>${mid?.toFixed(2) ?? '—'}</strong>。`);
  } else {
    lines.push('策略：中轨附近震荡，等待触及上下轨再操作。');
  }

  lines.push('<br><em>BS 点基于日线布林带(20,2)，仅供学习研究。</em>');
  return lines.join('<br>');
}
