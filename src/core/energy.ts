/**
 * core/energy — энергия поля: приток и расход.
 * Часть чистого ядра: вызывается из tick(), значит прогноз будущего
 * автоматически видит и голод, и приход угрозы.
 *
 * Угроза (Нейкос-шторм) — окно тиков, заложенное в Ме из seed при старте
 * (future/threat.ts только генерирует параметры): приток гаснет, расход
 * удваивается. Детерминизм полный.
 */
import type { Me } from './rules';

export const ENERGY_MAX = 100;
/** Ниже этого уровня поле голодает: выживание ужесточается на 1 соседа. */
export const STARVATION_LEVEL = 1;

export function isThreatActive(me: Me, tickNo: number): boolean {
  for (const t of me.threats) {
    if (tickNo >= t.tick && tickNo < t.tick + t.duration) return true;
  }
  return false;
}

/** Уровень энергии, при котором Споры решаются прорасти. */
export const SPROUT_ENERGY = 55;

export function nextEnergy(
  energy: number,
  aliveSeeds: number,
  me: Me,
  tickNo: number,
  springInflux = 0,
): number {
  const threat = isThreatActive(me, tickNo);
  // Шторм: приток гаснет (даже родники мелеют вдвое), расход ×6.
  const influx = threat ? springInflux / 2 : me.energyInflux + springInflux;
  const drain = (aliveSeeds / 100) * me.energyDrainPer100 * (threat ? 6 : 1);
  const next = energy + influx - drain;
  return next < 0 ? 0 : next > ENERGY_MAX ? ENERGY_MAX : next;
}
