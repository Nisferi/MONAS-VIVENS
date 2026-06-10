/**
 * run/setup — биомы, архетипы, seed: 3×3 = 9 вариантов старта.
 * Биом модифицирует поле (энергия, плотность), архетип — правила и взор.
 */
import { hashSeed } from '../core/rng';
import { DEFAULT_ME, type Me } from '../core/rules';
import { threatFromSeed } from '../future/threat';

export type BiomeId = 'swamp' | 'spring' | 'cave';
export type ArchetypeId = 'spark' | 'clay' | 'echo';

export interface BiomeInfo {
  id: BiomeId;
  name: string;
  desc: string;
}

export interface ArchetypeInfo {
  id: ArchetypeId;
  name: string;
  desc: string;
}

export const BIOMES: BiomeInfo[] = [
  { id: 'swamp', name: 'Глиняное болото', desc: 'медленный рост, высокая стабильность форм' },
  { id: 'spring', name: 'Горячий источник', desc: 'быстрая энергия, высокий Хаос' },
  { id: 'cave', name: 'Кристаллическая пещера', desc: 'сильная Мнемозина, скудная жизнь' },
];

export const ARCHETYPES: ArchetypeInfo[] = [
  { id: 'spark', name: 'Искра', desc: 'энергия и быстрый рост, риск выгорания' },
  { id: 'clay', name: 'Глина', desc: 'форма и устойчивость, медленный старт' },
  { id: 'echo', name: 'Эхо', desc: 'сигналы: ранний и дальний взор в будущее' },
];

/** Путь партии: Поток — мир из бульона; Сеятель — горсть Семян руками. */
export type RunMode = 'flow' | 'sower';

export const FIELD_SIZES = [
  { side: 48, name: 'Малый', desc: '48×48 — быстрая драма' },
  { side: 64, name: 'Средний', desc: '64×64 — классика' },
  { side: 96, name: 'Великий', desc: '96×96 — эпос' },
];

/** Сколько Семян в горсти Сеятеля. */
export const SOWER_BUDGET = 12;

export interface RunConfig {
  seedText: string;
  seed: number;
  biome: BiomeId;
  archetype: ArchetypeId;
  mode: RunMode;
  /** Сторона поля. */
  size: number;
  me: Me;
  density: number;
  startEnergy: number;
  /** Порог Φ пробуждения разума (линза 3). */
  mindPhi: number;
  /** Множитель дальности взора. */
  horizonScale: number;
}

export function makeRun(
  seedText: string,
  biome: BiomeId,
  archetype: ArchetypeId,
  size = 64,
  mode: RunMode = 'flow',
): RunConfig {
  const seed = hashSeed(`${seedText}:${biome}:${archetype}:${size}:${mode}`);
  const threat = threatFromSeed(seed);

  const me: Me = { ...DEFAULT_ME, threatTick: threat.tick, threatDuration: threat.duration };
  let density = 0.18;
  let startEnergy = 70;
  let mindPhi = 25;
  let horizonScale = 1;

  switch (biome) {
    case 'swamp':
      me.energyInflux = 0.5;
      me.energyDrainPer100 = 0.05;
      me.ashLifetime = 10;
      density = 0.16;
      break;
    case 'spring':
      me.energyInflux = 0.9;
      me.energyDrainPer100 = 0.09;
      me.ashLifetime = 4;
      density = 0.24;
      break;
    case 'cave':
      me.energyInflux = 0.45;
      me.energyDrainPer100 = 0.045;
      me.ashLifetime = 14;
      density = 0.12;
      break;
  }

  switch (archetype) {
    case 'spark':
      density += 0.05;
      startEnergy = 85;
      me.energyDrainPer100 += 0.02;
      break;
    case 'clay':
      density -= 0.02;
      startEnergy = 65;
      me.ashLifetime += 4;
      break;
    case 'echo':
      mindPhi = 18;
      horizonScale = 1.5;
      break;
  }

  // Сеятель начинает с пустоты: вся жизнь — из его горсти.
  if (mode === 'sower') density = 0;

  return {
    seedText, seed, biome, archetype, mode, size,
    me, density, startEnergy, mindPhi, horizonScale,
  };
}
