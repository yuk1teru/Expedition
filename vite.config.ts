import { defineConfig } from 'vite';
import { wikiEditPlugin } from './scripts/wikiPlugin';

// Relative asset paths: the build works from any sub-path (GitHub Pages serves
// the game from /<repo>/) and when opened from a plain folder.
// Two pages: the game (index.html) and the wiki (wiki.html; editable in `npm run dev`).
export default defineConfig({
  base: './',
  plugins: [wikiEditPlugin()],
  build: {
    rollupOptions: {
      input: { main: 'index.html', wiki: 'wiki.html' },
    },
  },
});
