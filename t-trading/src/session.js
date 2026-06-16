// 各市场交易时段 · 分时图时间轴

/** @typedef {'cn'|'hk'|'us'} Market */

export const MARKET_SESSIONS = {
  cn: {
    label: 'A股',
    open: '09:30',
    close: '15:00',
    segments: [
      { start: '09:30', end: '11:30' },
      { start: '13:00', end: '15:00' }
    ]
  },
  hk: {
    label: '港股',
    open: '09:30',
    close: '16:00',
    segments: [
      { start: '09:30', end: '12:00' },
      { start: '13:00', end: '16:00' }
    ]
  },
  us: {
    label: '美股',
    open: '09:30',
    close: '16:00',
    segments: [{ start: '09:30', end: '16:00' }]
  }
};

export function timeToMinutes(time) {
  const [h, m] = String(time || '00:00').split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function totalSessionMinutes(market = 'cn') {
  const session = MARKET_SESSIONS[market] || MARKET_SESSIONS.cn;
  return session.segments.reduce(
    (sum, seg) => sum + timeToMinutes(seg.end) - timeToMinutes(seg.start),
    0
  );
}

/** 将 HH:MM 映射到交易时段内的连续分钟（跳过午休） */
export function timeToSessionMinute(time, market = 'cn') {
  const session = MARKET_SESSIONS[market] || MARKET_SESSIONS.cn;
  const mins = timeToMinutes(time);
  let offset = 0;

  for (const seg of session.segments) {
    const start = timeToMinutes(seg.start);
    const end = timeToMinutes(seg.end);
    if (mins < start) return offset;
    if (mins >= start && mins <= end) return offset + (mins - start);
    offset += end - start;
  }
  return offset;
}

export function getLatestDate(candles) {
  if (!candles.length) return null;
  return [...new Set(candles.map((c) => c.date))].sort().pop();
}

/** 仅保留最近一个交易日的 K 线 */
export function filterTodayCandles(candles) {
  const today = getLatestDate(candles);
  if (!today) return [];
  return candles.filter((c) => c.date === today);
}

/**
 * 准备当日分时图数据（指标/信号索引对齐）
 * @param {object[]} candles
 * @param {object} indicators
 * @param {object[]} signals
 * @param {Market} market
 */
export function prepareTodayChartData(candles, indicators, signals, market = 'cn') {
  const today = getLatestDate(candles);
  if (!today) {
    return { candles: [], indicators: {}, signals: [], market, session: MARKET_SESSIONS[market] };
  }

  const startIdx = candles.findIndex((c) => c.date === today);
  if (startIdx < 0) {
    return { candles: [], indicators: {}, signals: [], market, session: MARKET_SESSIONS[market] };
  }

  const todayCandles = candles.slice(startIdx);
  const slice = (arr) => (Array.isArray(arr) ? arr.slice(startIdx) : arr);

  const todayIndicators = {
    rsiValues: slice(indicators.rsiValues),
    vwapValues: slice(indicators.vwapValues),
    upper: slice(indicators.upper),
    lower: slice(indicators.lower),
    mid: slice(indicators.mid),
    keltUpper: slice(indicators.keltUpper),
    keltLower: slice(indicators.keltLower),
    ma5: slice(indicators.ma5),
    ma10: slice(indicators.ma10),
    ma20: slice(indicators.ma20),
    macdLine: slice(indicators.macdLine),
    signalLine: slice(indicators.signalLine),
    histogram: slice(indicators.histogram),
    kdjK: slice(indicators.kdjK),
    kdjD: slice(indicators.kdjD),
    kdjJ: slice(indicators.kdjJ),
    obvValues: slice(indicators.obvValues),
    atrValues: slice(indicators.atrValues),
    cciValues: slice(indicators.cciValues),
    volRatio: slice(indicators.volRatio)
  };

  const todaySignals = signals
    .filter((s) => s.index >= startIdx)
    .map((s) => ({ ...s, index: s.index - startIdx }));

  return {
    candles: todayCandles,
    indicators: todayIndicators,
    signals: todaySignals,
    market,
    session: MARKET_SESSIONS[market] || MARKET_SESSIONS.cn,
    today
  };
}
