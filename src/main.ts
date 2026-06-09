/**
 * Точка входа. Шаги 1–2 плана сборки (docs/design/10-mvp-plan.md):
 * полноэкранное поле, тики, Конвей-правила, панель Ме, зум и панорама.
 *
 * Цикл: фиксированный шаг логики (10 тиков/сек), отрисовка — в rAF.
 */
import { createWorld, type WorldState } from './core/grid';
import { hashSeed } from './core/rng';
import { DEFAULT_ME, tick, type Me } from './core/rules';
import { FieldRenderer } from './ui/canvas';
import { Hud } from './ui/hud';

const TICKS_PER_SECOND = 10;
const TICK_MS = 1000 / TICKS_PER_SECOND;
const START_DENSITY = 0.18;
const ZOOM_STEP = 1.5;

const canvas = document.getElementById('field') as HTMLCanvasElement;

let seedText = String(Date.now());
let me: Me = { ...DEFAULT_ME };
let world: WorldState = createWorld(hashSeed(seedText), START_DENSITY);
let paused = false;

const renderer = new FieldRenderer(canvas);
const hud = new Hud(me, {
  onMeChange(next) {
    me = next;
  },
  onPauseToggle() {
    paused = !paused;
    return paused;
  },
  onReseed() {
    seedText = String(Date.now());
    world = createWorld(hashSeed(seedText), START_DENSITY);
  },
  onZoomIn: () => renderer.zoomAt(ZOOM_STEP, window.innerWidth / 2, window.innerHeight / 2),
  onZoomOut: () => renderer.zoomAt(1 / ZOOM_STEP, window.innerWidth / 2, window.innerHeight / 2),
  onViewReset: () => renderer.resetView(),
});

// ---- Управление видом: колесо, перетаскивание, пинч ----

canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    renderer.zoomAt(factor, e.clientX, e.clientY);
  },
  { passive: false },
);

interface PointerInfo { x: number; y: number }
const pointers = new Map<number, PointerInfo>();
let pinchDist = 0;

function pinchDistance(): number {
  const [a, b] = [...pointers.values()];
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) pinchDist = pinchDistance();
  canvas.classList.add('dragging');
});

canvas.addEventListener('pointermove', (e) => {
  const prev = pointers.get(e.pointerId);
  if (!prev) return;

  if (pointers.size === 1) {
    renderer.panBy(e.clientX - prev.x, e.clientY - prev.y);
  }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (pointers.size === 2) {
    const d = pinchDistance();
    if (pinchDist > 0 && d > 0) {
      const [a, b] = [...pointers.values()];
      if (a && b) {
        renderer.zoomAt(d / pinchDist, (a.x + b.x) / 2, (a.y + b.y) / 2);
      }
    }
    pinchDist = d;
  }
});

function dropPointer(e: PointerEvent): void {
  pointers.delete(e.pointerId);
  pinchDist = pointers.size === 2 ? pinchDistance() : 0;
  if (pointers.size === 0) canvas.classList.remove('dragging');
}
canvas.addEventListener('pointerup', dropPointer);
canvas.addEventListener('pointercancel', dropPointer);

// ---- Цикл ----

let lastTime = performance.now();
let accumulator = 0;

function frame(now: number): void {
  accumulator += now - lastTime;
  lastTime = now;

  // Не даём накопиться долгу после сворачивания вкладки.
  if (accumulator > 1000) accumulator = 1000;

  if (!paused) {
    while (accumulator >= TICK_MS) {
      world = tick(world, me);
      accumulator -= TICK_MS;
    }
  } else {
    accumulator = 0;
  }

  renderer.render(world);
  hud.update(world);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
