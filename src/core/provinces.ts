/**
 * core/provinces — Провинции и локальные законы (§15.4).
 *
 * Поле делится на области Вороного вокруг «столиц», выбранных из seed.
 * Игрок за Дыхание задаёт провинции локальное Ме: здесь заповедник
 * стабильности, там инкубатор хаоса. География становится стратегией:
 * где растить кормовую базу, где держать буфер пустоты против Тени.
 *
 * Карта детерминирована (seed) и вечна — как рельеф.
 */
import { GRID_H, GRID_SIZE, GRID_W } from './grid';
import { mulberry32 } from './rng';

/** Сколько провинций в мире. */
export const PROVINCES = 4;

export const PROVINCE_NAMES = ['Восход', 'Полдень', 'Закат', 'Полночь'] as const;

/**
 * Локальный сдвиг законов: применяется поверх глобального Ме в границах
 * провинции. Ноль по всем полям — провинция живёт общим законом.
 */
export interface LocalLaw {
  /** Сдвиг границ выживания: −1 строже, +1 мягче. */
  survive: number;
  /** Сдвиг верхней границы рождения: +1 — инкубатор, −1 — пустошь. */
  birth: number;
}

export const NEUTRAL_LAW: LocalLaw = { survive: 0, birth: 0 };

/** Готовые указы, которые игрок может наложить на провинцию. */
export const DECREES: { id: string; name: string; desc: string; law: LocalLaw }[] = [
  { id: 'none', name: 'Общий закон', desc: 'провинция живёт как весь мир', law: { survive: 0, birth: 0 } },
  { id: 'garden', name: 'Заповедник', desc: 'выживание мягче: формы держатся дольше', law: { survive: 1, birth: 0 } },
  { id: 'forge', name: 'Горнило', desc: 'рождение щедрее: инкубатор хаоса и Зари', law: { survive: 0, birth: 1 } },
  { id: 'waste', name: 'Пустошь', desc: 'выживание строже: буфер против Тени и хищников', law: { survive: -1, birth: 0 } },
];

/** Карта провинций: индекс клетки → номер провинции. Строится из seed. */
export function generateProvinces(seed: number): Uint8Array {
  const rng = mulberry32((seed ^ 0x7a0b1c) >>> 0);
  const map = new Uint8Array(GRID_SIZE);
  const cx: number[] = [];
  const cy: number[] = [];
  for (let p = 0; p < PROVINCES; p++) {
    cx.push(Math.floor(rng() * GRID_W));
    cy.push(Math.floor(rng() * GRID_H));
  }
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      let best = 0;
      let bestD = Infinity;
      for (let p = 0; p < PROVINCES; p++) {
        // Тороидальное расстояние: у мира нет края.
        const dx = Math.min(Math.abs(x - (cx[p] as number)), GRID_W - Math.abs(x - (cx[p] as number)));
        const dy = Math.min(Math.abs(y - (cy[p] as number)), GRID_H - Math.abs(y - (cy[p] as number)));
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      map[y * GRID_W + x] = best;
    }
  }
  return map;
}
