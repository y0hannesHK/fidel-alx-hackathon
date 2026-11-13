// Builds the whole player (Able Player + jQuery + Fidel code) into exactly two
// files, so a website only needs one <script> and one <link> tag:
//   dist/fidel.js   (classic script, works without type="module")
//   dist/fidel.css
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: 'src/index.js',
      name: 'Fidel',
      // IIFE = a plain script that runs on load; no module loader needed.
      formats: ['iife'],
      fileName: () => 'fidel.js',
      cssFileName: 'fidel',
    },
  },
});
