/**
 * future/worker — фоновый расчёт будущего.
 * Гоняет ТОТ ЖЕ чистый tick() из core: отдельного кода будущего не существует —
 * это контракт детерминизма (docs/design/05-future.md).
 */
import type { WorldState } from '../core/grid';
import { tick, type Me } from '../core/rules';

interface ForecastRequest {
  cells: Uint8Array;
  age: Uint16Array;
  baseTick: number;
  me: Me;
  steps: number;
}

self.onmessage = (e: MessageEvent<ForecastRequest>) => {
  const { cells, age, baseTick, me, steps } = e.data;
  let state: WorldState = { tick: baseTick, cells, age };
  for (let i = 0; i < steps; i++) {
    state = tick(state, me);
  }
  (self as unknown as Worker).postMessage(
    { baseTick, steps, cells: state.cells, age: state.age },
    [state.cells.buffer, state.age.buffer],
  );
};
