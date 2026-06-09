/**
 * phi/clusters — поиск устойчивых кластеров и отслеживание их идентичности
 * между тиками (нужно Мнемозине: возраст имеет смысл только у «того же» кластера).
 *
 * Кластер = связная компонента Семян (8-соседство, тороидальное, как в core/rules).
 * Идентичность между тиками — по максимальному пересечению клеток с прошлым тиком.
 * Только читает состояние мира, не пишет ничего.
 */
import { Cell, GRID_H, GRID_W, GRID_SIZE, type WorldState } from '../core/grid';

export interface Cluster {
  id: number;
  /** Индексы клеток кластера. */
  cells: number[];
  size: number;
  /** Внутренние рёбра Филии (каждая пара соседних Семян считается один раз). */
  edges: number;
  /** Центроид в координатах клеток (наивный; для обёрнутых кластеров приближение). */
  cx: number;
  cy: number;
  /** Мнемозина: сколько тиков подряд кластер сохраняет себя. */
  age: number;
}

/**
 * События за тик — топливо Нейкоса. Считаются только для форм
 * (размер ≥ MIN_FORM_SIZE): гибель мерцающего шума — забота Хаоса,
 * иначе один и тот же шум штрафовал бы Φ дважды.
 */
export interface ClusterEvents {
  /** Формы прошлого тика, не унаследованные никем (умерли/слились). */
  died: number;
  /** Новые кластеры, отколовшиеся от существовавших форм (раскол). */
  split: number;
}

/** Кластеры меньше этого размера — шум, не форма (учитывается Хаосом). */
export const MIN_FORM_SIZE = 3;

interface RawCluster {
  cells: number[];
  edges: number;
  cx: number;
  cy: number;
}

/** Связные компоненты живых клеток. */
function findRaw(state: WorldState): RawCluster[] {
  const { cells } = state;
  const visited = new Uint8Array(GRID_SIZE);
  const result: RawCluster[] = [];
  const stack: number[] = [];

  for (let start = 0; start < GRID_SIZE; start++) {
    if (cells[start] !== Cell.Seed || visited[start]) continue;

    const member: number[] = [];
    let edges = 0;
    let sx = 0;
    let sy = 0;
    visited[start] = 1;
    stack.push(start);

    while (stack.length > 0) {
      const i = stack.pop() as number;
      member.push(i);
      const x = i % GRID_W;
      const y = (i / GRID_W) | 0;
      sx += x;
      sy += y;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = (x + dx + GRID_W) % GRID_W;
          const ny = (y + dy + GRID_H) % GRID_H;
          const ni = ny * GRID_W + nx;
          if (cells[ni] !== Cell.Seed) continue;
          // Каждое ребро считаем один раз: только в «положительную» сторону.
          if (dy > 0 || (dy === 0 && dx > 0)) edges++;
          if (!visited[ni]) {
            visited[ni] = 1;
            stack.push(ni);
          }
        }
      }
    }

    result.push({
      cells: member,
      edges,
      cx: sx / member.length,
      cy: sy / member.length,
    });
  }
  return result;
}

export class ClusterTracker {
  /** Принадлежность клетки кластеру на прошлом тике (id или -1). */
  private prevOwner = new Int32Array(GRID_SIZE).fill(-1);
  private prevAges = new Map<number, number>();
  private prevSizes = new Map<number, number>();
  private nextId = 1;

  /** События последнего update — читает Нейкос. */
  events: ClusterEvents = { died: 0, split: 0 };

  update(state: WorldState): Cluster[] {
    const raw = findRaw(state);

    // Для каждого сырого кластера — прошлый id с максимальным пересечением.
    const wanted: { rawIdx: number; prevId: number; overlap: number }[] = [];
    for (let r = 0; r < raw.length; r++) {
      const counts = new Map<number, number>();
      for (const cell of (raw[r] as RawCluster).cells) {
        const owner = this.prevOwner[cell] ?? -1;
        if (owner >= 0) counts.set(owner, (counts.get(owner) ?? 0) + 1);
      }
      let bestId = -1;
      let bestOverlap = 0;
      for (const [id, n] of counts) {
        if (n > bestOverlap) {
          bestId = id;
          bestOverlap = n;
        }
      }
      wanted.push({ rawIdx: r, prevId: bestId, overlap: bestOverlap });
    }

    // Прошлый id наследует тот, у кого пересечение больше; остальные — расколы.
    const heir = new Map<number, { rawIdx: number; overlap: number }>();
    for (const w of wanted) {
      if (w.prevId < 0) continue;
      const cur = heir.get(w.prevId);
      if (!cur || w.overlap > cur.overlap) {
        heir.set(w.prevId, { rawIdx: w.rawIdx, overlap: w.overlap });
      }
    }

    const inheritedBy = new Map<number, number>(); // rawIdx -> prevId
    for (const [prevId, h] of heir) inheritedBy.set(h.rawIdx, prevId);

    this.events = { died: 0, split: 0 };
    const clusters: Cluster[] = [];
    const newAges = new Map<number, number>();
    const owner = new Int32Array(GRID_SIZE).fill(-1);

    for (let r = 0; r < raw.length; r++) {
      const rc = raw[r] as RawCluster;
      const prevId = inheritedBy.get(r);
      let id: number;
      let age: number;
      if (prevId !== undefined) {
        id = prevId;
        age = (this.prevAges.get(prevId) ?? 0) + 1;
      } else {
        id = this.nextId++;
        age = 1;
        // Откололся от живой формы — раскол, а не рождение из пустоты.
        const w = wanted[r] as { prevId: number };
        if (w.prevId >= 0 && (this.prevSizes.get(w.prevId) ?? 0) >= MIN_FORM_SIZE) {
          this.events.split++;
        }
      }
      newAges.set(id, age);
      for (const cell of rc.cells) owner[cell] = id;
      clusters.push({
        id,
        cells: rc.cells,
        size: rc.cells.length,
        edges: rc.edges,
        cx: rc.cx,
        cy: rc.cy,
        age,
      });
    }

    // Чьи формы не были унаследованы — умерли (или растворились в других).
    for (const [prevId, prevSize] of this.prevSizes) {
      if (!heir.has(prevId) && prevSize >= MIN_FORM_SIZE) this.events.died++;
    }

    const newSizes = new Map<number, number>();
    for (const c of clusters) newSizes.set(c.id, c.size);

    this.prevOwner = owner;
    this.prevAges = newAges;
    this.prevSizes = newSizes;
    return clusters;
  }

  reset(): void {
    this.prevOwner.fill(-1);
    this.prevAges.clear();
    this.prevSizes.clear();
    this.events = { died: 0, split: 0 };
  }
}
