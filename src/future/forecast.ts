/**
 * future/forecast — fast-forward копии мира в Web Worker,
 * чтобы расчёт будущего не подвешивал UI на слабых телефонах.
 */
import type { WorldState } from '../core/grid';
import type { Me } from '../core/rules';

export interface ForecastResult {
  /** Тик, с которого считался прогноз. */
  baseTick: number;
  /** На сколько тиков вперёд. */
  steps: number;
  /** Состояние мира на тике baseTick + steps. */
  cells: Uint8Array;
  age: Uint16Array;
}

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
    this.worker.postMessage(
      { cells, age, baseTick: state.tick, energy: state.energy, me, steps },
      [cells.buffer, age.buffer],
    );
    return true;
  }

  invalidate(): void {
    this.latest = null;
  }
}
