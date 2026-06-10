/**
 * run/trials — Испытания Сеятеля: фиксированные паззлы.
 * Seed закреплён — судьба одна на всех, решает только рука сеющего.
 */
import type { ArchetypeId, BiomeId } from './setup';

export interface Trial {
  id: string;
  name: string;
  desc: string;
  seedText: string;
  biome: BiomeId;
  archetype: ArchetypeId;
  size: number;
  budget: number;
  /** Цель: Φ не ниже этого в финале. */
  goalPhi: number;
}

export const TRIALS: Trial[] = [
  {
    id: 'breath',
    name: 'Первое дыхание',
    desc: '8 Семян, малое поле. Доведи Φ до 15.',
    seedText: 'испытание-дыхание',
    biome: 'swamp', archetype: 'clay', size: 48, budget: 8, goalPhi: 15,
  },
  {
    id: 'garden',
    name: 'Сад из горсти',
    desc: '10 Семян. Вырасти сад с Φ 30.',
    seedText: 'испытание-сад',
    biome: 'swamp', archetype: 'clay', size: 64, budget: 10, goalPhi: 30,
  },
  {
    id: 'ember',
    name: 'Жар и пепел',
    desc: 'Горячий источник сжигает. 12 Семян, Φ 35.',
    seedText: 'испытание-жар',
    biome: 'spring', archetype: 'spark', size: 64, budget: 12, goalPhi: 35,
  },
  {
    id: 'cavern',
    name: 'Эхо пещеры',
    desc: 'Скудная жизнь, дальний взор. 10 Семян, Φ 40.',
    seedText: 'испытание-пещера',
    biome: 'cave', archetype: 'echo', size: 64, budget: 10, goalPhi: 40,
  },
  {
    id: 'silence',
    name: 'Великое безмолвие',
    desc: 'Великое поле, 12 Семян. Φ 45 — не дай миру замёрзнуть.',
    seedText: 'испытание-безмолвие',
    biome: 'cave', archetype: 'clay', size: 96, budget: 12, goalPhi: 45,
  },
];

export function trialById(id: string): Trial | null {
  return TRIALS.find((t) => t.id === id) ?? null;
}

/**
 * Звёзды: ★ цель достигнута; ★★ и мир пережил все штормы;
 * ★★★ и обошёлся не более чем двумя Табличками (элегантность).
 */
export function trialStars(
  t: Trial,
  finalPhi: number,
  survived: boolean,
  tabletsCarved: number,
): number {
  if (finalPhi < t.goalPhi) return 0;
  if (!survived) return 1;
  return tabletsCarved <= 2 ? 3 : 2;
}
