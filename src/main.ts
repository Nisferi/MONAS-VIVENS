/**
 * Точка входа: полная петля партии (шаги 1–7 плана сборки).
 * Старт (биом × архетип × seed) → Genesis → Морфогенез → Разум →
 * Нейкос-шторм → развязка → концовка + летопись + счёт.
 */
import {
  BASE_STRAINS, Cell, GRID_H, GRID_W, HYBRID_STRAIN, Terrain,
  createWorld, setGridSize, type WorldState,
} from './core/grid';
import { generateTerrain } from './core/terrain';
import { DECREES, PROVINCES, PROVINCE_NAMES, generateProvinces, NEUTRAL_LAW } from './core/provinces';
import { DEFAULT_ME, shadowAt, tick, type Me } from './core/rules';
import { Forecaster } from './future/forecast';
import { horizonTicks } from './future/horizon';
import { LensSwitcher } from './lens/switcher';
import { ClusterTracker, type Cluster } from './phi/clusters';
import { PoliticsTracker } from './phi/politics';
import { NeikosMeter } from './phi/neikos';
import { computePhi, type PhiReport } from './phi/phi';
import { initPwa } from './platform/pwa';
import { loadBest, loadEcho, loadSetup, saveBest, saveEcho, saveSetup } from './platform/storage';
import { initTelegram } from './platform/telegram';
import { writeChronicle, type Milestones, type NamedFormNote } from './run/chronicle';
import { decideEnding } from './run/endings';
import { computeScore } from './run/score';
import { detectKnownForms, PATTERNS } from './phi/patterns';
import { NAME_AGE, NAME_SIZE, formName, type NamedForm } from './phi/names';
import { GoalsPanel } from './ui/goals';
import { discoverForm, loadLayoutBest, loadWeeklyBest, saveLayoutBest, saveTrialStars, saveWeeklyBest } from './platform/storage';
import { currentWeekly } from './run/weekly';
import { EONS, eonComplete, eonsProgress, type Eon } from './run/eons';
import { BreathPool, COST } from './run/breath';
import { vowMultiplier, vowVerdict, type VowId } from './run/vows';
import {
  HEARTH_TPS, clearHearth, clearResume, elapsedTicks, eternalThreats, fmtAbsence,
  loadHearth, loadResume, packWorld, restoreWorld, saveHearth, saveResume,
} from './run/hearth';
import { ReplayPlayer, ReplayRecorder, decodeDuel, decodeReplay, encodeDuel, meNums, type ReplayData } from './run/replay';
import { makeRun, type RunConfig } from './run/setup';
import { trialById, trialStars } from './run/trials';
import {
  LAYOUTS, PIECE_INFO, dailyLayout, layoutById, poolTotal,
  type Layout, type PieceKind, type Pool, type Stake,
} from './run/layouts';
import { downloadChroniclePng } from './ui/chronicleImage';
import { CodexScreen } from './ui/codex';
import { playEndingScene } from './ui/scenes';
import { activeTheme, applyTheme, loadThemeId } from './ui/themes';
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
applyTheme(loadThemeId());

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
/** «Расклад»: остатки фигур и текущая фигура кисти. */
let layoutPool: Pool | null = null;
let currentPiece: PieceKind = 's0';
let activeLayout: Layout | null = null;
/** Интеграл Φ за партию — счёт ставки «Расцвет». */
let phiIntegral = 0;
/** «Очаг»: вечный мир в реальном времени. */
let hearthMode = false;
let hearthCatchUp = 0;
let lastHearthSave = 0;
/** «Дыхание»: сессия созерцания — руки убраны, темп дышит. */
let breathMode = false;
let breathStartedAt = 0;
const BREATH_SESSION_MS = 10 * 60 * 1000;

const tracker = new ClusterTracker();
const politics = new PoliticsTracker();
const breath = new BreathPool();
const neikosMeter = new NeikosMeter();
const lenses = new LensSwitcher();
const forecaster = new Forecaster();
const tabletEngine = new TabletEngine();
const sound = new SoundEngine();
const recorder = new ReplayRecorder();
let player: ReplayPlayer | null = null;
/** Принятый вызов: счёт соперника и его реплей-доказательство. */
let pendingDuel: { score: number; data: ReplayData } | null = null;
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
/** Хроника: сколько тиков жизни видела каждая клетка (линза Ⅳ). */
let heat = new Float32Array(0);
/** Именованные формы партии (id кластера → биография). */
const namedForms = new Map<number, NamedForm>();
/** Заря уже взошла в этой партии? */
let dawnSeen = false;
/** Первый эндосимбиоз уже случился? (§16.3) */
let symbiosisSeen = false;
/** Пожиратели уже приходили? (§15.3) */
let devourersSeen = false;
/** Активная глава кампании «Эоны». */
let activeEon: Eon | null = null;
/** Обет партии (§15.2). */
let activeVow: VowId = 'none';
/** Откат последнего жеста: посев или правка Ме. */
let lastGesture:
  | { kind: 'sow'; i: number; budget: 'sower' | PieceKind | null }
  | { kind: 'me'; prev: Me }
  | null = null;
const goals = GoalsPanel.needed() ? new GoalsPanel() : null;

const milestones: Milestones = {
  firstFormTick: null,
  mindTick: null,
  namedForms: [],
  threatTick: 0,
  stormCount: 0,
  tabletsFired: [],
  finalTick: 0,
  finalPhi: 0,
};

function horizonNow(): number {
  return Math.round(horizonTicks(report.phi) * cfg.horizonScale);
}

let aliveCount = 0;

function measure(): void {
  clusters = tracker.update(world);
  const neikos = neikosMeter.update(tracker.events);
  report = computePhi(clusters, neikos);

  phiIntegral += report.phi;
  // §15.1 Дыхание Творца: мир, видящий себя, кормит своего бога.
  breath.feed(report.phi);

  aliveCount = 0;
  for (let i = 0; i < world.cells.length; i++) {
    if (world.cells[i] === Cell.Seed) aliveCount++;
  }

  // Хроника: место помнит каждый тик прожитой на нём жизни.
  if (heat.length === world.cells.length) {
    for (let i = 0; i < world.cells.length; i++) {
      if (world.cells[i] === Cell.Seed) heat[i] = (heat[i] as number) + 1;
    }
  }

  const unlockEvent = lenses.update(clusters, report.phi, world.tick);
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
    if (lenses.unlocked4) hud.setLensUnlocked(4, true);
    if (lenses.unlocked5) hud.setLensUnlocked(5, true);
    hud.toast(unlockEvent);
  }

  if (lenses.unlocked3) horizonMax = Math.max(horizonMax, horizonNow());

  if (me.threats.length > 0 && world.tick >= lastThreatEnd(me)) {
    aftermathNeikosSum += report.neikos;
    aftermathNeikosN++;
  }

  // События судьбы: голос в момент свершения.
  for (const ev of me.events) {
    if (world.tick === ev.tick) {
      hud.toast(ev.kind === 'comet'
        ? 'Комета прошла — небо засеяло землю новыми Семенами.'
        : 'Год тишины: родники полны, приток удвоен.');
      sound.event('form');
    }
    if (ev.kind === 'quiet' && world.tick === ev.tick + ev.duration) {
      hud.toast('Год тишины окончен.');
    }
  }

  // Эволюция (Ярус 3): отчёт о дрейфе осторожности — скан раз в 10 тиков.
  if (world.tick % 10 === 0) reportGeneDrift();

  // Политика форм (§16.6): союзы и войны — скан раз в 5 тиков.
  if (world.tick % 5 === 0) {
    for (const msg of politics.update(world, clusters)) {
      hud.toast(msg);
      sound.event('form');
    }
  }

  // Таблички: спящие правила проверяются каждый тик.
  for (const msg of tabletEngine.update(world, clusters, report, me)) {
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

    // Имена: форма, прожившая век, обретает биографию.
    const present = new Set<number>();
    for (const c of clusters) {
      present.add(c.id);
      const known = namedForms.get(c.id);
      if (known) {
        if (c.size > known.peakSize) known.peakSize = c.size;
      } else if (c.age >= NAME_AGE && c.size >= NAME_SIZE && namedForms.size < 6) {
        const name = formName(c.id, cfg.seed);
        namedForms.set(c.id, {
          id: c.id, name,
          bornTick: world.tick - c.age, namedTick: world.tick,
          diedTick: null, peakSize: c.size,
        });
        hud.toast(`Форма обрела имя: ${name}.`);
        sound.event('form');
      }
    }
    for (const f of namedForms.values()) {
      if (f.diedTick === null && !present.has(f.id)) {
        f.diedTick = world.tick;
        hud.toast(`${f.name} больше нет. Летопись запомнит.`);
      }
    }

    // §15.3 Пожиратели: первое пришествие хищников.
    if (!devourersSeen && me.devourers) {
      for (let i = 0; i < world.cells.length; i++) {
        if (world.cells[i] === Cell.Devourer) {
          devourersSeen = true;
          hud.toast('Пришли Пожиратели — у жизни появился хищник.');
          sound.event('storm');
          break;
        }
      }
    }

    // Эндосимбиоз: первый носитель митохондрий.
    if (!symbiosisSeen) {
      for (let i = 0; i < world.cells.length; i++) {
        if (world.cells[i] === Cell.Seed && (world.mito[i] ?? 0) > 0) {
          symbiosisSeen = true;
          hud.toast('Слияние! Клетка вобрала чужую — родилась митохондрия.');
          sound.event('mind');
          break;
        }
      }
    }

    // Заря: первый гибрид трёх родов.
    if (!dawnSeen) {
      for (let i = 0; i < world.cells.length; i++) {
        if (world.cells[i] === Cell.Seed && world.kind[i] === HYBRID_STRAIN) {
          dawnSeen = true;
          hud.toast('Три рода сошлись — взошла Заря, четвёртый род.');
          sound.event('mind');
          break;
        }
      }
    }
  }

  // Гид первой партии.
  if (goals && running && !player) {
    const done = goals.update({
      firstForm: lenses.unlocked2,
      lens2Used: lenses.current === 2 || lenses.current === 3,
      mindAwake: lenses.unlocked3,
      tabletBeforeStorm: tabletEngine.carvedCount > 0 && world.tick < firstThreatTick(me),
    });
    if (done) hud.toast(done);
  }
}

/** Средняя осторожность каждого рода до недавнего шторма — для дрейфа. */
const geneBefore: (number | null)[] = [null, null, null];
let lastStormIndex = -1;

function reportGeneDrift(): void {
  // Индекс ближайшего прошедшего шторма.
  let idx = -1;
  for (let s = 0; s < me.threats.length; s++) {
    if (world.tick >= (me.threats[s] as { tick: number }).tick) idx = s;
  }
  // На входе в шторм запоминаем осторожность; после — сравниваем.
  const sum = [0, 0, 0];
  const cnt = [0, 0, 0];
  for (let i = 0; i < world.cells.length; i++) {
    if (world.cells[i] === Cell.Seed || world.cells[i] === Cell.Spore) {
      const k = world.kind[i] as number;
      sum[k] = (sum[k] as number) + (world.gene[i] as number);
      cnt[k] = (cnt[k] as number) + 1;
    }
  }
  const STRAIN = ['Огня', 'Нефрита', 'Аметиста'];
  if (idx !== lastStormIndex && idx >= 0) {
    // Шторм пройден: показать, кто поумнел.
    for (let k = 0; k < 3; k++) {
      const before = geneBefore[k] ?? null;
      const after = (cnt[k] as number) > 0 ? (sum[k] as number) / (cnt[k] as number) : null;
      if (before != null && after != null && (cnt[k] as number) >= 8) {
        const d = Math.round(after - before);
        if (Math.abs(d) >= 6) {
          hud.toast(
            `Род ${STRAIN[k]} ${d > 0 ? 'поумнел' : 'осмелел'}: осторожность ${Math.round(before)}→${Math.round(after)}.`,
          );
        }
      }
    }
    lastStormIndex = idx;
    for (let k = 0; k < 3; k++) geneBefore[k] = null;
  }
  // Перед следующим штормом копим базовую осторожность.
  const nextStorm = me.threats[idx + 1] as { tick: number } | undefined;
  if (nextStorm && nextStorm.tick - world.tick <= 30 && geneBefore[0] === null) {
    for (let k = 0; k < 3; k++) {
      geneBefore[k] = (cnt[k] as number) > 0 ? (sum[k] as number) / (cnt[k] as number) : null;
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
  layoutPick: { id: string; stake: Stake } | null = null,
  echoOverride: number[] | null = null,
  vow: VowId = 'none',
): void {
  hearthMode = false;
  hearthCatchUp = 0;
  breathMode = false;
  activeEon = null;
  (document.getElementById('mepanel') as HTMLElement).style.display = '';
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
  // «Расклад»: фиксированный мир + бюджет фигур + ставка.
  activeLayout = null;
  layoutPool = null;
  if (layoutPick) {
    const lay = layoutById(layoutPick.id);
    if (lay) {
      activeLayout = lay;
      cfg = {
        ...makeRun(lay.seedText, lay.biome, 'clay', lay.size, 'sower'),
        layoutId: lay.id,
        stake: layoutPick.stake,
        sowBudget: poolTotal(lay.pool),
      };
      layoutPool = { ...lay.pool };
      currentPiece = nextPiece('wall') ?? 's0';
    }
  }
  player = replay ? new ReplayPlayer(replay) : null;
  if (!player && !trialId && !layoutPick) saveSetup({ biome, archetype, size, mode });
  setGridSize(cfg.size);
  renderer.rebuildGrid();
  me = { ...cfg.me };
  const land = generateTerrain(cfg.seed, cfg.terrain);
  const provMap = generateProvinces(cfg.seed);
  world = createWorld(cfg.seed, cfg.density, cfg.startEnergy, land, provMap);
  me.laws = Array.from({ length: PROVINCES }, () => ({ ...NEUTRAL_LAW }));
  heat = new Float32Array(world.cells.length);

  tracker.reset();
  politics.reset();
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
  phiIntegral = 0;
  namedForms.clear();
  milestones.namedForms = [];
  dawnSeen = false;
  symbiosisSeen = false;
  devourersSeen = false;
  breath.reset();
  activeVow = vow;
  lastGesture = null;
  if (goals && !player) goals.show();
  lastStormIndex = -1;
  geneBefore[0] = geneBefore[1] = geneBefore[2] = null;

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
  const echo = player ? player.data.echo : (echoOverride ?? loadEcho(cfg.size) ?? []);
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

  aim = null;
  hud.resetRunUi();
  hud.resetDecrees();
  hud.markLens(1);
  hud.setLensUnlocked(2, false);
  hud.setLensUnlocked(3, false);
  hud.applyPause(paused);
  hud.applyBrush(brush);
  if (layoutPool) {
    hud.setBudgetText(layoutBudgetText() || null);
    applyPieceButton();
  } else {
    hud.setBudget(sowBudget);
  }
  tabletUI.setUnlocked(false);
  tabletUI.refresh();
  renderer.resetView();
  // Фаза посева начинается с приближения: клетки видны, сетка включена.
  if (cfg.mode === 'sower' && !player) {
    renderer.zoomAt(2.5, window.innerWidth / 2, window.innerHeight / 2);
  }

  sound.init(); // нажатие «Сотвори мир» — жест, разрешающий звук
  measure();
  running = true;
  hud.toast(
    activeLayout
      ? `Расклад «${activeLayout.name}»: разложи фигуры (● кнопкой меняй тип) и пусти время.`
      : cfg.mode === 'sower'
        ? `В твоей горсти ${cfg.sowBudget} Семян. Расставь их — и пусти время (⏸).`
        : 'Мир сотворён. Начертай Ме — и жди, когда форма устоит.',
  );
}

function resumeEligible(): boolean {
  return (
    running && !hearthMode && !breathMode && !player &&
    cfg.mode === 'flow' && !cfg.trialId && !cfg.layoutId
  );
}

function persistResume(): void {
  if (!resumeEligible()) return;
  saveResume({
    seedText: cfg.seedText,
    biome: cfg.biome,
    archetype: cfg.archetype,
    size: cfg.size,
    world: packWorld(world),
    me,
    tablets: tabletEngine.toJSON(),
    savedAt: Date.now(),
  });
}

function persistHearth(): void {
  if (!hearthMode || !running) return;
  saveHearth({
    seedText: cfg.seedText,
    biome: cfg.biome,
    archetype: cfg.archetype,
    size: cfg.size,
    world: packWorld(world),
    me,
    tablets: tabletEngine.toJSON(),
    savedAt: Date.now(),
  });
  lastHearthSave = performance.now();
}

function startHearth(): void {
  const save = loadHearth();
  hearthMode = false; // чтобы startRun не сохранил лишнего
  if (save) {
    startRun(save.seedText, save.biome, save.archetype, save.size, 'flow');
    me = { ...save.me };
    world = restoreWorld(save);
    heat = new Float32Array(world.cells.length);
    tracker.reset();
    tabletEngine.fromJSON(save.tablets);
    tabletUI.refresh();
    hearthCatchUp = elapsedTicks(save);
    hearthMode = true;
    measure();
    hud.toast(
      hearthCatchUp > 0
        ? `Очаг ждал тебя ${fmtAbsence(hearthCatchUp)}. Мир проживает это время…`
        : 'Очаг тёплый. Мир продолжается.',
    );
  } else {
    startRun(`очаг-${Date.now() % 1000000}`, 'swamp', 'clay', 64, 'flow');
    me = { ...me, threats: eternalThreats(cfg.seed) };
    hearthCatchUp = 0;
    hearthMode = true;
    hud.toast('Очаг разожжён. Этот мир живёт в реальном времени — даже без тебя.');
  }
  persistHearth();
}

function startBreath(): void {
  startRun(`дыхание-${Date.now() % 1000000}`, 'swamp', 'clay', 64, 'flow');
  breathMode = true;
  breathStartedAt = performance.now();
  brush = false;
  hud.applyBrush(false);
  (document.getElementById('mepanel') as HTMLElement).style.display = 'none';
  hud.toast('Дыхание: 10 минут наблюдения. Мир дышит с тобой — руки не нужны.');
}

/** Живые Семена считаются один раз за тик в measure(). */
function aliveSeeds(): number {
  return aliveCount;
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
  const pol = politics.summary();
  if (pol.allies > 0 || pol.wars > 0) {
    milestones.politics = pol;
  }
  milestones.namedForms = [...namedForms.values()]
    .sort((a, b) => b.peakSize - a.peakSize)
    .map((f): NamedFormNote => ({
      name: f.name, namedTick: f.namedTick, diedTick: f.diedTick, peakSize: f.peakSize,
    }));
  if (!player) clearResume();
  goals?.hide();

  const endNeikos = aftermathNeikosN > 0 ? aftermathNeikosSum / aftermathNeikosN : report.neikos;
  const ending = decideEnding({
    survived,
    phi: report.phi,
    neikos: endNeikos,
    philia: report.philia,
    sawFuture: milestones.mindTick !== null && milestones.mindTick < firstThreatTick(me),
    tabletsCarved: tabletEngine.carvedCount,
    tabletsFired: tabletEngine.firedCount,
    will: me.will,
  });

  let score = computeScore({
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

  const chronicle = writeChronicle(milestones, ending, cfg);

  // Расклад: счёт по ставке.
  let trialResult: string | undefined;
  if (activeLayout && cfg.layoutId) {
    const layScore =
      cfg.stake === 'bloom' ? Math.round(phiIntegral / 100) : world.tick;
    const wasBest = player ? false : saveLayoutBest(cfg.layoutId, cfg.stake, layScore);
    const stakeName = cfg.stake === 'bloom' ? 'Расцвет' : 'Долгожитие';
    const best = loadLayoutBest(cfg.layoutId, cfg.stake);
    trialResult = `Расклад «${activeLayout.name}» · ${stakeName}: ${layScore}${wasBest ? ' — рекорд!' : ` (лучший ${best})`}`;
  }

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

  // §15.2 Обет: исполненный удваивает счёт, нарушенный — карает.
  const verdict = vowVerdict(activeVow, ending.id);
  if (verdict) {
    score = Math.round(score * vowMultiplier(activeVow, ending.id));
    trialResult = trialResult ? `${trialResult} · ${verdict}` : verdict;
  }

  // Рекорды считаем ПОСЛЕ суда обета — удвоение должно попасть в таблицу.
  const isRecord = player ? false : saveBest(score);
  // Мир недели: свой зачёт до понедельника.
  if (!player && cfg.seedText === currentWeekly().seedText) {
    if (saveWeeklyBest(cfg.seedText, score)) hud.toast('Лучший результат недели!');
  }

  // Сцена концовки — образ перед летописью.
  playEndingScene(ending.id, () =>
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
        onCopyDuel: () => {
          if (player) return null;
          const rep = recorder.encode();
          return rep ? encodeDuel(score, rep) : null;
        },
      },
    ),
  );
}

/** Гибель мира фиксируется не мгновенно — даём шанс на возрождение. */
let lowAliveTicks = 0;

function checkEnd(): void {
  const alive = aliveSeeds();
  lowAliveTicks = alive < 5 ? lowAliveTicks + 1 : 0;
  if (hearthMode) {
    // Очаг не кончается временем — только гибелью мира.
    if (lowAliveTicks > 50) {
      clearHearth();
      finishRun();
    }
    return;
  }
  if (world.tick >= endTick(me) || lowAliveTicks > 50) finishRun();
}

// ---- UI ----

const renderer = new FieldRenderer(canvas);
const screens = new Screens();
const codex = new CodexScreen();

const hud = new Hud(me, {
  onMeChange(next) {
    if (player || breathMode) return; // в чужом мире и в созерцании законы не трогают
    // Веер будущих: путь старого закона остаётся лиловой тенью на 6 секунд.
    const old = forecaster.latest;
    const lastFrame = old?.frames[old.frames.length - 1];
    if (lastFrame) altGhost = { cells: lastFrame.cells, until: performance.now() + 6000 };
    if (!breath.spend('me')) {
      hud.toast(`Не хватает Дыхания на правку закона (нужно ${COST.me}).`);
      return;
    }
    lastGesture = { kind: 'me', prev: { ...me } };
    // Поля энергии и угрозы ползунками не трогаются — переносим из текущих Ме.
    me = { ...me, birthMin: next.birthMin, birthMax: next.birthMax,
      surviveMin: next.surviveMin, surviveMax: next.surviveMax,
      ashLifetime: next.ashLifetime, will: next.will };
    meEdits++;
    recorder.record({ t: world.tick, k: 'me', me: meNums(me) });
    forecaster.invalidate();
    refreshForecast(true);
  },
  onPauseToggle: () => togglePause(),
  onReseed() {
    if (hearthMode && running) {
      // Очаг не гасят — его оставляют тёплым.
      persistHearth();
      running = false;
      hearthMode = false;
      hud.toast('Очаг сохранён. Мир продолжит жить без тебя.');
      showStart();
      return;
    }
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
    if (layoutPool) {
      const np = nextPiece(currentPiece);
      if (np) currentPiece = np;
      applyPieceButton();
      return -1; // hud не трогает цвет — applyPieceButton уже всё сделал
    }
    brushStrain = (brushStrain + 1) % BASE_STRAINS;
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
  // §15.4 Указ провинции: локальный закон за Дыхание.
  onDecree(province, decreeId) {
    if (player || breathMode) return 'Сейчас руки убраны.';
    const decree = DECREES.find((d) => d.id === decreeId);
    if (!decree) return 'Неведомый указ.';
    if (decreeId !== 'none' && !breath.spend('decree')) {
      const msg = `Не хватает Дыхания на указ (нужно ${COST.decree}).`;
      hud.toast(msg);
      return msg;
    }
    if (!me.laws || me.laws.length < PROVINCES) {
      me.laws = Array.from({ length: PROVINCES }, () => ({ ...NEUTRAL_LAW }));
    }
    me.laws[province] = { ...decree.law };
    forecaster.invalidate();
    refreshForecast(true);
    hud.toast(`${PROVINCE_NAMES[province]}: ${decree.name}.`);
    return null;
  },
});

const tabletUI = new TabletUI(hud.tabletsPane, tabletEngine, {
  onCarve(condition, action) {
    if (player || breathMode) return 'Сейчас руки убраны.';
    if (!breath.canAfford('tablet')) {
      const msg = `Не хватает Дыхания на высечение (нужно ${COST.tablet}).`;
      hud.toast(msg);
      return msg;
    }
    const err = tabletEngine.carve(condition, action, world);
    if (err) hud.toast(err);
    else {
      breath.spend('tablet');
      recorder.record({ t: world.tick, k: 'carve', c: condition, a: action });
      hud.toast('Табличка высечена. Она спит и ждёт своего часа.');
    }
    return err;
  },
});

function acceptCode(code: string): boolean {
  // Вызов на дуэль: играешь тот же мир сам, реплей соперника — доказательство.
  const duel = decodeDuel(code);
  if (duel) {
    pendingDuel = duel;
    const c = duel.data.cfg;
    // Эхо соперника — из его реплея: миры дуэлянтов идентичны.
    startRun(c.seedText, c.biome, c.archetype, c.size, c.mode, null, null, null, duel.data.echo);
    hud.toast(`Дуэль принята! Счёт соперника: ${duel.score}. Тот же мир — твой ход.`);
    return true;
  }
  const data = decodeReplay(code);
  if (!data) return false;
  pendingDuel = null;
  startRun(data.cfg.seedText, data.cfg.biome, data.cfg.archetype, data.cfg.size, data.cfg.mode, data);
  return true;
}

/** Настройка нового мира: путь, место, семя, простор, стиль. */
function showSetup(): void {
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
      startRun(
        choice.seedText, choice.biome, choice.archetype, choice.size, choice.mode,
        null, choice.trialId,
        choice.layoutId ? { id: choice.layoutId, stake: choice.stake } : null,
        null, choice.vow,
      ),
    showStart,
  );
}

function startEon(eon: Eon): void {
  startRun(eon.seedText, eon.biome, eon.archetype, eon.size, 'flow');
  activeEon = eon;
  hud.toast(`Эон ${eon.id} «${eon.name}»: ${eon.goalText}.`);
}

function resumeRun(): void {
  const save = loadResume();
  if (!save) return;
  startRun(save.seedText, save.biome, save.archetype, save.size, 'flow');
  me = { ...save.me };
  world = restoreWorld(save);
  heat = new Float32Array(world.cells.length);
  tracker.reset();
  tabletEngine.fromJSON(save.tablets);
  tabletUI.refresh();
  measure();
  hud.toast(`Партия продолжается с ${world.tick} тика.`);
}

/** Главное меню: все пути игры на виду. */
function showStart(): void {
  const w = currentWeekly();
  const weeklyBest = loadWeeklyBest(w.seedText);
  const save = loadHearth();
  screens.showMenu(
    'MONAS VIVENS',
    'Ты — закон, а не рука. Проведи мир от слепой клетки до разума, видящего будущее.',
    [
      {
        icon: '✦', label: 'Новый мир',
        desc: 'Поток · Сеятель · Испытания · Расклады',
        onClick: showSetup,
      },
      ...(loadResume()
        ? [{
            icon: '▶', label: 'Продолжить партию',
            desc: `мир ждёт на ${(JSON.parse((loadResume() as { world: string }).world) as { tick: number }).tick} тике`,
            onClick: () => {
              screens.hide();
              resumeRun();
            },
          }]
        : []),
      {
        icon: '🔥', label: save ? 'Очаг (тамагочи) — вернуться к миру' : 'Очаг — режим-тамагочи',
        desc: save
          ? `тик ${(JSON.parse(save.world) as { tick: number }).tick}, один ${fmtAbsence(elapsedTicks(save))}`
          : 'вечный мир: живёт в реальном времени, навещай и направляй',
        onClick: () => {
          screens.hide();
          startHearth();
        },
      },
      {
        icon: '☯', label: 'Дыхание — самопознание',
        desc: '10 минут созерцания: мир дышит с тобой, в конце — строка о себе',
        onClick: () => {
          screens.hide();
          startBreath();
        },
      },
      {
        icon: '🌍', label: `Мир недели «${w.seedText}»`,
        desc: weeklyBest > 0 ? `один на всех до понедельника · лучший ${weeklyBest}` : 'один на всех до понедельника',
        onClick: () => {
          screens.hide();
          startRun(w.seedText, w.biome, w.archetype, w.size, 'flow');
        },
      },
      {
        icon: '⛰', label: `Эоны — кампания (${eonsProgress()}/${EONS.length})`,
        desc: (() => {
          const next = EONS[eonsProgress()];
          return next ? `глава ${next.id} «${next.name}»: ${next.goalText}` : 'все главы пройдены';
        })(),
        onClick: () => {
          const next = EONS[Math.min(eonsProgress(), EONS.length - 1)] as Eon;
          screens.hide();
          startEon(next);
        },
      },
      {
        icon: '⚔', label: 'Чужой мир / Дуэль',
        desc: 'вставь код реплея или вызова',
        onClick: () => {
          const code = window.prompt('Код реплея (MONAS1:…) или вызова (MONAS-DUEL:…):');
          if (code && acceptCode(code)) screens.hide();
          else if (code) hud.toast('Код не прочитан.');
        },
      },
      {
        icon: '📖', label: 'Кодекс форм',
        desc: 'существа, которых видели твои миры',
        onClick: () => codex.show(),
      },
    ],
    loadBest(),
  );
}

// ---- Кисть посева ----

/** Посадить одно Семя; единая точка мутации для руки и для реплея. */
let worldDirty = 0;
/** Прицел посева: игрок целится, потом подтверждает — палец не закрывает клетку. */
let aim: { x: number; y: number } | null = null;

function sowingPhase(): boolean {
  return running && !player && !sowingLocked && (sowBudget !== null || layoutPool !== null);
}

function aimRgb(): [number, number, number] {
  const f = activeTheme.field;
  if (layoutPool) {
    if (currentPiece === 'wall') return f.signal;
    if (currentPiece === 'spore') return f.spore;
    return (f.strains[Number(currentPiece.slice(1))]?.old ?? [255, 255, 255]) as [number, number, number];
  }
  return (f.strains[brushStrain]?.old ?? [255, 255, 255]) as [number, number, number];
}

/** Следующая фигура расклада с остатком > 0 (после заданной). */
function nextPiece(after: PieceKind): PieceKind | null {
  if (!layoutPool) return null;
  const kinds = PIECE_INFO.map((x) => x.kind);
  const start = kinds.indexOf(after);
  for (let k = 1; k <= kinds.length; k++) {
    const kind = kinds[(start + k) % kinds.length] as PieceKind;
    if ((layoutPool[kind] ?? 0) > 0) return kind;
  }
  return null;
}

/** Поставить фигуру расклада; единая точка для руки и реплея. */
function setPiece(i: number, kind: PieceKind): boolean {
  if (i < 0 || i >= world.cells.length) return false;
  if (world.terrain[i] === Terrain.Crystal || world.cells[i] !== Cell.Empty) return false;
  if (kind === 'wall') world.cells[i] = Cell.Signal;
  else if (kind === 'spore') world.cells[i] = Cell.Spore;
  else {
    world.cells[i] = Cell.Seed;
    world.kind[i] = Number(kind.slice(1));
  }
  world.age[i] = 0;
  worldDirty++;
  return true;
}

function layoutBudgetText(): string {
  if (!layoutPool) return '';
  return PIECE_INFO
    .filter((x) => (layoutPool as Pool)[x.kind] > 0)
    .map((x) => `${x.glyph}${(layoutPool as Pool)[x.kind]}`)
    .join(' ');
}

function applyPieceButton(): void {
  const info = PIECE_INFO.find((x) => x.kind === currentPiece);
  if (!info) return;
  const strains = activeTheme.field.strains;
  const rgb =
    currentPiece === 'wall'
      ? activeTheme.field.signal
      : currentPiece === 'spore'
        ? activeTheme.field.spore
        : (strains[Number(currentPiece.slice(1))]?.old ?? [255, 255, 255]);
  hud.setPieceButton(info.glyph, rgb as [number, number, number], `Кисть кладёт: ${info.name}`);
}

function setSeed(i: number, strain: number): boolean {
  if (i < 0 || i >= world.cells.length || world.cells[i] === Cell.Seed) return false;
  if (world.terrain[i] === Terrain.Crystal) return false; // на камне не сеют
  world.cells[i] = Cell.Seed;
  world.age[i] = 0;
  world.kind[i] = strain;
  worldDirty++;
  return true;
}

/** Посадить в клетку (x, y) — из прицела или с клавиатуры. */
function plantAt(x: number, y: number): void {
  const c = { x, y };
  // «Расклад»: кладём текущую фигуру из бюджета.
  if (layoutPool) {
    if (sowingLocked || (layoutPool[currentPiece] ?? 0) <= 0) return;
    const i = c.y * GRID_W + c.x;
    if (!setPiece(i, currentPiece)) return;
    layoutPool[currentPiece]--;
    lastGesture = { kind: 'sow', i, budget: currentPiece };
    const ev: { t: number; k: 'sow'; i: number; s: number; p?: 'spore' | 'wall' } = {
      t: world.tick, k: 'sow', i,
      s: currentPiece.startsWith('s') ? Number(currentPiece.slice(1)) : 0,
    };
    if (currentPiece === 'spore' || currentPiece === 'wall') ev.p = currentPiece;
    recorder.record(ev);
    sound.event('sow');
    if ((layoutPool[currentPiece] ?? 0) === 0) {
      const np = nextPiece(currentPiece);
      if (np) {
        currentPiece = np;
        applyPieceButton();
      } else {
        hud.toast('Расклад выложен. Пусти время (⏸) — и смотри.');
      }
    }
    hud.setBudgetText(layoutBudgetText() || null);
    return;
  }

  // Сеятель: по одному Семени из горсти, после пуска времени — рука убрана.
  if (sowBudget !== null) {
    if (sowingLocked || sowBudget <= 0) return;
    const i = c.y * GRID_W + c.x;
    if (!setSeed(i, brushStrain)) return;
    lastGesture = { kind: 'sow', i, budget: 'sower' };
    recorder.record({ t: world.tick, k: 'sow', i, s: brushStrain });
    sowBudget--;
    hud.setBudget(sowBudget);
    sound.event('sow');
    if (sowBudget === 0) hud.toast('Горсть пуста. Пусти время (⏸) — и смотри, что взойдёт.');
  }
}

function sowAt(cssX: number, cssY: number, pointerType = 'mouse'): void {
  if (player || breathMode) return; // в чужом мире и в созерцании руки убраны

  // Фаза посева: палец только целится, сажает кнопка «Посадить».
  // На таче прицел живёт НАД пальцем — палец не закрывает точку.
  if (sowingPhase()) {
    const offset = pointerType === 'touch' ? 64 : 0;
    const t = renderer.cellAt(cssX, cssY - offset) ?? renderer.cellAt(cssX, cssY);
    if (t) aim = t;
    return;
  }

  const c = renderer.cellAt(cssX, cssY);
  if (!c) return;

  // §15.1 Кисть в Потоке стоит Дыхания — рука бога не бесплатна.
  if (sowBudget === null && !layoutPool) {
    if (!breath.spend('sow')) {
      hud.toast(`Не хватает Дыхания (нужно ${COST.sow}). Расти Φ — она кормит.`);
      return;
    }
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
        if (ev.p) setPiece(ev.i, ev.p);
        else setSeed(ev.i, ev.s);
        break;
      case 'carve':
        tabletEngine.carve(ev.c, ev.a, world);
        tabletUI.refresh();
        break;
    }
  }
}

/** «Рука дрогнула»: откатить последний посев или правку Ме. */
function undoGesture(): void {
  if (!lastGesture || player) return;
  if (lastGesture.kind === 'sow') {
    const { i, budget } = lastGesture;
    if (world.cells[i] === Cell.Seed || world.cells[i] === Cell.Spore || world.cells[i] === Cell.Signal) {
      world.cells[i] = Cell.Empty;
      world.age[i] = 0;
      worldDirty++;
      recorder.popLast('sow');
      if (budget === 'sower' && sowBudget !== null) {
        sowBudget++;
        hud.setBudget(sowBudget);
      } else if (budget && budget !== 'sower' && layoutPool) {
        layoutPool[budget]++;
        hud.setBudgetText(layoutBudgetText() || null);
      }
      hud.toast('Семя возвращено в горсть.');
    }
  } else {
    me = lastGesture.prev;
    breath.refund('me');
    recorder.popLast('me');
    forecaster.invalidate();
    refreshForecast(true);
    hud.toast('Закон возвращён, как был.');
  }
  lastGesture = null;
}

function togglePause(): boolean {
  paused = !paused;
  // Сеятель отпустил время — посев закончен навсегда: «дал жизнь и отпустил».
  if (!paused && sowBudget !== null && !sowingLocked) {
    sowingLocked = true;
    brush = false;
    aim = null;
    hud.applyBrush(false);
    hud.setBudget(null);
    hud.setBudgetText(null);
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
  if (brush && pointers.size === 1) sowAt(e.clientX, e.clientY, e.pointerType);
  else canvas.classList.add('dragging');
});

canvas.addEventListener('pointermove', (e) => {
  const prev = pointers.get(e.pointerId);
  if (!prev) return;

  if (pointers.size === 1) {
    if (brush) sowAt(e.clientX, e.clientY, e.pointerType);
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
    case 'Digit4':
      if (lenses.select(4)) hud.markLens(4);
      break;
    case 'Digit5':
      if (lenses.select(5)) hud.markLens(5);
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
    case 'KeyZ':
      undoGesture();
      break;
    case 'ArrowUp':
    case 'ArrowDown':
    case 'ArrowLeft':
    case 'ArrowRight': {
      if (!sowingPhase()) break;
      e.preventDefault();
      const cur = aim ?? { x: GRID_W >> 1, y: GRID_H >> 1 };
      const dx = e.code === 'ArrowLeft' ? -1 : e.code === 'ArrowRight' ? 1 : 0;
      const dy = e.code === 'ArrowUp' ? -1 : e.code === 'ArrowDown' ? 1 : 0;
      aim = {
        x: (cur.x + dx + GRID_W) % GRID_W,
        y: (cur.y + dy + GRID_H) % GRID_H,
      };
      break;
    }
    case 'Enter':
      if (sowingPhase() && aim) {
        e.preventDefault();
        plantAt(aim.x, aim.y);
      }
      break;
  }
});

// ---- Цикл ----

const mepanelEl = document.getElementById('mepanel') as HTMLElement;
let insetFrame = 0;

let lastTime = performance.now();
let accumulator = 0;
let lastStage = '';
let lastAmbient = 0;
/** Мир прошлого тика — для дыхания поля между шагами. */
let prevWorld: WorldState | null = null;
let lastRenderKey = '';

function frame(now: number): void {
  accumulator += now - lastTime;
  lastTime = now;
  if (accumulator > 1000) accumulator = 1000;

  let frac = 1;
  // Домотка очага: проживаем время отсутствия порциями, не вешая кадр.
  if (running && hearthCatchUp > 0) {
    const chunk = Math.min(150, hearthCatchUp);
    for (let k = 0; k < chunk && running; k++) {
      world = tick(world, me);
      measure();
      checkEnd();
    }
    hearthCatchUp -= chunk;
    hud.setBudgetText(hearthCatchUp > 0 ? `домотка ${fmtAbsence(hearthCatchUp)}` : null);
    if (hearthCatchUp === 0 && running) {
      hud.toast(`Мир дожил до ${world.tick} тика. Ты вернулся вовремя.`);
      persistHearth();
    }
    accumulator = 0;
  } else if (running && !paused) {
    let baseMs = hearthMode ? 1000 / HEARTH_TPS : TICK_MS;
    if (breathMode) {
      // Цикл 4-4-8: вдох — мир почти замирает, выдох — течёт.
      const phase = ((now - breathStartedAt) % 16000) / 16000;
      const breathFactor = phase < 0.25 ? 0.25 : phase < 0.5 ? 0.6 : 1.6;
      baseMs = TICK_MS / breathFactor;
      if (now - breathStartedAt > BREATH_SESSION_MS) {
        breathMode = false;
        const note = window.prompt('Сессия окончена. Что ты заметил? (одна строка в личную летопись)');
        if (note) {
          try {
            const key = 'monas.reflections';
            const arr = JSON.parse(localStorage.getItem(key) ?? '[]') as string[];
            arr.push(`${new Date().toISOString().slice(0, 10)}: ${note}`);
            localStorage.setItem(key, JSON.stringify(arr));
          } catch { /* ок */ }
        }
        finishRun();
      }
    }
    const stepMs = baseMs / (SPEEDS[speedIdx] as number);
    while (accumulator >= stepMs && running) {
      applyReplayEvents();
      prevWorld = world;
      world = tick(world, me);
      measure();
      checkEnd();
      accumulator -= stepMs;
    }
    refreshForecast();
    // Дыхание между тиками: доля пути от прошлого состояния к нынешнему.
    if (running) frac = Math.min(1, accumulator / stepMs);
    // Очаг автосохраняется раз в 20 секунд.
    if (hearthMode && now - lastHearthSave > 20000) persistHearth();
  } else {
    accumulator = 0;
    prevWorld = null;
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
      // §16.2 Голоса клеток: пересчитать слова последнего тика.
      let nAlarm = 0;
      let nCall = 0;
      let nHunger = 0;
      const sp = world.spike;
      for (let i = 0; i < sp.length; i++) {
        const w = sp[i];
        if (w === 1) nAlarm++;
        else if (w === 2) nCall++;
        else if (w === 3) nHunger++;
      }
      sound.voices(nAlarm, nCall, nHunger);
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

  if (++insetFrame % 15 === 0) {
    const top = mepanelEl.getBoundingClientRect().top;
    renderer.setBottomInset(Math.min(window.innerHeight * 0.6, Math.max(0, window.innerHeight - top)));
  }
  const aiming = sowingPhase() && aim ? aim : null;
  const renderKey = `${world.tick}|${lenses.current}|${renderer.version}|${worldDirty}|${scrubFrac}|${Math.round(frac * 50)}|${altGhost ? 1 : 0}|${aiming ? `${aiming.x},${aiming.y}` : ''}`;
  if (!paused || aiming || renderKey !== lastRenderKey) {
    renderer.render(
      world, lenses.current, clusters, prevWorld, frac, heat,
      aiming ? { x: aiming.x, y: aiming.y, rgb: aimRgb() } : null,
      running ? shadowAt(me, world.tick) : null,
      politics.established(),
    );
    lastRenderKey = renderKey;
  }
  plantWrap.classList.toggle('show', !!aiming);
  hud.update(world, report, lenses.unlocked3 ? horizonNow() : null, STAGE_NAMES[stage]);
  hud.setBreath(breath.current);
  requestAnimationFrame(frame);
}

// ---- Кнопка меню и кнопка посадки ----

const menuBtn = document.createElement('button');
menuBtn.id = 'menubtn';
menuBtn.className = 'iconbtn';
menuBtn.textContent = '☰';
menuBtn.title = 'В меню';
menuBtn.addEventListener('click', returnToMenu);
document.body.append(menuBtn);

const plantWrap = document.createElement('div');
plantWrap.id = 'plantwrap';
const nudge = (label: string, dx: number, dy: number) => {
  const b = document.createElement('button');
  b.className = 'nudgebtn';
  b.textContent = label;
  b.addEventListener('click', () => {
    const cur = aim ?? { x: GRID_W >> 1, y: GRID_H >> 1 };
    aim = { x: (cur.x + dx + GRID_W) % GRID_W, y: (cur.y + dy + GRID_H) % GRID_H };
  });
  return b;
};
const plantBtn = document.createElement('button');
plantBtn.id = 'plantbtn';
plantBtn.textContent = '⤓ Посадить';
plantBtn.addEventListener('click', () => {
  if (aim) plantAt(aim.x, aim.y);
});
const undoBtn = document.createElement('button');
undoBtn.className = 'nudgebtn';
undoBtn.textContent = '↶';
undoBtn.title = 'Вернуть последнее Семя (Z)';
undoBtn.addEventListener('click', undoGesture);
plantWrap.append(nudge('◀', -1, 0), nudge('▲', 0, -1), plantBtn, nudge('▼', 0, 1), nudge('▶', 1, 0), undoBtn);
document.body.append(plantWrap);

function returnToMenu(): void {
  if (running && hearthMode) {
    persistHearth();
    running = false;
    hearthMode = false;
    hud.toast('Очаг сохранён. Мир продолжит жить без тебя.');
    showStart();
    return;
  }
  if (running) {
    if (resumeEligible()) {
      // Обычную партию не теряем — сохраняем и выходим.
      persistResume();
      running = false;
      hud.toast('Партия сохранена — продолжишь из меню.');
    } else if (window.confirm('Покинуть мир и вернуться в меню? Партия завершится без летописи.')) {
      running = false;
      breathMode = false;
      (document.getElementById('mepanel') as HTMLElement).style.display = '';
    } else {
      return;
    }
  }
  showStart();
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    persistHearth();
    persistResume();
  }
});
window.addEventListener('pagehide', () => {
  persistHearth();
  persistResume();
});

showStart();
requestAnimationFrame(frame);
