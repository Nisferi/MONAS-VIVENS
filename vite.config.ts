import { defineConfig } from 'vite';

export default defineConfig({
  // Относительные пути: сборка работает и на GitHub Pages
  // (https://<user>.github.io/MONAS-VIVENS/), и в Telegram Mini App, и локально.
  base: './',
});
