/**
 * platform/telegram — мягкая интеграция с Telegram Mini App:
 * если игра открыта в ТГ, разворачиваемся на весь экран; иначе тишина.
 */
interface TelegramWebApp {
  ready(): void;
  expand(): void;
  setBackgroundColor?(color: string): void;
  CloudStorage?: {
    setItem(key: string, value: string, cb?: (err: unknown, ok?: boolean) => void): void;
    getItem(key: string, cb: (err: unknown, value?: string) => void): void;
  };
}

function webApp(): TelegramWebApp | null {
  try {
    return (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp ?? null;
  } catch {
    return null;
  }
}

export function initTelegram(): void {
  const tg = webApp();
  if (!tg) return;
  try {
    tg.ready();
    tg.expand();
    tg.setBackgroundColor?.('#0b0805');
  } catch {
    /* вне Telegram */
  }
}

/** Зеркалирование в облако ТГ: рекорды переживают переустановку. Вне ТГ — тишина. */
export function cloudMirror(key: string, value: string): void {
  try {
    webApp()?.CloudStorage?.setItem(key, value);
  } catch {
    /* ок */
  }
}

export function cloudRead(key: string, cb: (value: string | null) => void): void {
  try {
    const cs = webApp()?.CloudStorage;
    if (!cs) return cb(null);
    cs.getItem(key, (_err, value) => cb(value ?? null));
  } catch {
    cb(null);
  }
}
