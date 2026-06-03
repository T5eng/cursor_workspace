import {
  PROVIDERS, providerById, loadLlmConfig, saveLlmConfig, defaultConfig
} from './llm-config.js';
import { chatCompletion } from './llm-client.js';

let els = null;

export function wireLlmSettings(dom) {
  els = dom;
  fillProviderSelect();
  els.llmSettingsForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    persistFromForm();
    els.llmSaveStatus.textContent = '已保存到本浏览器';
    setTimeout(() => { els.llmSaveStatus.textContent = ''; }, 2500);
  });
  els.llmProvider?.addEventListener('change', onProviderChange);
  els.llmTestBtn?.addEventListener('click', testConnection);
  els.llmClearKeyBtn?.addEventListener('click', () => {
    if (els.llmApiKey) els.llmApiKey.value = '';
    persistFromForm();
    els.llmSaveStatus.textContent = '已清除 Token';
  });
}

function fillProviderSelect() {
  if (!els.llmProvider) return;
  els.llmProvider.innerHTML = PROVIDERS.map(p =>
    `<option value="${p.id}">${p.label}</option>`
  ).join('');
}

function onProviderChange() {
  const p = providerById(els.llmProvider.value);
  if (p.id !== 'custom') {
    els.llmBaseUrl.value = p.defaultBaseUrl;
    els.llmModel.value = p.defaultModel;
  }
  renderModelHints(p);
}

function renderModelHints(p) {
  if (!els.llmModelHints) return;
  if (!p.models?.length) {
    els.llmModelHints.textContent = '自定义端点请自行填写模型 ID';
    return;
  }
  els.llmModelHints.innerHTML = '常用：' + p.models.map(m =>
    `<button type="button" class="chip-btn" data-model="${m}">${m}</button>`
  ).join(' ');
  els.llmModelHints.querySelectorAll('[data-model]').forEach(btn => {
    btn.addEventListener('click', () => {
      els.llmModel.value = btn.dataset.model;
    });
  });
}

function persistFromForm() {
  const cfg = {
    providerId: els.llmProvider.value,
    baseUrl: els.llmBaseUrl.value.trim(),
    model: els.llmModel.value.trim(),
    apiKey: els.llmApiKey.value.trim(),
    temperature: Number(els.llmTemperature.value) || 0.4,
    maxTokens: Number(els.llmMaxTokens.value) || 120
  };
  saveLlmConfig(cfg);
}

export function loadFormFromStorage() {
  const cfg = loadLlmConfig();
  els.llmProvider.value = cfg.providerId;
  els.llmBaseUrl.value = cfg.baseUrl || providerById(cfg.providerId).defaultBaseUrl;
  els.llmModel.value = cfg.model;
  els.llmApiKey.value = cfg.apiKey || '';
  els.llmTemperature.value = cfg.temperature ?? 0.4;
  els.llmMaxTokens.value = cfg.maxTokens ?? 120;
  renderModelHints(providerById(cfg.providerId));
}

export function openLlmSettings() {
  loadFormFromStorage();
  els.llmSettingsModal.classList.remove('hidden');
}

export function closeLlmSettings() {
  els.llmSettingsModal.classList.add('hidden');
}

async function testConnection() {
  persistFromForm();
  const cfg = loadLlmConfig();
  els.llmTestStatus.textContent = '测试中…';
  try {
    const out = await chatCompletion(cfg, [
      { role: 'user', content: 'Reply JSON: {"action":"check","amount":null}' }
    ]);
    els.llmTestStatus.textContent = `成功：${out.slice(0, 80)}`;
    els.llmTestStatus.classList.remove('err');
  } catch (e) {
    els.llmTestStatus.textContent = `失败：${e.message}`;
    els.llmTestStatus.classList.add('err');
  }
}
