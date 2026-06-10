/**
 * Точка входа: полная петля партии (шаги 1–7 плана сборки).
 * Старт (биом × архетип × seed) → Genesis → Морфогенез → Разум →
 * Нейкос-шторм → развязка → концовка + летопись + счёт.
 */
import { Cell, GRID_H, GRID_W, STRAINS, createWorld, setGridSize, type WorldState } from './core/grid';
import { DEFAULT_ME, tick, type Me } from './core/rules';
import { Forecaster } from './future/forecast';
import { horizonTicks } from './future/horizon';
import { LensSwitcher } from './lens/switcher';
import { ClusterTracker, type Cluster } from './phi/clusters';
import { NeikosMeter } from './phi/neikos';
import { computePhi, type PhiReport } from './phi/phi';
import { initPwa } from './platform/pwa';
import { loadBest, loadSetup, saveBest, saveSetup } from './platform/storage';
import { initTelegram } from './platform/telegram';
import { writeChronicle, type Milestones } from './run/chronicle';
import { decideEnding } from './run/endings';
import { computeScore } from './run/score';
import { SOWER_BUDGET, makeRun, type RunConfig } from './run/setup';
import { STAGE_NAMES, SURVIVAL_THRESHOLD, currentStage, endTick } from './run/stages';
import { pickQuote } from './ui/quotes';
import { TabletEngine } from './tablets/engine';
import { FieldRenderer } from './ui/canvas';
import { Hud } from './ui/hud';
import { Screens } from './ui/screens';
import { TabletUI } from './ui/tabletUI';

const TICKS_PER_SECOND = 10;
const TICK_MS = 1000 / TICKS_PER_SECOND;
const ZOOM_STEP = 1.5;
const FORECAST_EVERY = 8;
const SPEEDS = [1, 2, 4] as const;

initTelegram();
initPwa();

const canvas = document.getElementById('field') as HTMLCanvasElement;

// ---- Состояние партии ----

let cfg: RunConfig = makeRun('0', 'swamp', 'clay');
let me: Me = { ...DEFAULT_ME };
let world: WorldState = createWorld(0, 0.18);
let running = false;
let paused = false;
let speedIdx = 0;
let brush = false;
let brushStrain = 0;
let meEdits = 0;
let horizonMax = 0;
/** Сеятель: сколько Семян осталось в горсти (null — режим Потока). */
let sowBudget: number | null = null;
/** Сеятель: после первого пуска времени рука убрана навсегда. */
let sowingLocked = false;

const tracker = new ClusterTracker();
const neikosMeter = new NeikosMeter();
const lenses = new LensSwitcher();
const forecaster = new Forecaster();
const tabletEngine = new TabletEngine();
let clusters: Cluster[] = [];
let report: PhiReport = computePhi([], 0);
let lastForecastBase = -1;

const milestones: Milestones = {
  firstFormTick: null,
  mindTick: null,
  threatTick: 0,
  tabletsFired: [],
  finalTick: 0,
  finalPhi: 0,
};

function horizonNow(): number {
  return Math.round(horizonTicks(report.phi) * cfg.horizonScale);
}

function measure(): void {
  clusters = tracker.update(world);
  const neikos = neikosMeter.update(tracker.events);
  report = computePhi(clusters, neikos);

  const unlockEvent = lenses.update(clusters, report.phi);
  if (unlockEvent) {
    if (lenses.unlocked2 && milestones.firstFormTick === null) {
      milestones.firstFormTick = world.tick;
      hud.setLensUnlocked(2, true);
    }
    if (lenses.unlocked3 && milestones.mindTick === null) {
      milestones.mindTick = world.tick;
      hud.setLensUnlocked(3, true);
      tabletUI.setUnlocked(true);
    }
    hud.toast(unlockEvent);
  }

  if (lenses.unlocked3) horizonMax = Math.max(horizonMax, horizonNow());

  // Таблички: спящие правила проверяются каждый тик.
  for (const msg of tabletEngine.update(world, clusters, report)) {
    hud.toast(msg);
    tabletUI.refresh();
    forecaster.invalidate();
  }
}

function refreshForecast(force = false): void {
  if (!lenses.unlocked3) return;
  if (!force && world.tick - lastForecastBase < FORECAST_EVERY) return;
  if (forecaster.request(world, me, horizonNow())) {
    lastForecastBase = world.tick;
  }
}

// ---- Старт и финал партии ----

function startRun(
  seedText: string,
  biome: RunConfig['biome'],
  archetype: RunConfig['archetype'],
  size: number,
  mode: RunConfig['mode'],
): void {
  cfg = makeRun(seedText, biome, archetype, size, mode);
  saveSetup({ biome, archetype, size, mode });
  setGridSize(cfg.size);
  renderer.rebuildGrid();
  me = { ...cfg.me };
  world = createWorld(cfg.seed, cfg.density, cfg.startEnergy);

  tracker.reset();
  neikosMeter.reset();
  lenses.reset();
  lenses.mindPhi = cfg.mindPhi;
  tabletEngine.reset();
  forecaster.invalidate();
  lastForecastBase = -1;
  meEdits = 0;
  horizonMax = 0;
  speedIdx = 0;
  paused = false;

  // Сеятель: время стоит, в горсти — Семена, кисть уже в руке.
  if (cfg.mode === 'sower') {
    sowBudget = SOWER_BUDGET;
    sowingLocked = false;
    brush = true;
    paused = true;
  } else {
    sowBudget = null;
    sowingLocked = false;
    brush = false;
  }

  milestones.firstFormTick = null;
  milestones.mindTick = null;
  milestones.threatTick = me.threatTick;
  milestones.tabletsFired = [];

  hud.markLens(1);
  hud.setLensUnlocked(2, false);
  hud.setLensUnlocked(3, false);
  hud.applyPause(paused);
  hud.applyBrush(brush);
  hud.setBudget(sowBudget);
  tabletUI.setUnlocked(false);
  tabletUI.refresh();
  renderer.resetView();

  measure();
  running = true;
  hud.toast(
    cfg.mode === 'sower'
      ? `В твоей горсти ${SOWER_BUDGET} Семян. Расставь их — и пусти время (⏸).`
      : 'Мир сотворён. Начертай Ме — и жди, когда форма устоит.',
  );
}

function aliveSeeds(): number {
  let n = 0;
  for (let i = 0; i < world.cells.length; i++) {
    if (world.cells[i] === Cell.Seed) n++;
  }
  return n;
}

function finishRun(): void {
  running = false;
  const survived = aliveSeeds() >= SURVIVAL_THRESHOLD;

  milestones.finalTick = world.tick;
  milestones.finalPhi = report.phi;
  milestones.tabletsFired = [...tabletEngine.firedLog];

  const ending = decideEnding({
    survived,
    phi: report.phi,
    neikos: report.neikos,
    philia: report.philia,
    sawFuture: milestones.mindTick !== null && milestones.mindTick < me.threatTick,
    tabletsCarved: tabletEngine.carvedCount,
    tabletsFired: tabletEngine.firedCount,
  });

  const score = computeScore({
    phi: report.phi,
    survived,
    horizonMax,
    neikos: report.neikos,
    chaos: report.chaos,
    ending,
    meEdits,
    tabletsCarved: tabletEngine.carvedCount,
    sower: cfg.mode === 'sower',
  });

  const isRecord = saveBest(score);
  const chronicle = writeChronicle(milestones, ending, cfg);

  screens.showFinal(
    { ending, score, best: Math.max(score, loadBest()), isRecord, chronicle, seedText: cfg.seedText },
    showStart,
  );
}

/** Гибель мира фиксируется не мгновенно — даём шанс на возрождение. */
let lowAliveTicks = 0;

function checkEnd(): void {
  const alive = aliveSeeds();
  lowAliveTicks = alive < 5 ? lowAliveTicks + 1 : 0;
  if (world.tick >= endTick(me) || lowAliveTicks > 50) finishRun();
}

// ---- UI ----

const renderer = new FieldRenderer(canvas);
const screens = new Screens();

const hud = new Hud(me, {
  onMeChange(next) {
    // Поля энергии и угрозы ползунками не трогаются — переносим из текущих Ме.
    me = { ...me, birthMin: next.birthMin, birthMax: next.birthMax,
      surviveMin: next.surviveMin, surviveMax: next.surviveMax, ashLifetime: next.ashLifetime };
    meEdits++;
    forecaster.invalidate();
    refreshForecast(true);
  },
  onPauseToggle: () => togglePause(),
  onReseed() {
    if (running) finishRun();
    else showStart();
  },
  onZoomIn: () => renderer.zoomAt(ZOOM_STEP, window.innerWidth / 2, window.innerHeight / 2),
  onZoomOut: () => renderer.zoomAt(1 / ZOOM_STEP, window.innerWidth / 2, window.innerHeight / 2),
  onViewReset: () => renderer.resetView(),
  onLensSelect(lens) {
    const ok = lenses.select(lens);
    if (ok) hud.markLens(lens);
    return ok;
  },
  onBrushToggle() {
    if (sowingLocked && sowBudget !== null) return false;
    brush = !brush;
    return brush;
  },
  onStrainCycle() {
    brushStrain = (brushStrain + 1) % STRAINS;
    return brushStrain;
  },
  onSpeedCycle() {
    speedIdx = (speedIdx + 1) % SPEEDS.length;
    return SPEEDS[speedIdx] as number;
  },
});

const tabletUI = new TabletUI(document.getElementById('mepanel') as HTMLElement, tabletEngine, {
  onCarve(condition, action) {
    const err = tabletEngine.carve(condition, action, world);
    if (err) hud.toast(err);
    else hud.toast('Табличка высечена. Она спит и ждёт своего часа.');
    return err;
  },
});

function showStart(): void {
  const saved = loadSetup();
  screens.showStart(
    {
      biome: saved?.biome ?? 'swamp',
      archetype: saved?.archetype ?? 'clay',
      size: saved?.size ?? 64,
      mode: saved?.mode ?? 'flow',
    },
    loadBest(),
    (choice) => startRun(choice.seedText, choice.biome, choice.archetype, choice.size, choice.mode),
  );
}

// ---- Кисть посева ----

function sowAt(cssX: number, cssY: number): void {
  const c = renderer.cellAt(cssX, cssY);
  if (!c) return;

  // Сеятель: по одному Семени из горсти, после пуска времени — рука убрана.
  if (sowBudget !== null) {
    if (sowingLocked) return;
    const i = c.y * GRID_W + c.x;
    if (sowBudget <= 0 || world.cells[i] === Cell.Seed) return;
    world.cells[i] = Cell.Seed;
    world.age[i] = 0;
    world.kind[i] = brushStrain;
    sowBudget--;
    hud.setBudget(sowBudget);
    if (sowBudget === 0) hud.toast('Горсть пуста. Пусти время (⏸) — и смотри, что взойдёт.');
    return;
  }

  const spots = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  for (const [dx, dy] of spots) {
    const x = (c.x + dx + GRID_W) % GRID_W;
    const y = (c.y + dy + GRID_H) % GRID_H;
    const i = y * GRID_W + x;
    if (world.cells[i] !== Cell.Seed) {
      world.cells[i] = Cell.Seed;
      world.age[i] = 0;
      world.kind[i] = brushStrain;
    }
  }
  forecaster.invalidate();
  refreshForecast(true);
}

function togglePause(): boolean {
  paused = !paused;
  // Сеятель отпустил время — посев закончен навсегда: «дал жизнь и отпустил».
  if (!paused && sowBudget !== null && !sowingLocked) {
    sowingLocked = true;
    brush = false;
    hud.applyBrush(false);
    hud.setBudget(null);
    hud.toast('Жребий брошен. Дальше мир растёт сам.');
  }
  return paused;
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
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  switch (e.code) {
    case 'Space':
      e.preventDefault();
      hud.applyPause(togglePause());
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
let lastStage = '';

function frame(now: number): void {
  accumulator += now - lastTime;
  lastTime = now;
  if (accumulator > 1000) accumulator = 1000;

  if (running && !paused) {
    const stepMs = TICK_MS / (SPEEDS[speedIdx] as number);
    while (accumulator >= stepMs && running) {
      world = tick(world, me);
      measure();
      checkEnd();
      accumulator -= stepMs;
    }
    refreshForecast();
  } else {
    accumulator = 0;
  }

  const stage = currentStage(world, me, lenses.unlocked2, lenses.unlocked3);
  if (running && STAGE_NAMES[stage] !== lastStage) {
    if (stage === 'crisis') hud.toast('Нейкос приближается. Шторм начался.');
    if (stage === 'aftermath') hud.toast('Шторм прошёл. Мир считает выживших.');
    lastStage = STAGE_NAMES[stage];
  }
  if (running) {
    const q = pickQuote(stage, world.tick);
    hud.setQuote(q.text, q.source);
  }

  const f = forecaster.latest;
  renderer.setFuture(lenses.current === 3 && f ? f.cells : null);

  renderer.render(world, lenses.current, clusters);
  hud.update(world, report, lenses.unlocked3 ? horizonNow() : null, STAGE_NAMES[stage]);
  requestAnimationFrame(frame);
}

showStart();
requestAnimationFrame(frame);
