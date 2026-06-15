// 做T量化分析 · 主应用

import { fetchIntradayKline, fetchDailyKline, fetchQuote, loadPrefs } from './api.js';
import { analyzeTPoints } from './analyzer.js';
import { renderChart } from './chart-render.js';
import { formatPrice, formatPct } from './indicators.js';

const $ = (id) => document.getElementById(id);

const symbolInput = $('symbolInput');
const periodSelect = $('periodSelect');
const daysSelect = $('daysSelect');
const analyzeBtn = $('analyzeBtn');
const statusBar = $('statusBar');
const quotePanel = $('quotePanel');
const mainChart = $('mainChart');

let lastChartData = null;

function setStatus(msg, type = '') {
  statusBar.textContent = msg;
  statusBar.className = `status-bar ${type}`;
}

function setLoading(loading) {
  analyzeBtn.disabled = loading;
  if (loading) setStatus('正在拉取行情与分时数据…', 'loading');
}

function priceClass(change) {
  if (change > 0) return 'up';
  if (change < 0) return 'down';
  return 'flat';
}

function renderQuote(quote, levels, lastRsi) {
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
  $('statVwap').textContent = formatPrice(levels.currentVwap);
  $('statRsi').textContent = lastRsi != null ? lastRsi.toFixed(1) : '—';
}

function renderLevels(levels) {
  const items = [
    { label: '枢轴 P', value: levels.p, type: 'neutral' },
    { label: '阻力 R1', value: levels.r1, type: 'resist' },
    { label: '阻力 R2', value: levels.r2, type: 'resist' },
    { label: '支撑 S1', value: levels.s1, type: 'support' },
    { label: '支撑 S2', value: levels.s2, type: 'support' },
    { label: '昨收', value: levels.prevClose, type: 'neutral' },
    { label: '今开', value: levels.todayOpen, type: 'neutral' },
    { label: '今高', value: levels.todayHigh, type: 'resist' },
    { label: '今低', value: levels.todayLow, type: 'support' },
    { label: 'VWAP', value: levels.currentVwap, type: 'neutral' }
  ];

  $('levelsGrid').innerHTML = items.map((item) => `
    <div class="level-item ${item.type}">
      <div class="label">${item.label}</div>
      <div class="value">${formatPrice(item.value)}</div>
    </div>
  `).join('');
}

function renderSignals(signals) {
  $('signalCount').textContent = String(signals.length);

  if (!signals.length) {
    $('signalList').innerHTML = '<div class="empty-hint">当前参数下未检测到明显做T信号<br>可尝试缩短周期或延长回看天数</div>';
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
      <span class="signal-strength">强度 ${sig.strength}/5</span>
    </div>
  `).join('');
}

function renderStrategy(html) {
  $('strategyBody').innerHTML = html;
}

async function runAnalysis() {
  const symbol = symbolInput.value.trim();
  const period = Number(periodSelect.value);
  const days = Number(daysSelect.value);

  if (!symbol) {
    setStatus('请输入股票代码', 'error');
    return;
  }

  setLoading(true);

  try {
    const [intraday, daily, quote] = await Promise.all([
      fetchIntradayKline({ symbol, period, days }),
      fetchDailyKline({ symbol, days: 30 }),
      fetchQuote(symbol).catch(() => null)
    ]);

    const analysis = analyzeTPoints({
      candles: intraday.candles,
      dailyCandles: daily.candles,
      quote
    });

    const lastRsi = analysis.indicators.rsiValues.at(-1);

    if (quote) {
      renderQuote(quote, analysis.levels, lastRsi);
    } else {
      quotePanel.classList.remove('hidden');
      $('quoteName').textContent = `${intraday.meta.name} (${intraday.meta.symbol})`;
    }

    renderLevels(analysis.levels);
    renderSignals(analysis.signals);
    renderStrategy(analysis.strategy);

    lastChartData = {
      candles: intraday.candles,
      indicators: analysis.indicators,
      signals: analysis.signals,
      levels: analysis.levels
    };
    renderChart(mainChart, lastChartData);

    const buyN = analysis.signals.filter((s) => s.type === 'buy').length;
    const sellN = analysis.signals.filter((s) => s.type === 'sell').length;
    setStatus(
      `${intraday.meta.name} · ${intraday.meta.label} · ${period}分钟 · ${intraday.meta.count}根K线 · 低吸${buyN}个 / 高抛${sellN}个信号` +
      (intraday.meta.source === 'mock' ? ' · [模拟数据]' : '')
    );
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
  if (prefs?.period) periodSelect.value = String(prefs.period);
  if (prefs?.days) daysSelect.value = String(prefs.days);
}

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
  if (lastChartData) renderChart(mainChart, lastChartData);
});

initPrefs();
if (symbolInput.value.trim()) runAnalysis();
