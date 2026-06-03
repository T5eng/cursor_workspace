// App hub: Balatro vs Texas Hold'em

import { wireLlmSettings, openLlmSettings, closeLlmSettings } from './holdem/llm-settings.js';

const $ = (id) => document.getElementById(id);

let balatroBooted = false;
let holdemBooted = false;

function showHub() {
  $('hubScreen')?.classList.remove('hidden');
  $('app')?.classList.add('mode-hidden');
  $('holdemApp')?.classList.add('mode-hidden');
  document.title = '扑克合集 · 小丑牌 & 德州';
}

function hideHub() {
  $('hubScreen')?.classList.add('hidden');
}

async function enterBalatro() {
  hideHub();
  $('app')?.classList.remove('mode-hidden');
  $('holdemApp')?.classList.add('mode-hidden');
  document.title = '小丑牌 · Joker Cards';
  if (!balatroBooted) {
    const { bootBalatro } = await import('./game.js');
    bootBalatro();
    balatroBooted = true;
  }
}

async function enterHoldem() {
  hideHub();
  $('app')?.classList.add('mode-hidden');
  $('holdemApp')?.classList.remove('mode-hidden');
  document.title = '德州扑克 · Texas Hold\'em';
  if (!holdemBooted) {
    const { bootHoldem } = await import('./holdem/holdem-ui.js');
    bootHoldem($('holdemApp'));
    holdemBooted = true;
  }
}

function wireHub() {
  $('hubBalatroBtn')?.addEventListener('click', enterBalatro);
  $('hubHoldemBtn')?.addEventListener('click', enterHoldem);
  $('hubLlmBtn')?.addEventListener('click', openLlmSettings);

  document.querySelectorAll('[data-back-hub]').forEach(btn => {
    btn.addEventListener('click', () => {
      holdemBooted = false;
      showHub();
    });
  });

  window.addEventListener('app:back-hub', () => {
    holdemBooted = false;
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
  btn.addEventListener('click', closeLlmSettings);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('llmSettingsModal')?.classList.contains('hidden')) {
    closeLlmSettings();
  }
});

wireHub();
showHub();
