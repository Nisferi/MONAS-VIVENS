/**
 * ui/canvas — отрисовка поля. Читает состояние, не считает ничего.
 * Палитра — docs/design/11-aesthetics.md: охра, золото, бирюза, тёмная глина.
 */
import { Cell, GRID_H, GRID_W, type WorldState } from '../core/grid';

const COLOR_BG: [number, number, number] = [0x1a, 0x12, 0x0c]; // тёмная глина
const COLOR_YOUNG: [number, number, number] = [0xc0, 0x88, 0x40]; // охра
const COLOR_OLD: [number, number, number] = [0xe8, 0xc0, 0x60]; // золото
const COLOR_SIGNAL: [number, number, number] = [0x40, 0xc0, 0xb0]; // бирюза
const COLOR_ASH: [number, number, number] = [0x3a, 0x2a, 0x1a]; // глина

/** Возраст, к которому Семя дозревает из охры в золото. */
const MATURE_AGE = 20;

export class FieldRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly image: ImageData;

  constructor(canvas: HTMLCanvasElement) {
    canvas.width = GRID_W;
    canvas.height = GRID_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D недоступен');
    this.ctx = ctx;
    this.image = ctx.createImageData(GRID_W, GRID_H);
  }

  render(state: WorldState): void {
    const px = this.image.data;
    for (let i = 0; i < state.cells.length; i++) {
      const cell = state.cells[i];
      const age = state.age[i] ?? 0;
      let c = COLOR_BG;
      if (cell === Cell.Seed) {
        const t = Math.min(age / MATURE_AGE, 1);
        c = [
          COLOR_YOUNG[0] + (COLOR_OLD[0] - COLOR_YOUNG[0]) * t,
          COLOR_YOUNG[1] + (COLOR_OLD[1] - COLOR_YOUNG[1]) * t,
          COLOR_YOUNG[2] + (COLOR_OLD[2] - COLOR_YOUNG[2]) * t,
        ];
      } else if (cell === Cell.Signal) {
        c = COLOR_SIGNAL;
      } else if (cell === Cell.Ash) {
        c = COLOR_ASH;
      }
      const o = i * 4;
      px[o] = c[0];
      px[o + 1] = c[1];
      px[o + 2] = c[2];
      px[o + 3] = 255;
    }
    this.ctx.putImageData(this.image, 0, 0);
  }
}
