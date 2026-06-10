/**
 * ui/hud — статистика (включая Φ), кнопки линз/вида/времени и панель Ме.
 * Читает всё, не считает ничего. Тон текстов — docs/design/11-aesthetics.md.
 */
import { Cell, STRAIN_NAMES, type WorldState } from '../core/grid';
import { ME_LIMITS, type Me } from '../core/rules';
import type { LensId } from '../lens/switcher';
import type { PhiReport } from '../phi/phi';
import { STRAIN_COLORS } from './canvas';

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
  /** Цикл скорости; возвращает новый множитель (1, 2, 4). */
  onSpeedCycle(): number;
}

interface SliderSpec {
  key: keyof Me;
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
  private breakdownEl!: HTMLElement;
  private lensBtns = new Map<LensId, HTMLButtonElement>();
  private toastEl!: HTMLElement;
  private toastTimer = 0;

  constructor(initialMe: Me, private readonly cb: HudCallbacks) {
    this.me = { ...initialMe };
    this.buildStats(document.getElementById('stats') as HTMLElement);
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
    root.append(
      this.phiEl, this.energyEl, this.stageEl, this.seedsEl,
      this.tickEl, this.horizonEl, this.budgetEl,
    );
  }

  private buildSideButtons(root: HTMLElement): void {
    const btn = (label: string, title: string, onClick: () => void) => {
      const b = document.createElement('button');
      b.className = 'iconbtn';
      b.textContent = label;
      b.title = title;
      b.addEventListener('click', onClick);
      root.append(b);
      return b;
    };

    // Линзы.
    const lens = (id: LensId, label: string, title: string) => {
      const b = btn(label, title, () => {
        if (this.cb.onLensSelect(id)) this.markLens(id);
        else this.toast('Эта линза ещё закрыта. Дай форме устояться.');
      });
      this.lensBtns.set(id, b);
    };
    lens(1, 'Ⅰ', 'Линза Семян (клавиша 1)');
    lens(2, 'Ⅱ', 'Линза Филии (клавиша 2)');
    lens(3, 'Ⅲ', 'Линза Разума (клавиша 3)');
    this.markLens(1);
    this.setLensUnlocked(2, false);
    this.setLensUnlocked(3, false);

    this.pauseBtn = btn('⏸', 'Остановить время (пробел)', () => this.applyPause(this.cb.onPauseToggle()));
    const speedBtn = btn('×1', 'Скорость времени (S)', () => {
      speedBtn.textContent = `×${this.cb.onSpeedCycle()}`;
    });
    this.brushBtn = btn('✋', 'Кисть: сеять Семена пальцем/мышью (B)', () =>
      this.applyBrush(this.cb.onBrushToggle()),
    );
    this.strainBtn = btn('●', 'Род кисти: какого цвета сеять', () =>
      this.applyStrain(this.cb.onStrainCycle()),
    );
    this.applyStrain(0);
    btn('✦', 'Новые Семена', () => this.cb.onReseed());
    btn('＋', 'Приблизить', () => this.cb.onZoomIn());
    btn('－', 'Отдалить', () => this.cb.onZoomOut());
    btn('◻', 'Всё поле (0)', () => this.cb.onViewReset());
  }

  applyPause(paused: boolean): void {
    this.pauseBtn.textContent = paused ? '▶' : '⏸';
    this.pauseBtn.title = paused ? 'Пустить время (пробел)' : 'Остановить время (пробел)';
  }

  applyStrain(strain: number): void {
    const ramp = STRAIN_COLORS[strain] ?? STRAIN_COLORS[0];
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
    const handle = document.createElement('button');
    handle.id = 'mehandle';
    handle.textContent = '— Начертай Ме —';
    handle.addEventListener('click', () => panel.classList.toggle('hidden'));
    panel.append(handle);

    this.breakdownEl = document.createElement('div');
    this.breakdownEl.id = 'phibreak';
    panel.append(this.breakdownEl);

    for (const spec of SLIDERS) {
      panel.append(this.buildSlider(spec));
    }
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
  }

  toast(text: string): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), 3500);
  }

  update(state: WorldState, report: PhiReport, horizon: number | null, stage: string): void {
    let seeds = 0;
    for (let i = 0; i < state.cells.length; i++) {
      if (state.cells[i] === Cell.Seed) seeds++;
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
