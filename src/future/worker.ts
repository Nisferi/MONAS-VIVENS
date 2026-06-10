/**
 * future/worker — фоновый расчёт будущего.
 * Гоняет ТОТ ЖЕ чистый tick() из core: отдельного кода будущего не существует —
 * это контракт детерминизма (docs/design/05-future.md).
 */
import { setGridSize, type WorldState } from '../core/grid';
import { tick, type Me } from '../core/rules';

interface ForecastRequest {
  cells: Uint8Array;
  age: Uint16Array;
  kind: Uint8Array;
  baseTick: number;
  energy: number;
  me: Me;
  steps: number;
}

self.onmessage = (e: MessageEvent<ForecastRequest>) => {
  const { cells, age, kind, baseTick, energy, me, steps } = e.data;
  // Размер поля выводим из данных — у воркера своя копия модуля grid.
  setGridSize(Math.round(Math.sqrt(cells.length)));
  let state: WorldState = { tick: baseTick, cells, age, kind, energy };
  for (let i = 0; i < steps; i++) {
    state = tick(state, me);
  }
  (self as unknown as Worker).postMessage(
    { baseTick, steps, cells: state.cells, age: state.age },
    [state.cells.buffer, state.age.buffer],
  );
};
