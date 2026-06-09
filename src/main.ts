/**
 * Точка входа. Шаги 1–4 плана сборки (docs/design/10-mvp-plan.md):
 * поле, Ме, Φ и линзы, детерминированное будущее.
 *
 * Цикл: фиксированный шаг логики (10 тиков/сек × множитель скорости),
 * отрисовка — в rAF. Прогноз — в Web Worker, тем же tick().
 */
import { Cell, GRID_H, GRID_W, createWorld, type WorldState } from './core/grid';
import { hashSeed } from './core/rng';
import { DEFAULT_ME, tick, type Me } from './core/rules';
import { Forecaster } from './future/forecast';
import { horizonTicks } from './future/horizon';
import { LensSwitcher } from './lens/switcher';
import { ClusterTracker, type Cluster } from './phi/clusters';
import { NeikosMeter } from './phi/neikos';
import { computePhi, type PhiReport } from './phi/phi';
import { FieldRenderer } from './ui/canvas';
import { Hud } from './ui/hud';

const TICKS_PER_SECOND = 10;
const TICK_MS = 1000 / TICKS_PER_SECOND;
const START_DENSITY = 0.18;
const ZOOM_STEP = 1.5;
/** Как часто (в тиках) обновлять прогноз будущего. */
const FORECAST_EVERY = 8;
const SPEEDS = [1, 2, 4] as const;

const canvas = document.getElementById('field') as HTMLCanvasElement;

let seedText = String(Date.now());
let me: Me = { ...DEFAULT_ME };
let world: WorldState = createWorld(hashSeed(seedText), START_DENSITY);
let paused = false;
let speedIdx = 0;
let brush = false;

// Измерение сознания: кластеры → члены формулы → Φ.
const tracker = new ClusterTracker();
const neikosMeter = new NeikosMeter();
const lenses = new LensSwitcher();
const forecaster = new Forecaster();
let clusters: Cluster[] = [];
let report: PhiReport = computePhi([], 0);
let lastForecastBase = -1;

function measure(): void {
  clusters = tracker.update(world);
  const neikos = neikosMeter.update(tracker.events);
  report = computePhi(clusters, neikos);
  const unlockEvent = lenses.update(clusters, report.phi);
  if (unlockEvent) {
    hud.setLensUnlocked(2, true);
    if (lenses.unlocked3) hud.setLensUnlocked(3, true);
    hud.toast(unlockEvent);
  }
}

/** Прогноз пересчитывается периодически и после любого вмешательства. */
function refreshForecast(force = false): void {
  if (!lenses.unlocked3) return;
  if (!force && world.tick - lastForecastBase < FORECAST_EVERY) return;
  if (forecaster.request(world, me, horizonTicks(report.phi))) {
    lastForecastBase = world.tick;
  }
}

function restart(): void {
  seedText = String(Date.now());
  world = createWorld(hashSeed(seedText), START_DENSITY);
  tracker.reset();
  neikosMeter.reset();
  forecaster.invalidate();
  lastForecastBase = -1;
}

const renderer = new FieldRenderer(canvas);
const hud = new Hud(me, {
  onMeChange(next) {
    me = next;
    forecaster.invalidate();
    refreshForecast(true);
  },
  onPauseToggle() {
    paused = !paused;
    return paused;
  },
  onReseed: restart,
  onZoomIn: () => renderer.zoomAt(ZOOM_STEP, window.innerWidth / 2, window.innerHeight / 2),
  onZoomOut: () => renderer.zoomAt(1 / ZOOM_STEP, window.innerWidth / 2, window.innerHeight / 2),
  onViewReset: () => renderer.resetView(),
  onLensSelect(lens) {
    const ok = lenses.select(lens);
    if (ok) hud.markLens(lens);
    return ok;
  },
  onBrushToggle() {
    brush = !brush;
    return brush;
  },
  onSpeedCycle() {
    speedIdx = (speedIdx + 1) % SPEEDS.length;
    return SPEEDS[speedIdx] as number;
  },
});

measure();

// ---- Кисть посева: вмешательство руки в мир ----

function sowAt(cssX: number, cssY: number): void {
  const c = renderer.cellAt(cssX, cssY);
  if (!c) return;
  // Сеем крестом 5 клеток — одинокое Семя умирает мгновенно.
  const spots = [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  for (const [dx, dy] of spots) {
    const x = (c.x + dx + GRID_W) % GRID_W;
    const y = (c.y + dy + GRID_H) % GRID_H;
    const i = y * GRID_W + x;
    if (world.cells[i] !== Cell.Seed) {
      world.cells[i] = Cell.Seed;
      world.age[i] = 0;
    }
  }
  forecaster.invalidate();
  refreshForecast(true);
}

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
  if (brush && pointers.size === 1) sowAt(e.clientX, e.clientY);
  else canvas.classList.add('dragging');
});

canvas.addEventListener('pointermove', (e) => {
  const prev = pointers.get(e.pointerId);
  if (!prev) return;

  if (pointers.size === 1) {
    if (brush) sowAt(e.clientX, e.clientY);
    else renderer.panBy(e.clientX - prev.x, e.clientY - prev.y);
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

// ---- Клавиатура ----

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  switch (e.code) {
    case 'Space':
      e.preventDefault();
      paused = !paused;
      hud.applyPause(paused);
      break;
    case 'Digit1':
      if (lenses.select(1)) hud.markLens(1);
      break;
    case 'Digit2':
      if (lenses.select(2)) hud.markLens(2);
      break;
    case 'Digit3':
      if (lenses.select(3)) hud.markLens(3);
      break;
    case 'Digit0':
      renderer.resetView();
      break;
    case 'KeyB':
      brush = !brush;
      hud.applyBrush(brush);
      break;
  }
});

// ---- Цикл ----

let lastTime = performance.now();
let accumulator = 0;

function frame(now: number): void {
  accumulator += now - lastTime;
  lastTime = now;

  // Не даём накопиться долгу после сворачивания вкладки.
  if (accumulator > 1000) accumulator = 1000;

  const stepMs = TICK_MS / (SPEEDS[speedIdx] as number);
  if (!paused) {
    while (accumulator >= stepMs) {
      world = tick(world, me);
      measure();
      accumulator -= stepMs;
    }
    refreshForecast();
  } else {
    accumulator = 0;
  }

  // Призрак будущего показываем только в линзе Разума.
  const f = forecaster.latest;
  renderer.setFuture(lenses.current === 3 && f ? f.cells : null);

  renderer.render(world, lenses.current, clusters);
  hud.update(world, report, lenses.unlocked3 ? horizonTicks(report.phi) : null);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
