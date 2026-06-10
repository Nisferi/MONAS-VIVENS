/**
 * run/layouts — «Расклад»: бюджет разнотипных фигур и ставка до старта.
 * Долгожитие — прожить дольше; Расцвет — прожить ярче (интеграл Φ).
 */
import { hashSeed, mulberry32 } from '../core/rng';
import type { BiomeId } from './setup';

export type PieceKind = 's0' | 's1' | 's2' | 'spore' | 'wall';

export const PIECE_INFO: { kind: PieceKind; name: string; glyph: string }[] = [
  { kind: 's0', name: 'Семя Огня', glyph: '●' },
  { kind: 's1', name: 'Семя Нефрита', glyph: '●' },
  { kind: 's2', name: 'Семя Аметиста', glyph: '●' },
  { kind: 'spore', name: 'Спора (ждёт сытости)', glyph: '◍' },
  { kind: 'wall', name: 'Сигнал-стена (инертен)', glyph: '▣' },
];

export type Pool = Record<PieceKind, number>;

export interface Layout {
  id: string;
  name: string;
  desc: string;
  seedText: string;
  biome: BiomeId;
  size: number;
  pool: Pool;
}

export type Stake = 'longevity' | 'bloom';

export const STAKE_INFO: Record<Stake, { name: string; desc: string }> = {
  longevity: { name: 'Долгожитие', desc: 'счёт — сколько тиков жизнь продержится' },
  bloom: { name: 'Расцвет', desc: 'счёт — интеграл Φ: жил ярко, пусть и короче' },
};

export const LAYOUTS: Layout[] = [
  {
    id: 'hearth', name: 'Очажок', desc: 'тёплое болото, горсть огня',
    seedText: 'расклад-очажок', biome: 'swamp', size: 48,
    pool: { s0: 8, s1: 0, s2: 0, spore: 2, wall: 2 },
  },
  {
    id: 'triad', name: 'Триада', desc: 'три рода по четыре семени',
    seedText: 'расклад-триада', biome: 'swamp', size: 64,
    pool: { s0: 4, s1: 4, s2: 4, spore: 0, wall: 0 },
  },
  {
    id: 'walls', name: 'Сад за стеной', desc: 'мало семян, много камня',
    seedText: 'расклад-стены', biome: 'cave', size: 64,
    pool: { s0: 6, s1: 0, s2: 0, spore: 0, wall: 8 },
  },
  {
    id: 'ember', name: 'Угли под пеплом', desc: 'споры ждут своего часа у источника',
    seedText: 'расклад-угли', biome: 'spring', size: 64,
    pool: { s0: 4, s1: 4, s2: 0, spore: 6, wall: 0 },
  },
  {
    id: 'vast', name: 'Великая пустошь', desc: 'великое поле, скудная горсть',
    seedText: 'расклад-пустошь', biome: 'cave', size: 96,
    pool: { s0: 5, s1: 5, s2: 0, spore: 2, wall: 4 },
  },
];

/** Расклад дня: один на всех, из даты. */
export function dailyLayout(now = new Date()): Layout {
  const ymd = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
  const seedText = `расклад-дня-${ymd}`;
  const rng = mulberry32(hashSeed(seedText));
  const biomes: BiomeId[] = ['swamp', 'spring', 'cave'];
  const pool: Pool = {
    s0: 3 + Math.floor(rng() * 5),
    s1: 2 + Math.floor(rng() * 4),
    s2: Math.floor(rng() * 4),
    spore: Math.floor(rng() * 4),
    wall: Math.floor(rng() * 5),
  };
  return {
    id: `daily-${ymd}`,
    name: `Расклад дня ${ymd.slice(5)}`,
    desc: 'один на всех до полуночи UTC',
    seedText,
    biome: biomes[Math.floor(rng() * biomes.length)] as BiomeId,
    size: 64,
    pool,
  };
}

export function layoutById(id: string): Layout | null {
  if (id.startsWith('daily-')) return dailyLayout();
  return LAYOUTS.find((l) => l.id === id) ?? null;
}

export function poolTotal(pool: Pool): number {
  return pool.s0 + pool.s1 + pool.s2 + pool.spore + pool.wall;
}
