/**
 * lens/lens3 — линза Разума: настоящее как тень, поверх — бирюзовый призрак
 * будущего (состояние мира через N тиков, рассчитанное тем же движком).
 */
import { Cell, GRID_H, GRID_W } from '../core/grid';
import type { LensTransform } from './lens2';

/** Готовит канвас-призрак будущего: клетки заданного цвета на прозрачном. */
export function paintFutureGhost(
  ctx: CanvasRenderingContext2D,
  image: ImageData,
  futureCells: Uint8Array,
  rgb: [number, number, number] = [0x00, 0xe5, 0xcf],
): void {
  const px = image.data;
  for (let i = 0; i < futureCells.length; i++) {
    const o = i * 4;
    if (futureCells[i] === Cell.Seed) {
      px[o] = rgb[0];
      px[o + 1] = rgb[1];
      px[o + 2] = rgb[2];
      px[o + 3] = 200;
    } else {
      px[o + 3] = 0;
    }
  }
  ctx.putImageData(image, 0, 0);
}

export function drawLens3(
  ctx: CanvasRenderingContext2D,
  t: LensTransform,
  presentCanvas: HTMLCanvasElement,
  futureCanvas: HTMLCanvasElement | null,
  altFutureCanvas: HTMLCanvasElement | null,
): void {
  const w = GRID_W * t.scale;
  const h = GRID_H * t.scale;

  // Настоящее — приглушено: разум смотрит сквозь него.
  ctx.globalAlpha = 0.4;
  ctx.drawImage(presentCanvas, t.originX, t.originY, w, h);
  ctx.globalAlpha = 1;

  // Веер будущих: лиловый призрак старого закона — тенью под новым.
  if (altFutureCanvas) {
    ctx.globalAlpha = 0.35;
    ctx.drawImage(altFutureCanvas, t.originX, t.originY, w, h);
    ctx.globalAlpha = 1;
  }

  // Будущее действующего закона — бирюзовый призрак.
  if (futureCanvas) {
    ctx.globalAlpha = 0.75;
    ctx.drawImage(futureCanvas, t.originX, t.originY, w, h);
    ctx.globalAlpha = 1;
  }
}
