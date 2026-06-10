/**
 * phi/names — имена устойчивых форм: мир обретает биографию.
 * Имя детерминировано от id кластера и seed партии — в реплее форма
 * зовётся так же.
 */
const HEADS = ['Ур', 'Ан', 'Дил', 'Эн', 'Ки', 'Нин', 'Заг', 'Ме', 'Лах', 'Сар'];
const TAILS = ['-Анна', 'мун', 'гир', 'лиль', 'ду', '-Ки', 'аш', 'ту', 'гал', 'нам'];

export function formName(clusterId: number, seed: number): string {
  const h = (Math.imul(clusterId ^ seed, 2654435761) >>> 0);
  const head = HEADS[h % HEADS.length] as string;
  const tail = TAILS[(h >>> 8) % TAILS.length] as string;
  return head + tail;
}

/** Форма достойна имени: прожила век и набрала тело. */
export const NAME_AGE = 100;
export const NAME_SIZE = 8;

export interface NamedForm {
  id: number;
  name: string;
  bornTick: number;
  namedTick: number;
  diedTick: number | null;
  /** Размер на пике славы. */
  peakSize: number;
}
