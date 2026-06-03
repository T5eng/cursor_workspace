// Texas Hold'em UI (6-max, 1 human + bots)

import {
  createPlayer, createTable, startHand, applyAction, publicState, getLegalActions
} from './engine.js';
import { decideBotAction } from './llm-bot.js';
import { describeRank } from './hand-rank.js';
import { openLlmSettings } from './llm-settings.js';
import { loadLlmConfig } from './llm-config.js';

const $ = (id, root = document) => root.getElementById(id);

let table = null;
let humanSeat = 0;
let botBusy = false;
let els = {};

export function bootHoldem(rootEl) {
  els = {
    root: rootEl,
    seats: rootEl.querySelector('#holdemSeats'),
    board: rootEl.querySelector('#holdemBoard'),
    pot: rootEl.querySelector('#holdemPot'),
    street: rootEl.querySelector('#holdemStreet'),
    message: rootEl.querySelector('#holdemMessage'),
    log: rootEl.querySelector('#holdemLog'),
    actions: rootEl.querySelector('#holdemActions'),
    foldBtn: rootEl.querySelector('#holdemFold'),
    checkCallBtn: rootEl.querySelector('#holdemCheckCall'),
    raiseBtn: rootEl.querySelector('#holdemRaise'),
    raiseSlider: rootEl.querySelector('#holdemRaiseSlider'),
    raiseLabel: rootEl.querySelector('#holdemRaiseLabel'),
    nextHandBtn: rootEl.querySelector('#holdemNextHand'),
    backHubBtn: rootEl.querySelector('#holdemBackHub'),
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
  els.backHubBtn?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('app:back-hub'));
  });
  els.llmBtn?.addEventListener('click', openLlmSettings);
  els.restartBtn?.addEventListener('click', () => {
    els.endModal?.classList.add('hidden');
    initTable();
    beginHand();
  });

  initTable();
  beginHand();
}

function initTable() {
  const cfg = loadLlmConfig();
  const hasLlm = Boolean(cfg.apiKey?.trim());
  const players = [
    createPlayer({ id: 0, name: '你', stack: 1000, isHuman: true }),
    createPlayer({ id: 1, name: '规则 Bot A', stack: 1000, botType: 'rule' }),
    createPlayer({ id: 2, name: '规则 Bot B', stack: 1000, botType: 'rule' }),
    createPlayer({ id: 3, name: hasLlm ? 'LLM Bot' : '规则 Bot C', stack: 1000, botType: hasLlm ? 'llm' : 'rule' }),
    createPlayer({ id: 4, name: '规则 Bot D', stack: 1000, botType: 'rule' }),
    createPlayer({ id: 5, name: hasLlm ? 'LLM Bot 2' : '规则 Bot E', stack: 1000, botType: hasLlm ? 'llm' : 'rule' })
  ];
  table = createTable({ players, smallBlind: 5, bigBlind: 10, dealerIndex: -1 });
  appendLog('新桌：6 人 NLHE，盲注 5/10，起始筹码 1000');
  if (hasLlm) appendLog('已检测到 LLM Token：座位 3、5 使用 LLM 对手');
}

function appendLog(msg) {
  if (!els.log) return;
  const line = document.createElement('div');
  line.className = 'holdem-log-line';
  line.textContent = msg;
  els.log.prepend(line);
  while (els.log.children.length > 40) els.log.lastChild.remove();
}

function beginHand() {
  if (table.phase === 'tournamentOver') {
    showEndModal();
    return;
  }
  const ok = startHand(table);
  if (!ok) {
    showEndModal();
    return;
  }
  appendLog(table.message);
  render();
  scheduleBots();
}

function render() {
  const view = publicState(table, humanSeat);
  els.pot.textContent = String(table.pot);
  els.street.textContent = streetLabel(view.street);
  els.message.textContent = view.message;

  renderBoard(view.board);
  renderSeats(view);
  renderActions(view);
  els.nextHandBtn.classList.toggle('hidden', view.phase !== 'handOver' && view.phase !== 'showdown');
}

function streetLabel(s) {
  return { preflop: '翻牌前', flop: '翻牌', turn: '转牌', river: '河牌' }[s] || s;
}

function renderBoard(board) {
  els.board.innerHTML = '';
  const slots = 5;
  for (let i = 0; i < slots; i++) {
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

const SEAT_POS = ['seat-0', 'seat-1', 'seat-2', 'seat-3', 'seat-4', 'seat-5'];

function renderSeats(view) {
  els.seats.innerHTML = '';
  view.players.forEach((p, i) => {
    const wrap = document.createElement('div');
    wrap.className = `holdem-seat ${SEAT_POS[i]}`;
    if (view.actorIndex === i && view.phase === 'betting') wrap.classList.add('acting');
    if (p.folded) wrap.classList.add('folded');
    if (view.dealerIndex === i) wrap.classList.add('dealer');

    const name = document.createElement('div');
    name.className = 'holdem-seat-name';
    name.textContent = p.name + (p.botType === 'llm' ? ' 🤖' : '');

    const stack = document.createElement('div');
    stack.className = 'holdem-seat-stack';
    stack.textContent = `$${p.stack}`;

    const bet = document.createElement('div');
    bet.className = 'holdem-seat-bet';
    if (p.betStreet > 0) bet.textContent = `下注 $${p.betStreet}`;

    const holes = document.createElement('div');
    holes.className = 'holdem-hole';
    (p.hole || []).forEach(c => holes.appendChild(cardEl(c)));

    wrap.append(name, stack, bet, holes);
    els.seats.appendChild(wrap);
  });

  if (table.showdownRanks?.length) {
    const info = table.showdownRanks.find(r => r.seat === humanSeat);
    if (info) appendLog(`你的牌型：${describeRank(info.rank)}`);
  }
}

function renderActions(view) {
  const legal = view.legal;
  const busy = view.phase !== 'betting' || view.actorIndex !== humanSeat;
  els.foldBtn.disabled = busy || !legal?.fold;
  els.checkCallBtn.disabled = busy || (!legal?.check && !legal?.call);
  els.raiseBtn.disabled = busy || (!legal?.raise && !legal?.allIn);

  if (legal?.check) {
    els.checkCallBtn.querySelector('.btn-main').textContent = '过牌';
  } else if (legal?.call) {
    els.checkCallBtn.querySelector('.btn-main').textContent = `跟注 $${legal.call.amount}`;
  } else {
    els.checkCallBtn.querySelector('.btn-main').textContent = '跟注';
  }

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

function updateRaiseLabel() {
  const v = Number(els.raiseSlider.value);
  els.raiseLabel.textContent = `$${v}`;
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
  if (legal.raise) {
    const amt = Number(els.raiseSlider.value);
    humanAct('raise', amt);
  } else if (legal.allIn) humanAct('allIn');
}

function onHandOver() {
  appendLog(table.message);
  if (table.players[humanSeat].stack <= 0) {
    table.phase = 'tournamentOver';
    showEndModal();
  }
  const alive = table.players.filter(p => p.stack > 0);
  if (alive.length === 1 && alive[0].id === humanSeat) {
    table.phase = 'tournamentOver';
    appendLog('恭喜，你赢得了整桌！');
    showEndModal();
  }
  render();
}

function showEndModal() {
  const human = table.players[humanSeat];
  if (human.stack > 0 && table.players.filter(p => p.stack > 0).length === 1) {
    els.endTitle.textContent = '胜利！';
    els.endText.textContent = '你击败了所有对手。';
  } else {
    els.endTitle.textContent = '出局';
    els.endText.textContent = '筹码用尽，可从新桌再来。';
  }
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
  else if (table.phase === 'betting' && table.actorIndex !== humanSeat) {
    scheduleBots();
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
