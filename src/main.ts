/**
 * Точка входа. Шаги 1–2 плана сборки (docs/design/10-mvp-plan.md):
 * поле, тики, Конвей-правила, панель Ме.
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

const canvas = document.getElementById('field') as HTMLCanvasElement;
const hudRoot = document.getElementById('hud') as HTMLElement;

let seedText = String(Date.now());
let me: Me = { ...DEFAULT_ME };
let world: WorldState = createWorld(hashSeed(seedText), START_DENSITY);
let paused = false;

const renderer = new FieldRenderer(canvas);
const hud = new Hud(hudRoot, me, {
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
});

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
