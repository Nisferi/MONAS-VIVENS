/**
 * tablets/engine — спящие правила ЕСЛИ→ТО.
 * Высекаются заранее, спят, проверяются каждый тик и срабатывают сами —
 * без игрока. Единственный модуль, меняющий мир извне правил.
 */
import { Cell, type WorldState } from '../core/grid';
import type { Cluster } from '../phi/clusters';
import type { PhiReport } from '../phi/phi';
import { SLEEP_TICKS, applyAction, describeAction, type ActionKind } from './actions';
import type { Me } from '../core/rules';
import { conditionMet, describeCondition, type ConditionSpec } from './conditions';
import { CARVE_COST, canCarve } from './cost';

export interface Tablet {
  id: number;
  condition: ConditionSpec;
  action: ActionKind;
  fired: boolean;
  firedTick: number | null;
}

interface Sleeper {
  wakeTick: number;
  cells: number[];
}

export class TabletEngine {
  tablets: Tablet[] = [];
  /** Сообщения сработавших табличек — для летописи. */
  firedLog: string[] = [];
  private sleepers: Sleeper[] = [];
  private nextId = 1;

  /** Высечь табличку; возвращает текст ошибки или null при успехе. */
  carve(condition: ConditionSpec, action: ActionKind, world: WorldState): string | null {
    const denied = canCarve(world.energy, this.tablets.length);
    if (denied) return denied;
    world.energy -= CARVE_COST;
    this.tablets.push({ id: this.nextId++, condition, action, fired: false, firedTick: null });
    return null;
  }

  /** Проверка условий и пробуждения спящих. Возвращает сообщения событий. */
  update(world: WorldState, clusters: Cluster[], report: PhiReport, me: Me): string[] {
    const messages: string[] = [];

    // Пробуждение уснувших форм.
    this.sleepers = this.sleepers.filter((s) => {
      if (world.tick < s.wakeTick) return true;
      for (const idx of s.cells) {
        if (world.cells[idx] === Cell.Signal) {
          world.cells[idx] = Cell.Seed;
          world.age[idx] = 0;
        }
      }
      messages.push('Спящая форма пробудилась.');
      return false;
    });

    // Сработка табличек: одна за тик, чтобы события читались.
    for (const t of this.tablets) {
      if (t.fired) continue;
      if (!conditionMet(t.condition, report, world, me)) continue;
      const outcome = applyAction(t.action, world, clusters);
      t.fired = true;
      t.firedTick = world.tick;
      if (outcome) {
        if (outcome.sleeperCells) {
          this.sleepers.push({ wakeTick: world.tick + SLEEP_TICKS, cells: outcome.sleeperCells });
        }
        const text = `Табличка Судеб пробудилась: ${outcome.message}.`;
        messages.push(text);
        this.firedLog.push(`на ${world.tick} тике ${describeCondition(t.condition)} — ${outcome.message}`);
      } else {
        messages.push('Табличка Судеб пробудилась, но рука не нашла цели.');
        this.firedLog.push(`на ${world.tick} тике табличка сработала впустую`);
      }
      break;
    }

    return messages;
  }

  get carvedCount(): number {
    return this.tablets.length;
  }

  get firedCount(): number {
    return this.tablets.filter((t) => t.fired).length;
  }

  describe(t: Tablet): string {
    return `ЕСЛИ ${describeCondition(t.condition)} ТО ${describeAction(t.action)}`;
  }

  reset(): void {
    this.tablets = [];
    this.sleepers = [];
    this.firedLog = [];
    this.nextId = 1;
  }
}
