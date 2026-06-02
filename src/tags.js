// Skip tags — rewards for skipping Small / Big blind (Balatro-inspired)
export const TAG_DEFS = {
  investment: {
    id: 'investment',
    name: '投资标签',
    desc: '获得 $6',
    apply(run) { run.money += 6; }
  },
  orbital: {
    id: 'orbital',
    name: '轨道标签',
    desc: '随机牌型等级 +1',
    apply(run, rng = Math.random) {
      const types = Object.keys(run.levels);
      const t = types[Math.floor(rng() * types.length)];
      run.levels[t] = (run.levels[t] || 1) + 1;
      run.lastTagDetail = `轨道：${t} +1`;
    }
  },
  handy: {
    id: 'handy',
    name: '顺手标签',
    desc: '下轮 +1 出牌次数',
    apply(run) { run.bonusHandsNextBlind = (run.bonusHandsNextBlind || 0) + 1; }
  },
  garbage: {
    id: 'garbage',
    name: '垃圾标签',
    desc: '下轮 +1 弃牌次数',
    apply(run) { run.bonusDiscardsNextBlind = (run.bonusDiscardsNextBlind || 0) + 1; }
  },
  coupon: {
    id: 'coupon',
    name: '优惠券标签',
    desc: '下店所有商品 -$2（最低 $1）',
    apply(run) { run.shopDiscount = 2; }
  },
  planet: {
    id: 'planet',
    name: '星球标签',
    desc: '下店赠送随机星球牌',
    apply(run) { run.freePlanetNextShop = true; }
  }
};

const TAG_POOL = ['investment', 'orbital', 'handy', 'garbage', 'coupon', 'planet'];

export function rollSkipTag(rng = Math.random) {
  const id = TAG_POOL[Math.floor(rng() * TAG_POOL.length)];
  return TAG_DEFS[id];
}
