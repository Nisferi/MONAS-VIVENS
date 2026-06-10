/**
 * run/stages — фазы партии и условия её конца.
 * Genesis → Морфогенез → Разум → (шторм ↔ передышка ×3) → После бури.
 */
import type { WorldState } from '../core/grid';
import { isThreatActive } from '../core/energy';
import type { Me } from '../core/rules';

export type Stage = 'genesis' | 'morpho' | 'mind' | 'crisis' | 'respite' | 'aftermath';

export const STAGE_NAMES: Record<Stage, string> = {
  genesis: 'Genesis',
  morpho: 'Морфогенез',
  mind: 'Разум',
  crisis: 'Нейкос-шторм',
  respite: 'Передышка',
  aftermath: 'После бури',
};

/** Сколько тиков после последнего шторма длится развязка. */
export const AFTERMATH_TICKS = 300;

export function firstThreatTick(me: Me): number {
  return me.threats.length > 0 ? (me.threats[0] as { tick: number }).tick : Number.MAX_SAFE_INTEGER;
}

export function lastThreatEnd(me: Me): number {
  let end = 0;
  for (const t of me.threats) end = Math.max(end, t.tick + t.duration);
  return end;
}

export function currentStage(
  world: WorldState,
  me: Me,
  unlocked2: boolean,
  unlocked3: boolean,
): Stage {
  if (isThreatActive(me, world.tick)) return 'crisis';
  if (me.threats.length > 0 && world.tick >= lastThreatEnd(me)) return 'aftermath';
  if (world.tick >= firstThreatTick(me)) return 'respite';
  if (unlocked3) return 'mind';
  if (unlocked2) return 'morpho';
  return 'genesis';
}

export function endTick(me: Me): number {
  return me.threats.length > 0 ? lastThreatEnd(me) + AFTERMATH_TICKS : Number.MAX_SAFE_INTEGER;
}

/** Жизнь считается павшей, если Семян меньше порога. */
export const SURVIVAL_THRESHOLD = 30;
