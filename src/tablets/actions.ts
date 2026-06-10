/**
 * tablets/actions — 3 действия Табличек (MVP).
 * Мутируют мир — но вызываются ТОЛЬКО из tablets/engine по сработавшему
 * условию: это единственная санкционированная рука извне правил
 * (docs/design/09-architecture.md).
 */
import { Cell, GRID_W, Terrain, type WorldState } from '../core/grid';
import { MIN_FORM_SIZE, type Cluster } from '../phi/clusters';

export type ActionKind = 'sever' | 'sleep' | 'sacrifice' | 'infuse' | 'resow';

export const ACTION_OPTIONS: { kind: ActionKind; label: string }[] = [
  { kind: 'sever', label: 'разорвать перегруз (отсечь край крупнейшей формы)' },
  { kind: 'sleep', label: 'перевести крупнейшую форму в спячку' },
  { kind: 'sacrifice', label: 'пожертвовать наименьшую форму' },
  { kind: 'infuse', label: 'влить запас энергии (+20)' },
  { kind: 'resow', label: 'засеять кольцо у сердца крупнейшей формы' },
];

export function describeAction(kind: ActionKind): string {
  return ACTION_OPTIONS.find((o) => o.kind === kind)?.label ?? '?';
}

/** Сколько тиков форма спит. */
export const SLEEP_TICKS = 80;

function largestForm(clusters: Cluster[]): Cluster | null {
  let best: Cluster | null = null;
  for (const c of clusters) {
    if (c.size >= MIN_FORM_SIZE && (!best || c.size > best.size)) best = c;
  }
  return best;
}

function smallestForm(clusters: Cluster[]): Cluster | null {
  let best: Cluster | null = null;
  for (const c of clusters) {
    if (c.size >= MIN_FORM_SIZE && (!best || c.size < best.size)) best = c;
  }
  return best;
}

export interface ActionOutcome {
  message: string;
  /** Клетки, уснувшие Сигналом (двигатель разбудит их позже). */
  sleeperCells?: number[];
}

/** Применить действие; null — если в мире не нашлось цели. */
export function applyAction(
  kind: ActionKind,
  world: WorldState,
  clusters: Cluster[],
): ActionOutcome | null {
  switch (kind) {
    case 'sever': {
      const c = largestForm(clusters);
      if (!c) return null;
      // Отсекаем треть клеток, дальних от сердца формы, — в Прах.
      const sorted = [...c.cells].sort((a, b) => {
        const da = dist2(a, c.cx, c.cy);
        const db = dist2(b, c.cx, c.cy);
        return db - da;
      });
      const cut = Math.max(1, Math.floor(sorted.length / 3));
      for (let i = 0; i < cut; i++) {
        const idx = sorted[i] as number;
        world.cells[idx] = Cell.Ash;
        world.age[idx] = 0;
      }
      return { message: `край формы отсечён (${cut} клеток обратились в Прах)` };
    }
    case 'sleep': {
      const c = largestForm(clusters);
      if (!c) return null;
      for (const idx of c.cells) {
        world.cells[idx] = Cell.Signal;
        world.age[idx] = 0;
      }
      return {
        message: `форма из ${c.size} клеток уснула на ${SLEEP_TICKS} тиков`,
        sleeperCells: [...c.cells],
      };
    }
    case 'sacrifice': {
      const c = smallestForm(clusters);
      if (!c) return null;
      for (const idx of c.cells) {
        world.cells[idx] = Cell.Ash;
        world.age[idx] = 0;
      }
      return { message: `форма из ${c.size} клеток принесена в жертву` };
    }
    case 'infuse': {
      // Запас, заложенный в глину при высечении, вливается в поле.
      world.energy = Math.min(100, world.energy + 20);
      return { message: 'запас энергии влился в поле (+20)' };
    }
    case 'resow': {
      const c = largestForm(clusters);
      if (!c) return null;
      const cx = Math.round(c.cx);
      const cy = Math.round(c.cy);
      const R = 4;
      let sown = 0;
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const x = (cx + Math.round(Math.cos(a) * R) + GRID_W) % GRID_W;
        const y = (cy + Math.round(Math.sin(a) * R) + GRID_W) % GRID_W;
        const i = y * GRID_W + x;
        if (world.cells[i] !== Cell.Seed && world.terrain[i] !== Terrain.Crystal) {
          world.cells[i] = Cell.Seed;
          world.age[i] = 0;
          world.kind[i] = world.kind[c.cells[0] as number] ?? 0;
          sown++;
        }
      }
      return sown > 0
        ? { message: `кольцо из ${sown} Семян взошло у сердца формы` }
        : null;
    }
  }
}

function dist2(idx: number, cx: number, cy: number): number {
  const x = idx % GRID_W;
  const y = (idx / GRID_W) | 0;
  return (x - cx) * (x - cx) + (y - cy) * (y - cy);
}
