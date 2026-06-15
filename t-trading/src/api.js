// 东方财富数据接口

const EASTMONEY_KLINE = 'https://push2his.eastmoney.com/api/qt/stock/kline/get';
const EASTMONEY_QUOTE = 'https://push2.eastmoney.com/api/qt/stock/get';
const EASTMONEY_SEARCH = 'https://searchapi.eastmoney.com/api/suggest/get';

const PERIOD_KLT = { 1: 1, 5: 5, 15: 15, 30: 30, 60: 60, day: 101 };

const SAVE_KEY = 't_trading_prefs_v1';

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
  } catch { /* quota */ }
}

/** @returns {{ market: number, code: string, label: string, secid: string }} */
export function parseSymbol(input) {
  const raw = String(input || '').trim().toUpperCase();
  if (!raw) throw new Error('请输入股票代码');

  if (/^\d{6}$/.test(raw)) {
    if (raw.startsWith('6') || raw.startsWith('9')) {
      return { market: 1, code: raw, label: `沪 ${raw}`, secid: `1.${raw}` };
    }
    if (raw.startsWith('8') || raw.startsWith('4')) {
      return { market: 0, code: raw, label: `京 ${raw}`, secid: `0.${raw}` };
    }
    return { market: 0, code: raw, label: `深 ${raw}`, secid: `0.${raw}` };
  }

  if (/^(SH|SS)(\d{6})$/.test(raw)) {
    const code = raw.slice(2);
    return { market: 1, code, label: `沪 ${code}`, secid: `1.${code}` };
  }
  if (/^(SZ)(\d{6})$/.test(raw)) {
    const code = raw.slice(2);
    return { market: 0, code, label: `深 ${code}`, secid: `0.${code}` };
  }

  throw new Error('无法识别代码，请输入 6 位 A 股代码');
}

function toYmd(dateStr) {
  return String(dateStr).replace(/-/g, '');
}

function dateRange(days) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10)
  };
}

function parseKlineRow(row) {
  const parts = row.split(',');
  const [datetime, open, close, high, low, volume, amount] = parts;
  return {
    datetime,
    date: datetime.slice(0, 10),
    time: datetime.length > 10 ? datetime.slice(11) : '',
    open: Number(open),
    close: Number(close),
    high: Number(high),
    low: Number(low),
    volume: Number(volume),
    amount: Number(amount || 0),
    bullish: Number(close) >= Number(open)
  };
}

export async function fetchIntradayKline({ symbol, period = 5, days = 3 }) {
  const parsed = parseSymbol(symbol);
  const range = dateRange(days);
  const klt = PERIOD_KLT[period] || 5;

  const url = new URL(EASTMONEY_KLINE);
  url.searchParams.set('fields1', 'f1,f2,f3,f4,f5,f6');
  url.searchParams.set('fields2', 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61');
  url.searchParams.set('ut', 'fa5fd1943c7b386f172d6893dbfba10b');
  url.searchParams.set('rtntype', '6');
  url.searchParams.set('secid', parsed.secid);
  url.searchParams.set('klt', String(klt));
  url.searchParams.set('fqt', '1');
  url.searchParams.set('beg', toYmd(range.start));
  url.searchParams.set('end', toYmd(range.end));

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`K线请求失败 HTTP ${res.status}`);
  const json = await res.json();
  const rows = json?.data?.klines;
  if (!Array.isArray(rows) || rows.length < 5) {
    const mock = generateMockIntraday({ period, days });
    return {
      candles: mock,
      meta: {
        symbol: parsed.code,
        name: parsed.code,
        label: parsed.label,
        secid: parsed.secid,
        period,
        days,
        count: mock.length,
        source: 'mock'
      }
    };
  }

  const candles = rows.map(parseKlineRow).filter((c) => c.close > 0);
  const name = json?.data?.name || parsed.code;

  savePrefs({ symbol: parsed.code, period, days });

  return {
    candles,
    meta: {
      symbol: parsed.code,
      name,
      label: parsed.label,
      secid: parsed.secid,
      period,
      days,
      count: candles.length,
      source: 'eastmoney'
    }
  };
}

export async function fetchDailyKline({ symbol, days = 30 }) {
  const parsed = parseSymbol(symbol);
  const range = dateRange(days);

  const url = new URL(EASTMONEY_KLINE);
  url.searchParams.set('fields1', 'f1,f2,f3,f4,f5,f6');
  url.searchParams.set('fields2', 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61');
  url.searchParams.set('ut', 'fa5fd1943c7b386f172d6893dbfba10b');
  url.searchParams.set('rtntype', '6');
  url.searchParams.set('secid', parsed.secid);
  url.searchParams.set('klt', '101');
  url.searchParams.set('fqt', '1');
  url.searchParams.set('beg', toYmd(range.start));
  url.searchParams.set('end', toYmd(range.end));

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`日线请求失败 HTTP ${res.status}`);
  const json = await res.json();
  const rows = json?.data?.klines;
  if (!Array.isArray(rows) || rows.length < 5) return { candles: [], meta: {} };

  return {
    candles: rows.map(parseKlineRow).filter((c) => c.close > 0),
    meta: { name: json?.data?.name || parsed.code }
  };
}

export async function fetchQuote(symbol) {
  const parsed = parseSymbol(symbol);
  const url = new URL(EASTMONEY_QUOTE);
  url.searchParams.set('ut', 'fa5fd1943c7b386f172d6893dbfba10b');
  url.searchParams.set('invt', '2');
  url.searchParams.set('fltt', '2');
  url.searchParams.set('fields', 'f43,f44,f45,f46,f47,f48,f57,f58,f60,f169,f170');
  url.searchParams.set('secid', parsed.secid);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`行情请求失败 HTTP ${res.status}`);
  const json = await res.json();
  const d = json?.data;
  if (!d) throw new Error('无法获取实时行情');

  return {
    name: d.f58 || parsed.code,
    code: d.f57 || parsed.code,
    price: d.f43,
    open: d.f46,
    high: d.f44,
    low: d.f45,
    prevClose: d.f60,
    volume: d.f47,
    amount: d.f48,
    change: d.f169,
    changePct: d.f170
  };
}

export async function searchStock(keyword) {
  const url = new URL(EASTMONEY_SEARCH);
  url.searchParams.set('input', keyword);
  url.searchParams.set('type', '14');
  url.searchParams.set('token', 'D43AEA724C8EFAE086841C28B52D04D89');
  url.searchParams.set('count', '8');

  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const json = await res.json();
  return (json?.QuotationCodeTable?.Data || []).map((item) => ({
    code: item.Code,
    name: item.Name,
    market: item.MarketType
  }));
}

export { dateRange, toYmd };

/** 模拟分时数据（网络不可用时兜底） */
export function generateMockIntraday({ period = 5, days = 3 } = {}) {
  const candles = [];
  const barsPerDay = Math.floor(240 / period);
  let price = 80 + Math.random() * 40;
  const now = new Date();

  for (let d = days - 1; d >= 0; d--) {
    const day = new Date(now);
    day.setDate(day.getDate() - d);
    const ymd = day.toISOString().slice(0, 10);
    let dayOpen = price;

    for (let b = 0; b < barsPerDay; b++) {
      const h = 9 + Math.floor((b * period + 30) / 60);
      const m = (b * period + 30) % 60;
      if (h > 15 || (h === 11 && m > 30) || h === 12) continue;
      const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const drift = (Math.random() - 0.48) * (price * 0.004);
      const open = price;
      const close = Math.max(1, open + drift);
      const high = Math.max(open, close) + Math.random() * price * 0.002;
      const low = Math.min(open, close) - Math.random() * price * 0.002;
      const vol = Math.floor(1e4 + Math.random() * 5e5);
      candles.push({
        datetime: `${ymd} ${time}`,
        date: ymd,
        time,
        open,
        close,
        high,
        low,
        volume: vol,
        amount: ((open + close) / 2) * vol,
        bullish: close >= open
      });
      price = close;
    }
  }
  return candles;
}
