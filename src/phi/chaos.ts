/**
 * phi/chaos — шум: доля живых клеток вне форм (одиночки и крошечные
 * мерцающие группы, не дожившие до устойчивости). Нормирован в [0..1].
 */
import { MIN_FORM_SIZE, type Cluster } from './clusters';

/** Моложе этого возраста (тиков) даже крупная группа ещё считается мерцанием. */
const FLICKER_AGE = 5;

export function chaosNorm(clusters: Cluster[]): number {
  let noise = 0;
  let alive = 0;
  for (const c of clusters) {
    alive += c.size;
    if (c.size < MIN_FORM_SIZE || c.age < FLICKER_AGE) noise += c.size;
  }
  return alive === 0 ? 0 : noise / alive;
}
