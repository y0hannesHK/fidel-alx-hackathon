// Record the BSL avatar signing each English caption of the demo lesson.
// Local recording only. Uses the pinned XSLT polyfill (user-approved) via
// recorder-page.mjs. Output: out/clips/NN.webm (one per caption that has signs),
// out/clips/idle.webm (avatar standing still), out/timeline.json.
//
//   node record.mjs <playwright-module-dir> <en.vtt> <out-dir> <polyfill.js> [reviewed=true|false]
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const [pwDir, vttPath, outDir, polyfill, reviewedArg = 'true'] = process.argv.slice(2);
const reviewed = reviewedArg !== 'false';
const { chromium } = await import(pathToFileURL(join(pwDir, 'node_modules/@playwright/test/index.mjs')).href);
const { openAvatarPage } = await import(pathToFileURL(join(import.meta.dirname, 'recorder-page.mjs')).href);

function parseVtt(text) {
  const toS = (t) => t.split(':').reduce((acc, part) => acc * 60 + parseFloat(part.replace(',', '.')), 0);
  const cues = [];
  for (const block of text.replace(/\r/g, '').split(/\n\n+/)) {
    const m = block.match(/(\d[\d:.,]+)\s+-->\s+(\d[\d:.,]+)[^\n]*\n([\s\S]+)/);
    if (m) cues.push({ start: toS(m[1]), end: toS(m[2]), text: m[3].replace(/<[^>]+>/g, '').replace(/\n/g, ' ').trim() });
  }
  return cues;
}

const cues = parseVtt(readFileSync(vttPath, 'utf8'));
mkdirSync(join(outDir, 'clips'), { recursive: true });
const browser = await chromium.launch();
const page = await openAvatarPage(browser, polyfill, { width: 640, height: 600 });

// Helpers inside the avatar page: signs-only SiGML (no fingerspelling), and a
// canvas recorder that starts just before signing and stops when the avatar is idle.
await page.evaluate(() => {
  window.__signsOnly = (plan) => {
    const tokens = String(plan.final || '').split(/\s+/).filter((t) => /[a-z]/i.test(t));
    const reviews = plan.per_token_review || [];
    const blocks = []; const used = []; const skipped = [];
    tokens.forEach((token, i) => {
      const r = reviews[i];
      const sign = r?.force_fingerspell ? null : (signs.get(token) || baseGloss.get(glossBase(token)));
      if (sign) { blocks.push(sign); used.push(token); } else skipped.push(token);
    });
    return { sigml: blocks.length ? `<?xml version="1.0" encoding="utf-8"?><sigml>${blocks.join('')}</sigml>` : '', used, skipped };
  };
  window.__record = (sigml) => new Promise((resolve) => {
    const canvas = document.querySelector('.CWASAAvatar canvas');
    const stream = canvas.captureStream(25);
    const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 600000 });
    const chunks = []; rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = async () => {
      const buf = new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer());
      let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      resolve({ base64: btoa(bin), seconds: (performance.now() - t0) / 1000 });
    };
    let t0;
    if (!sigml) { rec.start(); t0 = performance.now(); setTimeout(() => rec.stop(), 3000); return; }
    let started = false;
    const onActive = () => { started = true; };
    const onIdle = () => { if (started) setTimeout(() => rec.stop(), 200); };
    window.CWASA.addHook('animactive', onActive, 0);
    window.CWASA.addHook('animidle', onIdle, 0);
    rec.start(); t0 = performance.now();
    window.CWASA.playSiGMLText(sigml, 0);
    setTimeout(() => { if (rec.state === 'recording') rec.stop(); }, 60000);
  });
});

const plan = async (text, rev) => page.evaluate(async ({ text, rev }) => (await fetch('/api/plan', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text, language: 'en', sign_language: 'bsl', reviewed_only: rev }),
})).json(), { text, rev });

// Coverage for both settings (words with a sign).
const coverage = {};
for (const rev of [true, false]) {
  let words = 0; let signed = 0;
  for (const cue of cues) { const p = await plan(cue.text, rev); const r = await page.evaluate((p) => window.__signsOnly(p), p); words += r.used.length + r.skipped.length; signed += r.used.length; }
  coverage[rev ? 'reviewed_only' : 'all_signs'] = { words, signed };
}
console.log('coverage', JSON.stringify(coverage));

const idle = await page.evaluate(() => window.__record(''));
writeFileSync(join(outDir, 'clips', 'idle.webm'), Buffer.from(idle.base64, 'base64'));

const timeline = [];
for (const [i, cue] of cues.entries()) {
  const r = await page.evaluate((p) => window.__signsOnly(p), await plan(cue.text, reviewed));
  const row = { index: i, start: cue.start, end: cue.end, text: cue.text, signed: r.used, skipped: r.skipped, clip: null, clip_s: 0 };
  if (r.sigml) {
    const rec = await page.evaluate((s) => window.__record(s), r.sigml);
    const name = `${String(i).padStart(2, '0')}.webm`;
    writeFileSync(join(outDir, 'clips', name), Buffer.from(rec.base64, 'base64'));
    row.clip = name; row.clip_s = +rec.seconds.toFixed(2);
  }
  timeline.push(row);
  console.log(`${i} [${cue.start.toFixed(1)}-${cue.end.toFixed(1)}s] signed ${r.used.length} (${r.used.join(' ')}) clip ${row.clip_s}s`);
}
writeFileSync(join(outDir, 'timeline.json'), JSON.stringify({ reviewed_only: reviewed, coverage, cues: timeline }, null, 2));
await browser.close();
