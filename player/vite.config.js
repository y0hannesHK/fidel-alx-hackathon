// Builds the whole player (Able Player + jQuery + Fidel code) into:
//   dist/fidel.js     classic script, works without type="module"
//   dist/fidel.css
//   dist/fonts/       self-hosted Latin and Ethiopic fonts
// so a website only needs one <script> and one <link> tag.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { defineConfig } from 'vite';

const require = createRequire(import.meta.url);

// Copies self-hosted font files and their licences into dist/fonts/.
function copyFonts() {
  return {
    name: 'fidel-copy-fonts',
    generateBundle() {
      for (const weight of [400, 500, 600, 700]) {
        const file = require.resolve(`@fontsource/poppins/files/poppins-latin-${weight}-normal.woff2`);
        this.emitFile({
          type: 'asset',
          fileName: `fonts/poppins-${weight}.woff2`,
          source: readFileSync(file),
        });
      }
      for (const weight of [400, 700]) {
        const file = require.resolve(
          `@fontsource/noto-sans-ethiopic/files/noto-sans-ethiopic-ethiopic-${weight}-normal.woff2`
        );
        this.emitFile({
          type: 'asset',
          fileName: `fonts/noto-sans-ethiopic-${weight}.woff2`,
          source: readFileSync(file),
        });
      }
      this.emitFile({
        type: 'asset',
        fileName: 'fonts/Poppins-OFL.txt',
        source: readFileSync(require.resolve('@fontsource/poppins/LICENSE')),
      });
      this.emitFile({
        type: 'asset',
        fileName: 'fonts/OFL.txt',
        source: readFileSync(require.resolve('@fontsource/noto-sans-ethiopic/LICENSE')),
      });
    },
  };
}

export default defineConfig({
  plugins: [copyFonts()],
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
