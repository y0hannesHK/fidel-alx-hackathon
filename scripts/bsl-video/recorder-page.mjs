// Shared by the BSL recording scripts (scripts/bsl-video/make.sh). Local recording only.
// Loads the pinned BSD-3-Clause XSLT polyfill (fetched by make.sh) into this
// local browser only: Chrome 158+ has no XSLT, which the CWASA avatar needs.
// The polyfill's Wasm must start BEFORE CWASA's own Wasm code loads, so the
// avatar page is served with its scripts loaded in order after the polyfill.
import { readFileSync } from 'node:fs';

export const KOZHA = 'http://localhost:8001';

export async function openAvatarPage(browser, polyfillPath, viewport = { width: 640, height: 520 }) {
  const poly = readFileSync(polyfillPath);
  const page = await browser.newPage({ viewport });
  await page.route('**/__xslt-polyfill.min.js', (r) => r.fulfill({ body: poly, contentType: 'text/javascript' }));
  await page.route('**/fidel-sign/frame.html*', async (route) => {
    const res = await route.fetch();
    let html = await res.text();
    html = html.replace(/<script defer src="\/cwa\/allcsa\.js"><\/script>\s*<script defer src="\/sigml-validator\.js"><\/script>\s*<script defer src="([^"]+)"><\/script>/,
      (_, frameSrc) => `<script src="/__xslt-polyfill.min.js" charset="utf-8"></script>
  <script>
    (async () => {
      await window.xsltPolyfillReady();
      new XSLTProcessor(); // start the Wasm now, before CWASA loads
      for (const src of ['/cwa/allcsa.js', '/sigml-validator.js', '${frameSrc}']) {
        await new Promise((ok, fail) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = fail; document.head.append(s); });
      }
    })();
  </script>`);
    route.fulfill({ response: res, body: html });
  });
  await page.goto(`${KOZHA}/fidel-sign/frame.html?parent=${encodeURIComponent('http://localhost:8000')}`);
  await page.locator('#status').filter({ hasText: /avatar ready/ }).waitFor({ timeout: 90000 });
  return page;
}
