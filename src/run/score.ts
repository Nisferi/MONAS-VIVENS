/**
 * run/score — формула счёта (docs/design/07-run-loop.md).
 * Принцип элегантности: меньше Ме-правок и табличек при том же
 * результате — выше счёт (стиль Zachtronics).
 */
import type { Ending } from './endings';

export interface ScoreInput {
  phi: number;
  survived: boolean;
  /** Максимальная достигнутая дальность взора. */
  horizonMax: number;
  neikos: number;
  chaos: number;
  ending: Ending;
  meEdits: number;
  tabletsCarved: number;
}

const ENDING_BONUS: Record<string, number> = {
  absolute: 50,
  mycelium: 30,
  sphairos: 5,
  prophet: 5,
  swamp: 0,
};

export function computeScore(i: ScoreInput): number {
  const balanceBonus = i.neikos >= 0.05 && i.neikos <= 0.6 ? 15 : 0;
  const score =
    i.phi * 2 +
    (i.survived ? 30 : 0) +
    i.horizonMax / 10 +
    balanceBonus +
    (ENDING_BONUS[i.ending.id] ?? 0) -
    i.chaos * 20 -
    i.meEdits -
    2 * i.tabletsCarved;
  return Math.max(0, Math.round(score));
}
