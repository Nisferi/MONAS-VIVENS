/**
 * run/demiurge — Демиург-соперник, «Спор Богов» (§15.7).
 *
 * Второй бог ведёт свой род в своей провинции: у него своё Дыхание, свои
 * правила решений и свои Таблички. Он полностью детерминирован и играет
 * В ОТКРЫТУЮ — его намерения видны игроку, как ходы шахматного автомата.
 * Никакого Math.random: только состояние мира и hash(тик).
 *
 * Победа считается по Φ-вкладу: чей род держит больше живых клеток
 * в финале, тот бог и вёл мир вернее.
 */
import { Cell, GRID_W, GRID_H, Terrain, type WorldState } from '../core/grid';
import type { Me } from '../core/rules';
import { BreathPool, COST } from './breath';

export type DemiurgeAct = 'sow' | 'decree' | 'wait';

export interface DemiurgeMove {
  act: DemiurgeAct;
  /** Что именно сделал — для журнала и для «открытой игры». */
  text: string;
}

/** Как часто соперник размышляет (тиков). */
export const DEMIURGE_PERIOD = 30;
/** До скольких клеток соперник растит свой род, прежде чем беречь его. */
export const DEMIURGE_AMBITION = 200;

export class Demiurge {
  readonly breath = new BreathPool();
  /** Род, который ведёт соперник. */
  strain = 2;
  /** Провинция, которую он считает своей. */
  province = 1;
  /** Что он намерен сделать в следующий раз — открытая игра. */
  intent = 'Осматривает свои земли.';
  private lastDecreeTick = -999;

  reset(strain: number, province: number): void {
    this.breath.reset();
    this.strain = strain;
    this.province = province;
    this.intent = 'Осматривает свои земли.';
    this.lastDecreeTick = -999;
  }

  /** Живых клеток своего рода. */
  countOwn(world: WorldState): number {
    let n = 0;
    for (let i = 0; i < world.cells.length; i++) {
      if (world.cells[i] === Cell.Seed && world.kind[i] === this.strain) n++;
    }
    return n;
  }

  /**
   * Ход соперника. Мутирует мир только через посев — как рука игрока,
   * и только в своей провинции. Возвращает описание хода или null.
   */
  think(world: WorldState, me: Me, phi: number, rivalCount = 0): DemiurgeMove | null {
    this.breath.feed(phi);
    if (world.tick % DEMIURGE_PERIOD !== 0) return null;

    const own = this.countOwn(world);

    // Правило 1: род на грани — сеять в родной провинции.
    if (own < DEMIURGE_AMBITION && this.breath.canAfford('sow')) {
      const spot = this.findSpot(world);
      if (spot >= 0) {
        this.breath.spend('sow');
        this.sowCross(world, spot);
        this.intent = own < 40 ? 'Спасает свой род посевом.' : 'Расширяет владения.';
        return { act: 'sow', text: `Демиург сеет в провинции ${this.province + 1}.` };
      }
    }

    /*
     * Правило 2: соперник вырвался вперёд — крепить землю Заповедником.
     * Горнило (щедрое рождение) Демиург не трогает: испытания показали, что
     * перенаселение схлопывает род до нуля. Мудрый бог знает цену хаосу —
     * а игрок волен ошибиться сам.
     */
    if (
      rivalCount > own * 1.6 &&
      world.tick - this.lastDecreeTick > 400 &&
      this.breath.canAfford('decree') &&
      me.laws.length > this.province
    ) {
      this.breath.spend('decree');
      this.lastDecreeTick = world.tick;
      me.laws[this.province] = { survive: 1, birth: 0 };
      this.intent = 'Отстаёт и крепит свои земли.';
      return { act: 'decree', text: `Демиург укрепил провинцию ${this.province + 1} Заповедником.` };
    }

    // Правило 3: род окреп — укрепить землю указом (Заповедник).
    if (
      own >= DEMIURGE_AMBITION &&
      world.tick - this.lastDecreeTick > 400 &&
      this.breath.canAfford('decree') &&
      me.laws.length > this.province
    ) {
      this.breath.spend('decree');
      this.lastDecreeTick = world.tick;
      me.laws[this.province] = { survive: 1, birth: 0 };
      this.intent = 'Бережёт свои формы законом.';
      return { act: 'decree', text: `Демиург объявил Заповедник в провинции ${this.province + 1}.` };
    }

    this.intent =
      own < DEMIURGE_AMBITION ? 'Копит Дыхание для посева.' : 'Наблюдает, как крепнет его род.';
    return null;
  }

  /** Место для посева: пустая клетка своей провинции, ближе к своим. */
  private findSpot(world: WorldState): number {
    const h = Math.imul(world.tick ^ 0x0de301, 2654435761) >>> 0;
    for (let k = 0; k < 300; k++) {
      const hk = Math.imul(h ^ (k + 1), 40503) >>> 0;
      const i = hk % world.cells.length;
      if (
        world.cells[i] === Cell.Empty &&
        world.province[i] === this.province &&
        world.terrain[i] !== Terrain.Crystal
      ) {
        return i;
      }
    }
    return -1;
  }

  private sowCross(world: WorldState, center: number): void {
    const x0 = center % GRID_W;
    const y0 = (center / GRID_W) | 0;
    const spots: [number, number][] = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of spots) {
      const x = (x0 + dx + GRID_W) % GRID_W;
      const y = (y0 + dy + GRID_H) % GRID_H;
      const i = y * GRID_W + x;
      if (world.cells[i] === Cell.Empty && world.terrain[i] !== Terrain.Crystal) {
        world.cells[i] = Cell.Seed;
        world.age[i] = 0;
        world.kind[i] = this.strain;
        world.atp[i] = 150;
        world.integ[i] = 255;
      }
    }
  }
}

/** Итог спора: кто вёл мир вернее. */
export function judgeContest(
  world: WorldState,
  playerStrains: number[],
  demiurgeStrain: number,
): { player: number; demiurge: number; verdict: string } {
  let pl = 0;
  let dm = 0;
  for (let i = 0; i < world.cells.length; i++) {
    if (world.cells[i] !== Cell.Seed) continue;
    const k = world.kind[i] as number;
    if (k === demiurgeStrain) dm++;
    else if (playerStrains.includes(k)) pl++;
  }
  const verdict =
    pl > dm
      ? `Спор Богов выигран: твои рода ${pl} против ${dm}.`
      : pl < dm
        ? `Спор Богов проигран: Демиург ${dm} против твоих ${pl}.`
        : `Спор Богов свёлся вничью: ${pl} на ${dm}.`;
  return { player: pl, demiurge: dm, verdict };
}

export { COST as DEMIURGE_COST };
