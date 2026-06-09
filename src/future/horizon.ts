/**
 * future/horizon — дальность зрения разума: N = f(Φ).
 * Сила разума = дальность зрения (docs/design/05-future.md):
 * низкое Φ — туман уже через 10 тиков, высокое — ясность на 200.
 */
export const HORIZON_MIN = 10;
export const HORIZON_MAX = 200;

export function horizonTicks(phi: number): number {
  return Math.round(Math.min(HORIZON_MAX, HORIZON_MIN + phi * 3));
}
