/**
 * lens/lens4 — линза Хроники: память места.
 * Тепловая карта истории — где жизнь жила дольше всего за партию.
 * Тьма → тлеющий уголь → золото → белое каление.
 */
export function paintChronicle(
  ctx: CanvasRenderingContext2D,
  image: ImageData,
  heat: Float32Array,
): void {
  let max = 1;
  for (let i = 0; i < heat.length; i++) {
    const h = heat[i] as number;
    if (h > max) max = h;
  }
  const px = image.data;
  for (let i = 0; i < heat.length; i++) {
    const t = Math.sqrt((heat[i] as number) / max); // корень: тусклое тоже видно
    const o = i * 4;
    if (t < 0.5) {
      const k = t * 2;
      px[o] = 18 + (180 - 18) * k;
      px[o + 1] = 13 + (60 - 13) * k;
      px[o + 2] = 8 + (20 - 8) * k;
    } else {
      const k = (t - 0.5) * 2;
      px[o] = 180 + (255 - 180) * k;
      px[o + 1] = 60 + (230 - 60) * k;
      px[o + 2] = 20 + (160 - 20) * k;
    }
    px[o + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}
