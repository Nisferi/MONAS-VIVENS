/**
 * lens/switcher — переключение линз и условия их открытия.
 * Линза 2 открывается, когда первый кластер прожил ≥ STABLE_AGE тиков
 * (docs/design/04-lenses.md).
 */
import { MIN_FORM_SIZE, type Cluster } from '../phi/clusters';
import { STABLE_AGE } from '../phi/mnemosyne';

export type LensId = 1 | 2;

export class LensSwitcher {
  current: LensId = 1;
  unlocked2 = false;

  /** Проверяет условия открытия; возвращает текст события или null. */
  update(clusters: Cluster[]): string | null {
    if (!this.unlocked2) {
      const stable = clusters.some((c) => c.size >= MIN_FORM_SIZE && c.age >= STABLE_AGE);
      if (stable) {
        this.unlocked2 = true;
        return 'Форма устояла. Открылась линза Филии.';
      }
    }
    return null;
  }

  /** Пытается переключить линзу; возвращает успех. */
  select(lens: LensId): boolean {
    if (lens === 2 && !this.unlocked2) return false;
    this.current = lens;
    return true;
  }

  reset(): void {
    this.current = 1;
    this.unlocked2 = false;
  }
}
