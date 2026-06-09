/**
 * platform/pwa — регистрация service worker для офлайна.
 */
export function initPwa(): void {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
  navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`)
    .catch(() => {/* офлайн будет недоступен — не критично */});
}
