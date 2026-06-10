/**
 * ui/hud — статистика (включая Φ), кнопки линз/вида/времени и панель Ме.
 * Читает всё, не считает ничего. Тон текстов — docs/design/11-aesthetics.md.
 */
import { Cell, STRAIN_NAMES, type WorldState } from '../core/grid';
import { ME_LIMITS, type Me } from '../core/rules';
import type { LensId } from '../lens/switcher';
import type { PhiReport } from '../phi/phi';
import { activeTheme } from './themes';

export interface HudCallbacks {
  onMeChange(me: Me): void;
  onPauseToggle(): boolean; // возвращает новое состояние «на паузе»
  onReseed(): void;
  onZoomIn(): void;
  onZoomOut(): void;
  onViewReset(): void;
  /** Возвращает успех (линза может быть ещё закрыта). */
  onLensSelect(lens: LensId): boolean;
  /** Переключает кисть посева; возвращает новое состояние «кисть включена». */
  onBrushToggle(): boolean;
  /** Цикл рода кисти; возвращает новый род (0..STRAINS-1). */
  onStrainCycle(): number;
  /** Цикл скорости; возвращает новый множитель (0.5, 1, 2, 4). */
  onSpeedCycle(): number;
  /** Переключает звук; возвращает новое состояние «выключен». */
  onMuteToggle(): boolean;
  /** Скраббер времени: доля пути к горизонту (0..1). */
  onScrub(frac: number): void;
}

/** Ползункам доступны только числовые законы (массив угроз — не для рук). */
type NumericMeKey = { [K in keyof Me]: Me[K] extends number ? K : never }[keyof Me];

interface SliderSpec {
  key: NumericMeKey;
  label: string;
  min: number;
  max: number;
}

const SLIDERS: SliderSpec[] = [
  { key: 'birthMin', label: 'Рождение от', ...ME_LIMITS.neighbors },
  { key: 'birthMax', label: 'Рождение до', ...ME_LIMITS.neighbors },
  { key: 'surviveMin', label: 'Выживание от', ...ME_LIMITS.neighbors },
  { key: 'surviveMax', label: 'Выживание до', ...ME_LIMITS.neighbors },
  { key: 'ashLifetime', label: 'Жизнь Праха', ...ME_LIMITS.ashLifetime },
  { key: 'will', label: 'Воля форм', ...ME_LIMITS.will },
];

export class Hud {
  private readonly me: Me;
  private tickEl!: HTMLElement;
  private seedsEl!: HTMLElement;
  private phiEl!: HTMLElement;
  private energyEl!: HTMLElement;
  private stageEl!: HTMLElement;
  private horizonEl!: HTMLElement;
  private pauseBtn!: HTMLButtonElement;
  private brushBtn!: HTMLButtonElement;
  private strainBtn!: HTMLButtonElement;
  private budgetEl!: HTMLElement;
  private quoteEl!: HTMLElement;
  private quoteText = '';
  private scrubEl!: HTMLElement;
  private scrubLabel!: HTMLElement;
  private breakdownEl!: HTMLElement;
  private lensBtns = new Map<LensId, HTMLButtonElement>();
  private toastEl!: HTMLElement;
  private toastTimer = 0;
  /** Куда TabletUI вешает свой интерфейс (вкладка «Таблички»). */
  tabletsPane!: HTMLElement;
  private journalPane!: HTMLElement;
  private sparkCanvas!: HTMLCanvasElement;
  private phiHistory: number[] = [];
  private lastTick = 0;
  private lastStatsBottom = 0;

  private statsEl!: HTMLElement;

  constructor(initialMe: Me, private readonly cb: HudCallbacks) {
    this.me = { ...initialMe };
    this.statsEl = document.getElementById('stats') as HTMLElement;
    this.buildStats(this.statsEl);
    this.buildSideButtons(document.getElementById('sidebtns') as HTMLElement);
    this.buildMePanel(document.getElementById('mepanel') as HTMLElement);
    this.buildToast();
  }

  private buildStats(root: HTMLElement): void {
    this.phiEl = document.createElement('span');
    this.phiEl.id = 'phistat';
    this.energyEl = document.createElement('span');
    this.energyEl.id = 'energystat';
    this.stageEl = document.createElement('span');
    this.stageEl.id = 'stagestat';
    this.tickEl = document.createElement('span');
    this.seedsEl = document.createElement('span');
    this.horizonEl = document.createElement('span');
    this.horizonEl.id = 'horizonstat';
    this.budgetEl = document.createElement('span');
    this.budgetEl.id = 'budgetstat';
    this.sparkCanvas = document.createElement('canvas');
    this.sparkCanvas.id = 'phispark';
    this.sparkCanvas.width = 90;
    this.sparkCanvas.height = 22;
    root.append(
      this.phiEl, this.sparkCanvas, this.energyEl, this.stageEl, this.seedsEl,
      this.tickEl, this.horizonEl, this.budgetEl,
    );
  }

  /** Спарклайн Φ: дыхание сознания за последние ~100 отметок. */
  private drawSpark(): void {
    const ctx = this.sparkCanvas.getContext('2d');
    if (!ctx) return;
    const { width: w, height: h } = this.sparkCanvas;
    ctx.clearRect(0, 0, w, h);
    const hist = this.phiHistory;
    if (hist.length < 2) return;
    let max = 10;
    for (const v of hist) if (v > max) max = v;
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--gold') || '#ffd966';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < hist.length; i++) {
      const x = (i / (hist.length - 1)) * (w - 2) + 1;
      const y = h - 2 - ((hist[i] as number) / max) * (h - 4);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  resetRunUi(): void {
    this.phiHistory = [];
    this.clearJournal();
  }

  private buildSideButtons(root: HTMLElement): void {
    const makeBtn = (parent: HTMLElement, label: string, title: string, onClick: () => void) => {
      const b = document.createElement('button');
      b.className = 'iconbtn';
      b.textContent = label;
      b.title = title;
      b.addEventListener('click', onClick);
      parent.append(b);
      return b;
    };

    // Линзы — отдельной колонкой слева: взгляд отдельно от рук.
    const lensRoot = (document.getElementById('lensbtns') ?? root) as HTMLElement;
    const lens = (id: LensId, label: string, title: string) => {
      const b = makeBtn(lensRoot, label, title, () => {
        if (this.cb.onLensSelect(id)) this.markLens(id);
        else this.toast('Эта линза ещё закрыта. Дай форме устояться.');
      });
      this.lensBtns.set(id, b);
    };
    lens(1, 'Ⅰ', 'Линза Семян (клавиша 1)');
    lens(2, 'Ⅱ', 'Линза Филии (клавиша 2)');
    lens(3, 'Ⅲ', 'Линза Разума (клавиша 3)');
    lens(4, 'Ⅳ', 'Линза Хроники: память места (клавиша 4)');
    lens(5, 'Ⅴ', 'Линза Мицелия: химия жизни (клавиша 5)');
    this.markLens(1);
    this.setLensUnlocked(2, false);
    this.setLensUnlocked(3, false);
    this.setLensUnlocked(4, false);
    this.setLensUnlocked(5, false);

    const btn = (label: string, title: string, onClick: () => void) =>
      makeBtn(root, label, title, onClick);

    this.pauseBtn = btn('⏸', 'Остановить время (пробел)', () => this.applyPause(this.cb.onPauseToggle()));
    this.pauseBtn.classList.add('mainbtn');
    const fmtSpeed = (s: number) => (s === 0.5 ? '×½' : `×${s}`);
    const speedBtn = btn('×1', 'Скорость времени: ½, 1, 2, 4', () => {
      speedBtn.textContent = fmtSpeed(this.cb.onSpeedCycle());
    });
    this.brushBtn = btn('✋', 'Кисть: сеять Семена пальцем/мышью (B)', () =>
      this.applyBrush(this.cb.onBrushToggle()),
    );
    this.strainBtn = btn('●', 'Род кисти: какого цвета сеять', () =>
      this.applyStrain(this.cb.onStrainCycle()),
    );
    this.applyStrain(0);
    this.strainBtn.style.display = 'none'; // род виден только при кисти
    btn('◻', 'Всё поле (0); зум — колесо или пинч', () => this.cb.onViewReset());

    // Редкие действия — за «⋯», чтобы колонка дышала.
    const moreWrap = document.createElement('div');
    moreWrap.id = 'morebtns';
    const moreBtn = btn('⋯', 'Ещё: звук, новый мир', () =>
      moreWrap.classList.toggle('show'),
    );
    void moreBtn;
    root.append(moreWrap);
    const muteBtn = makeBtn(moreWrap, '♪', 'Звук вкл/выкл (M)', () => {
      muteBtn.textContent = this.cb.onMuteToggle() ? '∅' : '♪';
    });
    makeBtn(moreWrap, '✦', 'Завершить мир и начать новый', () => this.cb.onReseed());
  }

  applyPause(paused: boolean): void {
    this.pauseBtn.textContent = paused ? '▶' : '⏸';
    this.pauseBtn.title = paused ? 'Пустить время (пробел)' : 'Остановить время (пробел)';
  }

  applyStrain(strain: number): void {
    if (strain < 0) return; // «Расклад» красит кнопку сам
    const ramp = activeTheme.field.strains[strain] ?? activeTheme.field.strains[0];
    if (!ramp) return;
    const [r, g, b] = ramp.old;
    this.strainBtn.style.color = `rgb(${r}, ${g}, ${b})`;
    this.strainBtn.style.borderColor = `rgb(${r}, ${g}, ${b})`;
    this.strainBtn.title = `Кисть сеет: ${STRAIN_NAMES[strain] ?? ''}`;
  }

  /** Горсть Сеятеля: сколько Семян осталось расставить (null — скрыть). */
  setBudget(left: number | null): void {
    this.budgetEl.textContent = left === null ? '' : `Горсть ✦${left}`;
  }

  /** Произвольный текст горсти (режим «Расклад»). */
  setBudgetText(text: string | null): void {
    this.budgetEl.textContent = text ?? '';
  }

  /** Кнопка фигуры в «Раскладе»: глиф и цвет произвольные. */
  setPieceButton(glyph: string, rgb: [number, number, number], title: string): void {
    this.strainBtn.textContent = glyph;
    const [r, g, b] = rgb;
    this.strainBtn.style.color = `rgb(${r}, ${g}, ${b})`;
    this.strainBtn.style.borderColor = `rgb(${r}, ${g}, ${b})`;
    this.strainBtn.title = title;
  }

  /** Голос древних в верхней строке. */
  setQuote(text: string, source: string): void {
    const full = `${text} — ${source}`;
    if (full === this.quoteText) return;
    this.quoteText = full;
    this.quoteEl.classList.remove('show');
    window.setTimeout(() => {
      this.quoteEl.innerHTML = '';
      const t = document.createElement('span');
      t.textContent = text;
      const s = document.createElement('cite');
      s.textContent = source;
      this.quoteEl.append(t, s);
      this.quoteEl.classList.add('show');
    }, 400);
  }

  applyBrush(brush: boolean): void {
    this.brushBtn.textContent = brush ? '✎' : '✋';
    this.brushBtn.classList.toggle('active', brush);
    this.strainBtn.style.display = brush ? '' : 'none';
    this.brushBtn.title = brush
      ? 'Кисть включена: тяни по полю, чтобы сеять (B — выкл)'
      : 'Кисть: сеять Семена пальцем/мышью (B)';
  }

  markLens(active: LensId): void {
    for (const [id, b] of this.lensBtns) b.classList.toggle('active', id === active);
  }

  setLensUnlocked(id: LensId, unlocked: boolean): void {
    const b = this.lensBtns.get(id);
    if (b) b.classList.toggle('locked', !unlocked);
  }

  private buildMePanel(panel: HTMLElement): void {
    panel.classList.add('hidden'); // по умолчанию поле чистое
    const handle = document.createElement('button');
    handle.id = 'mehandle';
    const syncHandle = () => {
      handle.textContent = panel.classList.contains('hidden') ? '▲ Скрижаль ▲' : '▼ Скрыть ▼';
    };
    handle.addEventListener('click', () => {
      panel.classList.toggle('hidden');
      syncHandle();
    });
    syncHandle();
    panel.append(handle);

    // Вкладки нижней панели: законы, судьба, память.
    const tabs = document.createElement('div');
    tabs.id = 'paneltabs';
    panel.append(tabs);

    const mePane = document.createElement('div');
    this.tabletsPane = document.createElement('div');
    this.journalPane = document.createElement('div');
    this.journalPane.id = 'journal';
    panel.append(mePane, this.tabletsPane, this.journalPane);

    const panes: [string, HTMLElement][] = [
      ['Ме', mePane],
      ['Таблички', this.tabletsPane],
      ['Журнал', this.journalPane],
    ];
    const tabBtns: HTMLButtonElement[] = [];
    for (const [name, pane] of panes) {
      const b = document.createElement('button');
      b.className = 'paneltab';
      b.textContent = name;
      b.addEventListener('click', () => {
        for (const tb of tabBtns) tb.classList.remove('active');
        b.classList.add('active');
        for (const [, p] of panes) p.style.display = 'none';
        pane.style.display = '';
      });
      tabBtns.push(b);
      tabs.append(b);
    }
    (tabBtns[0] as HTMLButtonElement).classList.add('active');
    this.tabletsPane.style.display = 'none';
    this.journalPane.style.display = 'none';

    this.breakdownEl = document.createElement('div');
    this.breakdownEl.id = 'phibreak';
    mePane.append(this.breakdownEl);

    for (const spec of SLIDERS) {
      mePane.append(this.buildSlider(spec));
    }
  }

  /** Журнал: память обо всех событиях партии. */
  log(text: string): void {
    const row = document.createElement('div');
    row.className = 'journalrow';
    row.textContent = `${this.lastTick} · ${text}`;
    this.journalPane.prepend(row);
    while (this.journalPane.childElementCount > 60) {
      this.journalPane.lastElementChild?.remove();
    }
  }

  clearJournal(): void {
    this.journalPane.innerHTML = '';
  }

  private buildSlider(spec: SliderSpec): HTMLElement {
    const row = document.createElement('div');
    row.className = 'me-row';

    const label = document.createElement('label');
    label.textContent = spec.label;

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(spec.min);
    input.max = String(spec.max);
    input.step = '1';
    input.value = String(this.me[spec.key]);

    const out = document.createElement('output');
    out.textContent = input.value;

    input.addEventListener('input', () => {
      this.me[spec.key] = Number(input.value);
      out.textContent = input.value;
      this.cb.onMeChange({ ...this.me });
    });

    row.append(label, input, out);
    return row;
  }

  private buildToast(): void {
    this.toastEl = document.createElement('div');
    this.toastEl.id = 'toast';
    document.body.append(this.toastEl);
    this.quoteEl = document.createElement('div');
    this.quoteEl.id = 'quote';
    document.body.append(this.quoteEl);

    // Скраббер времени: путь взгляда по прогнозу (виден только в линзе Ⅲ).
    this.scrubEl = document.createElement('div');
    this.scrubEl.id = 'scrub';
    const label = document.createElement('span');
    label.textContent = 'взор';
    const range = document.createElement('input');
    range.type = 'range';
    range.min = '0';
    range.max = '100';
    range.value = '100';
    range.addEventListener('input', () => this.cb.onScrub(Number(range.value) / 100));
    this.scrubLabel = document.createElement('output');
    this.scrubLabel.textContent = '';
    this.scrubEl.append(label, range, this.scrubLabel);
    document.body.append(this.scrubEl);
  }

  /** Показ скраббера и подпись «+T тиков». */
  setScrub(visible: boolean, atTicks: number | null): void {
    this.scrubEl.classList.toggle('show', visible);
    if (atTicks !== null) this.scrubLabel.textContent = `+${atTicks}`;
  }

  toast(text: string): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), 3500);
    this.log(text);
  }

  update(state: WorldState, report: PhiReport, horizon: number | null, stage: string): void {
    let seeds = 0;
    for (let i = 0; i < state.cells.length; i++) {
      if (state.cells[i] === Cell.Seed) seeds++;
    }
    if (state.tick !== this.lastTick) {
      this.lastTick = state.tick;
      if (state.tick % 8 === 0) {
        this.phiHistory.push(report.phi);
        if (this.phiHistory.length > 100) this.phiHistory.shift();
        this.drawSpark();
      }
    }
    // Оверлеи (цитата, тост) держим ниже капсулы статов — без наложений.
    const statsBottom = Math.round(this.statsEl.getBoundingClientRect().bottom);
    if (statsBottom !== this.lastStatsBottom) {
      this.lastStatsBottom = statsBottom;
      this.quoteEl.style.top = `${statsBottom + 8}px`;
      this.toastEl.style.top = `${statsBottom + 8}px`;
    }
    this.phiEl.textContent = `Φ ${report.phi.toFixed(1)}`;
    this.energyEl.textContent = `⚡ ${Math.round(state.energy)}`;
    this.energyEl.classList.toggle('low', state.energy < 25);
    this.stageEl.textContent = stage;
    this.tickEl.textContent = `Тик ${state.tick}`;
    this.seedsEl.textContent = `Семена ${seeds}`;
    this.horizonEl.textContent = horizon === null ? '' : `Взор +${horizon}`;

    const f = (v: number) => v.toFixed(2);
    this.breakdownEl.textContent =
      `Семена ${f(report.seeds)} × Филия ${f(report.philia)} × Мнемозина ${f(report.mnemosyne)}` +
      `  −  Хаос ${f(report.chaos)}  −  Нейкос ${f(report.neikos)}`;
  }
}
