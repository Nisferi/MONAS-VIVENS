/**
 * ui/screens — экран старта (биом × архетип) и финал (концовка, счёт, летопись).
 */
import {
  ARCHETYPES, BIOMES, FIELD_SIZES, SOWER_BUDGET,
  type ArchetypeId, type BiomeId, type RunMode,
} from '../run/setup';
import type { Ending } from '../run/endings';

export interface StartChoice {
  biome: BiomeId;
  archetype: ArchetypeId;
  seedText: string;
  size: number;
  mode: RunMode;
}

export interface FinalData {
  ending: Ending;
  score: number;
  best: number;
  isRecord: boolean;
  chronicle: string;
  seedText: string;
}

export interface FinalCallbacks {
  onRestart(): void;
  /** Скачать летопись картинкой. */
  onExportPng(): void;
  /** Вернуть код реплея для буфера (null — нет записи). */
  onCopyReplay(): string | null;
}

export class Screens {
  private readonly el: HTMLElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'screen';
    document.body.append(this.el);
  }

  showStart(
    defaults: { biome: BiomeId; archetype: ArchetypeId; size: number; mode: RunMode },
    best: number,
    onStart: (choice: StartChoice) => void,
    onReplay?: (code: string) => boolean,
  ): void {
    this.el.innerHTML = '';
    this.el.classList.add('show');

    const panel = document.createElement('div');
    panel.className = 'panel';

    const h = document.createElement('h1');
    h.textContent = 'MONAS VIVENS';
    const sub = document.createElement('p');
    sub.className = 'sub';
    sub.textContent = 'Ты — закон, а не рука. Проведи мир от слепой клетки до разума, видящего будущее.';
    panel.append(h, sub);

    if (best > 0) {
      const bestEl = document.createElement('p');
      bestEl.className = 'best';
      bestEl.textContent = `Лучший счёт: ${best}`;
      panel.append(bestEl);
    }

    let biome = defaults.biome;
    let archetype = defaults.archetype;
    let size = defaults.size;
    let mode = defaults.mode;

    panel.append(
      this.chipGroup(
        'Путь',
        [
          { id: 'flow', name: 'Поток', desc: 'мир рождается из первичного бульона' },
          { id: 'sower', name: 'Сеятель', desc: `пустой мир и ${SOWER_BUDGET} Семян в горсти` },
        ],
        mode,
        (id) => (mode = id as RunMode),
      ),
    );
    panel.append(this.chipGroup('Место мира', BIOMES, biome, (id) => (biome = id as BiomeId)));
    panel.append(
      this.chipGroup('Первое Семя', ARCHETYPES, archetype, (id) => (archetype = id as ArchetypeId)),
    );
    panel.append(
      this.chipGroup(
        'Простор',
        FIELD_SIZES.map((f) => ({ id: String(f.side), name: f.name, desc: f.desc })),
        String(size),
        (id) => (size = Number(id)),
      ),
    );

    const seedRow = document.createElement('div');
    seedRow.className = 'seedrow';
    const seedLabel = document.createElement('label');
    seedLabel.textContent = 'Имя мира (seed):';
    const seedInput = document.createElement('input');
    seedInput.type = 'text';
    seedInput.placeholder = 'пусто — случайное';
    seedRow.append(seedLabel, seedInput);
    panel.append(seedRow);

    const start = document.createElement('button');
    start.className = 'primary';
    start.textContent = 'Сотвори мир';
    start.addEventListener('click', () => {
      const seedText = seedInput.value.trim() || String(Date.now() % 1000000);
      this.hide();
      onStart({ biome, archetype, seedText, size, mode });
    });
    panel.append(start);

    // Чужой мир: вставь код реплея — и история повторится у тебя.
    if (onReplay) {
      const repRow = document.createElement('div');
      repRow.className = 'seedrow';
      const repInput = document.createElement('input');
      repInput.type = 'text';
      repInput.placeholder = 'код реплея (MONAS1:…)';
      const repBtn = document.createElement('button');
      repBtn.textContent = '▶ Чужой мир';
      repBtn.addEventListener('click', () => {
        if (onReplay(repInput.value)) this.hide();
        else repInput.value = 'код не прочитан';
      });
      repRow.append(repInput, repBtn);
      panel.append(repRow);
    }

    this.el.append(panel);
  }

  showFinal(data: FinalData, cb: FinalCallbacks): void {
    this.el.innerHTML = '';
    this.el.classList.add('show');

    const panel = document.createElement('div');
    panel.className = 'panel';

    const h = document.createElement('h1');
    h.textContent = data.ending.title;

    const score = document.createElement('p');
    score.className = 'score';
    score.textContent = data.isRecord
      ? `Счёт: ${data.score} — новый рекорд!`
      : `Счёт: ${data.score} (лучший: ${data.best})`;

    const chron = document.createElement('pre');
    chron.className = 'chronicle';
    chron.textContent = data.chronicle;

    const seed = document.createElement('p');
    seed.className = 'sub';
    seed.textContent = `Семя этого мира: «${data.seedText}» — назови его снова, и судьба повторится.`;

    const again = document.createElement('button');
    again.className = 'primary';
    again.textContent = 'Новый мир';
    again.addEventListener('click', () => {
      this.hide();
      cb.onRestart();
    });

    const share = document.createElement('div');
    share.className = 'sharerow';
    const png = document.createElement('button');
    png.textContent = '🜍 Летопись (PNG)';
    png.addEventListener('click', () => cb.onExportPng());
    const rep = document.createElement('button');
    rep.textContent = '⧉ Реплей';
    rep.addEventListener('click', () => {
      const code = cb.onCopyReplay();
      if (!code) return;
      void navigator.clipboard?.writeText(code).then(
        () => (rep.textContent = '⧉ Скопирован!'),
        () => {
          window.prompt('Код реплея — скопируй вручную:', code);
        },
      );
    });
    share.append(png, rep);

    panel.append(h, score, chron, seed, share, again);
    this.el.append(panel);
  }

  hide(): void {
    this.el.classList.remove('show');
    this.el.innerHTML = '';
  }

  private chipGroup(
    title: string,
    items: { id: string; name: string; desc: string }[],
    selected: string,
    onPick: (id: string) => void,
  ): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'chipgroup';
    const t = document.createElement('div');
    t.className = 'chiptitle';
    t.textContent = title;
    wrap.append(t);

    const row = document.createElement('div');
    row.className = 'chips';
    const buttons: HTMLButtonElement[] = [];
    for (const item of items) {
      const b = document.createElement('button');
      b.className = 'chip';
      b.innerHTML = `<b>${item.name}</b><small>${item.desc}</small>`;
      if (item.id === selected) b.classList.add('active');
      b.addEventListener('click', () => {
        for (const other of buttons) other.classList.remove('active');
        b.classList.add('active');
        onPick(item.id);
      });
      buttons.push(b);
      row.append(b);
    }
    wrap.append(row);
    return wrap;
  }
}
