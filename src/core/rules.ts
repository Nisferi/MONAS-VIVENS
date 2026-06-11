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
  BASE_STRAINS, Cell, GRID_H, GRID_W, HYBRID_STRAIN, STRAINS, Terrain,
  type WorldState, cloneWorld, onGridResize,
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
  /**
   * Воля 0..10 (Ярус 4): сколько автономии даровано формам.
   * 0 — мир-механизм (кворум молчит); 10 — формы видят дальше и решают сами.
   */
  will: number;
  /** Детерминированная судьба: серия Нейкос-штормов (из seed). */
  threats: ThreatWindow[];
  /** Редкие события судьбы: кометный посев, год тишины (из seed). */
  events: WorldEvent[];
}

export interface WorldEvent {
  kind: 'comet' | 'quiet';
  tick: number;
  duration: number;
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
  will: 5,
  threats: [],
  events: [],
};

export const ME_LIMITS = {
  neighbors: { min: 0, max: 8 },
  ashLifetime: { min: 0, max: 30 },
  will: { min: 0, max: 10 },
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

/*
 * Умная жизнь, Ярус 1–2 (docs/design/14-mind-life.md). Всё детерминировано.
 * Сигнальное поле — «грибница»: живые Семена выделяют вещество (стресс на
 * грани гибели, присутствие иначе), оно диффундирует и затухает. Тропизм:
 * при ничьей родов рождение склоняется к роду с сильнейшим локальным
 * сигналом. Кворум: зрелая клетка в стрессе перед штормом сама уходит в Спору.
 */
const SIGNAL_DECAY = 0.9;
const SIGNAL_CENTER = 0.44;
const SIGNAL_EDGE = 0.07; // 0.44 + 8·0.07 = 1.0 (сохранение до затухания)
const EMIT_PRESENCE = 0.04;
const EMIT_STRESS = 0.7;
const QUORUM_AGE = 12;
const QUORUM_STRESS = 1.6;
const QUORUM_LOOKAHEAD = 60;
let emitBuf = new Float32Array(0);

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
  emitBuf = new Float32Array(GRID_W * GRID_H);
});

/**
 * Род новорождённого — большинство среди живых родителей.
 * Тропизм (Ярус 1): при ничьей побеждает род, чьи родители сидят на более
 * сильном сигнале — жизнь тянется туда, где грибница гуще.
 */
const strainVotes = new Int32Array(STRAINS);
const strainSignal = new Float64Array(STRAINS);
const birthNeigh = new Int32Array(8);
function inheritStrain(src: Uint8Array, kind: Uint8Array, signal: Float32Array): number {
  strainVotes.fill(0);
  strainSignal.fill(0);
  for (let k = 0; k < 8; k++) {
    const ni = birthNeigh[k] as number;
    if (src[ni] === Cell.Seed) {
      const s = kind[ni] as number;
      strainVotes[s] = (strainVotes[s] as number) + 1;
      strainSignal[s] = (strainSignal[s] as number) + (signal[ni] as number);
    }
  }
  // Заря: где сошлись все три базовых рода — рождается четвёртый.
  if (
    (strainVotes[0] as number) > 0 &&
    (strainVotes[1] as number) > 0 &&
    (strainVotes[2] as number) > 0
  ) {
    return HYBRID_STRAIN;
  }
  let best = 0;
  for (let s = 1; s < BASE_STRAINS; s++) {
    const v = strainVotes[s] as number;
    const vb = strainVotes[best] as number;
    if (v > vb || (v === vb && (strainSignal[s] as number) > (strainSignal[best] as number))) {
      best = s;
    }
  }
  return best;
}

/**
 * Геном новорождённого (Ярус 3): осторожность берётся от родителя на
 * сильнейшем сигнале (доминирующая линия), а не усредняется — иначе всё
 * сползало бы к середине и отбор был бы не виден. Плюс детерминированная
 * мутация ± из hash(позиция, тик): без seed и Math.random, реплеи совпадают.
 */
function inheritGene(
  src: Uint8Array,
  gene: Uint8Array,
  signal: Float32Array,
  i: number,
  tickNo: number,
): number {
  let best = 128;
  let bestSig = -1;
  for (let k = 0; k < 8; k++) {
    const ni = birthNeigh[k] as number;
    if (src[ni] === Cell.Seed) {
      const sg = signal[ni] as number;
      if (sg > bestSig) {
        bestSig = sg;
        best = gene[ni] as number;
      }
    }
  }
  const h = (Math.imul(i ^ 0x9e3779b1, 2654435761) ^ Math.imul(tickNo + 1, 40503)) >>> 0;
  const mut = (h % 11) - 5; // ±5 на поколение
  const g = best + mut;
  return g < 0 ? 0 : g > 255 ? 255 : g;
}

/**
 * Тень — тело Нейкос-шторма: блуждающий гаситель жизни.
 * Позиция — чистая функция (шторм, тик): путь Лиссажу из hash начала шторма.
 * Прогноз видит её, реплеи совпадают. Споры неуязвимы — спячка спасает.
 */
export function shadowAt(me: Me, tickNo: number): { x: number; y: number } | null {
  for (const t of me.threats) {
    if (tickNo >= t.tick && tickNo < t.tick + t.duration) {
      const h = Math.imul(t.tick, 2654435761) >>> 0;
      // Медленное блуждание: за шторм Тень проходит лишь часть мира.
      const ax = 0.012 + (h % 13) * 0.002;
      const ay = 0.010 + ((h >> 4) % 11) * 0.0025;
      const phx = (h % 628) / 100;
      const phy = ((h >> 8) % 628) / 100;
      const u = tickNo - t.tick;
      return {
        x: Math.floor((0.5 + 0.42 * Math.sin(ax * u + phx)) * GRID_W),
        y: Math.floor((0.5 + 0.42 * Math.cos(ay * u + phy)) * GRID_H),
      };
    }
  }
  return null;
}

/** Один шаг мира. Не мутирует вход. */
export function tick(state: WorldState, me: Me): WorldState {
  const next = cloneWorld(state);
  const src = state.cells;
  const srcAge = state.age;
  const srcKind = state.kind;

  const terrain = state.terrain;
  const sig = state.signal;
  const srcGene = state.gene;
  // Голод: на пустой энергии выживание ужесточается — поле само прореживается.
  const starving = state.energy <= STARVATION_LEVEL;
  // Сытость: Споры решаются прорасти.
  const sprouting = state.energy >= SPROUT_ENERGY;
  const surviveMax = starving ? me.surviveMax - 1 : me.surviveMax;
  // Воля (Ярус 4): автономия форм. Ноль — кворум молчит, мир-механизм.
  // Выше воля — дальше предвидение шторма (формы «видят» раньше).
  const will = me.will ?? 5;
  const lookahead = Math.round(QUORUM_LOOKAHEAD * (0.4 + will / 10));
  // Кворум (Ярус 2): шторм на горизонте — зрелые формы в стрессе уйдут в спячку.
  let stormNear = false;
  if (will > 0) {
    for (const t of me.threats) {
      if (state.tick < t.tick && t.tick - state.tick <= lookahead) {
        stormNear = true;
        break;
      }
    }
  }
  if (emitBuf.length !== sig.length) emitBuf = new Float32Array(sig.length);
  emitBuf.set(sig);
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
        // Эмиссия в грибницу: на грани гибели — тревога, иначе тихое присутствие.
        const onEdge = n <= me.surviveMin || n > surviveMax;
        emitBuf[i] = (emitBuf[i] as number) + (onEdge ? EMIT_STRESS : EMIT_PRESENCE);
        const age = srcAge[i] ?? 0;
        if (n >= me.surviveMin && n <= surviveMax) {
          // Кворум: зрелая форма, чующая шторм, прячется в Спору. Геном решает,
          // насколько рано: осторожный спит легко, смелый почти никогда —
          // и потому гибнет в шторм. Так отбор поднимает осторожность.
          const caution = (srcGene[i] as number) / 255;
          const effStress = QUORUM_STRESS * (0.4 + (1 - caution) * 2.4); // 0.4×..2.8× базы
          if (stormNear && age >= QUORUM_AGE && (sig[i] as number) >= effStress) {
            // Спячка хранит геном (клон уже скопировал gene[i]).
            next.cells[i] = Cell.Spore;
            next.age[i] = 0;
          } else {
            next.age[i] = Math.min(age + 1, 0xffff);
          }
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
        next.kind[i] = inheritStrain(src, srcKind, sig);
        next.gene[i] = inheritGene(src, srcGene, sig, i, state.tick);
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

  // Тень шторма: гасит Семена в 3×3 вокруг себя. Споры ей не по зубам.
  const sh = shadowAt(me, state.tick);
  if (sh) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const ix = (sh.x + dx + GRID_W) % GRID_W;
        const iy = (sh.y + dy + GRID_H) % GRID_H;
        const ii = iy * GRID_W + ix;
        if (next.cells[ii] === Cell.Seed) {
          next.cells[ii] = Cell.Ash;
          next.age[ii] = 0;
        }
      }
    }
  }

  // Редкие события судьбы (из seed, видны прогнозу).
  for (const ev of me.events) {
    if (ev.kind === 'comet' && state.tick === ev.tick) {
      // Кометный посев: горсть Семян с неба, узором из hash.
      const h0 = Math.imul(ev.tick ^ 0xc0337, 2654435761) >>> 0;
      const cx = h0 % GRID_W;
      const cy = (h0 >> 8) % GRID_H;
      for (let k = 0; k < 24; k++) {
        const hk = Math.imul(h0 ^ (k + 1), 40503) >>> 0;
        const ix = (cx + (hk % 11) - 5 + GRID_W) % GRID_W;
        const iy = (cy + ((hk >> 4) % 11) - 5 + GRID_H) % GRID_H;
        const ii = iy * GRID_W + ix;
        if (next.cells[ii] === Cell.Empty && terrain[ii] !== Terrain.Crystal) {
          next.cells[ii] = Cell.Seed;
          next.age[ii] = 0;
          next.kind[ii] = hk % 3;
          next.gene[ii] = (hk >> 8) % 256;
        }
      }
    }
  }

  // Диффузия грибницы: вещество растекается по 8 соседям и затухает.
  const nsig = next.signal;
  for (let y = 0; y < GRID_H; y++) {
    const row = y * GRID_W;
    const up = ROW_UP[y] as number;
    const down = ROW_DOWN[y] as number;
    for (let x = 0; x < GRID_W; x++) {
      const xm = XM1[x] as number;
      const xp = XP1[x] as number;
      const v =
        (emitBuf[row + x] as number) * SIGNAL_CENTER +
        ((emitBuf[up + xm] as number) +
          (emitBuf[up + x] as number) +
          (emitBuf[up + xp] as number) +
          (emitBuf[row + xm] as number) +
          (emitBuf[row + xp] as number) +
          (emitBuf[down + xm] as number) +
          (emitBuf[down + x] as number) +
          (emitBuf[down + xp] as number)) *
          SIGNAL_EDGE;
      nsig[row + x] = v * SIGNAL_DECAY;
    }
  }

  let quietBonus = 0;
  for (const ev of me.events) {
    if (ev.kind === 'quiet' && state.tick >= ev.tick && state.tick < ev.tick + ev.duration) {
      quietBonus = me.energyInflux; // приток удваивается
    }
  }
  next.energy = nextEnergy(state.energy, alive, me, state.tick, springs * SPRING_INFLUX + quietBonus);
  next.tick = state.tick + 1;
  return next;
}
