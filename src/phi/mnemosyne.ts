/**
 * phi/mnemosyne — память: возраст стабильности кластеров, нормированный в [0..1].
 * Насыщение по экспоненте: молодость растёт быстро, древность — медленно.
 */
import { MIN_FORM_SIZE, type Cluster } from './clusters';

/** Возраст (в тиках), к которому память считается «зрелой» (~63%). */
const MEMORY_TAU = 50;

/** Кластер устойчив — прожил не меньше этого (порог T из канона). */
export const STABLE_AGE = 25;

export function mnemosyneNorm(clusters: Cluster[]): number {
  let weighted = 0;
  let total = 0;
  for (const c of clusters) {
    if (c.size < MIN_FORM_SIZE) continue;
    weighted += (1 - Math.exp(-c.age / MEMORY_TAU)) * c.size;
    total += c.size;
  }
  return total === 0 ? 0 : weighted / total;
}
