/**
 * core/grid — поле 64×64, типы клеток, состояние мира.
 * Чистые данные и функции, без DOM (docs/design/09-architecture.md).
 */
import { mulberry32 } from './rng';

export const GRID_W = 64;
export const GRID_H = 64;
export const GRID_SIZE = GRID_W * GRID_H;

/** 4 типа клеток MVP: Пусто / Семя / Сигнал / Прах. */
export const enum Cell {
  Empty = 0,
  Seed = 1,
  Signal = 2,
  Ash = 3,
}

export interface WorldState {
  /** Номер тика с начала партии. */
  tick: number;
  /** Тип каждой клетки (Cell). */
  cells: Uint8Array;
  /** Возраст: для Семени — тики жизни (Мнемозина внизу), для Праха — тики распада. */
  age: Uint16Array;
  /** Энергия поля, 0..100. Часть детерминированного состояния — прогноз её видит. */
  energy: number;
}

export function createWorld(seed: number, density: number, energy = 100): WorldState {
  const rng = mulberry32(seed);
  const cells = new Uint8Array(GRID_SIZE);
  for (let i = 0; i < GRID_SIZE; i++) {
    if (rng() < density) cells[i] = Cell.Seed;
  }
  return { tick: 0, cells, age: new Uint16Array(GRID_SIZE), energy };
}

export function cloneWorld(state: WorldState): WorldState {
  return {
    tick: state.tick,
    cells: state.cells.slice(),
    age: state.age.slice(),
    energy: state.energy,
  };
}

export function idx(x: number, y: number): number {
  return y * GRID_W + x;
}

/** Сериализация для сохранений и обмена мирами (JSON-совместимо). */
export function serializeWorld(state: WorldState): string {
  return JSON.stringify({
    tick: state.tick,
    cells: Array.from(state.cells),
    age: Array.from(state.age),
    energy: state.energy,
  });
}

export function deserializeWorld(json: string): WorldState {
  const raw = JSON.parse(json) as {
    tick: number;
    cells: number[];
    age: number[];
    energy?: number;
  };
  return {
    tick: raw.tick,
    cells: Uint8Array.from(raw.cells),
    age: Uint16Array.from(raw.age),
    energy: raw.energy ?? 100,
  };
}
