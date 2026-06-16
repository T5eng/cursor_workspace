// K线数据获取与解析（东方财富公开接口 + 本地模拟兜底）

const EASTMONEY_KLINE =
  'https://push2his.eastmoney.com/api/qt/stock/kline/get';

const PERIOD_KLT = {
  day: 101,
  week: 102,
  month: 103
};

const SAVE_KEY = 'kline_rider_prefs_v1';

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function savePrefs(prefs) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore quota */
  }
}

/** @returns {{ market: number, code: string, label: string }} */
export function parseSymbol(input) {
  const raw = String(input || '').trim().toUpperCase();
  if (!raw) throw new Error('请输入股票代码');

  if (/^\d{6}$/.test(raw)) {
    if (raw.startsWith('6') || raw.startsWith('9')) {
      return { market: 1, code: raw, label: `沪 ${raw}` };
    }
    if (raw.startsWith('8') || raw.startsWith('4')) {
      return { market: 0, code: raw, label: `京 ${raw}` };
    }
    return { market: 0, code: raw, label: `深 ${raw}` };
  }

  if (/^(SH|SS)(\d{6})$/.test(raw)) {
    const code = raw.slice(2);
    return { market: 1, code, label: `沪 ${code}` };
  }
  if (/^(SZ)(\d{6})$/.test(raw)) {
    const code = raw.slice(2);
    return { market: 0, code, label: `深 ${code}` };
  }
  if (/^HK(\d{5})$/.test(raw)) {
    const code = raw.slice(2);
    return { market: 116, code, label: `港 ${code}` };
  }

  const us = raw.replace(/^(US|NASDAQ|NYSE|AMEX)[:\s-]?/, '');
  if (/^[A-Z][A-Z0-9.\-]{0,9}$/.test(us)) {
    return { market: 105, code: us, label: `美 ${us}` };
  }

  throw new Error('无法识别代码，请用 6 位 A 股或美股字母代码');
}

function toYmd(dateStr) {
  return String(dateStr).replace(/-/g, '');
}

function fromYmd(ymd) {
  const s = String(ymd);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function defaultDateRange() {
  const end = new Date();
  const start = new Date(end);
  start.setMonth(start.getMonth() - 6);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

export function defaultFormValues() {
  const prefs = loadPrefs();
  const range = defaultDateRange();
  return {
    symbol: prefs?.symbol || '600519',
    start: prefs?.start || range.start,
    end: prefs?.end || range.end,
    period: prefs?.period || 'day'
  };
}

function parseKlineRow(row) {
  const [date, open, close, high, low, volume] = row.split(',');
  return {
    date,
    open: Number(open),
    close: Number(close),
    high: Number(high),
    low: Number(low),
    volume: Number(volume),
    bullish: Number(close) >= Number(open)
  };
}

export function generateMockKline({ start, end, period = 'day' } = {}) {
  const startDate = new Date(start || defaultDateRange().start);
  const endDate = new Date(end || defaultDateRange().end);
  const step = period === 'week' ? 7 : period === 'month' ? 30 : 1;
  const candles = [];
  let price = 80 + Math.random() * 40;
  const cursor = new Date(startDate);

  while (cursor <= endDate) {
    const drift = (Math.random() - 0.48) * 4;
    const open = price;
    const close = Math.max(5, open + drift);
    const high = Math.max(open, close) + Math.random() * 3;
    const low = Math.min(open, close) - Math.random() * 3;
    candles.push({
      date: cursor.toISOString().slice(0, 10),
      open,
      close,
      high,
      low,
      volume: Math.floor(1e6 + Math.random() * 5e6),
      bullish: close >= open
    });
    price = close;
    cursor.setDate(cursor.getDate() + step);
  }
  return candles;
}

export async function fetchKline({ symbol, start, end, period = 'day' }) {
  const parsed = parseSymbol(symbol);
  const beg = toYmd(start);
  const endYmd = toYmd(end);
  const klt = PERIOD_KLT[period] || 101;
  const secid = `${parsed.market}.${parsed.code}`;
  const url = new URL(EASTMONEY_KLINE);
  url.searchParams.set('fields1', 'f1,f2,f3,f4,f5,f6');
  url.searchParams.set(
    'fields2',
    'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61'
  );
  url.searchParams.set('ut', 'fa5fd1943c7b386f172d6893dbfba10b');
  url.searchParams.set('rtntype', '6');
  url.searchParams.set('secid', secid);
  url.searchParams.set('klt', String(klt));
  url.searchParams.set('fqt', '1');
  url.searchParams.set('beg', beg);
  url.searchParams.set('end', endYmd);

  let candles = [];
  let source = 'eastmoney';

  try {
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const rows = json?.data?.klines;
    if (!Array.isArray(rows) || rows.length < 8) {
      throw new Error('该时段无足够 K 线数据');
    }
    candles = rows.map(parseKlineRow).filter((c) => c.close > 0);
  } catch (err) {
    source = 'mock';
    candles = generateMockKline({ start, end, period });
    candles.fetchError = err?.message || '网络不可用';
  }

  if (candles.length < 8) {
    throw new Error('K 线数量太少，请换更长的时间段');
  }

  savePrefs({ symbol: parsed.code, start, end, period });

  const first = candles[0].date;
  const last = candles[candles.length - 1].date;

  return {
    candles,
    meta: {
      symbol: parsed.code,
      label: parsed.label,
      secid,
      period,
      start: first,
      end: last,
      count: candles.length,
      source
    }
  };
}

export function summarizeCandles(candles) {
  if (!candles.length) return null;
  const closes = candles.map((c) => c.close);
  const min = Math.min(...candles.map((c) => c.low));
  const max = Math.max(...candles.map((c) => c.high));
  const first = candles[0].close;
  const last = candles[candles.length - 1].close;
  const change = ((last - first) / first) * 100;
  return {
    min,
    max,
    first,
    last,
    change,
    from: candles[0].date,
    to: candles[candles.length - 1].date
  };
}

export { fromYmd, toYmd, defaultDateRange };
