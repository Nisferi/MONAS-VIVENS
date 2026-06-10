/**
 * future/worker — фоновый расчёт будущего.
 * Гоняет ТОТ ЖЕ чистый tick() из core: отдельного кода будущего не существует —
 * это контракт детерминизма (docs/design/05-future.md).
 * Возвращает не только конечную точку, но и кадры пути — для скраббера времени.
 */
import { setGridSize, type WorldState } from '../core/grid';
import { tick, type Me } from '../core/rules';

interface ForecastRequest {
  cells: Uint8Array;
  age: Uint16Array;
  kind: Uint8Array;
  terrain: Uint8Array;
  signal: Float32Array;
  baseTick: number;
  energy: number;
  me: Me;
  steps: number;
  /** Сколько кадров пути вернуть. */
  frames: number;
}

self.onmessage = (e: MessageEvent<ForecastRequest>) => {
  const { cells, age, kind, terrain, signal, baseTick, energy, me, steps, frames } = e.data;
  // Размер поля выводим из данных — у воркера своя копия модуля grid.
  setGridSize(Math.round(Math.sqrt(cells.length)));
  let state: WorldState = { tick: baseTick, cells, age, kind, terrain, signal, energy };

  const out: { at: number; cells: Uint8Array }[] = [];
  const transfers: ArrayBuffer[] = [];
  const every = Math.max(1, Math.round(steps / Math.max(1, frames)));
  for (let i = 1; i <= steps; i++) {
    state = tick(state, me);
    if (i % every === 0 || i === steps) {
      const snap = state.cells.slice();
      out.push({ at: i, cells: snap });
      transfers.push(snap.buffer);
    }
  }
  (self as unknown as Worker).postMessage({ baseTick, frames: out }, transfers);
};
