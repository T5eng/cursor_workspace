// 21点 · Blackjack

import { freshDeck, makeCardEl, blackjackValue } from './card-ui.js';

const SAVE_KEY = 'mg_blackjack_chips_v1';
const DEFAULT_CHIPS = 1000;
const BETS = [10, 25, 50, 100];

let root = null;
let deck = [];
let player = [];
let dealer = [];
let chips = DEFAULT_CHIPS;
let bet = 0;
let phase = 'bet'; // bet | player | dealer | result
let doubled = false;

function loadChips() {
  const n = Number(localStorage.getItem(SAVE_KEY));
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CHIPS;
}

function saveChips() {
  localStorage.setItem(SAVE_KEY, String(chips));
}

function draw() {
  return deck.pop();
}

function isBlackjack(hand) {
  return hand.length === 2 && blackjackValue(hand) === 21;
}

function render() {
  if (!root) return;
  const pVal = player.length ? blackjackValue(player) : 0;
  const dShown = dealer.length ? (phase === 'player' || phase === 'bet' ? [dealer[0]] : dealer) : [];
  const dVal = dShown.length ? blackjackValue(dShown) : 0;

  root.innerHTML = `
    <div class="mg-panel mg-blackjack">
      <div class="mg-stats">
        <span>筹码 <strong class="gold">$${chips}</strong></span>
        <span>下注 <strong>$${bet}</strong></span>
      </div>

      <div class="mg-zone">
        <div class="mg-zone-label">庄家 ${phase !== 'player' && phase !== 'bet' && dealer.length ? `· ${blackjackValue(dealer)}` : dShown.length ? `· ${dVal}+?` : ''}</div>
        <div class="mg-hand" id="bjDealer"></div>
      </div>

      <div class="mg-zone">
        <div class="mg-zone-label">你 ${player.length ? `· ${pVal}` : ''}</div>
        <div class="mg-hand" id="bjPlayer"></div>
      </div>

      <p class="mg-message" id="bjMessage">${messageText()}</p>

      <div class="mg-actions" id="bjActions"></div>
    </div>
  `;

  const dealerEl = root.querySelector('#bjDealer');
  const playerEl = root.querySelector('#bjPlayer');
  dealer.forEach((c, i) => {
    const hide = phase === 'player' && i === 1;
    dealerEl.appendChild(makeCardEl(c, { faceDown: hide, small: true }));
  });
  player.forEach(c => playerEl.appendChild(makeCardEl(c, { small: true })));

  const actions = root.querySelector('#bjActions');
  if (phase === 'bet') {
    BETS.forEach(amount => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-sort mg-bet-btn';
      btn.disabled = chips < amount;
      btn.textContent = `$${amount}`;
      btn.addEventListener('click', () => startRound(amount));
      actions.appendChild(btn);
    });
    if (chips < 10) {
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.className = 'btn btn-play';
      reset.innerHTML = '<span class="btn-main">领救济金 $1000</span>';
      reset.addEventListener('click', () => {
        chips = DEFAULT_CHIPS;
        saveChips();
        render();
      });
      actions.appendChild(reset);
    }
  } else if (phase === 'player') {
    addAction(actions, 'btn-discard', '要牌', hit);
    addAction(actions, 'btn-play', '停牌', stand);
    if (player.length === 2 && !doubled && chips >= bet) {
      addAction(actions, 'btn-sort', '加倍', doubleDown);
    }
  } else if (phase === 'result') {
    addAction(actions, 'btn-play', '再来一手', () => {
      phase = 'bet';
      bet = 0;
      player = [];
      dealer = [];
      doubled = false;
      render();
    });
  }
}

function addAction(parent, cls, label, fn) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `btn ${cls}`;
  btn.innerHTML = `<span class="btn-main">${label}</span>`;
  btn.addEventListener('click', fn);
  parent.appendChild(btn);
}

function messageText() {
  if (phase === 'bet') return chips >= 10 ? '选择下注金额开始' : '筹码不足，可领取救济金';
  if (phase === 'player') return '你的回合 — 要牌或停牌';
  if (phase === 'dealer') return '庄家行动中…';
  return root?._resultMsg || '';
}

function startRound(amount) {
  bet = amount;
  chips -= bet;
  saveChips();
  deck = freshDeck();
  player = [draw(), draw()];
  dealer = [draw(), draw()];
  doubled = false;
  phase = 'player';

  if (isBlackjack(player)) {
    if (isBlackjack(dealer)) {
      chips += bet;
      endRound('双方黑杰克，平局，退还下注');
    } else {
      chips += Math.floor(bet * 2.5);
      endRound('黑杰克！赢得 3:2');
    }
    saveChips();
    return;
  }
  if (isBlackjack(dealer)) {
    phase = 'dealer';
    render();
    setTimeout(() => endRound('庄家黑杰克，你输了'), 500);
    return;
  }
  render();
}

function hit() {
  player.push(draw());
  if (blackjackValue(player) > 21) {
    endRound('爆牌了！庄家获胜');
    return;
  }
  render();
}

function stand() {
  phase = 'dealer';
  render();
  dealerTurn();
}

function doubleDown() {
  chips -= bet;
  bet *= 2;
  saveChips();
  doubled = true;
  player.push(draw());
  if (blackjackValue(player) > 21) {
    endRound('加倍后爆牌！');
    return;
  }
  phase = 'dealer';
  render();
  dealerTurn();
}

function dealerTurn() {
  const step = () => {
    if (blackjackValue(dealer) < 17) {
      dealer.push(draw());
      render();
      setTimeout(step, 450);
      return;
    }
    resolveWinner();
  };
  setTimeout(step, 400);
}

function resolveWinner() {
  const p = blackjackValue(player);
  const d = blackjackValue(dealer);
  if (d > 21) {
    chips += bet * 2;
    endRound(`庄家爆牌 (${d})！你赢得 $${bet * 2}`);
  } else if (p > d) {
    chips += bet * 2;
    endRound(`你 ${p} 胜 庄家 ${d}，赢得 $${bet * 2}`);
  } else if (p < d) {
    endRound(`庄家 ${d} 胜 你 ${p}，输掉下注`);
  } else {
    chips += bet;
    endRound(`平局 ${p}，退还下注`);
  }
  saveChips();
}

function endRound(msg) {
  phase = 'result';
  root._resultMsg = msg;
  render();
}

export function bootBlackjack(container) {
  root = container;
  chips = loadChips();
  phase = 'bet';
  bet = 0;
  player = [];
  dealer = [];
  render();
}

export function unmountBlackjack() {
  root = null;
}
