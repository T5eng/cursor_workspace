// Direct browser calls to OpenAI-compatible chat completions

export async function chatCompletion(config, messages) {
  const base = (config.baseUrl || '').replace(/\/$/, '');
  if (!base) throw new Error('请填写 API Base URL');
  if (!config.apiKey?.trim()) throw new Error('请填写 API Token');
  if (!config.model?.trim()) throw new Error('请填写模型名称');

  const url = `${base}/chat/completions`;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.apiKey.trim()}`
  };
  if (config.providerId === 'openrouter') {
    headers['HTTP-Referer'] = typeof location !== 'undefined' ? location.origin : 'https://localhost';
    headers['X-Title'] = 'Holdem Poker';
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model.trim(),
      messages,
      temperature: config.temperature ?? 0.4,
      max_tokens: config.maxTokens ?? 120,
      response_format: { type: 'json_object' }
    })
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`API 返回非 JSON (${res.status})`);
  }
  if (!res.ok) {
    const msg = data.error?.message || data.message || text.slice(0, 200);
    throw new Error(msg || `HTTP ${res.status}`);
  }
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('API 未返回内容');
  return content;
}

export function parseActionJson(raw) {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  const blob = jsonMatch ? jsonMatch[0] : trimmed;
  const parsed = JSON.parse(blob);
  const action = String(parsed.action || '').toLowerCase();
  let amount = parsed.amount;
  if (amount != null) amount = Number(amount);
  return { action, amount };
}
