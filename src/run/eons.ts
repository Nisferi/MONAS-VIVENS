/**
 * run/eons — кампания: пять глав, цепь миров. Эхо переносится между
 * главами само (одинаковый размер поля), миры растут на прахе предыдущих.
 */
import type { ArchetypeId, BiomeId } from './setup';
import type { EndingId } from './endings';

export interface EonGoalInput {
  survived: boolean;
  phi: number;
  endingId: EndingId;
  mindAwake: boolean;
  dawn: boolean;
}

export interface Eon {
  id: number;
  name: string;
  goalText: string;
  seedText: string;
  biome: BiomeId;
  archetype: ArchetypeId;
  size: number;
  check(i: EonGoalInput): boolean;
}

export const EONS: Eon[] = [
  {
    id: 1, name: 'Пробуждение', goalText: 'разбуди разум (открой линзу Ⅲ)',
    seedText: 'эон-1-пробуждение', biome: 'swamp', archetype: 'clay', size: 64,
    check: (i) => i.mindAwake,
  },
  {
    id: 2, name: 'Буря', goalText: 'переживи все штормы',
    seedText: 'эон-2-буря', biome: 'spring', archetype: 'spark', size: 64,
    check: (i) => i.survived,
  },
  {
    id: 3, name: 'Хранитель', goalText: 'доведи Φ до 40 в финале',
    seedText: 'эон-3-хранитель', biome: 'cave', archetype: 'echo', size: 64,
    check: (i) => i.phi >= 40,
  },
  {
    id: 4, name: 'Заря', goalText: 'сведи три рода — вырасти Зарю',
    seedText: 'эон-4-заря', biome: 'swamp', archetype: 'clay', size: 64,
    check: (i) => i.dawn,
  },
  {
    id: 5, name: 'Абсолют', goalText: 'достигни Абсолюта Через Различие',
    seedText: 'эон-5-абсолют', biome: 'cave', archetype: 'clay', size: 96,
    check: (i) => i.endingId === 'absolute',
  },
];

const KEY = 'monas.eons';

/** Сколько глав пройдено (0..5). */
export function eonsProgress(): number {
  try {
    return Number(localStorage.getItem(KEY)) || 0;
  } catch {
    return 0;
  }
}

export function eonComplete(id: number): boolean {
  if (id !== eonsProgress() + 1) return false;
  try {
    localStorage.setItem(KEY, String(id));
  } catch { /* ок */ }
  return true;
}
