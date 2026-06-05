// 跑团 / 叙事游戏注册

export const MINIGAMES = [
  {
    id: 'emperor-rpg',
    title: '天子跑团',
    subtitle: '嘉靖朝 · 宫斗权斗 · 活过十二年',
    emoji: '👑',
    boot: () => import('./emperor/ui.js'),
    bootFn: 'bootEmperorRpg',
    unmountFn: 'unmountEmperorRpg'
  }
];

export function getMinigame(id) {
  return MINIGAMES.find(g => g.id === id) ?? null;
}
