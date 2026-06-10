/**
 * phi/patterns — Кодекс форм: распознавание канонических существ Конвея.
 * Сигнатура формы инвариантна к сдвигу, повороту и отражению; фазы
 * осцилляторов и кораблей порождаются мини-симуляцией при старте —
 * никакого захардкоженного знания о будущем, только сами формы.
 */
import { GRID_W, type WorldState } from '../core/grid';
import type { Cluster } from './clusters';

export interface PatternInfo {
  id: string;
  name: string;
  /** Голос летописи о форме. */
  lore: string;
  /** Фаза 0 — для зарисовки в Кодексе. */
  cells: [number, number][];
}

export const PATTERNS: PatternInfo[] = [
  {
    id: 'block',
    name: 'Основание',
    lore: 'Четыре Семени, что не меняются вовек. Первый камень всякой памяти.',
    cells: [[0, 0], [1, 0], [0, 1], [1, 1]],
  },
  {
    id: 'beehive',
    name: 'Улей',
    lore: 'Шесть Семян держат пустоту в середине — дом, который никто не строил.',
    cells: [[1, 0], [2, 0], [0, 1], [3, 1], [1, 2], [2, 2]],
  },
  {
    id: 'loaf',
    name: 'Каравай',
    lore: 'Хлеб, испечённый самим законом. Лежит — и не черствеет.',
    cells: [[1, 0], [2, 0], [0, 1], [3, 1], [1, 2], [3, 2], [2, 3]],
  },
  {
    id: 'boat',
    name: 'Лодка',
    lore: 'Пять Семян, готовых плыть, — но вечно стоящих у берега.',
    cells: [[0, 0], [1, 0], [0, 1], [2, 1], [1, 2]],
  },
  {
    id: 'tub',
    name: 'Бочка',
    lore: 'Кольцо из четырёх. Внутри — пустота, и пустотой оно живо.',
    cells: [[1, 0], [0, 1], [2, 1], [1, 2]],
  },
  {
    id: 'blinker',
    name: 'Маятник',
    lore: 'Три Семени, меряющие время. Первые часы этого мира.',
    cells: [[0, 0], [1, 0], [2, 0]],
  },
  {
    id: 'toad',
    name: 'Жаба',
    lore: 'Дышит в два счёта: вдох — выдох. Не живая и не мёртвая.',
    cells: [[1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1]],
  },
  {
    id: 'beacon',
    name: 'Маяк',
    lore: 'Два Основания перемигиваются через угол — свет для тех, кто смотрит.',
    cells: [[0, 0], [1, 0], [0, 1], [3, 2], [2, 3], [3, 3]],
  },
  {
    id: 'glider',
    name: 'Странник',
    lore: 'Первая форма, что пошла. Не зная куда — но не останавливаясь.',
    cells: [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]],
  },
  {
    id: 'lwss',
    name: 'Корабль',
    lore: 'Лёгкое судно пустоты. Плывёт быстрее всякой памяти о нём.',
    cells: [[1, 0], [4, 0], [0, 1], [0, 2], [4, 2], [0, 3], [1, 3], [2, 3], [3, 3]],
  },
];

type Pt = [number, number];

/** Каноническая сигнатура множества точек: минимум по 8 симметриям. */
function signature(points: Pt[]): string {
  const transforms: ((p: Pt) => Pt)[] = [
    ([x, y]) => [x, y],
    ([x, y]) => [-x, y],
    ([x, y]) => [x, -y],
    ([x, y]) => [-x, -y],
    ([x, y]) => [y, x],
    ([x, y]) => [-y, x],
    ([x, y]) => [y, -x],
    ([x, y]) => [-y, -x],
  ];
  let best = '';
  for (const tf of transforms) {
    const mapped = points.map(tf);
    let minX = Infinity;
    let minY = Infinity;
    for (const [x, y] of mapped) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
    }
    const norm = mapped
      .map(([x, y]) => `${x - minX},${y - minY}`)
      .sort()
      .join(';');
    if (best === '' || norm < best) best = norm;
  }
  return best;
}

/** Мини-Конвей на маленькой доске — для порождения фаз осцилляторов и кораблей. */
function miniStep(points: Pt[]): Pt[] {
  const alive = new Set(points.map(([x, y]) => `${x},${y}`));
  const counts = new Map<string, number>();
  for (const [x, y] of points) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const key = `${x + dx},${y + dy}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  const next: Pt[] = [];
  for (const [key, n] of counts) {
    const isAlive = alive.has(key);
    if (n === 3 || (isAlive && n === 2)) {
      const [x, y] = key.split(',').map(Number) as Pt;
      next.push([x, y]);
    }
  }
  return next;
}

/** Словарь сигнатур всех фаз каждой формы. Строится один раз при загрузке. */
const DICT = new Map<string, string>();
for (const p of PATTERNS) {
  let phase: Pt[] = p.cells;
  for (let g = 0; g < 4; g++) {
    const sig = signature(phase);
    if (!DICT.has(sig)) DICT.set(sig, p.id);
    phase = miniStep(phase);
    if (phase.length === 0) break;
  }
}

const MAX_FORM_CELLS = 12;

/** Узнать известные формы среди кластеров; возвращает id найденных. */
export function detectKnownForms(state: WorldState, clusters: Cluster[]): string[] {
  const found = new Set<string>();
  for (const c of clusters) {
    if (c.size < 3 || c.size > MAX_FORM_CELLS) continue;
    const pts: Pt[] = [];
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const i of c.cells) {
      const x = i % GRID_W;
      const y = (i / GRID_W) | 0;
      pts.push([x, y]);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    // Формы, перехлестнувшие край тора, пропускаем — координаты рвутся.
    if (maxX - minX > GRID_W / 2 || maxY - minY > GRID_W / 2) continue;
    const id = DICT.get(signature(pts));
    if (id) found.add(id);
  }
  void state;
  return [...found];
}
