/**
 * run/breath — Дыхание Творца (§15.1): экономика божественной силы.
 *
 * Центральный цикл стратегии: Дыхание копится от Φ (мир, который видит себя,
 * кормит своего бога) и тратится на всякое вмешательство. Чтобы влиять —
 * расти Φ; чтобы растить Φ — влияй. Жадный бог нищает, терпеливый всемогущ,
 * но может опоздать к шторму.
 */

export type Spend = 'sow' | 'me' | 'tablet' | 'decree';

export const COST: Record<Spend, number> = {
  sow: 2, // посев креста
  me: 8, // правка одного закона Ме
  tablet: 12, // высечение Таблички
  decree: 20, // указ провинции (§15.4): локальный закон дороже всего
};

export const DECREE_COST = 20;

export const BREATH_MAX = 120;
export const BREATH_START = 30;

/** Прирост за тик: мир с высокой Φ кормит бога щедрее. */
export function breathGain(phi: number): number {
  return 0.02 + phi * 0.004;
}

export class BreathPool {
  private value = BREATH_START;

  reset(start = BREATH_START): void {
    this.value = start;
  }

  get current(): number {
    return this.value;
  }

  /** Накопление за тик от Φ. */
  feed(phi: number): void {
    this.value = Math.min(BREATH_MAX, this.value + breathGain(phi));
  }

  canAfford(what: Spend): boolean {
    return this.value >= COST[what];
  }

  /** Потратить; false — не хватило. */
  spend(what: Spend): boolean {
    if (!this.canAfford(what)) return false;
    this.value -= COST[what];
    return true;
  }

  /** Вернуть трату — «рука дрогнула» (откат жеста). */
  refund(what: Spend): void {
    this.value = Math.min(BREATH_MAX, this.value + COST[what]);
  }

  /** Сохранение Очага. */
  toJSON(): number {
    return this.value;
  }

  fromJSON(v: number): void {
    this.value = Math.min(BREATH_MAX, Math.max(0, v || BREATH_START));
  }
}
