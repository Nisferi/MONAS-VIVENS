/**
 * phi/neikos — Вражда: накопленное напряжение распадов и расколов.
 * Растёт от смертей и расколов кластеров, медленно остывает.
 * Нормирован в [0..1].
 *
 * Правило канона: Нейкос обязан быть > 0 — полное отсутствие напряжения
 * означает Сфайрос (docs/design/02-phi.md). Живой Конвей даёт его сам:
 * постоянные малые смерти держат Вражду тёплой.
 */
import type { ClusterEvents } from './clusters';

/*
 * Константы откалиброваны балансным тестом (600 тиков Конвея, разные seed):
 * в живой системе с постоянными малыми смертями Нейкос держится ~0.2–0.35,
 * к 1.0 подходит только при массовом распаде. Стационар ≈ gain / (1 − COOLING).
 */
const DEATH_HEAT = 0.008;
const SPLIT_HEAT = 0.005;
/** Доля тепла, остающаяся после каждого тика. */
const COOLING = 0.95;

export class NeikosMeter {
  private heat = 0;

  update(events: ClusterEvents): number {
    this.heat = this.heat * COOLING + events.died * DEATH_HEAT + events.split * SPLIT_HEAT;
    return this.norm();
  }

  norm(): number {
    return 1 - Math.exp(-this.heat);
  }

  reset(): void {
    this.heat = 0;
  }
}
