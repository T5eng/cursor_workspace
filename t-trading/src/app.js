// 做T量化分析 · 主应用

import { fetchIntradayKline, fetchDailyKline, fetchQuote, loadPrefs } from './api.js';
import { analyzeTPoints, analyzeDailyBS } from './analyzer.js';
import { renderChart, renderDailyChart } from './chart-render.js';
import { formatPrice, formatPct } from './indicators.js';
import { prepareTodayChartData } from './session.js';

const $ = (id) => document.getElementById(id);

const symbolInput = $('symbolInput');
const modeSelect = $('modeSelect');
const periodSelect = $('periodSelect');
const daysSelect = $('daysSelect');
const barsSelect = $('barsSelect');
const analyzeBtn = $('analyzeBtn');
const statusBar = $('statusBar');
const quotePanel = $('quotePanel');
const mainChart = $('mainChart');
const chartTitle = $('chartTitle');
const chartLegend = $('chartLegend');
const signalTitle = $('signalTitle');

let lastChartData = null;
let lastMode = 'daily-bs';

function setStatus(msg, type = '') {
  statusBar.textContent = msg;
  statusBar.className = `status-bar ${type}`;
}

function setLoading(loading) {
  analyzeBtn.disabled = loading;
  if (loading) {
    const mode = modeSelect.value;
    setStatus(mode === 'daily-bs' ? '正在拉取日线数据…' : '正在拉取行情与分时数据…', 'loading');
  }
}

function priceClass(change) {
  if (change > 0) return 'up';
  if (change < 0) return 'down';
  return 'flat';
}

function updateModeUI() {
  const isDaily = modeSelect.value === 'daily-bs';
  document.querySelectorAll('.field-intraday').forEach((el) => {
    el.classList.toggle('hidden', isDaily);
  });
  document.querySelectorAll('.field-daily').forEach((el) => {
    el.classList.toggle('hidden', !isDaily);
  });

  if (isDaily) {
    chartTitle.textContent = '日线 K 线 & BS 点位';
    chartLegend.innerHTML = `
      <span class="leg buy">● B点</span>
      <span class="leg sell">● S点</span>
      <span class="leg vwap">— 布林中轨</span>
      <span class="leg ma">— 上下轨</span>`;
    if (signalTitle) signalTitle.childNodes[0].textContent = 'BS 信号 ';
    $('combosGrid')?.closest('.combos-card')?.classList.add('hidden');
  } else {
    chartTitle.textContent = '当日分时 & 做T点位';
    chartLegend.innerHTML = `
      <span class="leg buy">● 低吸</span>
      <span class="leg sell">● 高抛</span>
      <span class="leg vwap">— VWAP</span>
      <span class="leg ma">— MA10/20</span>`;
    if (signalTitle) signalTitle.childNodes[0].textContent = '做T信号 ';
    $('combosGrid')?.closest('.combos-card')?.classList.remove('hidden');
  }
}

function renderQuote(quote, levels, snapshot) {
  quotePanel.classList.remove('hidden');
  $('quoteName').textContent = `${quote.name} (${quote.code})`;
  const pc = priceClass(quote.change);
  $('quotePrice').textContent = formatPrice(quote.price);
  $('quotePrice').className = `quote-price ${pc}`;
  $('quoteChange').textContent = `${formatPrice(quote.change)} (${formatPct(quote.changePct)})`;
  $('quoteChange').className = `quote-change ${pc}`;
  $('statOpen').textContent = formatPrice(quote.open);
  $('statHigh').textContent = formatPrice(quote.high);
  $('statLow').textContent = formatPrice(quote.low);
  $('statPrev').textContent = formatPrice(quote.prevClose);
  $('statVwap').textContent = formatPrice(levels.currentVwap ?? levels.mid);
  $('statRsi').textContent = snapshot.rsi != null ? snapshot.rsi.toFixed(1) : '—';
  $('statKdj').textContent = snapshot.kdjJ != null ? snapshot.kdjJ.toFixed(1) : '—';
  $('statMacd').textContent = snapshot.macdHist != null ? snapshot.macdHist.toFixed(3) : '—';
  $('statCci').textContent = snapshot.cci != null ? snapshot.cci.toFixed(0) : '—';
  $('statVolRatio').textContent = snapshot.volRatio != null ? snapshot.volRatio.toFixed(2) : '—';
  $('statAtr').textContent = snapshot.atr != null ? snapshot.atr.toFixed(2) : '—';
  $('statObv').textContent = snapshot.obvTrend || '—';
}

function renderCombos(combos) {
  if (!combos?.length) {
    $('combosGrid').innerHTML = '';
    return;
  }
  $('combosGrid').innerHTML = combos.map((c) => `
    <div class="combo-item combo-${c.bias}">
      <div class="combo-head">
        <span class="combo-name">${c.name}</span>
        <span class="combo-bias">${c.biasLabel}</span>
      </div>
      <div class="combo-desc">${c.desc}</div>
      <div class="combo-notes">${c.notes.join(' · ') || '—'}</div>
      <div class="combo-score">评分 ${c.score > 0 ? '+' : ''}${c.score}</div>
    </div>
  `).join('');
}

function renderLevels(levels, mode) {
  const items = mode === 'daily-bs'
    ? [
      { label: '布林上轨', value: levels.upper, type: 'resist' },
      { label: '布林中轨', value: levels.mid, type: 'neutral' },
      { label: '布林下轨', value: levels.lower, type: 'support' },
      { label: 'MA20', value: levels.ma20, type: 'neutral' },
      { label: 'MA60', value: levels.ma60, type: 'neutral' },
      { label: '昨收', value: levels.prevClose, type: 'neutral' },
      { label: '今高', value: levels.todayHigh, type: 'resist' },
      { label: '今低', value: levels.todayLow, type: 'support' }
    ]
    : [
      { label: '枢轴 P', value: levels.p, type: 'neutral' },
      { label: '阻力 R1', value: levels.r1, type: 'resist' },
      { label: '阻力 R2', value: levels.r2, type: 'resist' },
      { label: '支撑 S1', value: levels.s1, type: 'support' },
      { label: '支撑 S2', value: levels.s2, type: 'support' },
      { label: 'Fib 38.2%', value: levels.fib382, type: 'resist' },
      { label: 'Fib 50%', value: levels.fib500, type: 'neutral' },
      { label: 'Fib 61.8%', value: levels.fib618, type: 'support' },
      { label: '昨高', value: levels.prevHigh, type: 'resist' },
      { label: '昨低', value: levels.prevLow, type: 'support' },
      { label: '今开', value: levels.todayOpen, type: 'neutral' },
      { label: 'VWAP', value: levels.currentVwap, type: 'neutral' },
      { label: 'ATR止损(买)', value: levels.atrStopBuy, type: 'support' },
      { label: 'ATR止损(卖)', value: levels.atrStopSell, type: 'resist' }
    ];

  $('levelsGrid').innerHTML = items.map((item) => `
    <div class="level-item ${item.type}">
      <div class="label">${item.label}</div>
      <div class="value">${formatPrice(item.value)}</div>
    </div>
  `).join('');
}

function renderSignals(signals, mode) {
  $('signalCount').textContent = String(signals.length);

  if (!signals.length) {
    const hint = mode === 'daily-bs'
      ? '当前参数下未检测到明显 BS 信号<br>可尝试增加日线条数'
      : '当前参数下未检测到明显做T信号<br>可尝试缩短周期或延长回看天数';
    $('signalList').innerHTML = `<div class="empty-hint">${hint}</div>`;
    return;
  }

  const sorted = [...signals].reverse();
  $('signalList').innerHTML = sorted.map((sig) => `
    <div class="signal-item ${sig.type}">
      <div class="signal-head">
        <span class="signal-type ${sig.type}">${sig.label}</span>
        <span class="signal-price">${formatPrice(sig.price)}</span>
      </div>
      <div class="signal-time">${sig.datetime}</div>
      <div class="signal-reason">${sig.reasons.join(' · ') || '多指标共振'}</div>
      <span class="signal-strength">强度 ${sig.strength}/10</span>
    </div>
  `).join('');
}

function renderStrategy(html) {
  $('strategyBody').innerHTML = html;
}

async function runIntradayAnalysis(symbol, period, days) {
  const [intraday, daily, quote] = await Promise.all([
    fetchIntradayKline({ symbol, period, days }),
    fetchDailyKline({ symbol, bars: 60 }),
    fetchQuote(symbol).catch(() => null)
  ]);

  const analysis = analyzeTPoints({
    candles: intraday.candles,
    dailyCandles: daily.candles,
    quote
  });

  if (quote) {
    renderQuote(quote, analysis.levels, analysis.snapshot);
  } else {
    quotePanel.classList.remove('hidden');
    $('quoteName').textContent = `${intraday.meta.name} (${intraday.meta.symbol})`;
  }

  renderCombos(analysis.combos);
  renderLevels(analysis.levels, 'intraday');
  renderSignals(analysis.signals, 'intraday');
  renderStrategy(analysis.strategy);

  lastChartData = prepareTodayChartData(
    intraday.candles,
    analysis.indicators,
    analysis.signals,
    intraday.meta.market || 'cn'
  );
  lastChartData.levels = analysis.levels;
  lastMode = 'intraday';
  renderChart(mainChart, lastChartData);

  const todayN = lastChartData.candles.length;
  const buyN = analysis.signals.filter((s) => s.type === 'buy').length;
  const sellN = analysis.signals.filter((s) => s.type === 'sell').length;
  setStatus(
    `${intraday.meta.name} · ${intraday.meta.label} · 当日${todayN}根 · ${period}分钟周期 · 低吸${buyN} / 高抛${sellN}` +
    (intraday.meta.source === 'mock' ? ' · [模拟数据]' : '')
  );
}

async function runDailyBSAnalysis(symbol, bars) {
  const [daily, quote] = await Promise.all([
    fetchDailyKline({ symbol, bars }),
    fetchQuote(symbol).catch(() => null)
  ]);

  const analysis = analyzeDailyBS({
    candles: daily.candles,
    quote
  });

  if (quote) {
    renderQuote(quote, analysis.levels, analysis.snapshot);
  } else {
    quotePanel.classList.remove('hidden');
    $('quoteName').textContent = `${daily.meta.name || symbol} (${daily.meta.symbol || symbol})`;
  }

  renderCombos([]);
  renderLevels(analysis.levels, 'daily-bs');
  renderSignals(analysis.signals, 'daily-bs');
  renderStrategy(analysis.strategy);

  lastChartData = {
    candles: daily.candles,
    indicators: analysis.indicators,
    signals: analysis.signals,
    levels: analysis.levels
  };
  lastMode = 'daily-bs';
  renderDailyChart(mainChart, lastChartData);

  const buyN = analysis.signals.filter((s) => s.type === 'buy').length;
  const sellN = analysis.signals.filter((s) => s.type === 'sell').length;
  setStatus(
    `${daily.meta.name || symbol} · ${daily.meta.label || ''} · 日线${daily.candles.length}根 · B点${buyN} / S点${sellN}` +
    (daily.meta.source ? ` · [${daily.meta.source}]` : '')
  );
}

async function runAnalysis() {
  const symbol = symbolInput.value.trim();
  const mode = modeSelect.value;
  const period = Number(periodSelect.value);
  const days = Number(daysSelect.value);
  const bars = Number(barsSelect.value);

  if (!symbol) {
    setStatus('请输入股票代码', 'error');
    return;
  }

  setLoading(true);

  try {
    if (mode === 'daily-bs') {
      await runDailyBSAnalysis(symbol, bars);
    } else {
      await runIntradayAnalysis(symbol, period, days);
    }
  } catch (err) {
    setStatus(err?.message || '分析失败', 'error');
    console.error(err);
  } finally {
    setLoading(false);
  }
}

function initPrefs() {
  const prefs = loadPrefs();
  if (prefs?.symbol) symbolInput.value = prefs.symbol;
  if (prefs?.mode) modeSelect.value = prefs.mode;
  if (prefs?.period) periodSelect.value = String(prefs.period);
  if (prefs?.days) daysSelect.value = String(prefs.days);
  if (prefs?.bars) barsSelect.value = String(prefs.bars);
  updateModeUI();
}

modeSelect.addEventListener('change', () => {
  updateModeUI();
});

analyzeBtn.addEventListener('click', runAnalysis);
symbolInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') runAnalysis();
});

document.querySelectorAll('#quickPicks button').forEach((btn) => {
  btn.addEventListener('click', () => {
    symbolInput.value = btn.dataset.symbol;
    runAnalysis();
  });
});

window.addEventListener('resize', () => {
  if (!lastChartData) return;
  if (lastMode === 'daily-bs') renderDailyChart(mainChart, lastChartData);
  else renderChart(mainChart, lastChartData);
});

initPrefs();
if (symbolInput.value.trim()) runAnalysis();
