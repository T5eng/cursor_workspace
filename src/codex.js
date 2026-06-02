// =============================================================
// codex.js — 图鉴进度（localStorage 持久化）
// 状态：unknown 未抽出 | seen 商店已刷出 | obtained 已获得
// =============================================================

import { JOKER_DEFS } from './jokers.js';
import { PLANET_DEFS } from './planets.js';
import { HAND_TYPES, HAND_LABELS, HAND_BASE, SECRET_HANDS } from './cards.js';

const STORAGE_KEY = 'joker-cards-codex-v1';

const BASE_HAND_IDS = HAND_TYPES.filter(t => !SECRET_HANDS.has(t));

function emptyStore() {
  return {
    jokers: { seen: [], obtained: [] },
    planets: { seen: [], obtained: [] },
    hands: { seen: [], obtained: [] }
  };
}

function storage() {
  return typeof localStorage !== 'undefined' ? localStorage : null;
}

function loadStore() {
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const data = JSON.parse(raw);
    return {
      jokers: {
        seen: data.jokers?.seen || [],
        obtained: data.jokers?.obtained || []
      },
      planets: {
        seen: data.planets?.seen || [],
        obtained: data.planets?.obtained || []
      },
      hands: {
        seen: data.hands?.seen || [],
        obtained: data.hands?.obtained || []
      }
    };
  } catch {
    return emptyStore();
  }
}

let store = loadStore();

function save() {
  storage()?.setItem(STORAGE_KEY, JSON.stringify(store));
}

function add(setKey, category, id) {
  const bucket = store[category][setKey];
  if (!bucket.includes(id)) {
    bucket.push(id);
    save();
  }
}

export function markJokerSeen(id) { add('seen', 'jokers', id); }
export function markJokerObtained(id) {
  markJokerSeen(id);
  add('obtained', 'jokers', id);
}

export function markPlanetSeen(id) { add('seen', 'planets', id); }
export function markPlanetObtained(id) {
  markPlanetSeen(id);
  add('obtained', 'planets', id);
}

export function markHandSeen(handType) { add('seen', 'hands', handType); }
export function markHandObtained(handType) {
  markHandSeen(handType);
  add('obtained', 'hands', handType);
}

export function markShopOffer(shop) {
  if (!shop) return;
  for (const j of shop.jokers || []) markJokerSeen(j.id);
  for (const p of shop.planets || []) markPlanetSeen(p.id);
}

/** 同步到当局 run.discoveredHands（星球池 / 图鉴显示） */
export function syncDiscoveredHandsToRun(run) {
  if (!run.discoveredHands) run.discoveredHands = new Set();
  for (const id of BASE_HAND_IDS) run.discoveredHands.add(id);
  for (const h of store.hands.obtained) run.discoveredHands.add(h);
  for (const h of store.hands.seen) run.discoveredHands.add(h);
}

export function getEntryState(category, id) {
  const s = store[category];
  if (s.obtained.includes(id)) return 'obtained';
  if (s.seen.includes(id)) return 'seen';
  return 'unknown';
}

export function getStats() {
  const total =
    JOKER_DEFS.length + PLANET_DEFS.length + HAND_TYPES.length;
  let obtained = 0;
  let seen = 0;
  for (const j of JOKER_DEFS) {
    const st = getEntryState('jokers', j.id);
    if (st === 'obtained') obtained++;
    else if (st === 'seen') seen++;
  }
  for (const p of PLANET_DEFS) {
    const st = getEntryState('planets', p.id);
    if (st === 'obtained') obtained++;
    else if (st === 'seen') seen++;
  }
  for (const h of HAND_TYPES) {
    const st = getEntryState('hands', h);
    if (st === 'obtained') obtained++;
    else if (st === 'seen') seen++;
  }
  return { total, obtained, seen, unknown: total - obtained - seen };
}

const RARITY_LABELS = {
  common: '普通',
  uncommon: '稀有',
  rare: '传说'
};

function handDesc(handType) {
  const b = HAND_BASE[handType === 'Royal Flush' ? 'Straight Flush' : handType];
  if (!b) return '';
  return `Lv.1 基础 ${b.chips} 筹码 × ${b.mult} 倍数`;
}

function buildEntries() {
  return {
    jokers: JOKER_DEFS.map(j => ({
      category: 'jokers',
      id: j.id,
      name: j.name,
      art: j.art,
      meta: `$${j.cost} · ${RARITY_LABELS[j.rarity] || j.rarity}`,
      desc: j.desc,
      state: getEntryState('jokers', j.id)
    })),
    planets: PLANET_DEFS.map(p => ({
      category: 'planets',
      id: p.id,
      name: p.name,
      art: p.art,
      meta: HAND_LABELS[p.handType],
      desc: `升级 ${HAND_LABELS[p.handType]} +1 级`,
      state: getEntryState('planets', p.id)
    })),
    hands: HAND_TYPES.map(h => ({
      category: 'hands',
      id: h,
      name: HAND_LABELS[h],
      art: SECRET_HANDS.has(h) ? '✦' : '♠',
      meta: SECRET_HANDS.has(h) ? '隐藏牌型' : '扑克牌型',
      desc: handDesc(h),
      state: getEntryState('hands', h)
    }))
  };
}

let activeTab = 'jokers';
let activeFilter = 'all';

export function openCodexModal(els) {
  renderCodex(els);
  els.codexModal.classList.remove('hidden');
}

export function renderCodex(els) {
  const entries = buildEntries();
  const stats = getStats();
  els.codexStats.textContent =
    `已获得 ${stats.obtained} / ${stats.total} · 已遇见 ${stats.seen} · 未抽出 ${stats.unknown}`;

  els.codexTabs.querySelectorAll('[data-codex-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.codexTab === activeTab);
  });
  els.codexFilters.querySelectorAll('[data-codex-filter]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.codexFilter === activeFilter);
  });

  const list = entries[activeTab].filter(e => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'obtained') return e.state === 'obtained';
    if (activeFilter === 'seen') return e.state === 'seen';
    if (activeFilter === 'unknown') return e.state === 'unknown';
    return true;
  });

  els.codexGrid.innerHTML = '';
  for (const e of list) {
    const card = document.createElement('div');
    card.className = `codex-card codex-${e.state}`;
    const badge =
      e.state === 'obtained' ? '已获得'
        : e.state === 'seen' ? '已遇见'
          : '未抽出';
    const showSecret = e.state === 'unknown' && e.category === 'hands' && SECRET_HANDS.has(e.id);

    card.innerHTML = `
      <div class="codex-badge">${badge}</div>
      <div class="codex-art">${e.state === 'unknown' ? '?' : e.art}</div>
      <div class="codex-name">${e.state === 'unknown' && !showSecret ? '???' : e.name}</div>
      <div class="codex-meta">${e.state === 'unknown' ? '—' : e.meta}</div>
      <div class="codex-desc">${
        e.state === 'obtained' ? e.desc.replace(/\n/g, '<br/>')
          : e.state === 'seen' ? '已在商店或局中遇见，尚未正式获得'
            : showSecret ? '隐藏牌型 · 打出一次后解锁'
              : '继续冒险，等待商店抽选'
      }</div>
    `;
    els.codexGrid.appendChild(card);
  }

  if (!list.length) {
    els.codexGrid.innerHTML = '<div class="codex-empty">该分类下暂无条目</div>';
  }
}

export function wireCodexUI(els) {
  const open = () => openCodexModal(els);
  els.openCodexBtn?.addEventListener('click', open);
  els.welcomeCodexBtn?.addEventListener('click', open);
  document.querySelectorAll('.codex-open-btn').forEach(btn => btn.addEventListener('click', open));
  els.codexModal?.querySelector('[data-close]')?.addEventListener('click', () => {
    els.codexModal.classList.add('hidden');
  });
  els.codexTabs?.querySelectorAll('[data-codex-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.codexTab;
      renderCodex(els);
    });
  });
  els.codexFilters?.querySelectorAll('[data-codex-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.codexFilter;
      renderCodex(els);
    });
  });
}

export function resetCodexProgress() {
  store = emptyStore();
  save();
}
