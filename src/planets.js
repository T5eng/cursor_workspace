// Planet cards — upgrade specific poker hands (Balatro)
import { HAND_LABELS } from './cards.js';

export const PLANET_DEFS = [
  { id: 'pluto',   handType: 'High Card',       name: '冥王星', art: '🪐', cost: 3 },
  { id: 'mercury', handType: 'Pair',            name: '水星',   art: '☿',  cost: 3 },
  { id: 'uranus',  handType: 'Two Pair',        name: '天王星', art: '♅',  cost: 3 },
  { id: 'venus',   handType: 'Three of a Kind', name: '金星',   art: '♀',  cost: 3 },
  { id: 'saturn',  handType: 'Straight',        name: '土星',   art: '♄',  cost: 3 },
  { id: 'jupiter', handType: 'Flush',           name: '木星',   art: '♃',  cost: 3 },
  { id: 'earth',   handType: 'Full House',      name: '地球',   art: '🌍', cost: 3 },
  { id: 'mars',    handType: 'Four of a Kind',  name: '火星',   art: '♂',  cost: 3 },
  { id: 'neptune', handType: 'Straight Flush',  name: '海王星', art: '♆',  cost: 3 },
  { id: 'planet_x', handType: 'Five of a Kind', name: '行星 X', art: '🌑', cost: 3 },
  { id: 'ceres',   handType: 'Flush House',     name: '谷神星', art: '⚳',  cost: 3 },
  { id: 'eris',    handType: 'Flush Five',      name: '阋神星', art: '⚷',  cost: 3 }
];

const BASE_PLANET_HANDS = new Set([
  'High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight',
  'Flush', 'Full House', 'Four of a Kind', 'Straight Flush'
]);

export function planetLabel(p) {
  return `${p.name} · ${HAND_LABELS[p.handType]}`;
}

export function rollShopPlanets(n, discoveredHands, rng = Math.random) {
  const pool = PLANET_DEFS.filter(p =>
    BASE_PLANET_HANDS.has(p.handType) || discoveredHands.has(p.handType)
  );
  const out = [];
  const used = new Set();
  for (let i = 0; i < n && pool.length; i++) {
    let tries = 0;
    while (tries++ < 40) {
      const p = pool[Math.floor(rng() * pool.length)];
      if (!used.has(p.id)) {
        used.add(p.id);
        out.push({ ...p, desc: `升级 ${HAND_LABELS[p.handType]} +1 级` });
        break;
      }
    }
  }
  return out;
}
