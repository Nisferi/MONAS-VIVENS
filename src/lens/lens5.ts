/**
 * lens/lens5 — линза Мицелия: показ сигнального поля («грибницы»).
 * Невидимая химическая сеть жизни — тёмная зелень → бирюзовое свечение.
 * Открывается с Яруса Химии (Φ ≥ 15).
 */
export function paintMycelium(
  ctx: CanvasRenderingContext2D,
  image: ImageData,
  signal: Float32Array,
): void {
  const px = image.data;
  for (let i = 0; i < signal.length; i++) {
    // Логарифмическая шкала: и слабые нити видны, и яркие узлы не выжигают.
    const t = Math.min(1, Math.log1p((signal[i] as number) * 3) / Math.log1p(12));
    const o = i * 4;
    px[o] = 8 + 30 * t;
    px[o + 1] = 20 + 200 * t;
    px[o + 2] = 18 + 160 * t;
    px[o + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}
