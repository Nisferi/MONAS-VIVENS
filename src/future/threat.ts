/**
 * future/threat — детерминированная судьба партии, заложенная в seed:
 * серия из трёх Нейкос-штормов нарастающей силы с передышками между ними.
 * Генерирует только параметры; применяет их чистое ядро (core/energy),
 * поэтому прогноз видит каждый шторм заранее.
 *
 * Темп: при ×1 (10 тиков/с) партия живёт 12–16 минут; скорость ×2/×4
 * сжимает её, ×½ — растягивает в медитацию.
 */
import { mulberry32 } from '../core/rng';
import type { ThreatWindow } from '../core/rules';

export const STORM_COUNT = 3;

export function threatsFromSeed(seed: number): ThreatWindow[] {
  const rng = mulberry32(seed ^ 0x517e5eed);
  const storms: ThreatWindow[] = [];
  let t = 1600 + Math.floor(rng() * 600); // первый шторм: тик 1600–2200
  for (let k = 0; k < STORM_COUNT; k++) {
    const duration = 100 + k * 60 + Math.floor(rng() * 50); // каждый дольше прежнего
    storms.push({ tick: t, duration });
    t += duration + 1800 + Math.floor(rng() * 700); // передышка ~3 минуты
  }
  return storms;
}
