/**
 * ui/goals — обучение первой партии: четыре цели вместо туториала.
 * Показываются, пока игрок не прошёл путь один раз; галочки — сами.
 */
const TUTORED_KEY = 'monas.tutored';

export interface GoalState {
  firstForm: boolean;
  lens2Used: boolean;
  mindAwake: boolean;
  tabletBeforeStorm: boolean;
}

const LABELS: [keyof GoalState, string][] = [
  ['firstForm', 'Дождись первой устойчивой формы'],
  ['lens2Used', 'Открой линзу Филии (Ⅱ)'],
  ['mindAwake', 'Подними Φ — разбуди разум'],
  ['tabletBeforeStorm', 'Высеки Табличку до шторма'],
];

export class GoalsPanel {
  private readonly el: HTMLElement;
  private rows = new Map<keyof GoalState, HTMLElement>();
  private done: GoalState = {
    firstForm: false, lens2Used: false, mindAwake: false, tabletBeforeStorm: false,
  };
  private finished = false;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'goals';
    for (const [key, label] of LABELS) {
      const row = document.createElement('div');
      row.className = 'goalrow';
      row.textContent = `◇ ${label}`;
      this.rows.set(key, row);
      this.el.append(row);
    }
    document.body.append(this.el);
  }

  /** Нужен ли гид этому игроку. */
  static needed(): boolean {
    try {
      return !localStorage.getItem(TUTORED_KEY);
    } catch {
      return false;
    }
  }

  show(): void {
    if (this.finished) return;
    this.el.classList.add('show');
  }

  hide(): void {
    this.el.classList.remove('show');
  }

  /** Обновить галочки; вернёт текст события при полном прохождении. */
  update(state: GoalState): string | null {
    if (this.finished) return null;
    let all = true;
    for (const [key] of LABELS) {
      const was = this.done[key];
      const now = state[key] || was; // цель не «разгорается» обратно
      this.done[key] = now;
      if (now && !was) {
        const row = this.rows.get(key);
        if (row) {
          row.textContent = `✓ ${row.textContent?.slice(2) ?? ''}`;
          row.classList.add('done');
        }
      }
      if (!now) all = false;
    }
    if (all) {
      this.finished = true;
      try {
        localStorage.setItem(TUTORED_KEY, '1');
      } catch { /* ок */ }
      window.setTimeout(() => this.hide(), 4000);
      return 'Путь пройден. Дальше мир — только твой.';
    }
    return null;
  }
}
