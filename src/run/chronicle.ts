/**
 * run/chronicle — Глиняная летопись: короткий текст партии из шаблонов
 * по достигнутым вехам. Летопись + seed = артефакт, которым можно делиться.
 */
import type { Ending } from './endings';
import type { RunConfig } from './setup';
import { ARCHETYPES, BIOMES } from './setup';

export interface NamedFormNote {
  name: string;
  namedTick: number;
  diedTick: number | null;
  peakSize: number;
}

export interface Milestones {
  firstFormTick: number | null;
  mindTick: number | null;
  namedForms: NamedFormNote[];
  politics?: { allies: number; wars: number };
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

  if (m.politics) {
    const { allies, wars } = m.politics;
    if (allies > 0 && wars > 0) {
      lines.push(`Формы плели политику: ${allies} союз(ов) и ${wars} войн(а) за родники.`);
    } else if (allies > 0) {
      lines.push(`Разные рода нашли мир: ${allies} союз(ов) связали формы.`);
    } else if (wars > 0) {
      lines.push(`За родники шла война: ${wars} форм(ы) сошлись в борьбе.`);
    }
  }

  for (const f of m.namedForms.slice(0, 3)) {
    lines.push(
      f.diedTick === null
        ? `Форма ${f.name} обрела имя на ${f.namedTick} тике и дожила до конца (в расцвете — ${f.peakSize} клеток).`
        : `Форма ${f.name} обрела имя на ${f.namedTick} тике и пала на ${f.diedTick}-м (в расцвете — ${f.peakSize} клеток).`,
    );
  }

  if (m.tabletsFired.length > 0) {
    lines.push(`Таблички Судеб говорили: ${m.tabletsFired.join('; ')}.`);
  } else {
    lines.push('Ни одна Табличка не была высечена — мир встретил бурю голыми руками.');
  }

  lines.push(`На ${m.finalTick} тике летопись обрывается. Φ = ${m.finalPhi.toFixed(1)}.`);
  lines.push(ending.text);

  return lines.join('\n');
}
