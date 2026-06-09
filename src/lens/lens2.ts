/**
 * lens/lens2 — линза Филии: кластеры свёрнуты в узлы, между близкими
 * узлами — золотые нити. Чистая отрисовка, ничего не считает кроме геометрии.
 */
import { MIN_FORM_SIZE, type Cluster } from '../phi/clusters';
import { STABLE_AGE } from '../phi/mnemosyne';

/** Дальше этого расстояния (в клетках) нить Филии не видна. */
const THREAD_REACH = 18;

export interface LensTransform {
  /** Левый верхний угол поля на экране (физические пиксели). */
  originX: number;
  originY: number;
  /** Пикселей на клетку. */
  scale: number;
}

export function drawLens2(
  ctx: CanvasRenderingContext2D,
  t: LensTransform,
  clusters: Cluster[],
): void {
  const nodes = clusters.filter((c) => c.size >= MIN_FORM_SIZE);

  const px = (cx: number) => t.originX + cx * t.scale;
  const py = (cy: number) => t.originY + cy * t.scale;

  // Нити Филии между близкими узлами.
  ctx.lineCap = 'round';
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i] as Cluster;
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j] as Cluster;
      const d = Math.hypot(a.cx - b.cx, a.cy - b.cy);
      if (d >= THREAD_REACH) continue;
      const closeness = 1 - d / THREAD_REACH;
      ctx.strokeStyle = `rgba(255, 217, 102, ${(0.15 + 0.55 * closeness).toFixed(3)})`;
      ctx.lineWidth = Math.max(1, t.scale * 0.12 * (0.4 + closeness));
      ctx.beginPath();
      ctx.moveTo(px(a.cx), py(a.cy));
      ctx.lineTo(px(b.cx), py(b.cy));
      ctx.stroke();
    }
  }

  // Узлы: радиус — корень размера, свечение — возраст (Мнемозина).
  for (const c of nodes) {
    const r = Math.max(t.scale * 0.5, Math.sqrt(c.size) * 0.55 * t.scale);
    const maturity = Math.min(1, c.age / STABLE_AGE);
    const x = px(c.cx);
    const y = py(c.cy);

    ctx.shadowColor = 'rgba(255, 200, 80, 0.9)';
    ctx.shadowBlur = r * (0.5 + maturity);
    ctx.fillStyle = `rgba(255, ${Math.round(150 + 70 * maturity)}, ${Math.round(
      40 + 60 * maturity,
    )}, 0.95)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Устойчивый кластер отмечен бирюзовым кольцом — он уже «форма».
    if (c.age >= STABLE_AGE) {
      ctx.strokeStyle = 'rgba(0, 229, 207, 0.85)';
      ctx.lineWidth = Math.max(1, t.scale * 0.15);
      ctx.beginPath();
      ctx.arc(x, y, r + Math.max(2, t.scale * 0.3), 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
