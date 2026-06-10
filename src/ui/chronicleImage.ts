/**
 * ui/chronicleImage — экспорт летописи картинкой: финальное поле,
 * титул концовки, текст летописи, seed. PNG для дележа.
 */
import { Cell, type WorldState } from '../core/grid';
import { activeTheme } from './themes';

export interface ChronicleCard {
  title: string;
  chronicle: string;
  seedText: string;
  score: number;
  phi: number;
}

const W = 900;

export function downloadChroniclePng(world: WorldState, side: number, card: ChronicleCard): void {
  const lines = wrap(card.chronicle, 64);
  const fieldPx = 560;
  const h = 300 + fieldPx + lines.length * 26 + 120;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#0b0805';
  ctx.fillRect(0, 0, W, h);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd966';
  ctx.font = 'small-caps 600 34px Georgia, serif';
  ctx.fillText('MONAS VIVENS', W / 2, 64);
  ctx.font = 'small-caps 600 26px Georgia, serif';
  ctx.fillStyle = '#00e5cf';
  ctx.fillText(card.title, W / 2, 110);
  ctx.fillStyle = '#d99840';
  ctx.font = '18px Georgia, serif';
  ctx.fillText(`Φ ${card.phi.toFixed(1)}   ·   счёт ${card.score}`, W / 2, 146);

  // Поле: клетка за клеткой, той же палитрой, что в игре.
  const cellPx = Math.floor(fieldPx / side);
  const fw = cellPx * side;
  const ox = (W - fw) / 2;
  const oy = 180;
  ctx.fillStyle = '#120d08';
  ctx.fillRect(ox, oy, fw, fw);
  for (let i = 0; i < world.cells.length; i++) {
    const cell = world.cells[i];
    if (cell === Cell.Empty) continue;
    const x = ox + (i % side) * cellPx;
    const y = oy + Math.floor(i / side) * cellPx;
    if (cell === Cell.Seed) {
      const ramp = activeTheme.field.strains[world.kind[i] ?? 0] ?? activeTheme.field.strains[0];
      if (ramp) {
        const [r, g, b] = ramp.old;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
      }
    } else if (cell === Cell.Signal) {
      ctx.fillStyle = '#00e5cf';
    } else {
      ctx.fillStyle = '#523a24';
    }
    ctx.fillRect(x, y, cellPx, cellPx);
  }
  ctx.strokeStyle = 'rgba(217,152,64,0.6)';
  ctx.strokeRect(ox, oy, fw, fw);

  // Летопись.
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e8dcc8';
  ctx.font = 'italic 17px Georgia, serif';
  let ty = oy + fw + 50;
  for (const line of lines) {
    ctx.fillText(line, 70, ty);
    ty += 26;
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#d99840';
  ctx.font = '16px Georgia, serif';
  ctx.fillText(`Семя мира: «${card.seedText}» — назови его снова, и судьба повторится.`, W / 2, h - 40);

  const a = document.createElement('a');
  a.download = `monas-${card.seedText}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
}

function wrap(text: string, max: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      if ((line + ' ' + word).trim().length > max) {
        out.push(line.trim());
        line = word;
      } else {
        line = `${line} ${word}`;
      }
    }
    if (line.trim()) out.push(line.trim());
  }
  return out;
}
