// Builds the Fidel component docs (static HTML) from demo/docs/components.mjs.
//
//   node scripts/build-docs.mjs
//
// Writes demo/docs/index.html and one page per component
// (demo/docs/fidel-quiz.html, ...). The generated HTML is committed, so the
// site needs no build step; rerun this after changing the data file.
// Plain Node, no dependencies. demo/docs/docs.css and docs.js are written by
// hand and only linked from here.
import { writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'demo', 'docs');
const { COMPONENTS, GROUPS } = await import(new URL('../demo/docs/components.mjs', import.meta.url));

// --- Site chrome in English and Amharic. The reference content stays English.
export const CHROME = {
  site: ['Fidel component docs', 'የፊደል ክፍሎች ሰነድ'],
  tagline: ['Component docs', 'የክፍሎች ሰነድ'],
  skip: ['Skip to main content', 'ወደ ዋናው ይዘት ይዝለሉ'],
  language: ['Language', 'ቋንቋ'],
  navLabel: ['Site', 'ድረ-ገጽ'],
  breadcrumb: ['Breadcrumb', 'የሚገኙበት ቦታ'],
  docsHome: ['Docs home', 'የሰነዶች መነሻ'],
  showcase: ['Live showcase', 'የቀጥታ ማሳያ'],
  api: ['REST API docs', 'የREST API ሰነድ'],
  github: ['Fidel on GitHub', 'ፊደል በGitHub ላይ'],
  landing: ['Fidel landing page', 'የፊደል መግቢያ ገጽ'],
  intro: ['Every Fidel web component: what it does, who it helps, a live example, code to copy, its attributes and events, and accessibility notes.',
    'እያንዳንዱ የፊደል ዌብ ክፍል፦ ምን እንደሚሰራ፣ ማንን እንደሚረዳ፣ የቀጥታ ምሳሌ፣ የሚቀዳ ኮድ፣ መለያዎቹ (attributes) እና ክስተቶቹ (events)፣ እንዲሁም የተደራሽነት ማስታወሻዎች።'],
  introLang: ['The pages for each component are in English.', 'የእያንዳንዱ ክፍል ገጾች በእንግሊዝኛ ናቸው።'],
  start: ['Getting started', 'ለመጀመር'],
  start1: ['Add two lines to your page', 'ሁለት መስመሮችን ወደ ገጽዎ ያክሉ'],
  start1p: ["Put these in your page's head. From the free jsDelivr CDN, with no Fidel server:", 'እነዚህን በገጽዎ head ውስጥ ያስቀምጡ። ከነጻው jsDelivr CDN፣ ያለ ፊደል ሰርቨር፦'],
  start1self: ['Or from your own Fidel server, which also serves lessons, jobs and certificates. The /embed/v1/ address never gets breaking changes:',
    'ወይም ትምህርቶችን፣ ሥራዎችን እና ሰርተፊኬቶችን ከሚያቀርበው ከራስዎ የፊደል ሰርቨር። የ/embed/v1/ አድራሻ ነባሩን የሚያበላሽ ለውጥ አይደረግበትም፦'],
  start2: ['Your first player', 'የመጀመሪያ ማጫወቻዎ'],
  start2p: ['Add a fidel-player tag where the lesson goes. With your own video and caption files, no server is needed:',
    'ትምህርቱ በሚገባበት ቦታ የfidel-player ታግ ያክሉ። በራስዎ የቪዲዮ እና የካፕሽን ፋይሎች ሰርቨር አያስፈልግም፦'],
  start3: ['Other components load by themselves', 'ሌሎቹ ክፍሎች በራሳቸው ይጫናሉ'],
  start3p: ['fidel.js holds the player, job card, session viewer and certificate. Every other component is in fidel-components.js and fidel-components.css, and fidel.js loads them by itself, only when the page uses one of those tags. So a page with only a player downloads less, and you still add only one script tag.',
    'fidel.js ማጫወቻውን፣ የሥራ ካርዱን፣ የክፍለ ጊዜ መመልከቻውን እና የምስክር ወረቀቱን ይዟል። ሌሎቹ ክፍሎች በሙሉ fidel-components.js እና fidel-components.css ውስጥ ናቸው፤ ገጹ ከእነዚህ ታጎች አንዱን ሲጠቀም ብቻ fidel.js በራሱ ይጭናቸዋል። ስለዚህ ማጫወቻ ብቻ ያለው ገጽ ያነሰ ያወርዳል፤ እርስዎም አንድ የስክሪፕት ታግ ብቻ ያክላሉ።'],
  start3direct: ['A page that creates component tags from its own script before they are needed can load the second file directly:',
    'ክፍሎቹ ከመፈለጋቸው በፊት በራሱ ስክሪፕት የሚፈጥራቸው ገጽ ሁለተኛውን ፋይል በቀጥታ መጫን ይችላል፦'],
  start4: ['Settings in, events out', 'መቼቶች ይገባሉ፣ ክስተቶች ይወጣሉ'],
  start4p: ['Set attributes on the tag, and listen for its events like any DOM event. Events bubble and carry no personal data.',
    'በታጉ ላይ መለያዎችን (attributes) ያስቀምጡ፤ ክስተቶቹንም (events) እንደማንኛውም የDOM ክስተት ያዳምጡ። ክስተቶቹ ወደ ላይ ይተላለፋሉ፤ የግል መረጃ አይዙም።'],
  all: ['All components', 'ሁሉም ክፍሎች'],
  allp: ['Grouped by what they are for. Each link opens the page for that component.', 'በአገልግሎታቸው የተመደቡ ናቸው። እያንዳንዱ ማስፈንጠሪያ የዚያን ክፍል ገጽ ይከፍታል።'],
  filter: ['Filter components', 'ክፍሎችን ያጣሩ'],
  filterHint: ['Type a tag, a name or who it helps, for example Deaf or quiz.', 'ታግ፣ ስም ወይም የሚረዳውን ሰው ይጻፉ፤ ለምሳሌ Deaf ወይም quiz።'],
  helps: ['Who it helps:', 'ማንን ይረዳል፦'],
  live: ['Live example', 'የቀጥታ ምሳሌ'],
  liveIntro: ['This example is live: try it with the keyboard, a mouse or touch, and a screen reader.', 'ይህ ምሳሌ ቀጥታ ነው፦ በኪቦርድ፣ በማውዝ ወይም በንክኪ፣ እና በስክሪን አንባቢ ይሞክሩት።'],
  code: ['Code to copy', 'የሚቀዳ ኮድ'],
  copy: ['Copy', 'ቅዳ'],
  copyWhat: [' the example code', ' የምሳሌውን ኮድ'],
  attributes: ['Attributes', 'መለያዎች (attributes)'],
  events: ['Events', 'ክስተቶች (events)'],
  methods: ['Methods and properties', 'ዘዴዎች እና ባሕሪያት'],
  keyboard: ['Keyboard and screen reader', 'ኪቦርድ እና ስክሪን አንባቢ'],
  languages: ['Languages', 'ቋንቋዎች'],
  a11y: ['Accessibility and WCAG', 'ተደራሽነት እና WCAG'],
  related: ['Related components', 'ተዛማጅ ክፍሎች'],
  back: ['Back to all components', 'ወደ ሁሉም ክፍሎች ይመለሱ'],
  footer: ['Fidel component docs. Fidel is open source under the MIT licence and built on Able Player.',
    'የፊደል ክፍሎች ሰነድ። ፊደል በMIT ፈቃድ ክፍት ምንጭ ነው፤ በAble Player ላይ የተገነባ ነው።'],
};
// The run-time text (filter count, Copy messages) is in demo/docs/docs.js.

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Escape, then `code` and *emphasis*. */
const md = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
/** Both languages; CSS shows one. */
const t = (key) => {
  const [en, am] = CHROME[key];
  return `<span class="en">${esc(en)}</span><span class="am" lang="am">${esc(am)}</span>`;
};
const attrLabel = (key) => `aria-label="${esc(CHROME[key][0])}" data-label-en="${esc(CHROME[key][0])}" data-label-am="${esc(CHROME[key][1])}"`;
const byTag = new Map(COMPONENTS.map((c) => [c.tag, c]));
const groupOf = (id) => GROUPS.find((g) => g.id === id);
const tagName = (tag) => `<code>&lt;${tag}&gt;</code>`;

let codeCount = 0;
/** A code block in its own focusable scroll box, with a Copy button. */
function codeBlock(code, label) {
  const id = `code-${++codeCount}`;
  return `<div class="code-block">
  <div class="scroll-box" role="region" tabindex="0" aria-label="${esc(label)}"><pre><code id="${id}">${esc(code)}</code></pre></div>
  <p class="copy-row"><button type="button" class="button" data-copy="${id}"><span class="en">${esc(CHROME.copy[0])}<span class="sr-only">${esc(CHROME.copyWhat[0])}</span></span><span class="am" lang="am">${esc(CHROME.copy[1])}<span class="sr-only">${esc(CHROME.copyWhat[1])}</span></span></button> <span class="copy-status" role="status"></span></p>
</div>`;
}

function table(caption, head, rows) {
  if (!rows.length) return '';
  const th = head.map((h) => `<th scope="col">${h}</th>`).join('');
  const body = rows.map(([first, ...rest]) => `<tr><th scope="row">${first}</th>${rest.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('\n');
  return `<div class="scroll-box table-box" role="region" tabindex="0" aria-label="${esc(caption)}">
<table>
<caption>${esc(caption)}</caption>
<thead><tr>${th}</tr></thead>
<tbody>
${body}
</tbody>
</table>
</div>`;
}

function layout({ file, title, titleAm, heading, crumbs, body, loadsFidel }) {
  const current = file === 'index.html';
  const navLink = (href, key, isCurrent) => `<li><a href="${href}"${isCurrent ? ' aria-current="page"' : ''}>${t(key)}</a></li>`;
  return `<!DOCTYPE html>
<html lang="en" data-title-en="${esc(title)}" data-title-am="${esc(titleAm)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <!-- Generated by scripts/build-docs.mjs from demo/docs/components.mjs: edit those, not this file. -->
  <link rel="icon" href="/demo/brand/fidel-logo.svg" type="image/svg+xml">
  <script>
    // The remembered interface language, before the page is drawn.
    try { if (localStorage.getItem('fidel-docs-lang') === 'am') document.documentElement.setAttribute('data-ui-lang', 'am'); } catch (e) {}
  </script>
${loadsFidel ? `  <link rel="stylesheet" href="/embed/v1/fidel.css">
  <script src="/embed/v1/fidel.js" defer></script>
` : ''}  <link rel="stylesheet" href="/demo/docs/docs.css">
  <script src="/demo/docs/docs.js" defer></script>
</head>
<body>
  <a class="skip-link" href="#title">${t('skip')}</a>
  <header class="site-header">
    <div class="wrap header-row">
      <p class="brand"><img src="/demo/brand/fidel-logo.svg" alt="Fidel" width="86" height="40"> <span class="brand-text">${t('tagline')}</span></p>
      <div class="lang-switch" role="group" aria-labelledby="lang-label" hidden>
        <span id="lang-label" class="lang-label">${t('language')}</span>
        <button type="button" class="lang-button" data-set-lang="en" lang="en" aria-pressed="true">English<span class="sr-only am" lang="am"> (እንግሊዝኛ)</span></button>
        <button type="button" class="lang-button" data-set-lang="am" lang="am" aria-pressed="false">አማርኛ<span class="sr-only en" lang="en"> (Amharic)</span></button>
      </div>
    </div>
    <nav class="wrap site-nav" ${attrLabel('navLabel')}>
      <ul>
        ${navLink('/demo/docs/', 'docsHome', current)}
        ${navLink('/demo/components.html', 'showcase')}
        ${navLink('/docs', 'api')}
        ${navLink('https://github.com/y0hannesHK/fidel-alx-hackathon', 'github')}
        ${navLink('/', 'landing')}
      </ul>
    </nav>
  </header>
  <main class="wrap">
${crumbs ? `    <nav class="breadcrumb" ${attrLabel('breadcrumb')}>
      <ol>
${crumbs.map(([href, html], i) => `        <li>${i === crumbs.length - 1 ? `<a href="${href}" aria-current="page">${html}</a>` : `<a href="${href}">${html}</a>`}</li>`).join('\n')}
      </ol>
    </nav>
` : ''}    <h1 id="title" tabindex="-1">${heading}</h1>
${body}
  </main>
  <footer class="site-footer">
    <div class="wrap">
      <p>${t('footer')}</p>
    </div>
  </footer>
</body>
</html>
`;
}

// ------------------------------------------------------------------ index
function indexPage() {
  const groups = GROUPS.map((g) => {
    const items = COMPONENTS.filter((c) => c.group === g.id);
    const list = items.map((c) => `        <li data-search="${esc([c.tag, c.name, c.summary, c.helps].join(' ').toLowerCase())}">
          <a href="${c.tag}.html">${tagName(c.tag)}: ${esc(c.name)}</a>
          <p>${md(c.summary)}</p>
        </li>`).join('\n');
    return `      <section class="group" id="group-${g.id}" aria-labelledby="group-${g.id}-title" data-group>
        <h3 id="group-${g.id}-title"><span class="en">${esc(g.name)}</span><span class="am" lang="am">${esc(g.am)}</span></h3>
        <p>${md(g.intro)}</p>
        <ul class="component-list">
${list}
        </ul>
      </section>`;
  }).join('\n');

  const body = `    <p class="lead">${t('intro')}</p>
    <p class="am" lang="am">${esc(CHROME.introLang[1])}</p>

    <section aria-labelledby="start-title">
      <h2 id="start-title">${t('start')}</h2>
      <h3>${t('start1')}</h3>
      <p>${t('start1p')}</p>
${codeBlock(`<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/y0hannesHK/fidel-alx-hackathon@v1.0.0-cdn/fidel.css">
<script src="https://cdn.jsdelivr.net/gh/y0hannesHK/fidel-alx-hackathon@v1.0.0-cdn/fidel.js" defer></script>`, 'Code: the two lines from the CDN')}
      <p>${t('start1self')}</p>
${codeBlock(`<link rel="stylesheet" href="https://YOUR-FIDEL-HOST/embed/v1/fidel.css">
<script src="https://YOUR-FIDEL-HOST/embed/v1/fidel.js" defer></script>`, 'Code: the two lines from your own Fidel server')}
      <h3>${t('start2')}</h3>
      <p>${t('start2p')}</p>
${codeBlock(`<fidel-player src="lesson.mp4" captions-en="en.vtt" captions-am="am.vtt"
              chapters="chapters.vtt" lang="en"></fidel-player>`, 'Code: your first player')}
      <p><a href="fidel-player.html">${tagName('fidel-player')}: all attributes and events</a></p>
      <h3>${t('start3')}</h3>
      <p>${t('start3p')}</p>
      <p>${t('start3direct')}</p>
${codeBlock(`<link rel="stylesheet" href="https://YOUR-FIDEL-HOST/embed/v1/fidel-components.css">
<script src="https://YOUR-FIDEL-HOST/embed/v1/fidel-components.js" defer></script>`, 'Code: load the component file directly')}
      <h3>${t('start4')}</h3>
      <p>${t('start4p')}</p>
${codeBlock(`document.addEventListener('fidel-ended', (e) => markLessonDone(e.target.id));`, 'Code: listen for an event')}
    </section>

    <section aria-labelledby="all-title">
      <h2 id="all-title">${t('all')}</h2>
      <p>${t('allp')}</p>
      <div class="filter" hidden>
        <label for="filter">${t('filter')}</label>
        <p id="filter-hint" class="hint">${t('filterHint')}</p>
        <input type="search" id="filter" aria-describedby="filter-hint" autocomplete="off" spellcheck="false">
        <p id="filter-status" class="filter-status" role="status"></p>
      </div>
${groups}
      <p class="no-match" id="no-match" hidden></p>
    </section>`;
  return layout({
    file: 'index.html', title: CHROME.site[0], titleAm: CHROME.site[1],
    heading: t('site'), body,
  });
}

// --------------------------------------------------------- component page
function componentPage(c) {
  const g = groupOf(c.group);
  const attrRows = c.attributes.map(([name, values, def, meaning]) => [
    name.split(', ').map((n) => n.startsWith('(') ? md(n) : `<code>${esc(n)}</code>`).join(', '),
    values ? md(values) : '—', def ? md(def) : '—', md(meaning),
  ]);
  const eventRows = c.events.map(([name, detail, when]) => [`<code>${esc(name.split(' (')[0])}</code>${name.includes(' (') ? ' ' + md('(' + name.split(' (').slice(1).join(' (')) : ''}`, md(detail), md(when)]);
  const methodRows = (c.methods || []).map(([name, meaning]) => [`<code>${esc(name)}</code>`, md(meaning)]);
  const related = c.related.filter((r) => byTag.has(r)).map((r) => `        <li><a href="${r}.html">${tagName(r)}: ${esc(byTag.get(r).name)}</a></li>`).join('\n');

  const body = `    <p class="lead">${md(c.name)}. ${md(c.summary)}</p>
    <p><strong>${t('helps')}</strong> ${md(c.helps)}</p>

    <section aria-labelledby="live-title">
      <h2 id="live-title">${t('live')}</h2>
      <p>${t('liveIntro')}${c.liveNote ? ' ' + md(c.liveNote) : ''}</p>
      <div class="live-example">
${c.live}
      </div>
    </section>

    <section aria-labelledby="code-title">
      <h2 id="code-title">${t('code')}</h2>
${codeBlock(c.example, `Code: ${c.tag} example`)}
      <p class="source">Source: <code>${esc(c.source)}</code></p>
    </section>

    <section aria-labelledby="attributes-title">
      <h2 id="attributes-title">${t('attributes')}</h2>
${attrRows.length ? table(`Attributes of <${c.tag}>`, ['Attribute', 'Values', 'Default', 'Meaning'], attrRows) : '      <p>None.</p>'}
    </section>

    <section aria-labelledby="events-title">
      <h2 id="events-title">${t('events')}</h2>
${eventRows.length ? table(`Events sent by <${c.tag}>`, ['Event', 'event.detail', 'When'], eventRows) : `      <p>${md(c.eventsNote || 'None.')}</p>`}
${eventRows.length ? '      <p>Events bubble and carry no personal data. Listen with <code>addEventListener</code>, like any DOM event.</p>' : ''}
    </section>
${methodRows.length ? `
    <section aria-labelledby="methods-title">
      <h2 id="methods-title">${t('methods')}</h2>
${table(`Methods and properties of <${c.tag}>`, ['Name', 'Meaning'], methodRows)}
    </section>
` : ''}
    <section aria-labelledby="keyboard-title">
      <h2 id="keyboard-title">${t('keyboard')}</h2>
      <ul>
${c.keyboard.map((k) => `        <li>${md(k)}</li>`).join('\n')}
      </ul>
    </section>

    <section aria-labelledby="languages-title">
      <h2 id="languages-title">${t('languages')}</h2>
      <p>${md(c.languages)}</p>
    </section>

    <section aria-labelledby="a11y-title">
      <h2 id="a11y-title">${t('a11y')}</h2>
      <ul>
${c.wcag.map(([crit, note]) => `        <li><strong>${md(crit)}:</strong> ${md(note)}</li>`).join('\n')}
${(c.notes || []).map((n) => `        <li>${md(n)}</li>`).join('\n')}
      </ul>
      <p><a href="https://github.com/y0hannesHK/fidel-alx-hackathon/blob/main/CONFORMANCE.md">The full WCAG 2.2 AA conformance report</a></p>
    </section>

    <section aria-labelledby="related-title">
      <h2 id="related-title">${t('related')}</h2>
      <ul>
${related}
      </ul>
    </section>

    <p class="back"><a href="./">${t('back')}</a></p>`;
  return layout({
    file: `${c.tag}.html`,
    title: `<${c.tag}>: ${c.name} | ${CHROME.site[0]}`,
    titleAm: `<${c.tag}> | ${CHROME.site[1]}`,
    heading: tagName(c.tag),
    crumbs: [
      ['./', t('docsHome')],
      [`./#group-${g.id}`, `<span class="en">${esc(g.name)}</span><span class="am" lang="am">${esc(g.am)}</span>`],
      [`${c.tag}.html`, tagName(c.tag)],
    ],
    body, loadsFidel: true,
  });
}

// ------------------------------------------------------------------ write
for (const c of COMPONENTS) {
  if (!GROUPS.some((g) => g.id === c.group)) throw new Error(`${c.tag}: unknown group ${c.group}`);
  for (const r of c.related) if (!byTag.has(r)) throw new Error(`${c.tag}: related tag ${r} has no entry`);
}
// Remove pages of components that are gone.
for (const name of readdirSync(OUT)) {
  if (/^fidel-.*\.html$/.test(name) && !byTag.has(name.slice(0, -5))) unlinkSync(join(OUT, name));
}
codeCount = 0;
writeFileSync(join(OUT, 'index.html'), indexPage());
for (const c of COMPONENTS) {
  codeCount = 0;
  writeFileSync(join(OUT, `${c.tag}.html`), componentPage(c));
}
console.log(`Wrote ${COMPONENTS.length + 1} pages to demo/docs/.`);
