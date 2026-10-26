import { defineConfig } from 'vite';

// Relative asset paths: the build works from any sub-path (GitHub Pages serves
// the game from /<repo>/) and when opened from a plain folder.
export default defineConfig({
  base: './',
});
