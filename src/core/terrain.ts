/**
 * core/terrain — рельеф из seed: вечная основа мира.
 * Кристаллы растут гроздьями (стены и якоря), Родники бьют поодиночке.
 */
import { GRID_SIZE, GRID_W, GRID_H, Terrain } from './grid';
import { mulberry32 } from './rng';

export interface TerrainParams {
  /** Сколько гроздей кристаллов вырастить. */
  crystalClusters: number;
  /** Сколько родников пробить. */
  springs: number;
}

/** Прибавка притока энергии за каждый родник (за тик). */
export const SPRING_INFLUX = 0.06;

export function generateTerrain(seed: number, params: TerrainParams): Uint8Array {
  const rng = mulberry32(seed ^ 0x7e44a1d);
  const land = new Uint8Array(GRID_SIZE);

  for (let c = 0; c < params.crystalClusters; c++) {
    let x = Math.floor(rng() * GRID_W);
    let y = Math.floor(rng() * GRID_H);
    const grains = 3 + Math.floor(rng() * 4);
    for (let g = 0; g < grains; g++) {
      land[y * GRID_W + x] = Terrain.Crystal;
      x = (x + Math.floor(rng() * 3) - 1 + GRID_W) % GRID_W;
      y = (y + Math.floor(rng() * 3) - 1 + GRID_H) % GRID_H;
    }
  }

  for (let s = 0; s < params.springs; s++) {
    const i = Math.floor(rng() * GRID_SIZE);
    if (land[i] === Terrain.Plain) land[i] = Terrain.Spring;
  }

  return land;
}

export function countSprings(terrain: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < terrain.length; i++) {
    if (terrain[i] === Terrain.Spring) n++;
  }
  return n;
}
