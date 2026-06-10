/**
 * future/forecast — fast-forward копии мира в Web Worker,
 * чтобы расчёт будущего не подвешивал UI на слабых телефонах.
 * Прогноз — это путь: серия кадров от «+скоро» до горизонта.
 */
import type { WorldState } from '../core/grid';
import type { Me } from '../core/rules';

export interface ForecastFrame {
  /** На сколько тиков вперёд от точки расчёта. */
  at: number;
  cells: Uint8Array;
}

export interface ForecastResult {
  baseTick: number;
  frames: ForecastFrame[];
}

/** Сколько кадров пути просить у воркера. */
export const FORECAST_FRAMES = 8;

export class Forecaster {
  private readonly worker: Worker;
  private busy = false;
  /** Последний готовый прогноз; устаревает по мере хода времени. */
  latest: ForecastResult | null = null;

  constructor() {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<ForecastResult>) => {
      this.latest = e.data;
      this.busy = false;
    };
  }

  /** Запросить прогноз; вернёт false, если worker ещё занят прошлым. */
  request(state: WorldState, me: Me, steps: number): boolean {
    if (this.busy || steps <= 0) return false;
    this.busy = true;
    const cells = state.cells.slice();
    const age = state.age.slice();
    const kind = state.kind.slice();
    this.worker.postMessage(
      {
        cells, age, kind,
        baseTick: state.tick,
        energy: state.energy,
        me, steps,
        frames: FORECAST_FRAMES,
      },
      [cells.buffer, age.buffer, kind.buffer],
    );
    return true;
  }

  invalidate(): void {
    this.latest = null;
  }
}
