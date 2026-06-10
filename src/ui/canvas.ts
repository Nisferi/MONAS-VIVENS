/**
 * ui/canvas — полноэкранная отрисовка поля с зумом и панорамой.
 * Читает состояние, не считает ничего.
 *
 * Палитра (docs/design/11-aesthetics.md, итерация 2 — контраст и читаемость):
 * фон почти чёрный, Семена — янтарь→золото по возрасту, Прах — тёмная глина,
 * Сигнал — бирюза. Пиксели увеличиваются без сглаживания; на крупном зуме
 * появляется тонкая сетка.
 */
import { Cell, GRID_H, GRID_W, Terrain, type WorldState } from '../core/grid';
import { drawLens2 } from '../lens/lens2';
import { drawLens3, paintFutureGhost } from '../lens/lens3';
import { paintChronicle } from '../lens/lens4';
import type { LensId } from '../lens/switcher';
import type { Cluster } from '../phi/clusters';

const COLOR_BG = '#0b0805';
type Rgb = [number, number, number];
/** Палитры родов: молодое Семя → зрелое. */
export const STRAIN_COLORS: { young: Rgb; old: Rgb }[] = [
  { young: [0xff, 0x8c, 0x1a], old: [0xff, 0xd9, 0x66] }, // Род Огня: янтарь → золото
  { young: [0x16, 0xa0, 0x6e], old: [0x7b, 0xed, 0xc8] }, // Род Нефрита: нефрит → светлая зелень
  { young: [0xa0, 0x5e, 0xea], old: [0xd9, 0xb8, 0xff] }, // Род Аметиста: лиловый → светлый
];
const COLOR_SIGNAL: Rgb = [0x00, 0xe5, 0xcf]; // бирюза
const COLOR_ASH: Rgb = [0x52, 0x3a, 0x24]; // тёмная глина
const COLOR_EMPTY: Rgb = [0x12, 0x0d, 0x08]; // поле
const COLOR_SPORE: Rgb = [0x6b, 0x7d, 0x4f]; // спора: серо-зелёная капсула
const COLOR_CRYSTAL: Rgb = [0x7d, 0x86, 0xa8]; // кристалл: бледный камень
const COLOR_SPRING: Rgb = [0x0e, 0x4a, 0x42]; // родник: тёмное свечение воды

/** Возраст, к которому Семя дозревает из янтаря в золото. */
const MATURE_AGE = 20;
const ZOOM_MIN = 1;
const ZOOM_MAX = 16;
/** Порог пикселей на клетку, после которого рисуем сетку. */
const GRID_LINES_FROM = 9;

export class FieldRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly cellCanvas: HTMLCanvasElement;
  private readonly cellCtx: CanvasRenderingContext2D;
  private image: ImageData;
  private readonly futureCanvas: HTMLCanvasElement;
  private readonly futureCtx: CanvasRenderingContext2D;
  private futureImage: ImageData;
  private hasFuture = false;
  private readonly altCanvas: HTMLCanvasElement;
  private readonly altCtx: CanvasRenderingContext2D;
  private altImage: ImageData;
  private hasAlt = false;

  /** Зум относительно «вписанного» масштаба: 1 = всё поле на экране. */
  private zoom = 1;
  /** Центр взгляда в координатах клеток. */
  private centerX = GRID_W / 2;
  private centerY = GRID_H / 2;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D недоступен');
    this.ctx = ctx;

    this.cellCanvas = document.createElement('canvas');
    this.cellCanvas.width = GRID_W;
    this.cellCanvas.height = GRID_H;
    const cellCtx = this.cellCanvas.getContext('2d');
    if (!cellCtx) throw new Error('Canvas 2D недоступен');
    this.cellCtx = cellCtx;
    this.image = cellCtx.createImageData(GRID_W, GRID_H);

    this.futureCanvas = document.createElement('canvas');
    this.futureCanvas.width = GRID_W;
    this.futureCanvas.height = GRID_H;
    const futureCtx = this.futureCanvas.getContext('2d');
    if (!futureCtx) throw new Error('Canvas 2D недоступен');
    this.futureCtx = futureCtx;
    this.futureImage = futureCtx.createImageData(GRID_W, GRID_H);

    this.altCanvas = document.createElement('canvas');
    this.altCanvas.width = GRID_W;
    this.altCanvas.height = GRID_H;
    const altCtx = this.altCanvas.getContext('2d');
    if (!altCtx) throw new Error('Canvas 2D недоступен');
    this.altCtx = altCtx;
    this.altImage = altCtx.createImageData(GRID_W, GRID_H);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /** Пересобрать офскрин-буферы под текущий размер поля (между партиями). */
  rebuildGrid(): void {
    this.cellCanvas.width = GRID_W;
    this.cellCanvas.height = GRID_H;
    this.futureCanvas.width = GRID_W;
    this.futureCanvas.height = GRID_H;
    this.altCanvas.width = GRID_W;
    this.altCanvas.height = GRID_H;
    this.image = this.cellCtx.createImageData(GRID_W, GRID_H);
    this.futureImage = this.futureCtx.createImageData(GRID_W, GRID_H);
    this.altImage = this.altCtx.createImageData(GRID_W, GRID_H);
    this.hasFuture = false;
    this.hasAlt = false;
    this.resetView();
  }

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(window.innerWidth * dpr);
    this.canvas.height = Math.round(window.innerHeight * dpr);
  }

  /** Масштаб «вписать поле в экран», в физических пикселях на клетку. */
  private fitScale(): number {
    return Math.min(this.canvas.width, this.canvas.height) / GRID_W;
  }

  private scale(): number {
    return this.fitScale() * this.zoom;
  }

  private clampView(): void {
    this.zoom = Math.min(Math.max(this.zoom, ZOOM_MIN), ZOOM_MAX);
    // Центр не уводим дальше границ поля.
    this.centerX = Math.min(Math.max(this.centerX, 0), GRID_W);
    this.centerY = Math.min(Math.max(this.centerY, 0), GRID_H);
  }

  /** Зум к точке экрана (CSS-пиксели), factor > 1 — приближение. */
  zoomAt(factor: number, cssX: number, cssY: number): void {
    const dpr = window.devicePixelRatio || 1;
    const before = this.screenToCell(cssX * dpr, cssY * dpr);
    this.zoom *= factor;
    this.clampView();
    const after = this.screenToCell(cssX * dpr, cssY * dpr);
    this.centerX += before.x - after.x;
    this.centerY += before.y - after.y;
    this.clampView();
  }

  /** Сдвиг взгляда на (dx, dy) CSS-пикселей. */
  panBy(cssDx: number, cssDy: number): void {
    const dpr = window.devicePixelRatio || 1;
    const s = this.scale();
    this.centerX -= (cssDx * dpr) / s;
    this.centerY -= (cssDy * dpr) / s;
    this.clampView();
  }

  resetView(): void {
    this.zoom = 1;
    this.centerX = GRID_W / 2;
    this.centerY = GRID_H / 2;
  }

  zoomLevel(): number {
    return this.zoom;
  }

  private screenToCell(px: number, py: number): { x: number; y: number } {
    const s = this.scale();
    return {
      x: this.centerX + (px - this.canvas.width / 2) / s,
      y: this.centerY + (py - this.canvas.height / 2) / s,
    };
  }

  /** Клетка под точкой экрана (CSS-пиксели) или null вне поля. */
  cellAt(cssX: number, cssY: number): { x: number; y: number } | null {
    const dpr = window.devicePixelRatio || 1;
    const c = this.screenToCell(cssX * dpr, cssY * dpr);
    const x = Math.floor(c.x);
    const y = Math.floor(c.y);
    if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H) return null;
    return { x, y };
  }

  /** Обновить призрак будущего (или скрыть его, передав null). */
  setFuture(cells: Uint8Array | null): void {
    if (cells) {
      paintFutureGhost(this.futureCtx, this.futureImage, cells);
      this.hasFuture = true;
    } else {
      this.hasFuture = false;
    }
  }

  /** Веер будущих: лиловый призрак старого закона. */
  setFutureAlt(cells: Uint8Array | null): void {
    if (cells) {
      paintFutureGhost(this.altCtx, this.altImage, cells, [0xc4, 0x7a, 0xff]);
      this.hasAlt = true;
    } else {
      this.hasAlt = false;
    }
  }

  render(
    state: WorldState,
    lens: LensId = 1,
    clusters: Cluster[] = [],
    prev: WorldState | null = null,
    frac = 1,
    heat: Float32Array | null = null,
  ): void {
    if (lens === 4 && heat) paintChronicle(this.cellCtx, this.image, heat);
    else this.paintCells(state, prev, frac);

    const { ctx, canvas } = this;
    const s = this.scale();
    const originX = canvas.width / 2 - this.centerX * s;
    const originY = canvas.height / 2 - this.centerY * s;

    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.imageSmoothingEnabled = false;

    if (lens === 1 || lens === 4) {
      // Линза 4 — Хроника: тепловая карта уже в cellCanvas.
      ctx.drawImage(this.cellCanvas, originX, originY, GRID_W * s, GRID_H * s);
      if (lens === 1 && s >= GRID_LINES_FROM) this.paintGrid(originX, originY, s);
    } else if (lens === 2) {
      // Линза Филии: клетки — лишь тень внизу, поверх — узлы и нити.
      ctx.globalAlpha = 0.18;
      ctx.drawImage(this.cellCanvas, originX, originY, GRID_W * s, GRID_H * s);
      ctx.globalAlpha = 1;
      drawLens2(ctx, { originX, originY, scale: s }, clusters);
    } else {
      // Линза Разума: настоящее тускнеет, будущее проступает бирюзой.
      drawLens3(
        ctx,
        { originX, originY, scale: s },
        this.cellCanvas,
        this.hasFuture ? this.futureCanvas : null,
        this.hasAlt ? this.altCanvas : null,
      );
    }

    // Рамка поля — край мира.
    ctx.strokeStyle = 'rgba(217, 152, 64, 0.5)';
    ctx.lineWidth = Math.max(1, s * 0.06);
    ctx.strokeRect(originX, originY, GRID_W * s, GRID_H * s);
  }

  private cellColor(state: WorldState, i: number): Rgb {
    const cell = state.cells[i];
    if (cell === Cell.Seed) {
      const t = Math.min((state.age[i] ?? 0) / MATURE_AGE, 1);
      const ramp =
        STRAIN_COLORS[state.kind[i] ?? 0] ?? (STRAIN_COLORS[0] as { young: Rgb; old: Rgb });
      const { young, old } = ramp;
      return [
        young[0] + (old[0] - young[0]) * t,
        young[1] + (old[1] - young[1]) * t,
        young[2] + (old[2] - young[2]) * t,
      ];
    }
    if (cell === Cell.Signal) return COLOR_SIGNAL;
    if (cell === Cell.Ash) return COLOR_ASH;
    if (cell === Cell.Spore) return COLOR_SPORE;
    // Пустая клетка показывает рельеф под собой.
    const land = state.terrain[i];
    if (land === Terrain.Crystal) return COLOR_CRYSTAL;
    if (land === Terrain.Spring) return COLOR_SPRING;
    return COLOR_EMPTY;
  }

  /**
   * Дыхание поля: между тиками цвет каждой клетки плавно перетекает
   * из прошлого состояния в нынешнее — умершие гаснут, рождённые разгораются.
   */
  private paintCells(state: WorldState, prev: WorldState | null, frac: number): void {
    const px = this.image.data;
    const blend = prev && prev.cells.length === state.cells.length && frac < 1;
    const inv = 1 - frac;
    for (let i = 0; i < state.cells.length; i++) {
      const c = this.cellColor(state, i);
      let r = c[0];
      let g = c[1];
      let b = c[2];
      if (blend && prev) {
        const p = this.cellColor(prev, i);
        r = p[0] * inv + r * frac;
        g = p[1] * inv + g * frac;
        b = p[2] * inv + b * frac;
      }
      const o = i * 4;
      px[o] = r;
      px[o + 1] = g;
      px[o + 2] = b;
      px[o + 3] = 255;
    }
    this.cellCtx.putImageData(this.image, 0, 0);
  }

  private paintGrid(originX: number, originY: number, s: number): void {
    const { ctx } = this;
    ctx.strokeStyle = 'rgba(255, 217, 102, 0.10)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= GRID_W; x++) {
      ctx.moveTo(originX + x * s, originY);
      ctx.lineTo(originX + x * s, originY + GRID_H * s);
    }
    for (let y = 0; y <= GRID_H; y++) {
      ctx.moveTo(originX, originY + y * s);
      ctx.lineTo(originX + GRID_W * s, originY + y * s);
    }
    ctx.stroke();
  }
}
