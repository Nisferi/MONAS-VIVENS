/**
 * run/weekly — Мир недели: один seed на всех, новый каждый понедельник.
 * Биом и архетип тоже выводятся из номера недели — судьба общая.
 */
import { hashSeed } from '../core/rng';
import { ARCHETYPES, BIOMES, type ArchetypeId, type BiomeId } from './setup';

export interface WeeklyWorld {
  seedText: string;
  biome: BiomeId;
  archetype: ArchetypeId;
  size: number;
}

/** ISO-номер недели. */
function isoWeek(d: Date): { year: number; week: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: date.getUTCFullYear(), week };
}

export function currentWeekly(now = new Date()): WeeklyWorld {
  const { year, week } = isoWeek(now);
  const seedText = `Эон-${year}-W${String(week).padStart(2, '0')}`;
  const h = hashSeed(seedText);
  const biome = (BIOMES[h % BIOMES.length] as { id: BiomeId }).id;
  const archetype = (ARCHETYPES[(h >>> 8) % ARCHETYPES.length] as { id: ArchetypeId }).id;
  return { seedText, biome, archetype, size: 64 };
}
