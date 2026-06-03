// LLM provider presets — browser-local storage (API key stays on device)

export const STORAGE_KEY = 'holdem_llm_config_v1';

export const PERSONALITIES = [
  {
    id: 'tag',
    label: '紧凶 TAG',
    prompt: 'Play tight-aggressive (TAG). Open and continue with strong ranges, value-bet made hands, fold weak hands to large pressure unless pot odds are excellent.'
  },
  {
    id: 'lag',
    label: '松凶 LAG',
    prompt: 'Play loose-aggressive (LAG). Open wider, semi-bluff draws, fire bluffs on scary boards when opponents show weakness, but avoid spewing against big raises.'
  },
  {
    id: 'nit',
    label: '岩石 Nit',
    prompt: 'Play very tight (nit). Mostly premiums and strong broadways. Rarely bluff. Fold marginal hands to significant aggression.'
  },
  {
    id: 'calling',
    label: '跟注站',
    prompt: 'Calling-station style: call frequently with pairs and draws, rarely fold to single bets, seldom raise without very strong hands.'
  },
  {
    id: 'tricky',
    label: '诡诈',
    prompt: 'Tricky balanced play: mix value and bluffs, occasional check-raises with strong hands, float flops with position, but stay within legal actions.'
  },
  {
    id: 'custom',
    label: '自定义',
    prompt: ''
  }
];

export const PROVIDERS = [
  {
    id: 'openai',
    label: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1']
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o-mini',
    models: [
      'openai/gpt-4o-mini',
      'anthropic/claude-3.5-sonnet',
      'google/gemini-2.0-flash-001',
      'meta-llama/llama-3.1-70b-instruct'
    ]
  },
  {
    id: 'groq',
    label: 'Groq',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner']
  },
  {
    id: 'custom',
    label: '自定义 (OpenAI 兼容)',
    defaultBaseUrl: '',
    defaultModel: '',
    models: []
  }
];

export function defaultConfig() {
  const p = PROVIDERS[0];
  return {
    providerId: p.id,
    baseUrl: p.defaultBaseUrl,
    model: p.defaultModel,
    apiKey: '',
    temperature: 0.4,
    maxTokens: 120,
    personalityId: 'tag',
    personalityCustom: ''
  };
}

export function personalityById(id) {
  return PERSONALITIES.find(x => x.id === id) || PERSONALITIES[0];
}

export function personalityPrompt(cfg) {
  const p = personalityById(cfg.personalityId || 'tag');
  if (p.id === 'custom' && cfg.personalityCustom?.trim()) {
    return cfg.personalityCustom.trim();
  }
  return p.prompt || PERSONALITIES[0].prompt;
}

export function loadLlmConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultConfig();
    return { ...defaultConfig(), ...JSON.parse(raw) };
  } catch {
    return defaultConfig();
  }
}

export function saveLlmConfig(cfg) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

export function providerById(id) {
  return PROVIDERS.find(p => p.id === id) || PROVIDERS[0];
}
