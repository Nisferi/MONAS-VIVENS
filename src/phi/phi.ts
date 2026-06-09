/**
 * phi/phi — итоговая формула сознания:
 *
 *   Φ = Семена × Филия × Мнемозина − Хаос − Нейкос
 *
 * Каждый член нормирован в [0..1] (защита от доминирования одного члена,
 * docs/design/02-phi.md); Семена — с логарифмом по числу клеток в устойчивых
 * кластерах. Вычитаемые члены взвешены, итог масштабирован в читабельные 0..100.
 */
import { MIN_FORM_SIZE, type Cluster } from './clusters';
import { chaosNorm } from './chaos';
import { mnemosyneNorm, STABLE_AGE } from './mnemosyne';
import { philiaNorm } from './philia';

export interface PhiReport {
  /** Итог, 0..100. */
  phi: number;
  /** Члены формулы, каждый в [0..1]. */
  seeds: number;
  philia: number;
  mnemosyne: number;
  chaos: number;
  neikos: number;
  /** Клеток в устойчивых кластерах (для HUD). */
  stableCells: number;
}

/** Насыщение логарифма Семян: столько клеток в формах ≈ максимум члена. */
const SEEDS_CAP = 900;
const CHAOS_WEIGHT = 0.25;
const NEIKOS_WEIGHT = 0.25;
const SCALE = 100;

export function computePhi(clusters: Cluster[], neikos: number): PhiReport {
  let stableCells = 0;
  for (const c of clusters) {
    if (c.size >= MIN_FORM_SIZE && c.age >= STABLE_AGE) stableCells += c.size;
  }

  const seeds = Math.min(1, Math.log1p(stableCells) / Math.log1p(SEEDS_CAP));
  const philia = philiaNorm(clusters);
  const mnemosyne = mnemosyneNorm(clusters);
  const chaos = chaosNorm(clusters);

  /*
   * Кубический корень из произведения: сохраняет смысл умножения (ноль любого
   * члена обнуляет целое), но выравнивает масштаб с вычитаемыми членами —
   * иначе произведение трёх дробей структурно мельче линейных штрафов
   * (поймано балансным тестом, см. docs/design/02-phi.md).
   */
  const integration = Math.cbrt(seeds * philia * mnemosyne);
  const phi = Math.max(
    0,
    (integration - CHAOS_WEIGHT * chaos - NEIKOS_WEIGHT * neikos) * SCALE,
  );

  return { phi, seeds, philia, mnemosyne, chaos, neikos, stableCells };
}
