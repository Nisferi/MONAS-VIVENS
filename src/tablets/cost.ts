/**
 * tablets/cost — цена высечения: ресурс сейчас против будущего.
 * Центральный выбор игры (docs/design/06-tablets.md).
 */
export const CARVE_COST = 12;
export const MAX_TABLETS = 3;

export function canCarve(energy: number, carved: number): string | null {
  if (carved >= MAX_TABLETS) return 'Все Таблички уже высечены — глина судьбы исчерпана.';
  if (energy < CARVE_COST) return `Не хватает энергии: высечение стоит ${CARVE_COST}.`;
  return null;
}
