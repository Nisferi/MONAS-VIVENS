/**
 * core/grid — поле, типы клеток, роды, состояние мира.
 * Чистые данные и функции, без DOM (docs/design/09-architecture.md).
 *
 * Размер поля выбирается на старте партии (48/64/96): GRID_* — живые
 * ESM-привязки, модули с предвычисленными таблицами пересобирают их
 * через onGridResize.
 */
import { mulberry32 } from './rng';

export let GRID_W = 64;
export let GRID_H = 64;
export let GRID_SIZE = GRID_W * GRID_H;

type ResizeHook = () => void;
const resizeHooks: ResizeHook[] = [];

/** Зарегистрировать пересборку таблиц; вызывается сразу и при каждой смене размера. */
export function onGridResize(hook: ResizeHook): void {
  resizeHooks.push(hook);
  hook();
}

export function setGridSize(side: number): void {
  if (side === GRID_W) return;
  GRID_W = side;
  GRID_H = side;
  GRID_SIZE = side * side;
  for (const hook of resizeHooks) hook();
}

/** 4 типа клеток MVP: Пусто / Семя / Сигнал / Прах. */
export const enum Cell {
  Empty = 0,
  Seed = 1,
  Signal = 2,
  Ash = 3,
}

/** Роды Семян — культуры, не фракции: правила для всех одни, различие в цвете и наследии. */
export const STRAINS = 3;
export const STRAIN_NAMES = ['Род Огня', 'Род Нефрита', 'Род Аметиста'] as const;

export interface WorldState {
  /** Номер тика с начала партии. */
  tick: number;
  /** Тип каждой клетки (Cell). */
  cells: Uint8Array;
  /** Возраст: для Семени — тики жизни (Мнемозина внизу), для Праха — тики распада. */
  age: Uint16Array;
  /** Род клетки (0..STRAINS-1); наследуется от большинства родителей. */
  kind: Uint8Array;
  /** Энергия поля, 0..100. Часть детерминированного состояния — прогноз её видит. */
  energy: number;
}

export function createWorld(seed: number, density: number, energy = 100): WorldState {
  const rng = mulberry32(seed);
  const cells = new Uint8Array(GRID_SIZE);
  const kind = new Uint8Array(GRID_SIZE);
  for (let i = 0; i < GRID_SIZE; i++) {
    if (rng() < density) {
      cells[i] = Cell.Seed;
      kind[i] = Math.floor(rng() * STRAINS);
    }
  }
  return { tick: 0, cells, age: new Uint16Array(GRID_SIZE), kind, energy };
}

export function cloneWorld(state: WorldState): WorldState {
  return {
    tick: state.tick,
    cells: state.cells.slice(),
    age: state.age.slice(),
    kind: state.kind.slice(),
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
    kind: Array.from(state.kind),
    energy: state.energy,
  });
}

export function deserializeWorld(json: string): WorldState {
  const raw = JSON.parse(json) as {
    tick: number;
    cells: number[];
    age: number[];
    kind?: number[];
    energy?: number;
  };
  return {
    tick: raw.tick,
    cells: Uint8Array.from(raw.cells),
    age: Uint16Array.from(raw.age),
    kind: raw.kind ? Uint8Array.from(raw.kind) : new Uint8Array(raw.cells.length),
    energy: raw.energy ?? 100,
  };
}
