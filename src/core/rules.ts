/**
 * core/rules — Ме: законы соседства.
 * Чистая функция tick(state, me) → новое состояние. Тот же tick гоняет
 * и реальное время, и прогноз будущего (docs/design/05-future.md).
 *
 * Поле тороидальное: край сворачивается на противоположный — у мира нет
 * стены, только замкнутость (Сфайрос пространства).
 */
import { SPROUT_ENERGY, STARVATION_LEVEL, nextEnergy } from './energy';
import {
  Cell, GRID_H, GRID_W, STRAINS, Terrain, type WorldState, cloneWorld, onGridResize,
} from './grid';
import { SPRING_INFLUX } from './terrain';

/** Окно угрозы: приток гаснет, расход растёт. */
export interface ThreatWindow {
  tick: number;
  duration: number;
}

/** Ме — божественные законы мира: соседство, энергия, заложенные судьбой угрозы. */
export interface Me {
  /** Рождение: пустая клетка оживает при числе соседей в [birthMin..birthMax]. */
  birthMin: number;
  birthMax: number;
  /** Выживание: Семя живёт при числе соседей в [surviveMin..surviveMax]. */
  surviveMin: number;
  surviveMax: number;
  /** Сколько тиков Прах остаётся на поле, прежде чем стать Пустотой. */
  ashLifetime: number;
  /** Энергия: приток за тик и расход на 100 живых Семян за тик. */
  energyInflux: number;
  energyDrainPer100: number;
  /** Детерминированная судьба: серия Нейкос-штормов (из seed). */
  threats: ThreatWindow[];
}

/** Классический Конвей: B3/S23 — проверенная точка старта эмерджентности. */
export const DEFAULT_ME: Me = {
  birthMin: 3,
  birthMax: 3,
  surviveMin: 2,
  surviveMax: 3,
  ashLifetime: 6,
  energyInflux: 0.6,
  energyDrainPer100: 0.06,
  threats: [],
};

export const ME_LIMITS = {
  neighbors: { min: 0, max: 8 },
  ashLifetime: { min: 0, max: 30 },
} as const;

/*
 * Предвычисленные таблицы заворота тора: убирают 8 взятий остатка на клетку
 * в самом горячем цикле игры (его же гоняет прогноз будущего до 200 раз подряд).
 * Пересобираются при смене размера поля.
 */
let XM1 = new Int32Array(0);
let XP1 = new Int32Array(0);
let ROW_UP = new Int32Array(0);
let ROW_DOWN = new Int32Array(0);
onGridResize(() => {
  XM1 = new Int32Array(GRID_W);
  XP1 = new Int32Array(GRID_W);
  ROW_UP = new Int32Array(GRID_H);
  ROW_DOWN = new Int32Array(GRID_H);
  for (let x = 0; x < GRID_W; x++) {
    XM1[x] = (x - 1 + GRID_W) % GRID_W;
    XP1[x] = (x + 1) % GRID_W;
  }
  for (let y = 0; y < GRID_H; y++) {
    ROW_UP[y] = ((y - 1 + GRID_H) % GRID_H) * GRID_W;
    ROW_DOWN[y] = ((y + 1) % GRID_H) * GRID_W;
  }
});

/** Род новорождённого — большинство среди живых родителей; ничья — младший род. */
const strainVotes = new Int32Array(STRAINS);
const birthNeigh = new Int32Array(8);
function inheritStrain(src: Uint8Array, kind: Uint8Array): number {
  strainVotes.fill(0);
  for (let k = 0; k < 8; k++) {
    const ni = birthNeigh[k] as number;
    if (src[ni] === Cell.Seed) {
      const s = kind[ni] as number;
      strainVotes[s] = (strainVotes[s] as number) + 1;
    }
  }
  let best = 0;
  for (let s = 1; s < STRAINS; s++) {
    if ((strainVotes[s] as number) > (strainVotes[best] as number)) best = s;
  }
  return best;
}

/** Один шаг мира. Не мутирует вход. */
export function tick(state: WorldState, me: Me): WorldState {
  const next = cloneWorld(state);
  const src = state.cells;
  const srcAge = state.age;
  const srcKind = state.kind;

  const terrain = state.terrain;
  // Голод: на пустой энергии выживание ужесточается — поле само прореживается.
  const starving = state.energy <= STARVATION_LEVEL;
  // Сытость: Споры решаются прорасти.
  const sprouting = state.energy >= SPROUT_ENERGY;
  const surviveMax = starving ? me.surviveMax - 1 : me.surviveMax;
  let alive = 0;
  let springs = 0;

  for (let y = 0; y < GRID_H; y++) {
    const row = y * GRID_W;
    const up = ROW_UP[y] as number;
    const down = ROW_DOWN[y] as number;
    for (let x = 0; x < GRID_W; x++) {
      const i = row + x;
      const cell = src[i];
      const land = terrain[i];
      if (land === Terrain.Spring) springs++;
      // Кристалл — стена: жизни на нём нет и не будет.
      if (land === Terrain.Crystal) continue;
      const xm = XM1[x] as number;
      const xp = XP1[x] as number;
      const n0 = up + xm;
      const n1 = up + x;
      const n2 = up + xp;
      const n3 = row + xm;
      const n4 = row + xp;
      const n5 = down + xm;
      const n6 = down + x;
      const n7 = down + xp;
      const n =
        (src[n0] === Cell.Seed ? 1 : 0) +
        (src[n1] === Cell.Seed ? 1 : 0) +
        (src[n2] === Cell.Seed ? 1 : 0) +
        (src[n3] === Cell.Seed ? 1 : 0) +
        (src[n4] === Cell.Seed ? 1 : 0) +
        (src[n5] === Cell.Seed ? 1 : 0) +
        (src[n6] === Cell.Seed ? 1 : 0) +
        (src[n7] === Cell.Seed ? 1 : 0);

      if (cell === Cell.Seed) {
        alive++;
        if (n >= me.surviveMin && n <= surviveMax) {
          next.age[i] = Math.min((srcAge[i] ?? 0) + 1, 0xffff);
        } else if (starving && n >= me.surviveMin - 1) {
          // Голодная смерть на грани — жизнь сворачивается в Спору, не в Прах.
          next.cells[i] = Cell.Spore;
          next.age[i] = 0;
        } else {
          next.cells[i] = Cell.Ash;
          next.age[i] = 0;
        }
      } else if (cell === Cell.Spore) {
        // Спора ждёт сытости — и прорастает, помня свой род.
        if (sprouting) {
          next.cells[i] = Cell.Seed;
          next.age[i] = 0;
        }
      } else if (cell !== Cell.Signal && n >= me.birthMin && n <= me.birthMax) {
        // Жизнь прорастает и сквозь Прах: тлен — след, не преграда.
        // Это сохраняет точную динамику Конвея при любом ashLifetime.
        next.cells[i] = Cell.Seed;
        next.age[i] = 0;
        birthNeigh[0] = n0; birthNeigh[1] = n1; birthNeigh[2] = n2; birthNeigh[3] = n3;
        birthNeigh[4] = n4; birthNeigh[5] = n5; birthNeigh[6] = n6; birthNeigh[7] = n7;
        next.kind[i] = inheritStrain(src, srcKind);
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

  next.energy = nextEnergy(state.energy, alive, me, state.tick, springs * SPRING_INFLUX);
  next.tick = state.tick + 1;
  return next;
}
