/**
 * run/hearth — «Очаг»: вечный мир, живущий в реальном времени.
 * Детерминизм делает честным fast-forward без сервера: сохраняем состояние
 * и момент выхода, при возвращении доматываем прошедшие тики тем же tick().
 */
import { deserializeWorld, serializeWorld, type WorldState } from '../core/grid';
import { mulberry32 } from '../core/rng';
import type { Me, ThreatWindow } from '../core/rules';
import type { ArchetypeId, BiomeId } from './setup';

/** Темп очага: 1 тик в секунду реального времени. */
export const HEARTH_TPS = 1;
/** Кап домотки отсутствия — неделя. */
export const CATCHUP_CAP_TICKS = 7 * 24 * 3600 * HEARTH_TPS;

/** Вечная череда штормов: на годы вперёд. */
export function eternalThreats(seed: number): ThreatWindow[] {
  const rng = mulberry32(seed ^ 0x0c4a9e1);
  const storms: ThreatWindow[] = [];
  let t = 1600 + Math.floor(rng() * 600);
  for (let k = 0; k < 400; k++) {
    const duration = 100 + Math.floor(rng() * 120);
    storms.push({ tick: t, duration });
    t += duration + 2000 + Math.floor(rng() * 1500);
  }
  return storms;
}

export interface HearthSave {
  seedText: string;
  biome: BiomeId;
  archetype: ArchetypeId;
  size: number;
  world: string; // serializeWorld
  me: Me;
  tablets: string; // TabletEngine.toJSON
  savedAt: number; // Date.now()
}

const KEY = 'monas.hearth';

export function saveHearth(save: HearthSave): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* очаг живёт только в памяти вкладки */
  }
}

export function loadHearth(): (HearthSave & { world: string }) | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as HearthSave) : null;
  } catch {
    return null;
  }
}

export function clearHearth(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ок */
  }
}

export function restoreWorld(save: HearthSave): WorldState {
  return deserializeWorld(save.world);
}

export function packWorld(world: WorldState): string {
  return serializeWorld(world);
}

/** Сколько тиков прошло, пока очаг был один. */
export function elapsedTicks(save: HearthSave, now = Date.now()): number {
  const sec = Math.max(0, (now - save.savedAt) / 1000);
  return Math.min(CATCHUP_CAP_TICKS, Math.floor(sec * HEARTH_TPS));
}

export function fmtAbsence(ticks: number): string {
  const sec = ticks / HEARTH_TPS;
  if (sec < 90) return `${Math.round(sec)} с`;
  if (sec < 5400) return `${Math.round(sec / 60)} мин`;
  if (sec < 90000) return `${(sec / 3600).toFixed(1)} ч`;
  return `${(sec / 86400).toFixed(1)} дн`;
}
