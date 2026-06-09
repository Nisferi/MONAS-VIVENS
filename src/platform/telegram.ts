/**
 * platform/telegram — мягкая интеграция с Telegram Mini App:
 * если игра открыта в ТГ, разворачиваемся на весь экран; иначе тишина.
 */
interface TelegramWebApp {
  ready(): void;
  expand(): void;
  setBackgroundColor?(color: string): void;
}

export function initTelegram(): void {
  try {
    const tg = (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
    if (!tg) return;
    tg.ready();
    tg.expand();
    tg.setBackgroundColor?.('#0b0805');
  } catch {
    /* вне Telegram */
  }
}
