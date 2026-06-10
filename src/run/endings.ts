/**
 * run/endings — концовка следует из итогового состояния системы,
 * не из скрипта (docs/design/08-endings.md). MVP: 4 канонических +
 * высшая «Абсолют Через Различие».
 */
export interface EndingInput {
  /** Пережила ли система кризис (Семян ≥ порога в финале). */
  survived: boolean;
  phi: number;
  neikos: number;
  philia: number;
  /** Разум проснулся (видел прогноз) до прихода угрозы. */
  sawFuture: boolean;
  tabletsCarved: number;
  tabletsFired: number;
  /** Воля, дарованная формам (0..10): автономия жизни. */
  will: number;
}

export type EndingId = 'sphairos' | 'prophet' | 'swamp' | 'mycelium' | 'absolute' | 'tyrant';

export interface Ending {
  id: EndingId;
  title: string;
  text: string;
}

const ENDINGS: Record<EndingId, Ending> = {
  sphairos: {
    id: 'sphairos',
    title: 'Сфайрос — Ложный Абсолют',
    text: 'Мир замкнулся в Сфайрос. Вражда умерла — и различие умерло с ней. Совершенная сфера молчит: ей не о чем говорить с собой.',
  },
  prophet: {
    id: 'prophet',
    title: 'Пророк Без Рук',
    text: 'Разум видел бурю за горизонтом — и не высек ни одной Таблички. Предвидеть — не значит мочь. Мир угас с открытыми глазами.',
  },
  swamp: {
    id: 'swamp',
    title: 'Слепое Болото',
    text: 'Жизнь продолжается — слепая, тёплая, без числа Φ, способного назвать себя. Болото дышит и не знает, что дышит.',
  },
  mycelium: {
    id: 'mycelium',
    title: 'Мудрая Грибница',
    text: 'Кризис пришёл, как было предсказано, — и спящие Таблички встретили его сами. Разум победил будущее подготовкой.',
  },
  absolute: {
    id: 'absolute',
    title: 'Абсолют Через Различие',
    text: 'Множество стало единым, оставшись многим. Вражда жива — и потому живо различие; различие живо — и потому Целое видит себя.',
  },
  tyrant: {
    id: 'tyrant',
    title: 'Тиран Будущего',
    text: 'Ты задушил волю — и мир стал безупречным механизмом. Он живёт, он считает, он не ошибается. Но в нём некому ошибиться — а значит, некому и быть. Идеальные часы не знают, что идут.',
  },
};

export function decideEnding(i: EndingInput): Ending {
  // Пророк Без Рук: видел будущее, не действовал, пал.
  if (!i.survived && i.sawFuture && i.tabletsCarved === 0) return ENDINGS.prophet;
  // Любая иная гибель — мир так и не вышел из болота.
  if (!i.survived) return ENDINGS.swamp;
  // Тиран Будущего: высокий мир, у которого отняли волю, — мёртвый часовой механизм.
  if (i.phi >= 30 && i.will <= 1) return ENDINGS.tyrant;
  // Сфайрос: мир жив и высок, но Вражда умерла — застывшее единство.
  if (i.phi >= 25 && i.neikos < 0.03) return ENDINGS.sphairos;
  // Высшая: целое живо, Φ высока, Нейкос в живом диапазоне, воля дарована.
  if (i.phi >= 30 && i.neikos >= 0.03 && i.neikos <= 0.75 && i.will >= 3) return ENDINGS.absolute;
  // Кризис пережит руками прошлого.
  if (i.tabletsFired > 0 && i.phi >= 12) return ENDINGS.mycelium;
  return ENDINGS.swamp;
}
