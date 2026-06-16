// 跑团 / 街机小游戏注册

export const MINIGAMES = [
  {
    id: 'kline-rider',
    title: 'K线摩托',
    subtitle: '股票 K 线变越野赛道 · 手机横屏',
    emoji: '🏍️',
    boot: () => import('./kline-rider/ui.js'),
    bootFn: 'bootKlineRider',
    unmountFn: 'unmountKlineRider'
  },
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
