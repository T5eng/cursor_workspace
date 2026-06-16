// Texas Hold'em UI — 6-max / heads-up, save, LLM opponents

import {
  createPlayer, createTable, startHand, applyAction, publicState, getLegalActions, getRaisePresets, seatPositionLabel
} from './engine.js';
import { decideBotAction } from './llm-bot.js';
import { describeRank } from './hand-rank.js';
import { openLlmSettings } from './llm-settings.js';
import { loadLlmConfig, personalityById } from './llm-config.js';
import {
  saveHoldem, loadHoldem, clearHoldemSave, formatSaveSummary
} from './holdem-save.js';

let table = null;
let humanSeat = 0;
let botBusy = false;
let els = {};
let gameMeta = { ruleBotCount: 4, llmBotCount: 1 };
let logLines = [];

const MAX_OPPONENTS = 5;
const SEAT_LAYOUT = {
  2: ['seat-0', 'seat-3'],
  3: ['seat-0', 'seat-2', 'seat-4'],
  4: ['seat-0', 'seat-1', 'seat-4', 'seat-5'],
  5: ['seat-0', 'seat-1', 'seat-2', 'seat-4', 'seat-5'],
  6: ['seat-0', 'seat-1', 'seat-2', 'seat-3', 'seat-4', 'seat-5']
};

export function bootHoldem(rootEl) {
  els = {
    root: rootEl,
    setupModal: rootEl.querySelector('#holdemSetupModal'),
    ruleBotCount: rootEl.querySelector('#holdemRuleBotCount'),
    llmBotCount: rootEl.querySelector('#holdemLlmBotCount'),
    setupSummary: rootEl.querySelector('#holdemSetupSummary'),
    setupHint: rootEl.querySelector('#holdemSetupHint'),
    llmWarn: rootEl.querySelector('#holdemLlmWarn'),
    startBtn: rootEl.querySelector('#holdemStartBtn'),
    resumeBtn: rootEl.querySelector('#holdemResumeBtn'),
    gameWrap: rootEl.querySelector('#holdemGameWrap'),
    seats: rootEl.querySelector('#holdemSeats'),
    heroHand: rootEl.querySelector('#holdemHeroHand'),
    board: rootEl.querySelector('#holdemBoard'),
    pot: rootEl.querySelector('#holdemPot'),
    street: rootEl.querySelector('#holdemStreet'),
    message: rootEl.querySelector('#holdemMessage'),
    log: rootEl.querySelector('#holdemLog'),
    foldBtn: rootEl.querySelector('#holdemFold'),
    checkCallBtn: rootEl.querySelector('#holdemCheckCall'),
    raiseBtn: rootEl.querySelector('#holdemRaise'),
    raiseSlider: rootEl.querySelector('#holdemRaiseSlider'),
    raiseLabel: rootEl.querySelector('#holdemRaiseLabel'),
    raisePresets: rootEl.querySelector('#holdemRaisePresets'),
    nextHandBtn: rootEl.querySelector('#holdemNextHand'),
    saveBtn: rootEl.querySelector('#holdemSaveBtn'),
    llmBtn: rootEl.querySelector('#holdemLlmBtn'),
    endModal: rootEl.querySelector('#holdemEndModal'),
    endTitle: rootEl.querySelector('#holdemEndTitle'),
    endText: rootEl.querySelector('#holdemEndText'),
    restartBtn: rootEl.querySelector('#holdemRestart')
  };

  els.foldBtn?.addEventListener('click', () => humanAct('fold'));
  els.checkCallBtn?.addEventListener('click', onCheckCall);
  els.raiseBtn?.addEventListener('click', onRaise);
  els.raiseSlider?.addEventListener('input', updateRaiseLabel);
  els.nextHandBtn?.addEventListener('click', () => {
    if (table.phase === 'tournamentOver') showEndModal();
    else beginHand();
  });
  els.saveBtn?.addEventListener('click', () => {
    persistSave();
    appendLog('已手动保存牌局');
    els.message.textContent = '牌局已保存';
  });
  els.llmBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openLlmSettings();
  });
  els.restartBtn?.addEventListener('click', () => {
    els.endModal?.classList.add('hidden');
    showSetup();
  });
  els.startBtn?.addEventListener('click', () => {
    readSetupForm();
    if (gameMeta.llmBotCount > 0 && !hasLlmKey()) {
      syncSetupForm();
      openLlmSettings();
      return;
    }
    clearHoldemSave();
    startNewTable();
  });
  els.resumeBtn?.addEventListener('click', resumeSaved);

  const saved = loadHoldem();
  if (saved && els.resumeBtn) {
    els.resumeBtn.classList.remove('hidden');
    els.resumeBtn.textContent = formatSaveSummary(saved.savedAt);
  }

  els.ruleBotCount?.addEventListener('input', readSetupForm);
  els.llmBotCount?.addEventListener('input', readSetupForm);
  els.ruleBotCount?.addEventListener('change', readSetupForm);
  els.llmBotCount?.addEventListener('change', readSetupForm);

  syncSetupForm();
  showSetup();
}

function showSetup() {
  els.setupModal?.classList.remove('hidden');
  els.gameWrap?.classList.add('hidden');
  const saved = loadHoldem();
  els.resumeBtn?.classList.toggle('hidden', !saved);
  if (saved) els.resumeBtn.textContent = formatSaveSummary(saved.savedAt);
  syncSetupForm();
}

function hasLlmKey() {
  return Boolean(loadLlmConfig().apiKey?.trim());
}

function totalPlayers(meta = gameMeta) {
  return 1 + meta.ruleBotCount + meta.llmBotCount;
}

function isHeadsUp(meta = gameMeta) {
  return totalPlayers(meta) === 2;
}

function clampInt(n, min, max) {
  return Math.min(max, Math.max(min, Math.round(Number(n)) || 0));
}

function normalizeMeta(meta) {
  const m = {
    ruleBotCount: 4,
    llmBotCount: 1,
    ...meta
  };
  if (meta.gameMode != null && meta.ruleBotCount == null && meta.llmBotCount == null) {
    if (meta.gameMode === 'heads-up') {
      m.ruleBotCount = meta.opponentType === 'llm' ? 0 : 1;
      m.llmBotCount = meta.opponentType === 'llm' ? 1 : 0;
    } else {
      m.llmBotCount = meta.opponentType === 'llm' ? 1 : 0;
      m.ruleBotCount = MAX_OPPONENTS - m.llmBotCount;
    }
  }
  m.ruleBotCount = clampInt(m.ruleBotCount, 0, MAX_OPPONENTS);
  m.llmBotCount = clampInt(m.llmBotCount, 0, MAX_OPPONENTS);
  if (!hasLlmKey()) m.llmBotCount = 0;
  let opp = m.ruleBotCount + m.llmBotCount;
  if (opp < 1) m.ruleBotCount = 1;
  opp = m.ruleBotCount + m.llmBotCount;
  if (opp > MAX_OPPONENTS) {
    const over = opp - MAX_OPPONENTS;
    m.llmBotCount = Math.max(0, m.llmBotCount - over);
    opp = m.ruleBotCount + m.llmBotCount;
    if (opp > MAX_OPPONENTS) m.ruleBotCount = MAX_OPPONENTS - m.llmBotCount;
  }
  return { ruleBotCount: m.ruleBotCount, llmBotCount: m.llmBotCount };
}

function readSetupForm() {
  const rule = els.ruleBotCount?.value;
  const llm = els.llmBotCount?.value;
  gameMeta = normalizeMeta({ ruleBotCount: rule, llmBotCount: llm });
  syncSetupForm();
}

function syncSetupForm() {
  gameMeta = normalizeMeta(gameMeta);
  const hasLlm = hasLlmKey();
  if (els.ruleBotCount) els.ruleBotCount.value = String(gameMeta.ruleBotCount);
  if (els.llmBotCount) {
    els.llmBotCount.disabled = !hasLlm;
    els.llmBotCount.value = String(gameMeta.llmBotCount);
  }
  els.llmWarn?.classList.toggle('hidden', hasLlm);
  const n = totalPlayers();
  const opp = gameMeta.ruleBotCount + gameMeta.llmBotCount;
  if (els.setupSummary) {
    const mode = n === 2 ? '单挑' : `${n} 人桌`;
    els.setupSummary.textContent =
      `${mode}：你 + ${gameMeta.ruleBotCount} 规则 + ${gameMeta.llmBotCount} LLM`;
  }
  if (els.setupHint) {
    els.setupHint.textContent =
      '盲注 5/10，起始筹码 1000。对手 1～5 人（合计 2～6 人）。' +
      (hasLlm ? '' : ' 配置 LLM Token 后可添加 LLM Bot。');
  }
}

function buildPlayers() {
  const meta = normalizeMeta(gameMeta);
  const cfg = loadLlmConfig();
  const persona = personalityById(cfg.personalityId || 'tag').label;
  const players = [
    createPlayer({ id: 0, name: '你', stack: 1000, isHuman: true })
  ];
  let id = 1;
  for (let r = 0; r < meta.ruleBotCount; r++) {
    const label = String.fromCharCode(65 + (r % 26));
    players.push(createPlayer({
      id: id++,
      name: `规则 Bot ${label}`,
      stack: 1000,
      botType: 'rule'
    }));
  }
  for (let l = 0; l < meta.llmBotCount; l++) {
    const suffix = meta.llmBotCount > 1 ? ` ${l + 1}` : '';
    players.push(createPlayer({
      id: id++,
      name: `LLM · ${persona}${suffix}`,
      stack: 1000,
      botType: 'llm'
    }));
  }
  return players;
}

function startNewTable() {
  els.setupModal?.classList.add('hidden');
  els.gameWrap?.classList.remove('hidden');
  gameMeta = normalizeMeta(gameMeta);
  els.root?.classList.toggle('holdem-heads-up', isHeadsUp());
  logLines = [];
  if (els.log) els.log.innerHTML = '';
  table = createTable({ players: buildPlayers(), smallBlind: 5, bigBlind: 10, dealerIndex: 0 });
  const n = totalPlayers();
  appendLog(
    `新桌：${n} 人 · 规则×${gameMeta.ruleBotCount} LLM×${gameMeta.llmBotCount} · NLHE 5/10`
  );
  beginHand();
}

function resumeSaved() {
  const saved = loadHoldem();
  if (!saved) {
    showSetup();
    return;
  }
  gameMeta = normalizeMeta({ ...saved.meta });
  table = saved.table;
  logLines = saved.logLines || [];
  els.setupModal?.classList.add('hidden');
  els.gameWrap?.classList.remove('hidden');
  gameMeta = normalizeMeta(gameMeta);
  els.root?.classList.toggle('holdem-heads-up', isHeadsUp());
  if (els.log) {
    els.log.innerHTML = '';
    logLines.forEach(line => appendLog(line, false));
  }
  appendLog('已从本地存档恢复');
  render();
  if (table.phase === 'betting' && table.actorIndex !== humanSeat) scheduleBots();
}

function persistSave() {
  saveHoldem(table, gameMeta, logLines);
}

function appendLog(msg, alsoPersist = true) {
  if (!els.log) return;
  logLines.unshift(msg);
  if (logLines.length > 40) logLines.length = 40;
  const line = document.createElement('div');
  line.className = 'holdem-log-line';
  line.textContent = msg;
  els.log.prepend(line);
  while (els.log.children.length > 40) els.log.lastChild.remove();
  if (alsoPersist && table) persistSave();
}

function beginHand() {
  if (!table) return;
  if (table.phase === 'tournamentOver') {
    showEndModal();
    clearHoldemSave();
    return;
  }
  let ok = false;
  try {
    ok = startHand(table);
  } catch (e) {
    console.error('startHand failed', e);
    if (els.message) els.message.textContent = '发牌失败，请重新开始新局';
    return;
  }
  if (!ok) {
    showEndModal();
    clearHoldemSave();
    return;
  }
  appendLog(table.message);
  render();
  scheduleBots();
}

function formatChips(n) {
  return Number(n).toLocaleString('en-US');
}

function render() {
  const view = publicState(table, humanSeat);
  els.pot.textContent = formatChips(table.pot);
  els.street.textContent = streetLabel(view.street);
  els.message.textContent = view.message;
  renderBoard(view.board);
  renderSeats(view);
  renderHeroHand(view);
  renderActions(view);
  els.nextHandBtn.classList.toggle('hidden', view.phase !== 'handOver' && view.phase !== 'showdown');
  persistSave();
}

function streetLabel(s) {
  return { preflop: '翻牌前', flop: '翻牌', turn: '转牌', river: '河牌' }[s] || s;
}

function renderBoard(board) {
  els.board.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const el = document.createElement('div');
    el.className = 'holdem-card slot';
    if (board[i]) el.appendChild(cardEl(board[i]));
    else el.classList.add('empty');
    els.board.appendChild(el);
  }
}

function cardEl(c) {
  const d = document.createElement('div');
  if (c.hidden) {
    d.className = 'holdem-card back';
    d.textContent = '🂠';
    return d;
  }
  d.className = `holdem-card face ${c.suit === '♥' || c.suit === '♦' ? 'red' : 'black'}`;
  d.innerHTML = `<span class="r">${c.rank}</span><span class="s">${c.suit}</span>`;
  return d;
}

function seatClass(i) {
  const n = table?.players?.length ?? totalPlayers();
  const layout = SEAT_LAYOUT[n] ?? SEAT_LAYOUT[6];
  return layout[i] ?? layout[0];
}


function renderHeroHand(view) {
  if (!els.heroHand) return;
  els.heroHand.innerHTML = '';
  const human = view.players[humanSeat];
  if (!human?.hole?.length) return;
  human.hole.forEach(c => els.heroHand.appendChild(cardEl(c)));
}

function renderSeats(view) {
  els.seats.innerHTML = '';
  view.players.forEach((p, i) => {
    const wrap = document.createElement('div');
    wrap.className = `holdem-seat ${seatClass(i)}`;
    if (view.actorIndex === i && view.phase === 'betting') wrap.classList.add('acting');
    if (p.folded) wrap.classList.add('folded');
    if (view.dealerIndex === i) wrap.classList.add('dealer');
    if (view.sbSeat === i) wrap.classList.add('sb');
    if (view.bbSeat === i) wrap.classList.add('bb');

    const name = document.createElement('div');
    name.className = 'holdem-seat-name';
    const posTag = table ? seatPositionLabel(table, i) : '';
    name.textContent = (posTag ? `[${posTag}] ` : '') + p.name + (p.botType === 'llm' ? ' 🤖' : '');

    const stack = document.createElement('div');
    stack.className = 'holdem-seat-stack';
    stack.textContent = `$${formatChips(p.stack)}`;

    const bet = document.createElement('div');
    bet.className = 'holdem-seat-bet';
    if (p.betStreet > 0) bet.textContent = `+$${formatChips(p.betStreet)}`;

    const holes = document.createElement('div');
    holes.className = 'holdem-hole';
    (p.hole || []).forEach(c => holes.appendChild(cardEl(c)));

    wrap.append(name, stack, bet, holes);
    els.seats.appendChild(wrap);
  });
}

function renderActions(view) {
  const legal = view.legal;
  const busy = view.phase !== 'betting' || view.actorIndex !== humanSeat;
  els.foldBtn.disabled = busy || !legal?.fold;
  els.checkCallBtn.disabled = busy || (!legal?.check && !legal?.call);
  els.raiseBtn.disabled = busy || (!legal?.raise && !legal?.allIn);

  const main = els.checkCallBtn?.querySelector('.btn-main');
  if (main) {
    if (legal?.check) main.textContent = '过牌';
    else if (legal?.call) main.textContent = `跟注 $${legal.call.amount}`;
    else main.textContent = '跟注';
  }

  renderRaisePresets(legal);

  if (legal?.raise) {
    els.raiseSlider.min = legal.raise.min;
    els.raiseSlider.max = legal.raise.max;
    els.raiseSlider.value = legal.raise.min;
    els.raiseSlider.disabled = false;
    updateRaiseLabel();
  } else {
    els.raiseSlider.disabled = true;
    els.raiseLabel.textContent = legal?.allIn ? '全下' : '—';
  }
}

function renderRaisePresets(legal) {
  const box = els.raisePresets;
  if (!box) return;
  box.innerHTML = '';
  if (!legal?.raise || !table) {
    box.classList.add('hidden');
    return;
  }
  const presets = getRaisePresets(table, humanSeat);
  if (!presets.length) {
    box.classList.add('hidden');
    return;
  }
  box.classList.remove('hidden');
  for (const preset of presets) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'holdem-preset-btn';
    btn.textContent = preset.label;
    btn.title = `$${preset.amount}`;
    btn.addEventListener('click', () => {
      els.raiseSlider.value = String(preset.amount);
      updateRaiseLabel();
      humanAct('raise', preset.amount);
    });
    box.appendChild(btn);
  }
}

function updateRaiseLabel() {
  els.raiseLabel.textContent = `$${Number(els.raiseSlider.value)}`;
}

function humanAct(action, amount) {
  const res = applyAction(table, humanSeat, action, amount);
  if (!res.ok) {
    els.message.textContent = res.error;
    return;
  }
  render();
  if (table.phase === 'handOver') onHandOver();
  else scheduleBots();
}

function onCheckCall() {
  const legal = getLegalActions(table, humanSeat);
  if (!legal) return;
  if (legal.check) humanAct('check');
  else if (legal.call) humanAct('call');
}

function onRaise() {
  const legal = getLegalActions(table, humanSeat);
  if (!legal) return;
  if (legal.raise) humanAct('raise', Number(els.raiseSlider.value));
  else if (legal.allIn) humanAct('allIn');
}

function onHandOver() {
  appendLog(table.message);
  if (table.players[humanSeat].stack <= 0) {
    table.phase = 'tournamentOver';
    showEndModal();
    clearHoldemSave();
  }
  const alive = table.players.filter(p => p.stack > 0);
  if (alive.length === 1 && alive[0].id === humanSeat) {
    table.phase = 'tournamentOver';
    appendLog('恭喜，你赢得了整桌！');
    showEndModal();
    clearHoldemSave();
  }
  render();
}

function showEndModal() {
  const human = table.players[humanSeat];
  const won = human.stack > 0 && table.players.filter(p => p.stack > 0).length === 1;
  els.endTitle.textContent = won ? '胜利！' : '出局';
  els.endText.textContent = won
    ? (isHeadsUp() ? '单挑获胜！' : '你击败了所有对手。')
    : '筹码用尽，可重新开局。';
  els.endModal.classList.remove('hidden');
}

async function scheduleBots() {
  if (botBusy || !table || table.phase !== 'betting') return;
  const seat = table.actorIndex;
  const p = table.players[seat];
  if (!p || p.isHuman) return;

  botBusy = true;
  els.message.textContent = `${p.name} 思考中…`;

  try {
    const legal = getLegalActions(table, seat);
    const decision = await decideBotAction(table, seat);
    if (decision && legal) {
      await sleep(p.botType === 'llm' ? 200 : 350);
      const res = applyAction(table, seat, decision.action, decision.amount);
      if (res.ok) {
        const actLabel = { fold: '弃牌', check: '过牌', call: '跟注', raise: '加注', allIn: '全下' }[decision.action];
        appendLog(`${p.name}: ${actLabel}${decision.amount ? ` $${decision.amount}` : ''}`);
      }
    }
  } catch (e) {
    console.error(e);
    appendLog(`${p.name} 行动失败，自动弃牌`);
    applyAction(table, seat, 'fold');
  }

  botBusy = false;
  render();
  if (table.phase === 'handOver') onHandOver();
  else if (table.phase === 'betting' && table.actorIndex !== humanSeat) scheduleBots();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
