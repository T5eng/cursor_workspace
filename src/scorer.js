// =============================================================
// scorer.js — Balatro-style scoring pipeline + animation events
// =============================================================

import { chipsAndMultFor, evaluateHand } from './cards.js';

function levelsForHand(run, handType, levels) {
  const key = handType === 'Royal Flush' ? 'Straight Flush' : handType;
  const lvls = { ...levels };
  if (run.boss?.id === 'arm') {
    lvls[key] = Math.max(1, (lvls[key] || 1) - 1);
  }
  return lvls;
}

function isJokerDisabled(run, index) {
  return run.bossRound?.disabledJokerIndex === index;
}

export function scoreHand(playedCards, run, levels) {
  const hand = evaluateHand(playedCards);
  hand.played = playedCards;
  hand.scoringCards = hand.scoringCards.filter(c => !c.debuffed);

  const effectiveLevels = levelsForHand(run, hand.type, levels);
  const base = chipsAndMultFor(hand.type, effectiveLevels);
  let chips = base.chips;
  let mult = base.mult;

  const state = { photoUsed: false };
  const events = [];

  const ctx = {
    run,
    state,
    addChips(n, joker) {
      chips += n;
      events.push({ kind: 'chips', amount: n, joker, snapshot: { chips, mult } });
    },
    addMult(n, joker) {
      mult += n;
      events.push({ kind: 'mult', amount: n, joker, snapshot: { chips, mult } });
    },
    mulMult(n, joker) {
      mult *= n;
      events.push({ kind: 'xmult', amount: n, joker, snapshot: { chips, mult } });
    }
  };

  events.push({ kind: 'base', handType: hand.type, level: base.level, snapshot: { chips, mult } });

  if (run.boss?.id === 'flint') {
    chips = Math.floor(chips / 2);
    mult = Math.max(1, Math.floor(mult / 2));
    events.push({ kind: 'boss', label: '燧石', snapshot: { chips, mult } });
  }

  const runHook = (hookName, ...args) => {
    const list = run.jokers;
    for (let i = 0; i < list.length; i++) {
      if (isJokerDisabled(run, i)) continue;
      const j = list[i];
      const fn = j.hooks && j.hooks[hookName];
      if (fn) fn.call(j, ...args, ctx);

      if (j.id === 'blueprint' && list[i + 1] && !isJokerDisabled(run, i + 1)) {
        const right = list[i + 1];
        const rfn = right.hooks && right.hooks[hookName];
        if (rfn) {
          rfn.call(right, ...args, {
            ...ctx,
            addChips: (n) => { ctx.addChips(n, j); },
            addMult:  (n) => { ctx.addMult(n, j); },
            mulMult:  (n) => { ctx.mulMult(n, j); }
          });
        }
      }
    }
  };

  runHook('onHandPlayed', hand);

  for (const card of hand.scoringCards) {
    if (card.debuffed) continue;
    chips += card.chips;
    events.push({
      kind: 'card-chips',
      amount: card.chips,
      card,
      snapshot: { chips, mult }
    });
    runHook('onScoreCard', card);
  }

  for (const card of hand.played) {
    runHook('onPlayedCard', card);
  }

  runHook('onFinalize');

  events.push({ kind: 'final', snapshot: { chips, mult }, score: Math.floor(chips * mult) });

  return {
    hand,
    chips,
    mult,
    total: Math.floor(chips * mult),
    events
  };
}
