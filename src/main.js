// App hub: Balatro vs Texas Hold'em vs mini-games

import { wireLlmSettings, openLlmSettings, closeLlmSettings } from './holdem/llm-settings.js';
import { MINIGAMES } from './minigames/index.js';

const $ = (id) => document.getElementById(id);

let balatroBooted = false;
let holdemBooted = false;
let activeMinigame = null;
let activeMinigameMod = null;

function showHub() {
  document.documentElement.classList.remove('holdem-active', 'minigame-active');
  $('hubScreen')?.classList.remove('hidden');
  $('app')?.classList.add('mode-hidden');
  $('holdemApp')?.classList.add('mode-hidden');
  $('minigameApp')?.classList.add('mode-hidden');
  document.title = '扑克合集 · 小丑牌 & 德州 & 跑团';
}

function hideHub() {
  $('hubScreen')?.classList.add('hidden');
}

async function unmountMinigame() {
  if (activeMinigame && activeMinigameMod) {
    const fn = activeMinigameMod[activeMinigame.unmountFn];
    if (typeof fn === 'function') fn();
  }
  activeMinigame = null;
  activeMinigameMod = null;
  const root = $('minigameRoot');
  if (root) root.innerHTML = '';
}

async function enterBalatro() {
  await unmountMinigame();
  closeLlmSettings();
  hideHub();
  $('app')?.classList.remove('mode-hidden');
  $('holdemApp')?.classList.add('mode-hidden');
  $('minigameApp')?.classList.add('mode-hidden');
  document.title = '小丑牌 · Joker Cards';
  if (!balatroBooted) {
    const { bootBalatro } = await import('./game.js');
    bootBalatro();
    balatroBooted = true;
  }
}

async function enterHoldem() {
  await unmountMinigame();
  closeLlmSettings();
  hideHub();
  $('app')?.classList.add('mode-hidden');
  $('holdemApp')?.classList.remove('mode-hidden');
  $('minigameApp')?.classList.add('mode-hidden');
  document.documentElement.classList.add('holdem-active');
  document.title = '德州扑克 · Texas Hold\'em';
  if (!holdemBooted) {
    const { bootHoldem } = await import('./holdem/holdem-ui.js');
    bootHoldem($('holdemApp'));
    holdemBooted = true;
  }
}

async function enterMinigame(id) {
  const game = MINIGAMES.find(g => g.id === id);
  if (!game) return;

  await unmountMinigame();
  closeLlmSettings();
  hideHub();
  $('app')?.classList.add('mode-hidden');
  $('holdemApp')?.classList.add('mode-hidden');
  $('minigameApp')?.classList.remove('mode-hidden');
  document.documentElement.classList.add('minigame-active');
  document.title = `${game.title} · 扑克合集`;

  const titleEl = $('minigameTitle');
  if (titleEl) titleEl.textContent = `${game.emoji} ${game.title}`;

  const mod = await game.boot();
  activeMinigame = game;
  activeMinigameMod = mod;
  const bootFn = mod[game.bootFn];
  if (typeof bootFn === 'function') bootFn($('minigameRoot'));
}

function renderMinigameHubButtons() {
  const wrap = $('hubMinigames');
  if (!wrap) return;
  wrap.innerHTML = '';
  for (const game of MINIGAMES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-play hub-minigame-btn hub-rpg-btn';
    btn.dataset.minigame = game.id;
    btn.innerHTML = `
      <span class="btn-main">${game.emoji} ${game.title}</span>
      <span class="btn-sub">${game.subtitle}</span>
    `;
    wrap.appendChild(btn);
  }
}

function onHubClick(e) {
  const llmBtn = e.target.closest('#hubLlmBtn');
  if (llmBtn) {
    e.preventDefault();
    e.stopPropagation();
    openLlmSettings();
    return;
  }
  const mgBtn = e.target.closest('[data-minigame]');
  if (mgBtn) {
    e.preventDefault();
    enterMinigame(mgBtn.dataset.minigame);
    return;
  }
  if (e.target.closest('#hubBalatroBtn')) {
    e.preventDefault();
    enterBalatro();
    return;
  }
  if (e.target.closest('#hubHoldemBtn')) {
    e.preventDefault();
    enterHoldem();
  }
}

function wireHub() {
  renderMinigameHubButtons();
  $('hubScreen')?.addEventListener('click', onHubClick);

  document.querySelectorAll('[data-back-hub]').forEach(btn => {
    btn.addEventListener('click', async () => {
      holdemBooted = false;
      await unmountMinigame();
      closeLlmSettings();
      showHub();
    });
  });

  window.addEventListener('app:back-hub', async () => {
    holdemBooted = false;
    await unmountMinigame();
    closeLlmSettings();
    showHub();
  });
}

wireLlmSettings({
  llmSettingsModal: $('llmSettingsModal'),
  llmSettingsForm: $('llmSettingsForm'),
  llmProvider: $('llmProvider'),
  llmBaseUrl: $('llmBaseUrl'),
  llmModel: $('llmModel'),
  llmApiKey: $('llmApiKey'),
  llmTemperature: $('llmTemperature'),
  llmMaxTokens: $('llmMaxTokens'),
  llmModelHints: $('llmModelHints'),
  llmSaveStatus: $('llmSaveStatus'),
  llmTestStatus: $('llmTestStatus'),
  llmTestBtn: $('llmTestBtn'),
  llmClearKeyBtn: $('llmClearKeyBtn'),
  llmPersonality: $('llmPersonality'),
  llmPersonalityCustom: $('llmPersonalityCustom')
});

document.querySelectorAll('[data-close-llm]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    closeLlmSettings();
  });
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('llmSettingsModal')?.classList.contains('hidden')) {
    closeLlmSettings();
  }
});

wireHub();
showHub();
