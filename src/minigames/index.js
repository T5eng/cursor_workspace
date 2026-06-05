// Mini-game registry

export const MINIGAMES = [
  {
    id: 'blackjack',
    title: '21点',
    subtitle: 'Blackjack · 庄闲对赌',
    emoji: '🃏',
    boot: () => import('./blackjack.js'),
    bootFn: 'bootBlackjack',
    unmountFn: 'unmountBlackjack'
  },
  {
    id: 'memory',
    title: '记忆翻牌',
    subtitle: '配对扑克 · 考验记忆力',
    emoji: '🧠',
    boot: () => import('./memory.js'),
    bootFn: 'bootMemory',
    unmountFn: 'unmountMemory'
  },
  {
    id: 'higher-lower',
    title: '比大小',
    subtitle: '猜下一张 · 连胜挑战',
    emoji: '📈',
    boot: () => import('./higher-lower.js'),
    bootFn: 'bootHigherLower',
    unmountFn: 'unmountHigherLower'
  },
  {
    id: 'snake',
    title: '贪吃蛇',
    subtitle: '经典街机 · 吃花色得分',
    emoji: '🐍',
    boot: () => import('./snake.js'),
    bootFn: 'bootSnake',
    unmountFn: 'unmountSnake'
  }
];

export function getMinigame(id) {
  return MINIGAMES.find(g => g.id === id) ?? null;
}
