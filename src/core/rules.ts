/**
 * core/rules — Ме: законы соседства.
 * Чистая функция tick(state, me) → новое состояние. Тот же tick гоняет
 * и реальное время, и прогноз будущего (docs/design/05-future.md).
 *
 * Поле тороидальное: край сворачивается на противоположный — у мира нет
 * стены, только замкнутость (Сфайрос пространства).
 */
import { Cell, GRID_H, GRID_W, type WorldState, cloneWorld } from './grid';

/** Ме — ползунки законов, которые крутит игрок (линза 1). */
export interface Me {
  /** Рождение: пустая клетка оживает при числе соседей в [birthMin..birthMax]. */
  birthMin: number;
  birthMax: number;
  /** Выживание: Семя живёт при числе соседей в [surviveMin..surviveMax]. */
  surviveMin: number;
  surviveMax: number;
  /** Сколько тиков Прах остаётся на поле, прежде чем стать Пустотой. */
  ashLifetime: number;
}

/** Классический Конвей: B3/S23 — проверенная точка старта эмерджентности. */
export const DEFAULT_ME: Me = {
  birthMin: 3,
  birthMax: 3,
  surviveMin: 2,
  surviveMax: 3,
  ashLifetime: 6,
};

export const ME_LIMITS = {
  neighbors: { min: 0, max: 8 },
  ashLifetime: { min: 0, max: 30 },
} as const;

/*
 * Предвычисленные таблицы заворота тора: убирают 8 взятий остатка на клетку
 * в самом горячем цикле игры (его же гоняет прогноз будущего до 200 раз подряд).
 */
const XM1 = new Int32Array(GRID_W);
const XP1 = new Int32Array(GRID_W);
const ROW_UP = new Int32Array(GRID_H);
const ROW_DOWN = new Int32Array(GRID_H);
for (let x = 0; x < GRID_W; x++) {
  XM1[x] = (x - 1 + GRID_W) % GRID_W;
  XP1[x] = (x + 1) % GRID_W;
}
for (let y = 0; y < GRID_H; y++) {
  ROW_UP[y] = ((y - 1 + GRID_H) % GRID_H) * GRID_W;
  ROW_DOWN[y] = ((y + 1) % GRID_H) * GRID_W;
}

/** Один шаг мира. Не мутирует вход. */
export function tick(state: WorldState, me: Me): WorldState {
  const next = cloneWorld(state);
  const src = state.cells;
  const srcAge = state.age;

  for (let y = 0; y < GRID_H; y++) {
    const row = y * GRID_W;
    const up = ROW_UP[y] as number;
    const down = ROW_DOWN[y] as number;
    for (let x = 0; x < GRID_W; x++) {
      const i = row + x;
      const cell = src[i];
      const xm = XM1[x] as number;
      const xp = XP1[x] as number;
      const n =
        (src[up + xm] === Cell.Seed ? 1 : 0) +
        (src[up + x] === Cell.Seed ? 1 : 0) +
        (src[up + xp] === Cell.Seed ? 1 : 0) +
        (src[row + xm] === Cell.Seed ? 1 : 0) +
        (src[row + xp] === Cell.Seed ? 1 : 0) +
        (src[down + xm] === Cell.Seed ? 1 : 0) +
        (src[down + x] === Cell.Seed ? 1 : 0) +
        (src[down + xp] === Cell.Seed ? 1 : 0);

      if (cell === Cell.Seed) {
        if (n >= me.surviveMin && n <= me.surviveMax) {
          next.age[i] = Math.min((srcAge[i] ?? 0) + 1, 0xffff);
        } else {
          next.cells[i] = Cell.Ash;
          next.age[i] = 0;
        }
      } else if (cell !== Cell.Signal && n >= me.birthMin && n <= me.birthMax) {
        // Жизнь прорастает и сквозь Прах: тлен — след, не преграда.
        // Это сохраняет точную динамику Конвея при любом ashLifetime.
        next.cells[i] = Cell.Seed;
        next.age[i] = 0;
      } else if (cell === Cell.Ash) {
        const a = (srcAge[i] ?? 0) + 1;
        if (a >= me.ashLifetime) {
          next.cells[i] = Cell.Empty;
          next.age[i] = 0;
        } else {
          next.age[i] = a;
        }
      }
    }
  }

  next.tick = state.tick + 1;
  return next;
}
