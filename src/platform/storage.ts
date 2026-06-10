/**
 * platform/storage — локальные сохранения: рекорд и последний выбор старта.
 */
import type { ArchetypeId, BiomeId, RunMode } from '../run/setup';
import { cloudMirror } from './telegram';

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
  cloudMirror(BEST_KEY, String(score));
  return true;
}

/** Лучший счёт Мира недели (по его seed). */
const WEEK_KEY = 'monas.week';

export function loadWeeklyBest(seedText: string): number {
  try {
    return Number(localStorage.getItem(`${WEEK_KEY}.${seedText}`)) || 0;
  } catch {
    return 0;
  }
}

export function saveWeeklyBest(seedText: string, score: number): boolean {
  if (score <= loadWeeklyBest(seedText)) return false;
  try {
    localStorage.setItem(`${WEEK_KEY}.${seedText}`, String(score));
  } catch {
    /* ок */
  }
  cloudMirror(`${WEEK_KEY}.${seedText}`, String(score));
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

/**
 * Эхо мира: отпечаток последней жизни погибшего/завершённого мира.
 * Следующий мир того же размера взойдёт на этом прахе.
 */
const ECHO_KEY = 'monas.echo';

export function saveEcho(size: number, indices: number[]): void {
  try {
    localStorage.setItem(`${ECHO_KEY}.${size}`, JSON.stringify(indices));
  } catch {
    /* ок */
  }
}

/** Кодекс форм: какие существа уже открыты. */
const CODEX_KEY = 'monas.codex';

export function loadCodex(): Record<string, true> {
  try {
    const raw = localStorage.getItem(CODEX_KEY);
    return raw ? (JSON.parse(raw) as Record<string, true>) : {};
  } catch {
    return {};
  }
}

/** Возвращает true, если форма открыта впервые. */
export function discoverForm(id: string): boolean {
  const codex = loadCodex();
  if (codex[id]) return false;
  codex[id] = true;
  try {
    localStorage.setItem(CODEX_KEY, JSON.stringify(codex));
  } catch {
    /* ок */
  }
  return true;
}

/** Звёзды испытаний (хранится лучший результат). */
const TRIALS_KEY = 'monas.trials';

export function loadTrialStars(): Record<string, number> {
  try {
    const raw = localStorage.getItem(TRIALS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function saveTrialStars(id: string, stars: number): void {
  const all = loadTrialStars();
  if ((all[id] ?? 0) >= stars) return;
  all[id] = stars;
  try {
    localStorage.setItem(TRIALS_KEY, JSON.stringify(all));
  } catch {
    /* ок */
  }
}

/** Рекорды раскладов: ключ — раскладId:ставка. */
const LAYOUT_KEY = 'monas.layout';

export function loadLayoutBest(layoutId: string, stake: string): number {
  try {
    return Number(localStorage.getItem(`${LAYOUT_KEY}.${layoutId}.${stake}`)) || 0;
  } catch {
    return 0;
  }
}

export function saveLayoutBest(layoutId: string, stake: string, score: number): boolean {
  if (score <= loadLayoutBest(layoutId, stake)) return false;
  try {
    localStorage.setItem(`${LAYOUT_KEY}.${layoutId}.${stake}`, String(score));
  } catch {
    /* ок */
  }
  cloudMirror(`${LAYOUT_KEY}.${layoutId}.${stake}`, String(score));
  return true;
}

export function loadEcho(size: number): number[] | null {
  try {
    const raw = localStorage.getItem(`${ECHO_KEY}.${size}`);
    return raw ? (JSON.parse(raw) as number[]) : null;
  } catch {
    return null;
  }
}
