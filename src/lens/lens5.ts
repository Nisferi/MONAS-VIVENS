/**
 * lens/lens5 — линза Мицелия: показ сигнального поля («грибницы»).
 * Невидимая химическая сеть жизни — тёмная зелень → бирюзовое свечение.
 * Открывается с Яруса Химии (Φ ≥ 15).
 */
export function paintMycelium(
  ctx: CanvasRenderingContext2D,
  image: ImageData,
  signal: Float32Array,
  spike?: Uint8Array,
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
    // §16.2 Слова электрического языка — вспышки поверх грибницы.
    const w = spike ? spike[i] : 0;
    if (w === 1) {
      // ТРЕВОГА — багровая вспышка
      px[o] = 255; px[o + 1] = 70; px[o + 2] = 40;
    } else if (w === 2) {
      // ЗОВ — бело-бирюзовая искра
      px[o] = 180; px[o + 1] = 255; px[o + 2] = 240;
    } else if (w === 3) {
      // ГОЛОД — глухой синий пульс
      px[o] = 60; px[o + 1] = 80; px[o + 2] = 200;
    }
  }
  ctx.putImageData(image, 0, 0);
}
