/**
 * run/stages — фазы партии и условия её конца.
 * Genesis → Морфогенез → Разум → (кризис) → Финал.
 */
import type { WorldState } from '../core/grid';
import { isThreatActive } from '../core/energy';
import type { Me } from '../core/rules';

export type Stage = 'genesis' | 'morpho' | 'mind' | 'crisis' | 'aftermath';

export const STAGE_NAMES: Record<Stage, string> = {
  genesis: 'Genesis',
  morpho: 'Морфогенез',
  mind: 'Разум',
  crisis: 'Нейкос-шторм',
  aftermath: 'После бури',
};

/** Сколько тиков после конца угрозы длится развязка. */
export const AFTERMATH_TICKS = 300;

export function currentStage(world: WorldState, me: Me, unlocked2: boolean, unlocked3: boolean): Stage {
  if (isThreatActive(me, world.tick)) return 'crisis';
  if (world.tick >= me.threatTick + me.threatDuration) return 'aftermath';
  if (unlocked3) return 'mind';
  if (unlocked2) return 'morpho';
  return 'genesis';
}

export function endTick(me: Me): number {
  return me.threatTick + me.threatDuration + AFTERMATH_TICKS;
}

/** Жизнь считается павшей, если Семян меньше порога. */
export const SURVIVAL_THRESHOLD = 30;
