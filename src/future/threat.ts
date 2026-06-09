/**
 * future/threat — детерминированная угроза партии, заложенная в seed.
 * Генерирует только параметры; применяет их чистое ядро (core/energy):
 * поэтому прогноз будущего видит кризис заранее — он часть судьбы.
 */
import { mulberry32 } from '../core/rng';

export interface Threat {
  tick: number;
  duration: number;
}

export function threatFromSeed(seed: number): Threat {
  const rng = mulberry32(seed ^ 0x517e5eed);
  return {
    tick: 500 + Math.floor(rng() * 300), // приходит на 500–800 тике
    duration: 100 + Math.floor(rng() * 60), // длится 100–160 тиков
  };
}
