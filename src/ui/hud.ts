/**
 * ui/hud — статистика, кнопки управления видом/временем и панель Ме.
 * Панель Ме — выезжающий снизу лист; кнопки вида — колонка справа.
 * Тон текстов — docs/design/11-aesthetics.md.
 */
import { Cell, type WorldState } from '../core/grid';
import { ME_LIMITS, type Me } from '../core/rules';

export interface HudCallbacks {
  onMeChange(me: Me): void;
  onPauseToggle(): boolean; // возвращает новое состояние «на паузе»
  onReseed(): void;
  onZoomIn(): void;
  onZoomOut(): void;
  onViewReset(): void;
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

  constructor(initialMe: Me, private readonly cb: HudCallbacks) {
    this.me = { ...initialMe };
    this.buildStats(document.getElementById('stats') as HTMLElement);
    this.buildSideButtons(document.getElementById('sidebtns') as HTMLElement);
    this.buildMePanel(document.getElementById('mepanel') as HTMLElement);
  }

  private buildStats(root: HTMLElement): void {
    this.tickEl = document.createElement('span');
    this.seedsEl = document.createElement('span');
    root.append(this.tickEl, this.seedsEl);
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

    const pauseBtn = btn('⏸', 'Остановить время', () => {
      const paused = this.cb.onPauseToggle();
      pauseBtn.textContent = paused ? '▶' : '⏸';
      pauseBtn.title = paused ? 'Пустить время' : 'Остановить время';
    });
    btn('✦', 'Новые Семена', () => this.cb.onReseed());
    btn('＋', 'Приблизить', () => this.cb.onZoomIn());
    btn('－', 'Отдалить', () => this.cb.onZoomOut());
    btn('◻', 'Всё поле', () => this.cb.onViewReset());
  }

  private buildMePanel(panel: HTMLElement): void {
    const handle = document.createElement('button');
    handle.id = 'mehandle';
    handle.textContent = '— Начертай Ме —';
    handle.addEventListener('click', () => panel.classList.toggle('hidden'));
    panel.append(handle);

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

  update(state: WorldState): void {
    let seeds = 0;
    for (let i = 0; i < state.cells.length; i++) {
      if (state.cells[i] === Cell.Seed) seeds++;
    }
    this.tickEl.textContent = `Тик ${state.tick}`;
    this.seedsEl.textContent = `Семена ${seeds}`;
  }
}
