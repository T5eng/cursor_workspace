// 嘉靖朝皇帝生存跑团 · 核心引擎

export const SAVE_KEY = 'emperor_rpg_save_v2';
export const SEASONS = ['春', '夏', '秋', '冬'];
export const STAT_KEYS = ['health', 'prestige', 'treasury', 'military', 'morale', 'suspicion'];
export const STAT_LABELS = {
  health: '龙体',
  prestige: '威信',
  treasury: '国库',
  military: '军威',
  morale: '民心',
  suspicion: '猜忌'
};
export const CATEGORY_LABELS = {
  palace: '宫斗',
  power: '权斗',
  war: '战争',
  disaster: '天灾',
  mystic: '玄学'
};

export const START_YEAR = 21; // 嘉靖二十一年
export const VICTORY_YEARS = 12; // 再活十二年算通关

export function defaultState() {
  return {
    phase: 'intro', // intro | play | result
    year: START_YEAR,
    seasonIndex: 0,
    turn: 0,
    stats: {
      health: 78,
      prestige: 52,
      treasury: 48,
      military: 58,
      morale: 42,
      suspicion: 28
    },
    bankruptStreak: 0,
    currentEvent: null,
    lastEventIds: [],
    log: [],
    flags: {},
    storyStep: 0,
    storyBeats: {},
    npc: {
      yansong: -15,
      xujie: 10,
      taizi: 25,
      empress: 5,
      qijiguang: 0,
      hairui: 0,
      taoist: -5
    },
    ending: null,
    lastRoll: null,
    pendingOutcome: null
  };
}

export function clampStat(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function applyEffects(stats, effects = {}) {
  const next = { ...stats };
  for (const key of STAT_KEYS) {
    if (effects[key] != null) next[key] = clampStat(next[key] + effects[key]);
  }
  return next;
}

export function applyNpc(npc, changes = {}) {
  const next = { ...npc };
  for (const [k, v] of Object.entries(changes)) {
    if (next[k] != null) next[k] = Math.max(-100, Math.min(100, Math.round(next[k] + v)));
  }
  return next;
}

export function completedChapters(state) {
  return Object.keys(state.storyBeats || {}).length;
}

export function rollCheck(statValue, dc) {
  const die = Math.floor(Math.random() * 20) + 1;
  const bonus = Math.floor(statValue / 5);
  const total = die + bonus;
  return {
    die,
    bonus,
    total,
    dc,
    statValue,
    success: total >= dc
  };
}

export function yearLabel(year) {
  return `嘉靖${toChineseYear(year)}年`;
}

function toChineseYear(n) {
  const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  if (n <= 10) return n === 10 ? '十' : digits[n];
  if (n < 20) return `十${digits[n - 10]}`;
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return `${digits[tens]}十${ones ? digits[ones] : ''}`;
}

export function seasonLabel(state) {
  return `${yearLabel(state.year)}·${SEASONS[state.seasonIndex]}`;
}

export function checkGameOver(state) {
  const s = state.stats;
  if (s.health <= 0) {
    return { dead: true, key: 'health', title: '龙驭宾天', text: '丹药与劳碌终于拖垮了龙体。内廷秘不发丧，诸王与权臣已在盘算新主。' };
  }
  if (s.suspicion >= 100) {
    return { dead: true, key: 'suspicion', title: '深宫惊变', text: '你疑神疑鬼、屠戮过甚，终有人在月黑风高之夜推开寝殿之门。' };
  }
  if (s.prestige <= 0 && s.morale <= 15) {
    return { dead: true, key: 'coup', title: '宫门失火', text: '威信扫地、民怨沸腾，京师暴民与边军同时逼近紫禁城，你的天子剑未能出鞘。' };
  }
  if (s.military <= 0) {
    return { dead: true, key: 'war', title: '胡马渡江', text: '边防崩溃，敌军直逼畿辅。朝堂无人替你督师，你只能看着城破。' };
  }
  if (state.bankruptStreak >= 3) {
    return { dead: true, key: 'treasury', title: '国库枯竭', text: '连年内帑空虚，宦官与权臣索性另立傀儡。史书上，你成了「久居深宫、不问世事」的昏君。' };
  }
  return null;
}

export function checkVictory(state) {
  const yearsRuled = state.year - START_YEAR + (state.seasonIndex + 1) / 4;
  if (yearsRuled >= VICTORY_YEARS && state.stats.health > 30) {
    return {
      won: true,
      title: '中兴之世',
      text: `你在位已满 ${VICTORY_YEARS} 年，严嵩渐衰、边患稍平，史官开始称颂「嘉靖中兴」。你仍需谨慎——帝王之路没有真正的终点。`
    };
  }
  return null;
}

export function advanceSeason(state) {
  let seasonIndex = state.seasonIndex + 1;
  let year = state.year;
  if (seasonIndex >= SEASONS.length) {
    seasonIndex = 0;
    year += 1;
  }
  const bankruptStreak = state.stats.treasury <= 5
    ? state.bankruptStreak + 1
    : 0;
  return { ...state, seasonIndex, year, turn: state.turn + 1, bankruptStreak };
}

export function pushLog(state, line) {
  const log = [line, ...state.log].slice(0, 24);
  return { ...state, log };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.stats) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveGame(state) {
  const payload = { ...state, currentEvent: null, pendingOutcome: null, lastRoll: null };
  localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}
