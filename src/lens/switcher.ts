/**
 * lens/switcher — переключение линз и условия их открытия.
 * Линза 2 открывается, когда первая форма прожила ≥ STABLE_AGE тиков;
 * линза 3 — когда Φ достигла порога разума (docs/design/04-lenses.md).
 */
import { MIN_FORM_SIZE, type Cluster } from '../phi/clusters';
import { STABLE_AGE } from '../phi/mnemosyne';

export type LensId = 1 | 2 | 3;

/** Порог Φ, за которым просыпается разум (архетип Эхо снижает его). */
export const MIND_PHI = 25;

export class LensSwitcher {
  current: LensId = 1;
  unlocked2 = false;
  unlocked3 = false;
  mindPhi = MIND_PHI;

  /** Проверяет условия открытия; возвращает текст события или null. */
  update(clusters: Cluster[], phi: number): string | null {
    if (!this.unlocked2) {
      const stable = clusters.some((c) => c.size >= MIN_FORM_SIZE && c.age >= STABLE_AGE);
      if (stable) {
        this.unlocked2 = true;
        return 'Форма устояла. Открылась линза Филии.';
      }
    }
    if (this.unlocked2 && !this.unlocked3 && phi >= this.mindPhi) {
      this.unlocked3 = true;
      return 'Разум пробудился. Открылась линза Разума — видно будущее.';
    }
    return null;
  }

  /** Пытается переключить линзу; возвращает успех. */
  select(lens: LensId): boolean {
    if (lens === 2 && !this.unlocked2) return false;
    if (lens === 3 && !this.unlocked3) return false;
    this.current = lens;
    return true;
  }

  reset(): void {
    this.current = 1;
    this.unlocked2 = false;
    this.unlocked3 = false;
  }
}
