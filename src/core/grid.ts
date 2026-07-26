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

/** Типы клеток: Пусто / Семя / Сигнал / Прах / Спора. */
export const enum Cell {
  Empty = 0,
  Seed = 1,
  Signal = 2,
  Ash = 3,
  /** Спора: жизнь, свернувшаяся от голода; прорастает, когда энергия вернётся. */
  Spore = 4,
  /**
   * Пожиратель (§15.3): вторая трофическая ступень. Живёт только рядом
   * с Семенами — они его пища; без еды голодает и гибнет. Регулятор
   * перенаселения и угроза формам: волны хищник-жертва по Лотке–Вольтерре.
   */
  Devourer = 5,
}

/** Рельеф — вечная основа мира, заложенная seed'ом. */
export const enum Terrain {
  Plain = 0,
  /** Кристалл: стена; жизнь не родится и не считается соседом. Якорь форм. */
  Crystal = 1,
  /** Родник: точка притока энергии. За них стоит бороться. */
  Spring = 2,
}

/**
 * Роды Семян — культуры, не фракции: правила для всех одни, различие
 * в цвете и наследии. Четвёртый род — Заря — не сеется рукой: он рождается
 * лишь там, где сошлись все три рода (награда за слияние культур).
 */
export const STRAINS = 4;
export const BASE_STRAINS = 3;
export const HYBRID_STRAIN = 3;
export const STRAIN_NAMES = ['Род Огня', 'Род Нефрита', 'Род Аметиста', 'Род Зари'] as const;

export interface WorldState {
  /** Номер тика с начала партии. */
  tick: number;
  /** Тип каждой клетки (Cell). */
  cells: Uint8Array;
  /** Возраст: для Семени — тики жизни (Мнемозина внизу), для Праха — тики распада. */
  age: Uint16Array;
  /** Род клетки (0..STRAINS-1); наследуется от большинства родителей. */
  kind: Uint8Array;
  /**
   * Геном клетки: осторожность 0..255 (Ярус 3 разума). Наследуется от
   * родителей с детерминированной мутацией; штормы отбирают осторожных.
   */
  gene: Uint8Array;
  /** Рельеф (Terrain): вечен, не меняется тиками — клонируется ссылкой. */
  terrain: Uint8Array;
  /** Провинция клетки (§15.4): вечна, как рельеф — клонируется ссылкой. */
  province: Uint8Array;
  /** Сигнальное поле — «грибница»: химия стресса/присутствия (Ярус 1 разума). */
  signal: Float32Array;
  /** АТФ клетки 0..255 — личный запас энергии (живая клетка, §16.1). */
  atp: Uint8Array;
  /** Целостность мембраны 0..255 — «здоровье» клетки (§16.1). */
  integ: Uint8Array;
  /** Слово электрического языка, излучённое в этот тик (Word, §16.2). */
  spike: Uint8Array;
  /** Митохондрии 0..7 — вобранные симбионты, усиливают метаболизм (§16.3). */
  mito: Uint8Array;
  /** Энергия поля, 0..100. Часть детерминированного состояния — прогноз её видит. */
  energy: number;
}

/** Слова электрического языка клеток (§16.2). */
export const enum Word {
  None = 0,
  Alarm = 1, // тревога: целостность падает / враг рядом
  Call = 2, // зов: заряд высок, есть место — делитесь сюда
  Hunger = 3, // голод: АТФ низок — не плодитесь
  Self = 4, // свой: тихая метка рода
}

export function createWorld(
  seed: number,
  density: number,
  energy = 100,
  terrain?: Uint8Array,
  province?: Uint8Array,
): WorldState {
  const rng = mulberry32(seed);
  // Геному — отдельный поток: размещение клеток и родов не сдвигается,
  // прежняя генерация мира сохранена бит-в-бит.
  const grng = mulberry32(seed ^ 0x9e3779b9);
  const cells = new Uint8Array(GRID_SIZE);
  const kind = new Uint8Array(GRID_SIZE);
  const gene = new Uint8Array(GRID_SIZE);
  const land = terrain ?? new Uint8Array(GRID_SIZE);
  for (let i = 0; i < GRID_SIZE; i++) {
    if (land[i] !== Terrain.Crystal && rng() < density) {
      cells[i] = Cell.Seed;
      kind[i] = Math.floor(rng() * BASE_STRAINS); // Заря не сеется — только рождается
      gene[i] = Math.floor(grng() * 256); // первое поколение — случайный разброс осторожности
    }
  }
  // Новорождённый мир: у живых полный заряд и целая мембрана.
  const atp = new Uint8Array(GRID_SIZE);
  const integ = new Uint8Array(GRID_SIZE);
  for (let i = 0; i < GRID_SIZE; i++) {
    if (cells[i] === Cell.Seed) {
      atp[i] = 160;
      integ[i] = 255;
    }
  }
  return {
    tick: 0,
    cells,
    age: new Uint16Array(GRID_SIZE),
    kind,
    gene,
    terrain: land,
    province: province ?? new Uint8Array(GRID_SIZE),
    signal: new Float32Array(GRID_SIZE),
    atp,
    integ,
    spike: new Uint8Array(GRID_SIZE),
    mito: new Uint8Array(GRID_SIZE),
    energy,
  };
}

export function cloneWorld(state: WorldState): WorldState {
  return {
    tick: state.tick,
    cells: state.cells.slice(),
    age: state.age.slice(),
    kind: state.kind.slice(),
    gene: state.gene.slice(),
    terrain: state.terrain, // рельеф вечен — общая ссылка
    province: state.province, // карта провинций вечна — общая ссылка
    signal: state.signal.slice(),
    atp: state.atp.slice(),
    integ: state.integ.slice(),
    spike: state.spike.slice(),
    mito: state.mito.slice(),
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
    gene: Array.from(state.gene),
    terrain: Array.from(state.terrain),
    province: Array.from(state.province),
    atp: Array.from(state.atp),
    integ: Array.from(state.integ),
    mito: Array.from(state.mito),
    energy: state.energy,
  });
}

export function deserializeWorld(json: string): WorldState {
  const raw = JSON.parse(json) as {
    tick: number;
    cells: number[];
    age: number[];
    kind?: number[];
    gene?: number[];
    terrain?: number[];
    province?: number[];
    atp?: number[];
    integ?: number[];
    mito?: number[];
    energy?: number;
  };
  return {
    tick: raw.tick,
    cells: Uint8Array.from(raw.cells),
    age: Uint16Array.from(raw.age),
    kind: raw.kind ? Uint8Array.from(raw.kind) : new Uint8Array(raw.cells.length),
    gene: raw.gene ? Uint8Array.from(raw.gene) : new Uint8Array(raw.cells.length),
    terrain: raw.terrain ? Uint8Array.from(raw.terrain) : new Uint8Array(raw.cells.length),
    province: raw.province ? Uint8Array.from(raw.province) : new Uint8Array(raw.cells.length),
    // Сигнальное поле не сохраняем — оно отрастает заново за десяток тиков.
    signal: new Float32Array(raw.cells.length),
    atp: raw.atp ? Uint8Array.from(raw.atp) : new Uint8Array(raw.cells.length).fill(160),
    integ: raw.integ ? Uint8Array.from(raw.integ) : new Uint8Array(raw.cells.length).fill(255),
    spike: new Uint8Array(raw.cells.length),
    mito: raw.mito ? Uint8Array.from(raw.mito) : new Uint8Array(raw.cells.length),
    energy: raw.energy ?? 100,
  };
}
