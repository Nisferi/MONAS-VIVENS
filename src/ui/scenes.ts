/**
 * ui/scenes — сцены концовок: 2.5 секунды образа перед летописью.
 * Сфайрос стягивается в идеальный круг, Абсолют вспыхивает сетью,
 * Болото зарастает, Пророк гаснет с открытым глазом, Грибница плетёт нити.
 */
import type { EndingId } from '../run/endings';

const DURATION = 2500;

export function playEndingScene(ending: EndingId, done: () => void): void {
  const cv = document.createElement('canvas');
  cv.id = 'scene';
  cv.width = window.innerWidth;
  cv.height = window.innerHeight;
  document.body.append(cv);
  const ctx = cv.getContext('2d');
  if (!ctx) {
    cv.remove();
    done();
    return;
  }

  const cx = cv.width / 2;
  const cy = cv.height / 2;
  const R = Math.min(cv.width, cv.height) * 0.4;
  const start = performance.now();

  function frame(now: number): void {
    const t = Math.min(1, (now - start) / DURATION);
    if (!ctx) return;
    ctx.fillStyle = `rgba(11, 8, 5, ${0.25 + 0.6 * t})`;
    ctx.fillRect(0, 0, cv.width, cv.height);

    switch (ending) {
      case 'sphairos': {
        // Идеальная сфера стягивается — и замирает.
        const r = R * (1.2 - 0.7 * t);
        ctx.strokeStyle = `rgba(255, 217, 102, ${0.4 + 0.6 * t})`;
        ctx.lineWidth = 2 + 4 * t;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'absolute': {
        // Сеть различий вспыхивает единым целым.
        const n = 14;
        ctx.strokeStyle = `rgba(0, 229, 207, ${0.15 + 0.5 * Math.sin(t * Math.PI)})`;
        ctx.lineWidth = 1.5;
        for (let i = 0; i < n; i++) {
          const a1 = (i / n) * Math.PI * 2;
          for (let j = i + 1; j < n; j += 2) {
            const a2 = (j / n) * Math.PI * 2 + t;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a1) * R * t, cy + Math.sin(a1) * R * t);
            ctx.lineTo(cx + Math.cos(a2) * R * t, cy + Math.sin(a2) * R * t);
            ctx.stroke();
          }
        }
        ctx.fillStyle = `rgba(255, 217, 102, ${t})`;
        ctx.beginPath();
        ctx.arc(cx, cy, 5 + 6 * Math.sin(t * Math.PI), 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'mycelium': {
        // Золотые нити прорастают снизу.
        ctx.strokeStyle = `rgba(255, 217, 102, ${0.3 + 0.4 * t})`;
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 12; i++) {
          const x0 = (cv.width / 12) * i + 20;
          ctx.beginPath();
          ctx.moveTo(x0, cv.height);
          const reach = cv.height * t;
          ctx.quadraticCurveTo(
            x0 + Math.sin(i * 2.4) * 80,
            cv.height - reach / 2,
            x0 + Math.sin(i * 5.1) * 120,
            cv.height - reach,
          );
          ctx.stroke();
        }
        break;
      }
      case 'prophet': {
        // Бирюзовый глаз, что видел всё, — гаснет.
        const a = Math.sin(Math.min(1, t * 1.4) * Math.PI);
        ctx.strokeStyle = `rgba(0, 229, 207, ${a})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(cx, cy, R * 0.8, R * 0.35 * (1 - t * 0.8), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(0, 229, 207, ${a * 0.8})`;
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.12 * (1 - t), 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'swamp': {
        // Тёплая тьма болота затягивает поле.
        const grad = ctx.createRadialGradient(cx, cy, R * (1 - t), cx, cy, R * 1.6);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, `rgba(30, 40, 18, ${0.5 + 0.5 * t})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, cv.width, cv.height);
        break;
      }
    }

    if (t < 1) requestAnimationFrame(frame);
    else {
      cv.remove();
      done();
    }
  }
  requestAnimationFrame(frame);
}
