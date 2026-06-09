/**
 * ui/hud — панель Ме (ползунки законов), управление и счётчики.
 * Тон текстов — docs/design/11-aesthetics.md: «Начертай Ме», не «настройки».
 */
import { Cell, type WorldState } from '../core/grid';
import { ME_LIMITS, type Me } from '../core/rules';

export interface HudCallbacks {
  onMeChange(me: Me): void;
  onPauseToggle(): boolean; // возвращает новое состояние «на паузе»
  onReseed(): void;
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

  constructor(root: HTMLElement, initialMe: Me, private readonly cb: HudCallbacks) {
    this.me = { ...initialMe };
    this.build(root);
  }

  private build(root: HTMLElement): void {
    const stats = document.createElement('div');
    stats.id = 'stats';
    this.tickEl = document.createElement('span');
    this.seedsEl = document.createElement('span');
    stats.append(this.tickEl, this.seedsEl);
    root.append(stats);

    const meTitle = document.createElement('div');
    meTitle.textContent = '— Начертай Ме —';
    meTitle.style.textAlign = 'center';
    root.append(meTitle);

    for (const spec of SLIDERS) {
      root.append(this.buildSlider(spec));
    }

    const controls = document.createElement('div');
    controls.id = 'controls';

    const pauseBtn = document.createElement('button');
    pauseBtn.textContent = 'Остановить время';
    pauseBtn.addEventListener('click', () => {
      const paused = this.cb.onPauseToggle();
      pauseBtn.textContent = paused ? 'Пустить время' : 'Остановить время';
    });

    const reseedBtn = document.createElement('button');
    reseedBtn.textContent = 'Новые Семена';
    reseedBtn.addEventListener('click', () => this.cb.onReseed());

    controls.append(pauseBtn, reseedBtn);
    root.append(controls);
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
    this.tickEl.textContent = `Тик: ${state.tick}`;
    this.seedsEl.textContent = `Семена: ${seeds}`;
  }
}
