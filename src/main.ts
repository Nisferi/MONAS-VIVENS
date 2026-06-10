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
import { loadBest, loadEcho, loadSetup, saveBest, saveEcho, saveSetup } from './platform/storage';
import { initTelegram } from './platform/telegram';
import { writeChronicle, type Milestones } from './run/chronicle';
import { decideEnding } from './run/endings';
import { computeScore } from './run/score';
import { detectKnownForms, PATTERNS } from './phi/patterns';
import { discoverForm, saveTrialStars } from './platform/storage';
import { ReplayPlayer, ReplayRecorder, decodeReplay, meNums, type ReplayData } from './run/replay';
import { makeRun, type RunConfig } from './run/setup';
import { trialById, trialStars } from './run/trials';
import { downloadChroniclePng } from './ui/chronicleImage';
import { CodexScreen } from './ui/codex';
import {
  STAGE_NAMES, SURVIVAL_THRESHOLD, currentStage, endTick, firstThreatTick, lastThreatEnd,
} from './run/stages';
import { SoundEngine } from './ui/sound';
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
const SPEEDS = [1, 2, 4, 0.5] as const;

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
const sound = new SoundEngine();
const recorder = new ReplayRecorder();
let player: ReplayPlayer | null = null;
/** Скраббер: доля пути взгляда к горизонту (1 = сам горизонт). */
let scrubFrac = 1;
/** Веер будущих: призрак старого закона после правки Ме. */
let altGhost: { cells: Uint8Array; until: number } | null = null;
let clusters: Cluster[] = [];
let report: PhiReport = computePhi([], 0);
let lastForecastBase = -1;
/*
 * Нейкос для суда концовки усредняется по развязке: миг финала видит только
 * остывший пепел, а среднее помнит, был ли мир жив, встречая последний шторм.
 */
let aftermathNeikosSum = 0;
let aftermathNeikosN = 0;

const milestones: Milestones = {
  firstFormTick: null,
  mindTick: null,
  threatTick: 0,
  stormCount: 0,
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
      sound.event('form');
    }
    if (lenses.unlocked3 && milestones.mindTick === null) {
      milestones.mindTick = world.tick;
      hud.setLensUnlocked(3, true);
      tabletUI.setUnlocked(true);
      sound.event('mind');
    }
    hud.toast(unlockEvent);
  }

  if (lenses.unlocked3) horizonMax = Math.max(horizonMax, horizonNow());

  if (me.threats.length > 0 && world.tick >= lastThreatEnd(me)) {
    aftermathNeikosSum += report.neikos;
    aftermathNeikosN++;
  }

  // Таблички: спящие правила проверяются каждый тик.
  for (const msg of tabletEngine.update(world, clusters, report)) {
    hud.toast(msg);
    tabletUI.refresh();
    forecaster.invalidate();
    sound.event('tablet');
  }

  // Кодекс: раз в 25 тиков мир осматривается на знакомые существа.
  if (world.tick % 25 === 0) {
    for (const id of detectKnownForms(world, clusters)) {
      if (discoverForm(id)) {
        const p = PATTERNS.find((x) => x.id === id);
        if (p) {
          hud.toast(`В Кодекс внесена форма: «${p.name}».`);
          sound.event('form');
        }
      }
    }
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
  replay: ReplayData | null = null,
  trialId: string | null = null,
): void {
  cfg = makeRun(seedText, biome, archetype, size, mode);
  // Испытание: фиксированный паззл Сеятеля поверх обычного конфига.
  if (trialId) {
    const trial = trialById(trialId);
    if (trial) {
      cfg = {
        ...makeRun(trial.seedText, trial.biome, trial.archetype, trial.size, 'sower'),
        sowBudget: trial.budget,
        trialId: trial.id,
      };
    }
  }
  player = replay ? new ReplayPlayer(replay) : null;
  if (!player && !trialId) saveSetup({ biome, archetype, size, mode });
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
  aftermathNeikosSum = 0;
  aftermathNeikosN = 0;

  // Сеятель: время стоит, в горсти — Семена, кисть уже в руке.
  if (cfg.mode === 'sower') {
    sowBudget = cfg.sowBudget;
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
  milestones.threatTick = firstThreatTick(me);
  milestones.stormCount = me.threats.length;
  milestones.tabletsFired = [];

  // Эхо мира: новый мир восходит на прахе прежнего (если размеры совпали).
  // Реплей несёт своё эхо — иначе чужая история не совпадёт с нашей.
  const echo = player ? player.data.echo : (loadEcho(cfg.size) ?? []);
  let laid = 0;
  for (const i of echo) {
    if (i >= 0 && i < world.cells.length && world.cells[i] === Cell.Empty) {
      world.cells[i] = Cell.Ash;
      world.age[i] = 0;
      laid++;
    }
  }
  if (laid > 0 && !player) hud.toast('Этот мир восходит на прахе прежнего.');

  recorder.start(
    { seedText: cfg.seedText, biome: cfg.biome, archetype: cfg.archetype, size: cfg.size, mode: cfg.mode },
    echo,
  );
  if (player) {
    paused = false;
    brush = false;
    sowBudget = null;
    hud.toast('Чужой мир. Смотри, как творил другой, — руки убраны.');
  }

  hud.markLens(1);
  hud.setLensUnlocked(2, false);
  hud.setLensUnlocked(3, false);
  hud.applyPause(paused);
  hud.applyBrush(brush);
  hud.setBudget(sowBudget);
  tabletUI.setUnlocked(false);
  tabletUI.refresh();
  renderer.resetView();

  sound.init(); // нажатие «Сотвори мир» — жест, разрешающий звук
  measure();
  running = true;
  hud.toast(
    cfg.mode === 'sower'
      ? `В твоей горсти ${cfg.sowBudget} Семян. Расставь их — и пусти время (⏸).`
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
  sound.event('end');

  // Эхо мира: запомнить отпечаток последней жизни для следующего творения.
  // Чужая история не оставляет праха в нашем мире.
  if (!player) {
    const imprint: number[] = [];
    for (let i = 0; i < world.cells.length; i++) {
      if (world.cells[i] === Cell.Seed) imprint.push(i);
    }
    saveEcho(cfg.size, imprint);
  }

  milestones.finalTick = world.tick;
  milestones.finalPhi = report.phi;
  milestones.tabletsFired = [...tabletEngine.firedLog];

  const endNeikos = aftermathNeikosN > 0 ? aftermathNeikosSum / aftermathNeikosN : report.neikos;
  const ending = decideEnding({
    survived,
    phi: report.phi,
    neikos: endNeikos,
    philia: report.philia,
    sawFuture: milestones.mindTick !== null && milestones.mindTick < firstThreatTick(me),
    tabletsCarved: tabletEngine.carvedCount,
    tabletsFired: tabletEngine.firedCount,
  });

  const score = computeScore({
    phi: report.phi,
    survived,
    horizonMax,
    neikos: endNeikos,
    chaos: report.chaos,
    ending,
    meEdits,
    tabletsCarved: tabletEngine.carvedCount,
    sower: cfg.mode === 'sower',
  });

  const isRecord = player ? false : saveBest(score);
  const chronicle = writeChronicle(milestones, ending, cfg);

  // Испытание: оценка цели и звёзды.
  let trialResult: string | undefined;
  if (cfg.trialId) {
    const trial = trialById(cfg.trialId);
    if (trial) {
      const stars = trialStars(trial, report.phi, survived, tabletEngine.carvedCount);
      if (!player && stars > 0) saveTrialStars(trial.id, stars);
      trialResult =
        stars > 0
          ? `Испытание «${trial.name}»: ${'★'.repeat(stars)}`
          : `Испытание «${trial.name}» не пройдено: Φ ${report.phi.toFixed(1)} из ${trial.goalPhi}`;
    }
  }

  screens.showFinal(
    {
      ending, score, best: Math.max(score, loadBest()), isRecord, chronicle,
      seedText: cfg.seedText,
      ...(trialResult !== undefined ? { trialResult } : {}),
    },
    {
      onRestart: showStart,
      onExportPng: () =>
        downloadChroniclePng(world, cfg.size, {
          title: ending.title,
          chronicle,
          seedText: cfg.seedText,
          score,
          phi: report.phi,
        }),
      onCopyReplay: () => (player ? null : recorder.encode()),
    },
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
const codex = new CodexScreen();

const hud = new Hud(me, {
  onMeChange(next) {
    if (player) return; // в чужом мире законы чужие
    // Веер будущих: путь старого закона остаётся лиловой тенью на 6 секунд.
    const old = forecaster.latest;
    const lastFrame = old?.frames[old.frames.length - 1];
    if (lastFrame) altGhost = { cells: lastFrame.cells, until: performance.now() + 6000 };
    // Поля энергии и угрозы ползунками не трогаются — переносим из текущих Ме.
    me = { ...me, birthMin: next.birthMin, birthMax: next.birthMax,
      surviveMin: next.surviveMin, surviveMax: next.surviveMax, ashLifetime: next.ashLifetime };
    meEdits++;
    recorder.record({ t: world.tick, k: 'me', me: meNums(me) });
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
  onMuteToggle: () => sound.toggleMute(),
  onScrub(frac) {
    scrubFrac = frac;
  },
});

const tabletUI = new TabletUI(document.getElementById('mepanel') as HTMLElement, tabletEngine, {
  onCarve(condition, action) {
    if (player) return 'В чужом мире нельзя высекать.';
    const err = tabletEngine.carve(condition, action, world);
    if (err) hud.toast(err);
    else {
      recorder.record({ t: world.tick, k: 'carve', c: condition, a: action });
      hud.toast('Табличка высечена. Она спит и ждёт своего часа.');
    }
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
    (choice) =>
      startRun(choice.seedText, choice.biome, choice.archetype, choice.size, choice.mode, null, choice.trialId),
    (code) => {
      const data = decodeReplay(code);
      if (!data) return false;
      startRun(data.cfg.seedText, data.cfg.biome, data.cfg.archetype, data.cfg.size, data.cfg.mode, data);
      return true;
    },
    () => codex.show(),
  );
}

// ---- Кисть посева ----

/** Посадить одно Семя; единая точка мутации для руки и для реплея. */
function setSeed(i: number, strain: number): boolean {
  if (i < 0 || i >= world.cells.length || world.cells[i] === Cell.Seed) return false;
  world.cells[i] = Cell.Seed;
  world.age[i] = 0;
  world.kind[i] = strain;
  return true;
}

function sowAt(cssX: number, cssY: number): void {
  if (player) return; // в чужом мире руки убраны
  const c = renderer.cellAt(cssX, cssY);
  if (!c) return;

  // Сеятель: по одному Семени из горсти, после пуска времени — рука убрана.
  if (sowBudget !== null) {
    if (sowingLocked || sowBudget <= 0) return;
    const i = c.y * GRID_W + c.x;
    if (!setSeed(i, brushStrain)) return;
    recorder.record({ t: world.tick, k: 'sow', i, s: brushStrain });
    sowBudget--;
    hud.setBudget(sowBudget);
    sound.event('sow');
    if (sowBudget === 0) hud.toast('Горсть пуста. Пусти время (⏸) — и смотри, что взойдёт.');
    return;
  }

  const spots = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  for (const [dx, dy] of spots) {
    const x = (c.x + dx + GRID_W) % GRID_W;
    const y = (c.y + dy + GRID_H) % GRID_H;
    const i = y * GRID_W + x;
    if (setSeed(i, brushStrain)) {
      recorder.record({ t: world.tick, k: 'sow', i, s: brushStrain });
    }
  }
  forecaster.invalidate();
  refreshForecast(true);
}

/** Воспроизведение: применить вмешательства, чей тик настал. */
function applyReplayEvents(): void {
  if (!player) return;
  for (const ev of player.due(world.tick)) {
    switch (ev.k) {
      case 'me':
        me = { ...me, ...ev.me };
        break;
      case 'sow':
        setSeed(ev.i, ev.s);
        break;
      case 'carve':
        tabletEngine.carve(ev.c, ev.a, world);
        tabletUI.refresh();
        break;
    }
  }
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
    case 'KeyM':
      sound.toggleMute();
      break;
  }
});

// ---- Цикл ----

let lastTime = performance.now();
let accumulator = 0;
let lastStage = '';
let lastAmbient = 0;

function frame(now: number): void {
  accumulator += now - lastTime;
  lastTime = now;
  if (accumulator > 1000) accumulator = 1000;

  if (running && !paused) {
    const stepMs = TICK_MS / (SPEEDS[speedIdx] as number);
    while (accumulator >= stepMs && running) {
      applyReplayEvents();
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
    if (stage === 'crisis') {
      hud.toast('Нейкос приближается. Шторм начался.');
      sound.event('storm');
    }
    if (stage === 'respite') hud.toast('Шторм прошёл. Передышка — но судьба ещё не исчерпана.');
    if (stage === 'aftermath') hud.toast('Последний шторм отгремел. Мир считает выживших.');
    lastStage = STAGE_NAMES[stage];
  }
  if (running) {
    const q = pickQuote(stage, world.tick);
    hud.setQuote(q.text, q.source);
    if (now - lastAmbient > 500) {
      lastAmbient = now;
      sound.ambient(aliveSeeds() / world.cells.length, world.energy, stage);
    }
  }

  // Призрак будущего — только в линзе Разума; скраббер выбирает кадр пути.
  const f = forecaster.latest;
  const snap =
    f && f.frames.length > 0
      ? f.frames[Math.min(f.frames.length - 1, Math.round(scrubFrac * (f.frames.length - 1)))]
      : undefined;
  renderer.setFuture(lenses.current === 3 && snap ? snap.cells : null);
  if (altGhost && performance.now() > altGhost.until) altGhost = null;
  renderer.setFutureAlt(lenses.current === 3 && altGhost ? altGhost.cells : null);
  hud.setScrub(lenses.current === 3 && !!snap, snap ? snap.at : null);

  renderer.render(world, lenses.current, clusters);
  hud.update(world, report, lenses.unlocked3 ? horizonNow() : null, STAGE_NAMES[stage]);
  requestAnimationFrame(frame);
}

showStart();
requestAnimationFrame(frame);
