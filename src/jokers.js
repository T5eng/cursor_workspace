// =============================================================
// jokers.js — joker definitions
//
// Each joker exposes a set of *hooks* that the scorer calls at
// known times. Hooks may mutate `ctx.chips`, `ctx.mult`, or
// `ctx.xmult` (multiplicative), and may push popup events.
//
//   hooks.onScoreCard(card, ctx)   — for each scoring card
//   hooks.onPlayedCard(card, ctx)  — for each played card (even non-scoring)
//   hooks.onHandPlayed(hand, ctx)  — once per hand, before scoring cards
//   hooks.onFinalize(ctx)          — once per hand, after all cards scored
// =============================================================

export const JOKER_DEFS = [
  {
    id: 'joker',
    name: '小丑',
    art: '🃏',
    cost: 2,
    rarity: 'common',
    desc: '+4 倍数',
    hooks: {
      onFinalize(ctx) { ctx.addMult(4, this); }
    }
  },
  {
    id: 'greedy',
    name: '贪婪小丑',
    art: '♦',
    cost: 5,
    rarity: 'common',
    color: '#ff8a3d',
    desc: '每张计分的 ♦ 方块\n+3 倍数',
    hooks: {
      onScoreCard(card, ctx) {
        if (card.suit === '♦') ctx.addMult(3, this);
      }
    }
  },
  {
    id: 'lusty',
    name: '色欲小丑',
    art: '♥',
    cost: 5,
    rarity: 'common',
    color: '#ff5a8a',
    desc: '每张计分的 ♥ 红心\n+3 倍数',
    hooks: {
      onScoreCard(card, ctx) {
        if (card.suit === '♥') ctx.addMult(3, this);
      }
    }
  },
  {
    id: 'wrathful',
    name: '愤怒小丑',
    art: '♠',
    cost: 5,
    rarity: 'common',
    color: '#a5b8d6',
    desc: '每张计分的 ♠ 黑桃\n+3 倍数',
    hooks: {
      onScoreCard(card, ctx) {
        if (card.suit === '♠') ctx.addMult(3, this);
      }
    }
  },
  {
    id: 'gluttonous',
    name: '暴食小丑',
    art: '♣',
    cost: 5,
    rarity: 'common',
    color: '#5ad59b',
    desc: '每张计分的 ♣ 梅花\n+3 倍数',
    hooks: {
      onScoreCard(card, ctx) {
        if (card.suit === '♣') ctx.addMult(3, this);
      }
    }
  },
  {
    id: 'jolly',
    name: '欢乐小丑',
    art: '😄',
    cost: 3,
    rarity: 'common',
    desc: '出牌包含对子时\n+8 倍数',
    hooks: {
      onHandPlayed(hand, ctx) {
        if (['Pair','Two Pair','Three of a Kind','Full House','Four of a Kind'].includes(hand.type))
          ctx.addMult(8, this);
      }
    }
  },
  {
    id: 'zany',
    name: '滑稽小丑',
    art: '🤪',
    cost: 4,
    rarity: 'common',
    desc: '出牌包含三条时\n+12 倍数',
    hooks: {
      onHandPlayed(hand, ctx) {
        if (['Three of a Kind','Full House','Four of a Kind'].includes(hand.type))
          ctx.addMult(12, this);
      }
    }
  },
  {
    id: 'mad',
    name: '疯狂小丑',
    art: '😈',
    cost: 4,
    rarity: 'common',
    desc: '出牌包含两对时\n+10 倍数',
    hooks: {
      onHandPlayed(hand, ctx) {
        if (['Two Pair','Full House'].includes(hand.type))
          ctx.addMult(10, this);
      }
    }
  },
  {
    id: 'crazy',
    name: '狂野小丑',
    art: '🌀',
    cost: 4,
    rarity: 'common',
    desc: '出牌包含顺子时\n+12 倍数',
    hooks: {
      onHandPlayed(hand, ctx) {
        if (['Straight','Straight Flush'].includes(hand.type)) ctx.addMult(12, this);
      }
    }
  },
  {
    id: 'droll',
    name: '诙谐小丑',
    art: '🎭',
    cost: 4,
    rarity: 'common',
    desc: '出牌包含同花时\n+10 倍数',
    hooks: {
      onHandPlayed(hand, ctx) {
        if (['Flush','Straight Flush'].includes(hand.type)) ctx.addMult(10, this);
      }
    }
  },
  {
    id: 'sly',
    name: '狡猾小丑',
    art: '🦊',
    cost: 3,
    rarity: 'common',
    desc: '出牌包含对子时\n+50 筹码',
    hooks: {
      onHandPlayed(hand, ctx) {
        if (['Pair','Two Pair','Three of a Kind','Full House','Four of a Kind'].includes(hand.type))
          ctx.addChips(50, this);
      }
    }
  },
  {
    id: 'wily',
    name: '机敏小丑',
    art: '🦉',
    cost: 4,
    rarity: 'common',
    desc: '出牌包含三条时\n+100 筹码',
    hooks: {
      onHandPlayed(hand, ctx) {
        if (['Three of a Kind','Full House','Four of a Kind'].includes(hand.type))
          ctx.addChips(100, this);
      }
    }
  },
  {
    id: 'devious',
    name: '诡谲小丑',
    art: '🐍',
    cost: 4,
    rarity: 'common',
    desc: '出牌包含顺子时\n+100 筹码',
    hooks: {
      onHandPlayed(hand, ctx) {
        if (['Straight','Straight Flush'].includes(hand.type)) ctx.addChips(100, this);
      }
    }
  },
  {
    id: 'half',
    name: '半个小丑',
    art: '◐',
    cost: 5,
    rarity: 'common',
    desc: '出牌 ≤ 3 张时\n+20 倍数',
    hooks: {
      onHandPlayed(hand, ctx) {
        if (hand.played.length <= 3) ctx.addMult(20, this);
      }
    }
  },
  {
    id: 'even_steven',
    name: '偶数史蒂文',
    art: '2 4 6',
    cost: 4,
    rarity: 'common',
    desc: '每张计分的偶数牌\n(10/8/6/4/2) +4 倍数',
    hooks: {
      onScoreCard(card, ctx) { if (card.isEven) ctx.addMult(4, this); }
    }
  },
  {
    id: 'odd_todd',
    name: '奇数托德',
    art: '3 5 7',
    cost: 4,
    rarity: 'common',
    desc: '每张计分的奇数牌\n(A/9/7/5/3) +31 筹码',
    hooks: {
      onScoreCard(card, ctx) { if (card.isOdd) ctx.addChips(31, this); }
    }
  },
  {
    id: 'scholar',
    name: '学者',
    art: '🎓',
    cost: 4,
    rarity: 'common',
    desc: '每张计分的 A\n+20 筹码, +4 倍数',
    hooks: {
      onScoreCard(card, ctx) {
        if (card.isAce) { ctx.addChips(20, this); ctx.addMult(4, this); }
      }
    }
  },
  {
    id: 'fibonacci',
    name: '斐波那契',
    art: 'φ',
    cost: 8,
    rarity: 'uncommon',
    desc: '每张计分的 A/2/3/5/8\n+8 倍数',
    hooks: {
      onScoreCard(card, ctx) {
        if (['A','2','3','5','8'].includes(card.rank)) ctx.addMult(8, this);
      }
    }
  },
  {
    id: 'banner',
    name: '横幅小丑',
    art: '🚩',
    cost: 5,
    rarity: 'common',
    desc: '每剩余 1 次弃牌\n+30 筹码',
    hooks: {
      onFinalize(ctx) {
        const n = ctx.run.discardsLeft;
        if (n > 0) ctx.addChips(30 * n, this);
      }
    }
  },
  {
    id: 'mystic',
    name: '神秘巅峰',
    art: '⛰',
    cost: 5,
    rarity: 'common',
    desc: '当 0 次弃牌剩余时\n+15 倍数',
    hooks: {
      onFinalize(ctx) {
        if (ctx.run.discardsLeft === 0) ctx.addMult(15, this);
      }
    }
  },
  {
    id: 'abstract',
    name: '抽象小丑',
    art: '◈',
    cost: 4,
    rarity: 'common',
    desc: '每持有一个小丑\n+3 倍数',
    hooks: {
      onFinalize(ctx) {
        const n = ctx.run.jokers.length;
        if (n > 0) ctx.addMult(3 * n, this);
      }
    }
  },
  {
    id: 'photograph',
    name: '相机小丑',
    art: '📷',
    cost: 5,
    rarity: 'uncommon',
    desc: '本手中第一张计分的\n人头牌获得 ×2 倍数',
    hooks: {
      onScoreCard(card, ctx) {
        if (card.isFace && !ctx.state.photoUsed) {
          ctx.state.photoUsed = true;
          ctx.mulMult(2, this);
        }
      },
      onHandPlayed() { /* photoUsed reset by scorer per hand */ }
    }
  },
  {
    id: 'baseball',
    name: '棒球小丑',
    art: '⚾',
    cost: 8,
    rarity: 'uncommon',
    desc: '每个稀有小丑提供\n×1.5 倍数',
    hooks: {
      onFinalize(ctx) {
        const n = ctx.run.jokers.filter(j => j.rarity === 'uncommon').length;
        for (let i = 0; i < n; i++) ctx.mulMult(1.5, this);
      }
    }
  },
  {
    id: 'blueprint',
    name: '蓝图',
    art: '📐',
    cost: 10,
    rarity: 'rare',
    desc: '复制紧邻右侧小丑\n的效果',
    hooks: {
      // implemented by scorer: when iterating, if joker is blueprint, also re-run neighbor
    }
  }
];

export const JOKERS_BY_ID = Object.fromEntries(JOKER_DEFS.map(j => [j.id, j]));

// Map rarity -> draw weight for the shop
const RARITY_WEIGHTS = { common: 70, uncommon: 25, rare: 5 };

export function rollShopJokers(n, ownedIds = new Set(), rng = Math.random) {
  const pool = JOKER_DEFS.filter(j => !ownedIds.has(j.id));
  const out = [];
  for (let i = 0; i < n; i++) {
    if (pool.length === 0) break;
    const totalWeight = pool.reduce((s, j) => s + (RARITY_WEIGHTS[j.rarity] || 1), 0);
    let r = rng() * totalWeight;
    let pick = pool[0];
    for (const j of pool) {
      r -= RARITY_WEIGHTS[j.rarity] || 1;
      if (r <= 0) { pick = j; break; }
    }
    out.push(pick);
    const idx = pool.indexOf(pick);
    if (idx >= 0) pool.splice(idx, 1);
  }
  return out;
}
