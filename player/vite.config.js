// Builds the whole player (Able Player + jQuery + Fidel code) into:
//   dist/fidel.js     classic script, works without type="module"
//   dist/fidel.css
//   dist/fonts/       self-hosted Noto Sans Ethiopic (loaded only when needed)
// so a website only needs one <script> and one <link> tag.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { defineConfig } from 'vite';
import { ableRealButtons } from './patches/able-real-buttons.js';

const require = createRequire(import.meta.url);

// Copies the Ethiopic font files from the @fontsource package into dist/fonts/.
function copyEthiopicFonts() {
  return {
    name: 'fidel-copy-ethiopic-fonts',
    generateBundle() {
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
      // The SIL Open Font License must travel with the font files.
      this.emitFile({
        type: 'asset',
        fileName: 'fonts/OFL.txt',
        source: readFileSync(require.resolve('@fontsource/noto-sans-ethiopic/LICENSE')),
      });
    },
  };
}

export default defineConfig({
  plugins: [ableRealButtons(), copyEthiopicFonts()],
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
