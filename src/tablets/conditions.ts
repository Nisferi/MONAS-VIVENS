/**
 * tablets/conditions — условия пробуждения Табличек (3 вида MVP).
 * Только чтение: проверяют отчёт Φ и энергию поля.
 */
import type { PhiReport } from '../phi/phi';

export type ConditionKind = 'phiBelow' | 'energyBelow' | 'chaosAbove';

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
];

export function describeCondition(spec: ConditionSpec): string {
  const opt = CONDITION_OPTIONS.find((o) => o.kind === spec.kind);
  return opt ? `${opt.label} ${opt.fmt(spec.threshold)}` : '?';
}

export function conditionMet(spec: ConditionSpec, report: PhiReport, energy: number): boolean {
  switch (spec.kind) {
    case 'phiBelow':
      return report.phi < spec.threshold;
    case 'energyBelow':
      return energy < spec.threshold;
    case 'chaosAbove':
      return report.chaos * 100 > spec.threshold;
  }
}
