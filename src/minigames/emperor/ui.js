// 嘉靖朝皇帝生存跑团 · UI

import {
  defaultState,
  loadSave,
  saveGame,
  clearSave,
  seasonLabel,
  checkGameOver,
  checkVictory,
  advanceSeason,
  pushLog,
  STAT_KEYS,
  STAT_LABELS,
  CATEGORY_LABELS,
  VICTORY_YEARS,
  START_YEAR,
  completedChapters,
  checkSuccessChance,
  normalizeDc,
  statMod
} from './engine.js';
import { INTRO, pickEvent, resolveChoice, markStoryProgress } from './events.js';
import { NPC_LABELS } from './story-events.js';
import { applyBackdrop } from './backgrounds.js';

let root = null;
let backdrop = null;
let sceneLabel = null;
let state = defaultState();

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatParagraphs(text) {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function statBarClass(value, key) {
  if (key === 'suspicion') {
    if (value >= 75) return 'danger';
    if (value >= 50) return 'warn';
    return '';
  }
  if (value <= 20) return 'danger';
  if (value <= 40) return 'warn';
  return '';
}

function setRootMode(mode) {
  root?.classList.remove('rpg-mode-play', 'rpg-mode-intro', 'rpg-mode-result');
  if (mode) root?.classList.add(`rpg-mode-${mode}`);
}

function updateScene() {
  applyBackdrop(backdrop, state);
  if (sceneLabel) {
    const labelEl = backdrop?.querySelector('.rpg-backdrop-label');
    sceneLabel.textContent = labelEl?.textContent || '';
    sceneLabel.classList.toggle('hidden', !labelEl?.textContent);
  }
}

function render() {
  if (!root) return;

  if (state.phase === 'intro') {
    setRootMode('intro');
    renderIntro();
    return;
  }
  if (state.phase === 'result') {
    setRootMode('result');
    renderResult();
    return;
  }
  setRootMode('play');
  renderPlay();
}

function finishRender() {
  updateScene();
}

function renderIntro() {
  root.innerHTML = `
    <div class="rpg-panel rpg-intro">
      <p class="rpg-era">${escapeHtml(INTRO.era)}</p>
      <h2 class="rpg-title">${escapeHtml(INTRO.title)}</h2>
      <div class="rpg-intro-body">
        ${INTRO.paragraphs.map(p => `<p>${formatParagraphs(p)}</p>`).join('')}
      </div>
      <div class="mg-actions">
        <button type="button" class="btn btn-play" id="rpgStart">
          <span class="btn-main">临朝听政</span>
          <span class="btn-sub">开始跑团</span>
        </button>
        <button type="button" class="btn btn-sort hidden" id="rpgContinue">
          <span class="btn-main">续统江山</span>
          <span class="btn-sub">读取存档</span>
        </button>
      </div>
    </div>
  `;

  const saved = loadSave();
  const cont = root.querySelector('#rpgContinue');
  if (saved?.phase === 'play') {
    cont?.classList.remove('hidden');
    cont?.addEventListener('click', () => {
      state = { ...saved, currentEvent: null, pendingOutcome: null, lastRoll: null, phase: 'play' };
      beginTurn();
    });
  }

  root.querySelector('#rpgStart')?.addEventListener('click', () => {
    clearSave();
    state = defaultState();
    state.phase = 'play';
    beginTurn();
  });
  finishRender();
}

function renderPlay() {
  const ev = state.currentEvent;
  const outcome = state.pendingOutcome;
  const roll = state.lastRoll;
  const yearsLeft = Math.max(0, VICTORY_YEARS - (state.year - START_YEAR));
  const chapters = completedChapters(state);
  const prologueDone = (state.storyStep ?? 0) >= 3;

  root.innerHTML = `
    <div class="rpg-panel rpg-play">
      <header class="rpg-header">
        <div class="rpg-time">${escapeHtml(seasonLabel(state))}</div>
        <div class="rpg-goal">
          主线 <strong>${chapters}</strong>/7 · 距中兴约 <strong>${yearsLeft}</strong> 年
          ${!prologueDone ? ' · <span class="rpg-prologue">序章</span>' : ''}
        </div>
      </header>

      <section class="rpg-stats rpg-stats-bar" id="rpgStats" aria-label="国运六维"></section>

      <details class="rpg-meta">
        <summary class="rpg-meta-summary">人物关系</summary>
        <div class="rpg-npc-grid" id="rpgNpc"></div>
      </details>

      <div class="rpg-scroll">
        ${ev ? `
          <article class="rpg-event${ev.story ? ' rpg-event-story' : ''}">
            <span class="rpg-cat rpg-cat-${ev.category}">${escapeHtml(CATEGORY_LABELS[ev.category] || ev.category)}${ev.story ? ' · 主线' : ''}</span>
            <h3 class="rpg-event-title">${escapeHtml(ev.title)}</h3>
            <p class="rpg-event-text">${escapeHtml(ev.text)}</p>
          </article>
        ` : ''}

        ${outcome ? `
          <div class="rpg-outcome">
            <div class="rpg-outcome-label">后果</div>
            <p>${escapeHtml(outcome)}</p>
            ${roll ? renderRoll(roll) : ''}
          </div>
        ` : ''}

        <details class="rpg-log">
          <summary>起居注</summary>
          <ul>${state.log.map(l => `<li>${escapeHtml(l)}</li>`).join('') || '<li>（尚无记录）</li>'}</ul>
        </details>
      </div>

      <footer class="rpg-choices-dock" id="rpgChoices" aria-label="抉择"></footer>
    </div>
  `;

  const statsEl = root.querySelector('#rpgStats');
  for (const key of STAT_KEYS) {
    const v = state.stats[key];
    const row = document.createElement('div');
    row.className = `rpg-stat-row ${statBarClass(v, key)}`;
    row.dataset.stat = key;
    row.innerHTML = `
      <div class="rpg-stat-head">
        <span class="rpg-stat-name">${STAT_LABELS[key]}</span>
        <span class="rpg-stat-val">${v}</span>
      </div>
      <div class="rpg-stat-bar" role="meter" aria-valuenow="${v}" aria-valuemin="0" aria-valuemax="100" aria-label="${STAT_LABELS[key]}">
        <div class="rpg-stat-fill" style="width:${v}%"></div>
      </div>
    `;
    statsEl.appendChild(row);
  }

  const npcEl = root.querySelector('#rpgNpc');
  const npc = state.npc || {};
  for (const [key, label] of Object.entries(NPC_LABELS)) {
    if (npc[key] == null) continue;
    const v = npc[key];
    const item = document.createElement('div');
    item.className = `rpg-npc-item${v < -20 ? ' hostile' : v > 20 ? ' allied' : ''}`;
    item.innerHTML = `
      <span class="rpg-npc-name">${escapeHtml(label)}</span>
      <span class="rpg-npc-val">${v > 0 ? '+' : ''}${v}</span>
    `;
    npcEl.appendChild(item);
  }

  const choicesEl = root.querySelector('#rpgChoices');
  if (outcome) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-play';
    btn.innerHTML = '<span class="btn-main">进入下一季</span>';
    btn.addEventListener('click', onNextSeason);
    choicesEl.appendChild(btn);
  } else if (ev?.choices) {
    ev.choices.forEach((c, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-sort rpg-choice-btn';
      btn.innerHTML = `<span class="btn-main">${escapeHtml(c.label)}</span>`;
      if (c.check) {
        const sub = document.createElement('span');
        sub.className = 'btn-sub';
        const stat = c.check.stat;
        const val = state.stats[stat];
        const dc = normalizeDc(c.check.dc);
        const mod = statMod(val, stat);
        const pct = Math.round(checkSuccessChance(val, c.check.dc, stat) * 100);
        sub.textContent = `检定：1d20${mod >= 0 ? '+' : ''}${mod} ≥ ${dc}（${STAT_LABELS[stat]} ${val} · 约 ${pct}%）`;
        btn.appendChild(sub);
      }
      btn.addEventListener('click', () => onChoose(i));
      choicesEl.appendChild(btn);
    });
  }

  root.querySelector('.rpg-scroll')?.scrollTo(0, 0);
  finishRender();
}

function renderRoll(roll) {
  const mod = roll.mod ?? roll.bonus;
  const statName = roll.statKey ? STAT_LABELS[roll.statKey] : '属性';
  return `
    <p class="rpg-roll ${roll.success ? 'ok' : 'fail'}">
      🎲 检定 ${roll.success ? '成功' : '失败'}：
      1d20(${roll.die}) ${mod >= 0 ? '+' : ''}${mod}（${statName} 调整）= ${roll.total}
      ${roll.success ? '≥' : '<'} DC ${roll.dc}
    </p>
  `;
}

function renderResult() {
  const end = state.ending || {};
  root.innerHTML = `
    <div class="rpg-panel rpg-result">
      <h2 class="rpg-end-title">${escapeHtml(end.title || '结局')}</h2>
      <p class="rpg-end-text">${escapeHtml(end.text || '')}</p>
      <p class="rpg-end-meta">在位 ${state.year - START_YEAR} 年又 ${state.seasonIndex + 1} 季 · 共 ${state.turn} 回合</p>
      <div class="mg-actions">
        <button type="button" class="btn btn-play" id="rpgRestart">
          <span class="btn-main">重开一世</span>
        </button>
      </div>
    </div>
  `;
  root.querySelector('#rpgRestart')?.addEventListener('click', () => {
    clearSave();
    state = defaultState();
    render();
  });
  finishRender();
}

function beginTurn() {
  const event = pickEvent(state);
  const ids = [event.id, ...state.lastEventIds].slice(0, 4);
  state = {
    ...state,
    currentEvent: event,
    lastEventIds: ids,
    pendingOutcome: null,
    lastRoll: null
  };
  state = pushLog(state, `${seasonLabel(state)}：${event.title}`);
  saveGame(state);
  render();
}

function onChoose(index) {
  const ev = state.currentEvent;
  const { state: next, narrative } = resolveChoice(state, ev, index);
  state = markStoryProgress(next, ev);
  state = pushLog(state, narrative.slice(0, 56));
  const over = checkGameOver(state);
  if (over) {
    state.phase = 'result';
    state.ending = over;
    clearSave();
    render();
    return;
  }
  saveGame(state);
  render();
}

function onNextSeason() {
  state = {
    ...state,
    pendingOutcome: null,
    lastRoll: null,
    currentEvent: null
  };

  const over = checkGameOver(state);
  if (over) {
    state.phase = 'result';
    state.ending = over;
    clearSave();
    render();
    return;
  }

  const win = checkVictory(state);
  if (win && !state.flags.victory_shown) {
    state.flags.victory_shown = true;
    state = pushLog(state, win.title);
    state.ending = { ...win, victory: true };
    // continue playing after victory message once
    state = advanceSeason(state);
    state.pendingOutcome = win.text;
    saveGame(state);
    render();
    return;
  }

  state = advanceSeason(state);
  const over2 = checkGameOver(state);
  if (over2) {
    state.phase = 'result';
    state.ending = over2;
    clearSave();
    render();
    return;
  }

  beginTurn();
}

function migrateSave(saved) {
  const base = defaultState();
  return {
    ...base,
    ...saved,
    storyStep: saved.storyStep ?? 0,
    storyBeats: saved.storyBeats ?? {},
    npc: { ...base.npc, ...(saved.npc || {}) }
  };
}

export function bootEmperorRpg(container) {
  root = container;
  backdrop = document.getElementById('rpgBackdrop');
  sceneLabel = document.getElementById('rpgSceneLabel');
  if (backdrop && !backdrop.querySelector('.rpg-backdrop-label')) {
    const lbl = document.createElement('span');
    lbl.className = 'rpg-backdrop-label';
    lbl.setAttribute('aria-hidden', 'true');
    backdrop.appendChild(lbl);
  }
  const saved = loadSave();
  if (saved?.phase === 'play') {
    state = migrateSave(saved);
    state.phase = 'intro';
  } else {
    state = defaultState();
  }
  render();
}

export function unmountEmperorRpg() {
  if (state.phase === 'play') saveGame(state);
  root = null;
  backdrop = null;
  sceneLabel = null;
}
