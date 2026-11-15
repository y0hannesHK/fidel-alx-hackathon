// Second build: the component library (Packages A–E, form fields) into
//   dist/fidel-components.js   classic script, like fidel.js
//   dist/fidel-components.css
// Run after the main build (npm run build does both); it adds to dist/
// without emptying it. fidel.js loads this file only when a page uses one of
// these tags (see the loader in src/index.js).
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: 'src/components.js',
      name: 'FidelComponents',
      formats: ['iife'],
      fileName: () => 'fidel-components.js',
      cssFileName: 'fidel-components',
    },
  },
});
