/**
 * platform/storage — локальные сохранения: рекорд и последний выбор старта.
 */
import type { ArchetypeId, BiomeId, RunMode } from '../run/setup';

const BEST_KEY = 'monas.best';
const SETUP_KEY = 'monas.setup';

export interface SavedSetup {
  biome: BiomeId;
  archetype: ArchetypeId;
  size?: number;
  mode?: RunMode;
}

export function loadBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

/** Возвращает true, если это новый рекорд. */
export function saveBest(score: number): boolean {
  const best = loadBest();
  if (score <= best) return false;
  try {
    localStorage.setItem(BEST_KEY, String(score));
  } catch {
    /* приватный режим — живём без памяти */
  }
  return true;
}

export function loadSetup(): SavedSetup | null {
  try {
    const raw = localStorage.getItem(SETUP_KEY);
    return raw ? (JSON.parse(raw) as SavedSetup) : null;
  } catch {
    return null;
  }
}

export function saveSetup(setup: SavedSetup): void {
  try {
    localStorage.setItem(SETUP_KEY, JSON.stringify(setup));
  } catch {
    /* ок */
  }
}
