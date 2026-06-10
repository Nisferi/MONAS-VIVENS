/**
 * ui/codex — Кодекс форм: энциклопедия открытых существ с зарисовками.
 * Знание — коллекция; неоткрытое значится как «???».
 */
import { PATTERNS } from '../phi/patterns';
import { loadCodex } from '../platform/storage';

export class CodexScreen {
  private readonly el: HTMLElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'codex';
    document.body.append(this.el);
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.hide();
    });
  }

  show(): void {
    this.el.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'codexpanel';

    const h = document.createElement('h2');
    h.textContent = 'Кодекс форм';
    panel.append(h);

    const known = loadCodex();
    const grid = document.createElement('div');
    grid.className = 'codexgrid';
    for (const p of PATTERNS) {
      const card = document.createElement('div');
      card.className = 'codexcard';
      const cv = document.createElement('canvas');
      cv.width = 72;
      cv.height = 72;
      this.draw(cv, p.cells, !!known[p.id]);
      const name = document.createElement('b');
      const lore = document.createElement('small');
      if (known[p.id]) {
        name.textContent = p.name;
        lore.textContent = p.lore;
      } else {
        name.textContent = '???';
        lore.textContent = 'Эта форма ещё не встречалась твоим мирам.';
        card.classList.add('unknown');
      }
      card.append(cv, name, lore);
      grid.append(card);
    }
    panel.append(grid);

    const close = document.createElement('button');
    close.className = 'primary';
    close.textContent = 'Закрыть';
    close.addEventListener('click', () => this.hide());
    panel.append(close);

    this.el.append(panel);
    this.el.classList.add('show');
  }

  hide(): void {
    this.el.classList.remove('show');
  }

  private draw(cv: HTMLCanvasElement, cells: [number, number][], known: boolean): void {
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#120d08';
    ctx.fillRect(0, 0, cv.width, cv.height);
    let maxX = 0;
    let maxY = 0;
    for (const [x, y] of cells) {
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    const s = Math.floor(Math.min(cv.width / (maxX + 3), cv.height / (maxY + 3)));
    const ox = (cv.width - s * (maxX + 1)) / 2;
    const oy = (cv.height - s * (maxY + 1)) / 2;
    ctx.fillStyle = known ? '#ffd966' : '#3a2e1d';
    for (const [x, y] of cells) {
      ctx.fillRect(ox + x * s, oy + y * s, s - 1, s - 1);
    }
  }
}
