/**
 * phi/politics — узнавание и политика форм (§16.5–6).
 * Аналитический слой: НЕ мутирует мир (golden цел). По кластерам определяет,
 * какие крупные формы соприкасаются, дружат (разные рода мирно рядом),
 * враждуют (разные рода у одного родника) — для летописи и линзы Филии.
 */
import { GRID_W, GRID_H, Terrain, type WorldState } from '../core/grid';
import { MIN_FORM_SIZE, type Cluster } from './clusters';

export type Relation = 'ally' | 'war';

export interface FormTie {
  a: number; // id кластера
  b: number;
  relation: Relation;
  ageTicks: number; // сколько тиков держится
}

/** Форма достойна политики: крупная и зрелая. */
const POLITIC_SIZE = 10;
const POLITIC_AGE = 40;
/** Сколько тиков соприкосновения делают связь союзом/войной. */
export const TIE_THRESHOLD = 60;

interface Border {
  contacts: number; // близкие пары клеток двух форм
}

/**
 * Радиус соседства колоний. Прямое касание невозможно: flood fill слил бы
 * такие формы в один кластер. Политика — про близкие, но раздельные колонии
 * (как соседние поселения через полосу земли).
 */
const NEIGHBOR_RADIUS = 3;

export class PoliticsTracker {
  /** Ключ "min-max" id → накопленное состояние. */
  private ties = new Map<string, FormTie>();

  reset(): void {
    this.ties.clear();
  }

  /** Обновить политику; вернуть свежие события (стал союз/война). */
  update(world: WorldState, clusters: Cluster[]): string[] {
    const big = clusters.filter((c) => c.size >= POLITIC_SIZE && c.age >= POLITIC_AGE);
    if (big.length < 2) {
      this.ties.clear();
      return [];
    }
    // Владелец клетки → id кластера (только у крупных форм).
    const owner = new Int32Array(world.cells.length).fill(-1);
    const kindOf = new Map<number, number>();
    const nameSize = new Map<number, number>();
    for (const c of big) {
      kindOf.set(c.id, world.kind[c.cells[0] as number] ?? 0);
      nameSize.set(c.id, c.size);
      for (const idx of c.cells) owner[idx] = c.id;
    }

    // Соседство колоний и родники, к которым каждая тянется.
    const borders = new Map<string, Border>();
    const springsOf = new Map<number, Set<number>>();
    const R = NEIGHBOR_RADIUS;
    for (const c of big) {
      const mySprings = springsOf.get(c.id) ?? new Set<number>();
      springsOf.set(c.id, mySprings);
      for (const idx of c.cells) {
        const x = idx % GRID_W;
        const y = (idx / GRID_W) | 0;
        for (let dy = -R; dy <= R; dy++) {
          for (let dx = -R; dx <= R; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = (x + dx + GRID_W) % GRID_W;
            const ny = (y + dy + GRID_H) % GRID_H;
            const ni = ny * GRID_W + nx;
            if (world.terrain[ni] === Terrain.Spring) mySprings.add(ni);
            const o = owner[ni] as number;
            if (o >= 0 && o !== c.id) {
              const key = c.id < o ? `${c.id}-${o}` : `${o}-${c.id}`;
              const b = borders.get(key) ?? { contacts: 0 };
              b.contacts++;
              borders.set(key, b);
            }
          }
        }
      }
    }

    const events: string[] = [];
    const live = new Set<string>();
    for (const [key, b] of borders) {
      if (b.contacts < 3) continue;
      const [a, bb] = key.split('-').map(Number) as [number, number];
      const sameKind = kindOf.get(a) === kindOf.get(bb);
      if (sameKind) continue; // своих политика не касается — они и так едины
      live.add(key);
      // Общий родник — война за воду; иначе мирное соседство — союз.
      const sa = springsOf.get(a);
      const sb = springsOf.get(bb);
      let contested = false;
      if (sa && sb) {
        for (const sp of sa) {
          if (sb.has(sp)) {
            contested = true;
            break;
          }
        }
      }
      const relation: Relation = contested ? 'war' : 'ally';
      const prev = this.ties.get(key);
      const ageTicks = prev && prev.relation === relation ? prev.ageTicks + 1 : 1;
      const tie: FormTie = { a, b: bb, relation, ageTicks };
      this.ties.set(key, tie);
      if (ageTicks === TIE_THRESHOLD) {
        events.push(
          relation === 'ally'
            ? 'Две формы разных родов заключили союз.'
            : 'Две формы сошлись в войне за родник.',
        );
      }
    }
    // Забыть распавшиеся связи.
    for (const key of [...this.ties.keys()]) if (!live.has(key)) this.ties.delete(key);
    return events;
  }

  /** Устоявшиеся связи для линзы Филии. */
  established(): FormTie[] {
    return [...this.ties.values()].filter((t) => t.ageTicks >= TIE_THRESHOLD);
  }

  /** Итог для летописи. */
  summary(): { allies: number; wars: number } {
    let allies = 0;
    let wars = 0;
    for (const t of this.established()) {
      if (t.relation === 'ally') allies++;
      else wars++;
    }
    return { allies, wars };
  }
}
