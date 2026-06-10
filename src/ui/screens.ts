/**
 * ui/screens — экран старта (биом × архетип) и финал (концовка, счёт, летопись).
 */
import {
  ARCHETYPES, BIOMES, FIELD_SIZES, SOWER_BUDGET,
  type ArchetypeId, type BiomeId, type RunMode,
} from '../run/setup';
import { TRIALS } from '../run/trials';
import { LAYOUTS, STAKE_INFO, dailyLayout, type Stake } from '../run/layouts';
import { loadLayoutBest } from '../platform/storage';
import { loadTrialStars } from '../platform/storage';
import { THEMES, activeTheme, applyTheme } from './themes';
import type { Ending } from '../run/endings';

export interface StartChoice {
  biome: BiomeId;
  archetype: ArchetypeId;
  seedText: string;
  size: number;
  mode: RunMode;
  /** Выбранное испытание (путь «Испытание»). */
  trialId: string | null;
  /** Выбранный расклад и ставка (путь «Расклад»). */
  layoutId: string | null;
  stake: Stake;
}

export interface FinalData {
  ending: Ending;
  score: number;
  best: number;
  isRecord: boolean;
  chronicle: string;
  seedText: string;
  /** Итог испытания («★★ Сад из горсти»), если партия была паззлом. */
  trialResult?: string;
}

export interface FinalCallbacks {
  onRestart(): void;
  /** Скачать летопись картинкой. */
  onExportPng(): void;
  /** Вернуть код реплея для буфера (null — нет записи). */
  onCopyReplay(): string | null;
  /** Вернуть код дуэли (счёт + реплей-доказательство). */
  onCopyDuel(): string | null;
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
    onCodex?: () => void,
    weekly?: { label: string; best: number; onPlay: () => void },
    hearth?: { label: string; onPlay: () => void },
    breath?: { onPlay: () => void },
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
    let path: 'flow' | 'sower' | 'trial' | 'layout' = mode;
    let trialId = TRIALS[0]?.id ?? '';
    const daily = dailyLayout();
    let layoutId = daily.id;
    let stake: Stake = 'longevity';

    const worldGroups = document.createElement('div');
    const trialGroup = document.createElement('div');
    const layoutGroup = document.createElement('div');
    const syncPath = () => {
      worldGroups.style.display = path === 'trial' || path === 'layout' ? 'none' : '';
      trialGroup.style.display = path === 'trial' ? '' : 'none';
      layoutGroup.style.display = path === 'layout' ? '' : 'none';
    };

    panel.append(
      this.chipGroup(
        'Путь',
        [
          { id: 'flow', name: 'Поток', desc: 'мир рождается из первичного бульона' },
          { id: 'sower', name: 'Сеятель', desc: `пустой мир и ${SOWER_BUDGET} Семян в горсти` },
          { id: 'trial', name: 'Испытание', desc: 'паззлы Сеятеля с целью и звёздами' },
          { id: 'layout', name: 'Расклад', desc: 'фигуры и ставка: долгожитие или расцвет' },
        ],
        path,
        (id) => {
          path = id as typeof path;
          if (path === 'flow' || path === 'sower') mode = path;
          syncPath();
        },
      ),
    );

    worldGroups.append(
      this.chipGroup('Место мира', BIOMES, biome, (id) => (biome = id as BiomeId)),
      this.chipGroup('Первое Семя', ARCHETYPES, archetype, (id) => (archetype = id as ArchetypeId)),
      this.chipGroup(
        'Простор',
        FIELD_SIZES.map((f) => ({ id: String(f.side), name: f.name, desc: f.desc })),
        String(size),
        (id) => (size = Number(id)),
      ),
    );
    panel.append(worldGroups);

    const stars = loadTrialStars();
    trialGroup.append(
      this.chipGroup(
        'Испытания',
        TRIALS.map((t) => ({
          id: t.id,
          name: `${t.name} ${'★'.repeat(stars[t.id] ?? 0) || '☆'}`,
          desc: t.desc,
        })),
        trialId,
        (id) => (trialId = id),
      ),
    );
    panel.append(trialGroup);

    const layList = [daily, ...LAYOUTS];
    layoutGroup.append(
      this.chipGroup(
        'Расклады',
        layList.map((l) => {
          const bl = loadLayoutBest(l.id, 'longevity');
          const bb = loadLayoutBest(l.id, 'bloom');
          const best = bl || bb ? ` · ${bl}/${bb}` : '';
          return { id: l.id, name: l.name + best, desc: l.desc };
        }),
        layoutId,
        (id) => (layoutId = id),
      ),
      this.chipGroup(
        'Ставка',
        (Object.keys(STAKE_INFO) as Stake[]).map((k) => ({
          id: k,
          name: STAKE_INFO[k].name,
          desc: STAKE_INFO[k].desc,
        })),
        stake,
        (id) => (stake = id as Stake),
      ),
    );
    panel.append(layoutGroup);
    syncPath();

    // Стиль мира: применяется сразу — живой предпросмотр.
    panel.append(
      this.chipGroup(
        'Стиль',
        THEMES.map((t) => ({ id: t.id, name: t.name, desc: t.desc })),
        activeTheme.id,
        (id) => applyTheme(id),
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
      onStart({
        biome, archetype, seedText, size, mode,
        trialId: path === 'trial' ? trialId : null,
        layoutId: path === 'layout' ? layoutId : null,
        stake,
      });
    });
    panel.append(start);

    const extras = document.createElement('div');
    extras.className = 'sharerow';
    if (weekly) {
      const weekBtn = document.createElement('button');
      weekBtn.textContent =
        weekly.best > 0
          ? `🌍 ${weekly.label} · лучший ${weekly.best}`
          : `🌍 ${weekly.label}`;
      weekBtn.title = 'Мир недели: один seed на всех до понедельника';
      weekBtn.addEventListener('click', () => {
        this.hide();
        weekly.onPlay();
      });
      extras.append(weekBtn);
    }
    if (hearth) {
      const hearthBtn = document.createElement('button');
      hearthBtn.textContent = `🔥 ${hearth.label}`;
      hearthBtn.title = 'Очаг: мир живёт в реальном времени, даже когда вкладка закрыта';
      hearthBtn.addEventListener('click', () => {
        this.hide();
        hearth.onPlay();
      });
      extras.append(hearthBtn);
    }
    if (breath) {
      const breathBtn = document.createElement('button');
      breathBtn.textContent = '☯ Дыхание';
      breathBtn.title = '10 минут созерцания: мир дышит с тобой, руки убраны';
      breathBtn.addEventListener('click', () => {
        this.hide();
        breath.onPlay();
      });
      extras.append(breathBtn);
    }
    if (onCodex) {
      const codexBtn = document.createElement('button');
      codexBtn.textContent = '✦ Кодекс форм';
      codexBtn.addEventListener('click', onCodex);
      extras.append(codexBtn);
    }
    if (extras.childElementCount > 0) panel.append(extras);

    // Чужой мир: вставь код реплея — и история повторится у тебя.
    if (onReplay) {
      const repRow = document.createElement('div');
      repRow.className = 'seedrow';
      const repInput = document.createElement('input');
      repInput.type = 'text';
      repInput.placeholder = 'код реплея или вызова на дуэль';
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

    let trialEl: HTMLElement | null = null;
    if (data.trialResult) {
      trialEl = document.createElement('p');
      trialEl.className = 'best';
      trialEl.textContent = data.trialResult;
    }

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
    const duel = document.createElement('button');
    duel.textContent = '⚔ Вызов';
    duel.title = 'Скопировать вызов на дуэль: соперник сыграет тот же мир';
    duel.addEventListener('click', () => {
      const code = cb.onCopyDuel();
      if (!code) return;
      void navigator.clipboard?.writeText(code).then(
        () => (duel.textContent = '⚔ Скопирован!'),
        () => {
          window.prompt('Код вызова — скопируй вручную:', code);
        },
      );
    });
    const tg = document.createElement('button');
    tg.textContent = '✈ В Telegram';
    tg.title = 'Отправить вызов сообщением';
    tg.addEventListener('click', () => {
      const code = cb.onCopyDuel();
      if (!code) return;
      const text = encodeURIComponent(`Вызываю тебя в MONAS VIVENS! Открой игру и вставь код:\n${code}`);
      window.open(`https://t.me/share/url?url=${encodeURIComponent('https://nisferi.github.io/MONAS-VIVENS/')}&text=${text}`);
    });
    share.append(png, rep, duel, tg);

    panel.append(h);
    if (trialEl) panel.append(trialEl);
    panel.append(score, chron, seed, share, again);
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
