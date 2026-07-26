/**
 * run/vows — Обеты (§15.2): концовка как выбранный путь, а не результат.
 *
 * Игрок клянётся на старте — и получает двойной счёт за исполненный обет,
 * штраф за нарушенный. Каждый обет требует своей стратегии: билды.
 */
import type { EndingId } from './endings';

export type VowId = 'none' | 'absolute' | 'sphairos' | 'mycelium';

export interface VowInfo {
  id: VowId;
  name: string;
  desc: string;
  /** Какая концовка исполняет обет. */
  target: EndingId | null;
  /** Подсказка о стратегии — видна на старте. */
  hint: string;
}

export const VOWS: VowInfo[] = [
  {
    id: 'none',
    name: 'Без обета',
    desc: 'путь открыт, счёт обычный',
    target: null,
    hint: 'Никаких клятв — куда выведет мир, туда и придёшь.',
  },
  {
    id: 'absolute',
    name: 'Обет Абсолюта',
    desc: 'единство, оставшееся многим (×2 за исполнение)',
    target: 'absolute',
    hint: 'Держи Вражду живой, роды разными, Волю высокой — не дай миру застыть.',
  },
  {
    id: 'sphairos',
    name: 'Обет Сфайроса',
    desc: 'совершенный покой (×2 за исполнение)',
    target: 'sphairos',
    hint: 'Гаси Нейкос: стабилизируй формы, усмиряй хаос, веди мир к тишине.',
  },
  {
    id: 'mycelium',
    name: 'Обет Грибницы',
    desc: 'разум, победивший будущее подготовкой (×2)',
    target: 'mycelium',
    hint: 'Вся партия — подготовка: высекай Таблички и дай им сработать в шторм.',
  },
];

export function vowById(id: VowId): VowInfo {
  return VOWS.find((v) => v.id === id) ?? (VOWS[0] as VowInfo);
}

/** Множитель счёта: исполнил ×2, нарушил ×0.6, без обета ×1. */
export function vowMultiplier(vow: VowId, ending: EndingId): number {
  if (vow === 'none') return 1;
  const target = vowById(vow).target;
  if (!target) return 1;
  return ending === target ? 2 : 0.6;
}

export function vowVerdict(vow: VowId, ending: EndingId): string | null {
  if (vow === 'none') return null;
  const info = vowById(vow);
  return ending === info.target
    ? `${info.name} исполнен — счёт удвоен.`
    : `${info.name} нарушен: мир пришёл иным путём.`;
}
