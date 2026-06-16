// Boss blinds — score multipliers and round debuffs (Balatro)
import { HAND_LABELS } from './cards.js';

export const BOSS_BLINDS = [
  { id: 'hook',     name: 'The Hook',     nameZh: '钩爪',     minAnte: 1, scoreMult: 2,
    desc: '每次出牌后随机弃掉 2 张手牌' },
  { id: 'club',     name: 'The Club',     nameZh: '梅花',     minAnte: 1, scoreMult: 2,
    desc: '所有 ♣ 牌被削弱（不计分）', debuffSuit: '♣' },
  { id: 'head',     name: 'The Head',     nameZh: '红心',     minAnte: 1, scoreMult: 2,
    desc: '所有 ♥ 牌被削弱', debuffSuit: '♥' },
  { id: 'goad',     name: 'The Goad',     nameZh: '黑桃',     minAnte: 1, scoreMult: 2,
    desc: '所有 ♠ 牌被削弱', debuffSuit: '♠' },
  { id: 'window',   name: 'The Window',   nameZh: '方片',     minAnte: 1, scoreMult: 2,
    desc: '所有 ♦ 牌被削弱', debuffSuit: '♦' },
  { id: 'psychic',  name: 'The Psychic',  nameZh: '灵媒',     minAnte: 1, scoreMult: 2,
    desc: '必须出 5 张牌' },
  { id: 'water',    name: 'The Water',    nameZh: '止水',     minAnte: 2, scoreMult: 2,
    desc: '本回合 0 次弃牌' },
  { id: 'manacle',  name: 'The Manacle',  nameZh: '镣铐',     minAnte: 1, scoreMult: 2,
    desc: '手牌上限 -1' },
  { id: 'needle',   name: 'The Needle',   nameZh: '针尖',     minAnte: 2, scoreMult: 1,
    desc: '只能出 1 手牌' },
  { id: 'flint',    name: 'The Flint',    nameZh: '燧石',     minAnte: 2, scoreMult: 2,
    desc: '牌型基础筹码与倍数减半' },
  { id: 'arm',      name: 'The Arm',      nameZh: '铁臂',     minAnte: 2, scoreMult: 2,
    desc: '出牌牌型等级 -1（最低 1）' },
  { id: 'mouth',    name: 'The Mouth',    nameZh: '之口',     minAnte: 2, scoreMult: 2,
    desc: '本回合只能出一种牌型' },
  { id: 'eye',      name: 'The Eye',      nameZh: '之眼',     minAnte: 3, scoreMult: 2,
    desc: '本回合不可重复牌型' },
  { id: 'plant',    name: 'The Plant',    nameZh: '植株',     minAnte: 4, scoreMult: 2,
    desc: '所有人头牌 (J/Q/K) 被削弱' },
  { id: 'tooth',    name: 'The Tooth',    nameZh: '利齿',     minAnte: 3, scoreMult: 2,
    desc: '每出 1 张牌失去 $1' },
  { id: 'wall',     name: 'The Wall',     nameZh: '高墙',     minAnte: 2, scoreMult: 4,
    desc: '目标分数 ×4' },
  { id: 'pillar',   name: 'The Pillar',   nameZh: '石柱',     minAnte: 1, scoreMult: 2,
    desc: '本 ante 小/大盲出过的牌被削弱' }
];

export const SHOWDOWN_BOSSES = [
  { id: 'violet_vessel', name: 'Violet Vessel', nameZh: '紫晶之器', minAnte: 8, scoreMult: 6,
    desc: '目标分数 ×6（终局 Boss）' },
  { id: 'cerulean_bell', name: 'Cerulean Bell', nameZh: '青铃', minAnte: 8, scoreMult: 2,
    desc: '强制始终选中 1 张牌' },
  { id: 'crimson_heart', name: 'Crimson Heart', nameZh: '赤心', minAnte: 8, scoreMult: 2,
    desc: '每手随机禁用 1 张小丑' }
];

export function rollBossBlind(run, rng = Math.random) {
  const pool = (run.ante >= 8 ? SHOWDOWN_BOSSES : BOSS_BLINDS)
    .filter(b => run.ante >= b.minAnte);
  const unseen = pool.filter(b => !run.seenBosses.has(b.id));
  const pickFrom = unseen.length ? unseen : pool;
  const boss = { ...pickFrom[Math.floor(rng() * pickFrom.length)] };
  run.seenBosses.add(boss.id);
  return boss;
}

export function bossScoreMult(boss, blindKey) {
  if (!boss) {
    if (blindKey === 'small') return 1;
    if (blindKey === 'big') return 1.5;
    return 2;
  }
  return boss.scoreMult ?? 2;
}

export function applyBossRoundStart(run) {
  run.bossRound = {
    mouthLockedType: null,
    eyeUsedTypes: new Set(),
    disabledJokerIndex: null
  };
  if (!run.boss) return;

  const b = run.boss;
  if (b.debuffSuit) {
    for (const c of run.deck) {
      if (c.suit === b.debuffSuit) c.debuffed = true;
    }
  }
  if (b.id === 'plant') {
    for (const c of run.deck) {
      if (c.isFace) c.debuffed = true;
    }
  }
  if (b.id === 'pillar' && run.pillarPlayedIds) {
    for (const c of run.deck) {
      if (run.pillarPlayedIds.has(c.id)) c.debuffed = true;
    }
  }
  if (b.id === 'crimson_heart' && run.jokers.length) {
    run.bossRound.disabledJokerIndex = Math.floor(Math.random() * run.jokers.length);
  }
}

export function clearBossCardDebuffs(run) {
  for (const c of run.deck) c.debuffed = false;
}

export function validateBossPlay(run, playedCards, handType) {
  const b = run.boss;
  if (!b) return { ok: true };

  if (b.id === 'psychic' && playedCards.length !== 5) {
    return { ok: false, reason: '灵媒 Boss：必须出 5 张牌' };
  }
  if (b.id === 'mouth') {
    if (!run.bossRound.mouthLockedType) run.bossRound.mouthLockedType = handType;
    else if (run.bossRound.mouthLockedType !== handType) {
      return { ok: false, reason: `之口 Boss：本回合只能出 ${HAND_LABELS[run.bossRound.mouthLockedType]}` };
    }
  }
  if (b.id === 'eye' && run.bossRound.eyeUsedTypes.has(handType)) {
    return { ok: false, reason: '之眼 Boss：不可重复牌型' };
  }
  return { ok: true };
}

export function afterBossHandPlayed(run, playedCards, handType) {
  const b = run.boss;
  if (!b) return;

  if (b.id === 'eye') run.bossRound.eyeUsedTypes.add(handType);
  if (b.id === 'tooth') {
    run.money = Math.max(0, run.money - playedCards.length);
  }
  if (b.id === 'hook' && run.hand.length > 0) {
    const n = Math.min(2, run.hand.length);
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(Math.random() * run.hand.length);
      const [c] = run.hand.splice(idx, 1);
      run.discardPile.push(c);
    }
  }
}

export function getRoundHandSize(run) {
  let size = 8;
  if (run.boss?.id === 'manacle') size -= 1;
  return Math.max(1, size);
}

export function getRoundHands(run) {
  let h = 4;
  if (run.boss?.id === 'needle') h = 1;
  h += run.bonusHandsNextBlind || 0;
  return h;
}

export function getRoundDiscards(run) {
  let d = 3;
  if (run.boss?.id === 'water') d = 0;
  d += run.bonusDiscardsNextBlind || 0;
  return d;
}
