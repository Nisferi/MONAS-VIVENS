/**
 * phi/philia — внутренняя связность кластеров, нормированная в [0..1].
 * Плотный кластер (много рёбер на клетку) > рыхлой цепочки.
 */
import { MIN_FORM_SIZE, type Cluster } from './clusters';

/** Рёбер на клетку у плотного блока ≈ 3 (каждое ребро считано один раз). */
const EDGES_PER_CELL_DENSE = 3;

export function philiaNorm(clusters: Cluster[]): number {
  let weighted = 0;
  let total = 0;
  for (const c of clusters) {
    if (c.size < MIN_FORM_SIZE) continue;
    const density = Math.min(1, c.edges / (EDGES_PER_CELL_DENSE * c.size));
    weighted += density * c.size;
    total += c.size;
  }
  return total === 0 ? 0 : weighted / total;
}
