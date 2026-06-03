import { chatCompletion, parseActionJson } from './llm-client.js';
import { loadLlmConfig } from './llm-config.js';
import { ruleBotDecide } from './rule-bot.js';
import { getLegalActions } from './engine.js';

function cardStr(c) {
  if (!c || c.hidden) return '??';
  return `${c.rank}${c.suit}`;
}

function buildPrompt(table, seatId, legal) {
  const p = table.players[seatId];
  const lines = [
    'You are a Texas Hold\'em poker bot. Reply with JSON only.',
    '{"action":"fold"|"check"|"call"|"raise"|"allIn","amount":number|null}',
    `Street: ${table.street}`,
    `Pot: ${table.pot}`,
    `Current bet to match: ${table.currentBet}`,
    `Your stack: ${p.stack}`,
    `Your bet this street: ${p.betStreet}`,
    `Your hole: ${p.hole.map(cardStr).join(' ')}`,
    `Board: ${table.board.map(cardStr).join(' ') || '(none)'}`,
    `Legal actions: ${JSON.stringify(legal)}`,
    'Choose one legal action. For raise, amount is total bet this street (not increment).'
  ];
  return lines.join('\n');
}

function normalizeLlmAction(table, seatId, legal, parsed) {
  const action = parsed.action;
  if (action === 'fold' && legal.fold) return { action: 'fold' };
  if (action === 'check' && legal.check) return { action: 'check' };
  if (action === 'call' && legal.call) return { action: 'call' };
  if (action === 'allin' && legal.allIn) return { action: 'allIn' };
  if ((action === 'raise' || action === 'allin') && legal.raise) {
    let amt = Number(parsed.amount);
    if (!Number.isFinite(amt)) amt = legal.raise.min;
    amt = Math.max(legal.raise.min, Math.min(legal.raise.max, Math.round(amt)));
    return { action: 'raise', amount: amt };
  }
  if (action === 'allin' && legal.allIn) return { action: 'allIn' };
  return null;
}

export async function llmBotDecide(table, seatId, legal) {
  const cfg = loadLlmConfig();
  if (!cfg.apiKey?.trim()) {
    return ruleBotDecide(table, seatId, legal);
  }

  try {
    const content = await chatCompletion(cfg, [
      { role: 'system', content: 'You play tight-aggressive NLHE. Output valid JSON only.' },
      { role: 'user', content: buildPrompt(table, seatId, legal) }
    ]);
    const parsed = parseActionJson(content);
    const norm = normalizeLlmAction(table, seatId, legal, parsed);
    if (norm) return norm;
  } catch (e) {
    console.warn('LLM bot fallback:', e);
  }
  return ruleBotDecide(table, seatId, legal);
}

export async function decideBotAction(table, seatId) {
  const legal = getLegalActions(table, seatId);
  if (!legal) return null;
  const p = table.players[seatId];
  if (p.botType === 'llm') return llmBotDecide(table, seatId, legal);
  return ruleBotDecide(table, seatId, legal);
}
