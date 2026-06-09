/**
 * ui/tabletUI — высекание Табличек Судеб: дропдауны ЕСЛИ→ТО, не текст.
 * Живёт в нижней панели; до пробуждения разума показывает подсказку.
 */
import { ACTION_OPTIONS, type ActionKind } from '../tablets/actions';
import { CONDITION_OPTIONS, type ConditionSpec } from '../tablets/conditions';
import { CARVE_COST } from '../tablets/cost';
import type { Tablet, TabletEngine } from '../tablets/engine';

export interface TabletUICallbacks {
  /** Возвращает текст ошибки или null при успехе. */
  onCarve(condition: ConditionSpec, action: ActionKind): string | null;
}

export class TabletUI {
  private readonly root: HTMLElement;
  private listEl!: HTMLElement;
  private lockedEl!: HTMLElement;
  private formEl!: HTMLElement;
  private condKind!: HTMLSelectElement;
  private condThreshold!: HTMLSelectElement;
  private actionSel!: HTMLSelectElement;
  private unlocked = false;

  constructor(parent: HTMLElement, private readonly engine: TabletEngine, private readonly cb: TabletUICallbacks) {
    this.root = document.createElement('div');
    this.root.id = 'tablets';
    parent.append(this.root);
    this.build();
    this.setUnlocked(false);
  }

  private build(): void {
    const title = document.createElement('div');
    title.className = 'tablettitle';
    title.textContent = '— Таблички Судеб —';
    this.root.append(title);

    this.lockedEl = document.createElement('div');
    this.lockedEl.className = 'tabletlocked';
    this.lockedEl.textContent = 'Глина судьбы молчит, пока не пробудится разум (линза Ⅲ).';
    this.root.append(this.lockedEl);

    this.formEl = document.createElement('div');
    this.formEl.className = 'tabletform';

    const row = document.createElement('div');
    row.className = 'tabletrow';

    const ifLabel = document.createElement('span');
    ifLabel.textContent = 'ЕСЛИ';

    this.condKind = document.createElement('select');
    for (const opt of CONDITION_OPTIONS) {
      const o = document.createElement('option');
      o.value = opt.kind;
      o.textContent = opt.label;
      this.condKind.append(o);
    }
    this.condThreshold = document.createElement('select');
    this.fillThresholds();
    this.condKind.addEventListener('change', () => this.fillThresholds());

    const thenLabel = document.createElement('span');
    thenLabel.textContent = 'ТО';

    this.actionSel = document.createElement('select');
    for (const opt of ACTION_OPTIONS) {
      const o = document.createElement('option');
      o.value = opt.kind;
      o.textContent = opt.label;
      this.actionSel.append(o);
    }

    row.append(ifLabel, this.condKind, this.condThreshold, thenLabel, this.actionSel);
    this.formEl.append(row);

    const carve = document.createElement('button');
    carve.className = 'carvebtn';
    carve.textContent = `Высеки Табличку (−${CARVE_COST} энергии)`;
    carve.addEventListener('click', () => {
      const condition: ConditionSpec = {
        kind: this.condKind.value as ConditionSpec['kind'],
        threshold: Number(this.condThreshold.value),
      };
      this.cb.onCarve(condition, this.actionSel.value as ActionKind);
      this.refresh();
    });
    this.formEl.append(carve);

    this.listEl = document.createElement('div');
    this.listEl.className = 'tabletlist';
    this.formEl.append(this.listEl);

    this.root.append(this.formEl);
  }

  private fillThresholds(): void {
    const opt = CONDITION_OPTIONS.find((o) => o.kind === this.condKind.value);
    this.condThreshold.innerHTML = '';
    if (!opt) return;
    for (const t of opt.thresholds) {
      const o = document.createElement('option');
      o.value = String(t);
      o.textContent = opt.fmt(t);
      this.condThreshold.append(o);
    }
  }

  setUnlocked(unlocked: boolean): void {
    this.unlocked = unlocked;
    this.lockedEl.style.display = unlocked ? 'none' : '';
    this.formEl.style.display = unlocked ? '' : 'none';
  }

  refresh(): void {
    if (!this.unlocked) return;
    this.listEl.innerHTML = '';
    for (const t of this.engine.tablets) {
      const row = document.createElement('div');
      row.className = 'tabletitem' + (t.fired ? ' fired' : '');
      row.textContent = `${t.fired ? '✦' : '◇'} ${this.engine.describe(t as Tablet)}`;
      this.listEl.append(row);
    }
  }
}
