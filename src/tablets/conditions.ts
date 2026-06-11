/**
 * tablets/conditions — условия пробуждения Табличек (3 вида MVP).
 * Только чтение: проверяют отчёт Φ и энергию поля.
 */
import type { WorldState } from '../core/grid';
import type { Me } from '../core/rules';
import type { PhiReport } from '../phi/phi';

export type ConditionKind = 'phiBelow' | 'energyBelow' | 'chaosAbove' | 'stormSoon' | 'strainDying' | 'afterTablet';

export interface ConditionSpec {
  kind: ConditionKind;
  threshold: number;
}

export interface ConditionOption {
  kind: ConditionKind;
  label: string;
  thresholds: number[];
  /** Как показать порог человеку. */
  fmt(threshold: number): string;
}

export const CONDITION_OPTIONS: ConditionOption[] = [
  {
    kind: 'phiBelow',
    label: 'Φ упадёт ниже',
    thresholds: [10, 15, 20, 25],
    fmt: (t) => String(t),
  },
  {
    kind: 'energyBelow',
    label: 'Энергия ниже',
    thresholds: [25, 50, 75],
    fmt: (t) => `${t}%`,
  },
  {
    kind: 'chaosAbove',
    label: 'Хаос выше',
    thresholds: [30, 40, 50],
    fmt: (t) => `${t}%`,
  },
  {
    kind: 'stormSoon',
    label: 'Шторм ближе чем за',
    thresholds: [150, 75, 25],
    fmt: (t) => `${t} тиков`,
  },
  {
    kind: 'strainDying',
    label: 'Род вымирает (<10 клеток):',
    thresholds: [0, 1, 2],
    fmt: (t) => ['Огонь', 'Нефрит', 'Аметист'][t] ?? '?',
  },
  {
    kind: 'afterTablet',
    label: 'После таблички №',
    thresholds: [1, 2, 3, 4],
    fmt: (t) => String(t),
  },
];

export function describeCondition(spec: ConditionSpec): string {
  const opt = CONDITION_OPTIONS.find((o) => o.kind === spec.kind);
  return opt ? `${opt.label} ${opt.fmt(spec.threshold)}` : '?';
}

export function conditionMet(
  spec: ConditionSpec,
  report: PhiReport,
  world: WorldState,
  me: Me,
  firedByIndex: boolean[],
): boolean {
  switch (spec.kind) {
    case 'phiBelow':
      return report.phi < spec.threshold;
    case 'energyBelow':
      return world.energy < spec.threshold;
    case 'chaosAbove':
      return report.chaos * 100 > spec.threshold;
    case 'stormSoon':
      // Судьба известна — табличка слышит её приближение.
      return me.threats.some(
        (t) => world.tick < t.tick && t.tick - world.tick <= spec.threshold,
      );
    case 'strainDying': {
      let n = 0;
      for (let i = 0; i < world.cells.length; i++) {
        if (world.cells[i] === 1 && world.kind[i] === spec.threshold) n++;
      }
      return n > 0 && n < 10;
    }
    case 'afterTablet':
      // Цепочка: лист на ветви Ме — табличка ждёт сработки другой.
      return firedByIndex[spec.threshold - 1] === true;
  }
}
