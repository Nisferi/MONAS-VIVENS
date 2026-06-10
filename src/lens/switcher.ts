/**
 * lens/switcher — переключение линз и условия их открытия.
 * Линза 2 открывается, когда первая форма прожила ≥ STABLE_AGE тиков;
 * линза 3 — когда Φ достигла порога разума (docs/design/04-lenses.md).
 */
import { MIN_FORM_SIZE, type Cluster } from '../phi/clusters';
import { STABLE_AGE } from '../phi/mnemosyne';

export type LensId = 1 | 2 | 3 | 4 | 5;

/** Порог Φ, за которым просыпается разум (архетип Эхо снижает его). */
export const MIND_PHI = 25;
/** Порог Φ Яруса Химии: жизнь обрастает грибницей (линза Мицелия). */
export const CHEM_PHI = 15;
/** Возраст мира, с которого у него есть история (линза Хроники). */
export const HISTORY_TICK = 400;

export class LensSwitcher {
  current: LensId = 1;
  unlocked2 = false;
  unlocked3 = false;
  unlocked4 = false;
  unlocked5 = false;
  mindPhi = MIND_PHI;

  /** Проверяет условия открытия; возвращает текст события или null. */
  update(clusters: Cluster[], phi: number, worldTick: number): string | null {
    if (!this.unlocked2) {
      const stable = clusters.some((c) => c.size >= MIN_FORM_SIZE && c.age >= STABLE_AGE);
      if (stable) {
        this.unlocked2 = true;
        return 'Форма устояла. Открылась линза Филии.';
      }
    }
    if (!this.unlocked5 && phi >= CHEM_PHI) {
      this.unlocked5 = true;
      return 'Жизнь обросла грибницей. Открылась линза Мицелия — видна химия.';
    }
    if (this.unlocked2 && !this.unlocked3 && phi >= this.mindPhi) {
      this.unlocked3 = true;
      return 'Разум пробудился. Открылась линза Разума — видно будущее.';
    }
    if (!this.unlocked4 && worldTick >= HISTORY_TICK) {
      this.unlocked4 = true;
      return 'У мира появилась история. Открылась линза Хроники.';
    }
    return null;
  }

  /** Пытается переключить линзу; возвращает успех. */
  select(lens: LensId): boolean {
    if (lens === 2 && !this.unlocked2) return false;
    if (lens === 3 && !this.unlocked3) return false;
    if (lens === 4 && !this.unlocked4) return false;
    if (lens === 5 && !this.unlocked5) return false;
    this.current = lens;
    return true;
  }

  reset(): void {
    this.current = 1;
    this.unlocked2 = false;
    this.unlocked3 = false;
    this.unlocked4 = false;
    this.unlocked5 = false;
  }
}
