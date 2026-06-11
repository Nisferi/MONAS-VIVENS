/**
 * future/events — редкие события судьбы из seed: кометный посев и год тишины.
 * Генерируются при сотворении, применяются чистым ядром — прогноз видит их.
 */
import { mulberry32 } from '../core/rng';
import type { WorldEvent } from '../core/rules';

export function eventsFromSeed(seed: number): WorldEvent[] {
  const rng = mulberry32(seed ^ 0x5eed5);
  const out: WorldEvent[] = [];
  if (rng() < 0.45) {
    out.push({ kind: 'comet', tick: 900 + Math.floor(rng() * 2600), duration: 1 });
  }
  if (rng() < 0.45) {
    out.push({ kind: 'quiet', tick: 700 + Math.floor(rng() * 3000), duration: 300 });
  }
  return out;
}
