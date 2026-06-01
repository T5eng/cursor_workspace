// =============================================================
// scorer.js — turn a played hand + jokers into a final score,
// emitting a sequence of visual "events" so the UI can animate.
// =============================================================

import { chipsAndMultFor, evaluateHand } from './cards.js';

export function scoreHand(playedCards, run, levels) {
  const hand = evaluateHand(playedCards);
  hand.played = playedCards;

  const base = chipsAndMultFor(hand.type, levels);
  let chips = base.chips;
  let mult = base.mult;

  // Per-hand transient state for stateful jokers (e.g. Photograph)
  const state = { photoUsed: false };
  const events = [];

  // ctx exposed to joker hooks
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

  // 1) base — initial chips/mult shown
  events.push({ kind: 'base', handType: hand.type, level: base.level, snapshot: { chips, mult } });

  // helper that runs hooks across all jokers (handles Blueprint copy)
  const runHook = (hookName, ...args) => {
    const list = run.jokers;
    for (let i = 0; i < list.length; i++) {
      const j = list[i];
      const fn = j.hooks && j.hooks[hookName];
      if (fn) fn.call(j, ...args, ctx);

      // Blueprint: also trigger the hook on the joker to its right
      if (j.id === 'blueprint' && list[i + 1]) {
        const right = list[i + 1];
        const rfn = right.hooks && right.hooks[hookName];
        if (rfn) {
          // visually flash blueprint
          rfn.call(right, ...args, { ...ctx,
            addChips: (n) => { ctx.addChips(n, j); },
            addMult:  (n) => { ctx.addMult(n, j); },
            mulMult:  (n) => { ctx.mulMult(n, j); }
          });
        }
      }
    }
  };

  // 2) once per hand (joker effects that look at hand type)
  runHook('onHandPlayed', hand);

  // 3) for each scoring card: add its chips, then per-card joker hooks
  for (const card of hand.scoringCards) {
    chips += card.chips;
    events.push({
      kind: 'card-chips',
      amount: card.chips,
      card,
      snapshot: { chips, mult }
    });
    runHook('onScoreCard', card);
    // played-card hook fires for *all* played cards, not just scoring;
    // we run that in a separate loop below to keep ordering tidy
  }

  for (const card of hand.played) {
    runHook('onPlayedCard', card);
  }

  // 4) finalize
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
