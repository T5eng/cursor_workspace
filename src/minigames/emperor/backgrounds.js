// 跑团场景背景解析

const CATEGORY_SCENE = {
  palace: 'palace',
  power: 'power',
  war: 'war',
  disaster: 'disaster',
  mystic: 'mystic'
};

/** 特定事件 / 章节优先 */
const EVENT_SCENE = {
  story_opening: 'prologue-rain',
  story_palace_echo: 'palace-night',
  story_omen: 'mystic-temple',
  chapter_yansong_peak: 'power-court',
  chapter_wokou_climax: 'war-coast',
  chapter_empress_crisis: 'palace-fire',
  chapter_hairui: 'power-memorial',
  chapter_elixir_crisis: 'mystic-dan',
  chapter_purge_yansong: 'power-purge',
  chapter_final_choice: 'finale-heaven',
  story_famine_child: 'disaster-famine',
  story_prophecy_lan: 'mystic-omen',
  story_border_letter: 'war-coast',
  assassin_attempt: 'palace-night',
  elixir_poison: 'mystic-dan',
  comet_omen: 'mystic-omen',
  plague_beijing: 'disaster-plague',
  famine_rebellion: 'disaster-famine',
  wokou_raid: 'war-coast',
  mongol_border: 'war',
  drought_north: 'disaster-famine',
  yellow_river: 'disaster-flood',
  dream_ancestor: 'mystic-temple'
};

const BEAT_SCENE = {
  chapter_yansong_peak: 'power-court',
  chapter_wokou: 'war-coast',
  chapter_empress: 'palace-fire',
  chapter_hairui: 'power-memorial',
  chapter_elixir: 'mystic-dan',
  chapter_purge: 'power-purge',
  chapter_finale: 'finale-heaven'
};

export const SCENE_LABELS = {
  intro: '西苑初雨',
  palace: '紫禁宫墙',
  'palace-night': '深宫夜雨',
  'palace-fire': '坤宁宫火',
  power: '朝堂风云',
  'power-court': '严党顶峰',
  'power-memorial': '言官死谏',
  'power-purge': '倒严诏狱',
  war: '边关烽火',
  'war-coast': '东南抗倭',
  disaster: '天灾降临',
  'disaster-famine': '赤地千里',
  'disaster-flood': '黄河决口',
  'disaster-plague': '京城瘟疫',
  mystic: '方术玄奇',
  'mystic-temple': '斋醮道观',
  'mystic-dan': '丹炉铅汞',
  'mystic-omen': '彗星守心',
  'prologue-rain': '序章·夜雨',
  'finale-heaven': '终章·问天',
  'result-win': '中兴之世',
  'result-death': '龙驭宾天'
};

export function resolveScene(state) {
  if (state.phase === 'intro') {
    return { scene: 'intro', mood: null };
  }
  if (state.phase === 'result') {
    const won = Boolean(state.ending?.won || state.ending?.victory);
    const dead = Boolean(state.ending?.dead);
    if (won) return { scene: 'result-win', mood: null };
    if (dead) return { scene: 'result-death', mood: 'roll-fail' };
    return { scene: 'result-death', mood: null };
  }

  const ev = state.currentEvent;
  let scene = 'power';
  let mood = null;

  if (state.pendingOutcome && state.lastRoll) {
    mood = state.lastRoll.success ? 'roll-ok' : 'roll-fail';
  }

  if (ev) {
    scene = EVENT_SCENE[ev.id]
      || (ev.beat && BEAT_SCENE[ev.beat])
      || CATEGORY_SCENE[ev.category]
      || scene;
  }

  return { scene, mood };
}

export function sceneImageUrl(scene) {
  return `./assets/rpg/${scene}.svg`;
}

export function applyBackdrop(backdropEl, state) {
  if (!backdropEl) return;
  const { scene, mood } = resolveScene(state);
  const img = backdropEl.querySelector('.rpg-backdrop-img');
  const moodEl = backdropEl.querySelector('.rpg-backdrop-mood');
  const label = backdropEl.querySelector('.rpg-backdrop-label');

  if (img) {
    img.dataset.scene = scene;
    img.style.backgroundImage = `url(${sceneImageUrl(scene)})`;
  }
  if (moodEl) {
    moodEl.dataset.mood = mood || '';
    moodEl.classList.toggle('active', Boolean(mood));
  }
  if (label) {
    const extra = mood === 'roll-ok' ? ' · 检定成功' : mood === 'roll-fail' ? ' · 检定失败' : '';
    label.textContent = (SCENE_LABELS[scene] || scene) + extra;
  }
  backdropEl.dataset.scene = scene;
  backdropEl.classList.add('rpg-backdrop-visible');
}
