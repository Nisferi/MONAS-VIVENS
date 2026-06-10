/**
 * run/chronicle — Глиняная летопись: короткий текст партии из шаблонов
 * по достигнутым вехам. Летопись + seed = артефакт, которым можно делиться.
 */
import type { Ending } from './endings';
import type { RunConfig } from './setup';
import { ARCHETYPES, BIOMES } from './setup';

export interface Milestones {
  firstFormTick: number | null;
  mindTick: number | null;
  threatTick: number;
  stormCount: number;
  tabletsFired: string[];
  finalTick: number;
  finalPhi: number;
}

export function writeChronicle(m: Milestones, ending: Ending, cfg: RunConfig): string {
  const biome = BIOMES.find((b) => b.id === cfg.biome)?.name ?? cfg.biome;
  const archetype = ARCHETYPES.find((a) => a.id === cfg.archetype)?.name ?? cfg.archetype;
  const lines: string[] = [];

  lines.push(`Мир взошёл из семени «${cfg.seedText}» — ${archetype} в месте, что зовётся ${biome}.`);

  if (m.firstFormTick !== null) {
    lines.push(`На ${m.firstFormTick} тике первая форма устояла и узнала свою границу.`);
  } else {
    lines.push('Ни одна форма так и не устояла: жизнь мерцала и гасла.');
  }

  if (m.mindTick !== null) {
    lines.push(`На ${m.mindTick} тике пробудился разум и впервые взглянул за горизонт.`);
  } else {
    lines.push('Разум не пробудился: будущее осталось тьмой.');
  }

  lines.push(
    `На ${m.threatTick} тике пришёл первый из ${m.stormCount} Нейкос-штормов — как и было предначертано.`,
  );

  if (m.tabletsFired.length > 0) {
    lines.push(`Таблички Судеб говорили: ${m.tabletsFired.join('; ')}.`);
  } else {
    lines.push('Ни одна Табличка не была высечена — мир встретил бурю голыми руками.');
  }

  lines.push(`На ${m.finalTick} тике летопись обрывается. Φ = ${m.finalPhi.toFixed(1)}.`);
  lines.push(ending.text);

  return lines.join('\n');
}
