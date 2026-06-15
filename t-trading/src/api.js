// 腾讯财经数据接口（A 股 / 港股 / 美股）

const TENCENT_QUOTE = 'https://qt.gtimg.cn/q=';
const TENCENT_MKLINE = 'https://ifzq.gtimg.cn/appstock/app/kline/mkline';
const TENCENT_DAY_MINUTE = 'https://web.ifzq.gtimg.cn/appstock/app/day/query';
const TENCENT_DAY_US = 'https://web.ifzq.gtimg.cn/appstock/app/dayus/query';
const TENCENT_FQKLINE = 'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get';
const TENCENT_US_FQKLINE = 'https://web.ifzq.gtimg.cn/appstock/app/usfqkline/get';
const TENCENT_SEARCH = 'https://smartbox.gtimg.cn/s3/';

const PERIOD_KEY = { 1: 'm1', 5: 'm5', 15: 'm15', 30: 'm30', 60: 'm60' };
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

function pad2(n) {
  return String(n).padStart(2, '0');
}

function ymdToDate(ymd) {
  const s = String(ymd).replace(/\D/g, '');
  if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  return s.slice(0, 10);
}

function ymdFromDate(d) {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function dateRange(days) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    startYmd: ymdFromDate(start),
    endYmd: ymdFromDate(end)
  };
}

/**
 * @returns {{
 *   tencentCode: string,
 *   market: 'cn'|'hk'|'us',
 *   code: string,
 *   label: string,
 *   displayCode: string
 * }}
 */
export function parseSymbol(input) {
  const raw = String(input || '').trim();
  if (!raw) throw new Error('请输入股票代码');

  const upper = raw.toUpperCase();

  if (/^(US|NASDAQ|NYSE|AMEX)[:\s-]?([A-Z][A-Z0-9.\-]{0,9})$/.test(upper)) {
    const ticker = upper.replace(/^(US|NASDAQ|NYSE|AMEX)[:\s-]?/, '').split('.')[0];
    return {
      tencentCode: `us${ticker}`,
      market: 'us',
      code: ticker,
      label: `美 ${ticker}`,
      displayCode: ticker
    };
  }

  if (/^US([A-Z][A-Z0-9]{0,9})$/.test(upper)) {
    const ticker = upper.slice(2).split('.')[0];
    return {
      tencentCode: `us${ticker}`,
      market: 'us',
      code: ticker,
      label: `美 ${ticker}`,
      displayCode: ticker
    };
  }

  if (/^(SH|SS)(\d{6})$/.test(upper)) {
    const code = upper.slice(2);
    return {
      tencentCode: `sh${code}`,
      market: 'cn',
      code,
      label: `沪 ${code}`,
      displayCode: code
    };
  }

  if (/^(SZ)(\d{6})$/.test(upper)) {
    const code = upper.slice(2);
    return {
      tencentCode: `sz${code}`,
      market: 'cn',
      code,
      label: `深 ${code}`,
      displayCode: code
    };
  }

  if (/^(BJ)(\d{6})$/.test(upper)) {
    const code = upper.slice(2);
    return {
      tencentCode: `bj${code}`,
      market: 'cn',
      code,
      label: `京 ${code}`,
      displayCode: code
    };
  }

  if (/^HK(\d{4,5})$/.test(upper)) {
    const num = upper.slice(2).padStart(5, '0');
    return {
      tencentCode: `hk${num}`,
      market: 'hk',
      code: num,
      label: `港 ${num}`,
      displayCode: num
    };
  }

  if (/^\d{6}$/.test(raw)) {
    const code = raw;
    if (code.startsWith('6') || code.startsWith('9')) {
      return { tencentCode: `sh${code}`, market: 'cn', code, label: `沪 ${code}`, displayCode: code };
    }
    if (code.startsWith('8') || code.startsWith('4')) {
      return { tencentCode: `bj${code}`, market: 'cn', code, label: `京 ${code}`, displayCode: code };
    }
    return { tencentCode: `sz${code}`, market: 'cn', code, label: `深 ${code}`, displayCode: code };
  }

  if (/^\d{5}$/.test(raw)) {
    const num = raw.padStart(5, '0');
    return {
      tencentCode: `hk${num}`,
      market: 'hk',
      code: num,
      label: `港 ${num}`,
      displayCode: num
    };
  }

  if (/^[A-Z]{1,10}$/.test(upper)) {
    return {
      tencentCode: `us${upper}`,
      market: 'us',
      code: upper,
      label: `美 ${upper}`,
      displayCode: upper
    };
  }

  throw new Error('无法识别代码。A股 6 位 / 港股 5 位 / 美股字母，如 600519、00700、AAPL');
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`请求失败 HTTP ${res.status}`);
  return res.json();
}

function parseTencentQuoteText(text) {
  const match = text.match(/v_\w+="([^"]+)"/);
  if (!match) return null;
  return match[1].split('~');
}

function parseQuoteFields(fields, parsed) {
  if (!fields || fields.length < 35) throw new Error('行情数据格式异常');

  const price = Number(fields[3]);
  const prevClose = Number(fields[4]);
  const open = Number(fields[5]);
  const high = Number(fields[33]);
  const low = Number(fields[34]);
  const change = Number(fields[31]);
  const changePct = Number(fields[32]);
  const volume = Number(fields[6]);
  const amount = Number(fields[37] || fields[36] || 0);
  const name = fields[1] || parsed.code;
  const code = fields[2] || parsed.displayCode;

  return {
    name,
    code,
    price,
    open,
    high,
    low,
    prevClose,
    volume,
    amount,
    change: Number.isFinite(change) ? change : price - prevClose,
    changePct: Number.isFinite(changePct) ? changePct : (prevClose ? ((price - prevClose) / prevClose) * 100 : 0)
  };
}

export async function fetchQuote(symbol) {
  const parsed = parseSymbol(symbol);
  const res = await fetch(`${TENCENT_QUOTE}${parsed.tencentCode}`);
  if (!res.ok) throw new Error(`行情请求失败 HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  const text = new TextDecoder('gbk').decode(buf);
  const fields = parseTencentQuoteText(text);
  if (!fields) throw new Error('无法获取实时行情');
  return parseQuoteFields(fields, parsed);
}

function parseMklineRow(row) {
  const [dt, open, close, high, low, volume, , amount] = row;
  const s = String(dt);
  const date = ymdToDate(s.slice(0, 8));
  const time = `${s.slice(8, 10)}:${s.slice(10, 12)}`;
  return {
    datetime: `${date} ${time}`,
    date,
    time,
    open: Number(open),
    close: Number(close),
    high: Number(high),
    low: Number(low),
    volume: Number(volume),
    amount: Number(amount || 0) || Number(close) * Number(volume),
    bullish: Number(close) >= Number(open)
  };
}

function parseDailyRow(row) {
  const [date, open, close, high, low, volume] = row;
  const d = ymdToDate(date);
  return {
    datetime: d,
    date: d,
    time: '',
    open: Number(open),
    close: Number(close),
    high: Number(high),
    low: Number(low),
    volume: Number(volume),
    amount: 0,
    bullish: Number(close) >= Number(open)
  };
}

function parseMinuteTick(line, dateYmd) {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 3) return null;
  const hh = parts[0].slice(0, 2);
  const mm = parts[0].slice(2, 4);
  const price = Number(parts[1]);
  const volume = Number(parts[2]);
  const amount = parts[3] ? Number(parts[3]) : price * volume;
  const date = ymdToDate(dateYmd);
  return {
    datetime: `${date} ${hh}:${mm}`,
    date,
    time: `${hh}:${mm}`,
    price,
    volume,
    amount
  };
}

function aggregateTicks(ticks, period) {
  const buckets = new Map();

  for (const t of ticks) {
    const [hh, mm] = t.time.split(':').map(Number);
    const totalMin = hh * 60 + mm;
    const bucketMin = Math.floor(totalMin / period) * period;
    const bucketH = Math.floor(bucketMin / 60);
    const bucketM = bucketMin % 60;
    const key = `${t.date} ${pad2(bucketH)}:${pad2(bucketM)}`;

    if (!buckets.has(key)) {
      buckets.set(key, {
        datetime: key,
        date: t.date,
        time: `${pad2(bucketH)}:${pad2(bucketM)}`,
        prices: [],
        volumes: [],
        amounts: []
      });
    }
    const b = buckets.get(key);
    b.prices.push(t.price);
    b.volumes.push(t.volume);
    b.amounts.push(t.amount);
  }

  return [...buckets.values()]
    .sort((a, b) => a.datetime.localeCompare(b.datetime))
    .map((b) => {
      const open = b.prices[0];
      const close = b.prices[b.prices.length - 1];
      const high = Math.max(...b.prices);
      const low = Math.min(...b.prices);
      const volume = b.volumes.reduce((s, v) => s + v, 0);
      const amount = b.amounts.reduce((s, v) => s + v, 0);
      return {
        datetime: b.datetime,
        date: b.date,
        time: b.time,
        open,
        close,
        high,
        low,
        volume,
        amount,
        bullish: close >= open
      };
    });
}

function filterByDays(candles, days) {
  const range = dateRange(days);
  return candles.filter((c) => c.date >= range.start && c.date <= range.end);
}

async function fetchCnMkline(parsed, period, count = 320) {
  const pKey = PERIOD_KEY[period] || 'm5';
  const url = `${TENCENT_MKLINE}?param=${parsed.tencentCode},${pKey},,${count}`;
  const json = await fetchJson(url);
  const block = json?.data?.[parsed.tencentCode];
  const rows = block?.[pKey];
  if (!Array.isArray(rows) || rows.length < 5) return null;
  return rows.map(parseMklineRow).filter((c) => c.close > 0);
}

async function fetchDayMinute(parsed) {
  const base = parsed.market === 'us' ? TENCENT_DAY_US : TENCENT_DAY_MINUTE;
  const url = `${base}?code=${parsed.tencentCode}`;
  const json = await fetchJson(url);
  if (json?.code !== 0) return [];

  const block = json?.data?.[parsed.tencentCode];
  const days = block?.data;
  if (!Array.isArray(days)) return [];

  const ticks = [];
  for (const day of days) {
    const dateYmd = day.date;
    const lines = day?.data;
    if (!Array.isArray(lines)) continue;
    for (const line of lines) {
      const tick = parseMinuteTick(line, dateYmd);
      if (tick && tick.price > 0) ticks.push(tick);
    }
  }
  return ticks;
}

export async function fetchIntradayKline({ symbol, period = 5, days = 3 }) {
  const parsed = parseSymbol(symbol);
  let candles = [];
  let source = 'tencent';

  if (parsed.market === 'cn') {
    try {
      const mk = await fetchCnMkline(parsed, period, 320);
      if (mk?.length >= 5) candles = mk;
    } catch { /* fallback below */ }
  }

  if (candles.length < 5) {
    try {
      const ticks = await fetchDayMinute(parsed);
      if (ticks.length >= 5) {
        candles = period === 1
          ? ticks.map((t) => ({
            datetime: t.datetime,
            date: t.date,
            time: t.time,
            open: t.price,
            close: t.price,
            high: t.price,
            low: t.price,
            volume: t.volume,
            amount: t.amount,
            bullish: true
          }))
          : aggregateTicks(ticks, period);
        source = 'tencent-minute';
      }
    } catch { /* fallback below */ }
  }

  candles = filterByDays(candles, days);

  if (candles.length < 5) {
    const mock = generateMockIntraday({ period, days });
    return {
      candles: mock,
      meta: {
        symbol: parsed.displayCode,
        name: parsed.displayCode,
        label: parsed.label,
        market: parsed.market,
        tencentCode: parsed.tencentCode,
        period,
        days,
        count: mock.length,
        source: 'mock'
      }
    };
  }

  let name = parsed.displayCode;
  try {
    const q = await fetchQuote(symbol);
    name = q.name;
  } catch { /* ignore */ }

  savePrefs({ symbol: parsed.displayCode, period, days, market: parsed.market });

  return {
    candles,
    meta: {
      symbol: parsed.displayCode,
      name,
      label: parsed.label,
      market: parsed.market,
      tencentCode: parsed.tencentCode,
      period,
      days,
      count: candles.length,
      source
    }
  };
}

export async function fetchDailyKline({ symbol, days = 30 }) {
  const parsed = parseSymbol(symbol);
  const count = Math.max(days + 5, 40);

  try {
    if (parsed.market === 'us') {
      const url = `${TENCENT_US_FQKLINE}?param=${parsed.tencentCode},day,,,${count},qfq`;
      const json = await fetchJson(url);
      const rows = json?.data?.[parsed.tencentCode]?.day;
      if (!Array.isArray(rows) || rows.length < 2) return { candles: [], meta: {} };
      const candles = rows.map(parseDailyRow).filter((c) => c.close > 0);
      return { candles: filterByDays(candles, days), meta: { name: parsed.displayCode } };
    }

    const url = `${TENCENT_FQKLINE}?param=${parsed.tencentCode},day,,,${count},qfq`;
    const json = await fetchJson(url);
    const block = json?.data?.[parsed.tencentCode];
    const rows = block?.qfqday || block?.day;
    if (!Array.isArray(rows) || rows.length < 2) return { candles: [], meta: {} };
    const candles = rows.map(parseDailyRow).filter((c) => c.close > 0);
    return { candles: filterByDays(candles, days), meta: { name: parsed.displayCode } };
  } catch {
    return { candles: [], meta: {} };
  }
}

export async function searchStock(keyword) {
  const url = `${TENCENT_SEARCH}?v=2&q=${encodeURIComponent(keyword)}&t=all&c=8`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const buf = await res.arrayBuffer();
  const text = new TextDecoder('utf-8').decode(buf);
  const hints = [...text.matchAll(/v_hint="([^"]+)"/g)].map((m) => m[1]);
  return hints.map((hint) => {
    const parts = hint.split('~');
    const market = parts[0];
    const code = parts[1];
    const name = parts[2];
    return { code, name, market };
  });
}

export { dateRange, ymdToDate as toYmd };

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

    for (let b = 0; b < barsPerDay; b++) {
      const h = 9 + Math.floor((b * period + 30) / 60);
      const m = (b * period + 30) % 60;
      if (h > 15 || (h === 11 && m > 30) || h === 12) continue;
      const time = `${pad2(h)}:${pad2(m)}`;
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
