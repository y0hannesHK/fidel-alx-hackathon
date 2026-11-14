// Caption editor: the video on one side, the list of captions on the other.
//
// Each caption shows its time, the English text and each translation
// (Amharic, Afaan Oromo), all editable, a "Play this caption" button and a
// "checked" box per translation. Machine translations stay drafts until a
// person ticks "checked" for every caption; only then does the player stop
// showing the draft notice for that language.
//
// Shortcut (with a visible button for each): in a translation box,
// Ctrl+Enter = "Checked, go to next" for that language.
import { api } from './api.js';
import { formatTime, h, say, uid } from './util.js';

// Translated caption languages, in the order they are shown.
const TRANSLATIONS = [
  { code: 'am', name: 'Amharic', native: 'አማርኛ' },
  { code: 'om', name: 'Afaan Oromo', native: 'Afaan Oromoo' },
];

export async function captionEditor(lessonId, manifest) {
  const languages = manifest.captions.map((c) => c.lang);
  const section = h('section', { class: 'card', 'aria-labelledby': 'captions-heading' },
    h('h2', { id: 'captions-heading' }, 'Captions'));
  if (!languages.length) {
    section.append(h('p', {}, 'No captions yet. They appear here when the "transcribe" step is done.'));
    return section;
  }

  // Load every language. They share timings (translations are made cue by cue).
  const load = async (lang) => (languages.includes(lang) ? api(`/api/v1/lessons/${lessonId}/captions/${lang}/cues`) : null);
  const [english, glossary, ...translated] = await Promise.all([
    load('en'), api('/api/v1/glossary').catch(() => ({ terms: [] })), ...TRANSLATIONS.map((t) => load(t.code)),
  ]);
  const loaded = Object.fromEntries(TRANSLATIONS.map((t, i) => [t.code, translated[i]]));
  const targets = TRANSLATIONS.filter((t) => loaded[t.code]);

  // Glossary words in a caption's English text (word match; also plurals and -ed/-ing).
  const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = glossary.terms.map((term) => ({ term, re: new RegExp(`\\b${escape(term.en)}(s|es|d|ed|ing)?\\b`, 'i') }));
  const glossaryWords = (text) => patterns.filter(({ re }) => re.test(text || '')).map(({ term }) => term);

  const base = english || loaded[targets[0]?.code];
  const rows = base.cues.map((cue, i) => {
    const row = { start: cue.start, end: cue.end, en: english?.cues[i] ? { ...english.cues[i] } : null, checks: {} };
    for (const t of targets) row[t.code] = loaded[t.code].cues[i] ? { ...loaded[t.code].cues[i] } : null;
    return row;
  });

  const status = h('p', { class: 'status', role: 'status' });
  const counter = h('p', { class: 'counter' });
  let dirty = false;
  const markDirty = () => {
    dirty = true;
    updateCounter();
  };
  window.addEventListener('beforeunload', (event) => {
    if (dirty) event.preventDefault(); // browser asks "leave with unsaved changes?"
  });

  function draftsLeft(code) {
    return rows.filter((r) => r[code] && !r[code].reviewed).length;
  }
  function updateCounter() {
    counter.textContent = targets.length
      ? targets.map((t) => {
        const left = draftsLeft(t.code);
        return left === 0 ? `All ${t.name} captions are checked.` : `${left} of ${rows.length} ${t.name} captions still to check.`;
      }).join(' ')
      : 'No translated captions yet.';
    if (dirty) counter.textContent += ' You have unsaved changes.';
  }

  // --- Video on the left ---------------------------------------------------
  const video = h('video', { controls: true, preload: 'metadata', class: 'editor-video', crossorigin: 'anonymous' });
  if (manifest.video.webm) video.append(h('source', { src: manifest.video.webm, type: 'video/webm' }));
  if (manifest.video.mp4) video.append(h('source', { src: manifest.video.mp4, type: 'video/mp4' }));
  let stopAt = null;
  video.addEventListener('timeupdate', () => {
    if (stopAt !== null && video.currentTime >= stopAt) {
      video.pause();
      stopAt = null;
    }
  });
  function playRow(row) {
    video.currentTime = row.start;
    stopAt = row.end;
    video.play();
  }

  // --- Caption list on the right -------------------------------------------
  const boxes = Object.fromEntries(targets.map((t) => [t.code, []]));
  const list = h('ol', { class: 'cue-list' },
    rows.map((row, i) => {
      const legendId = uid('cue');
      const time = `${formatTime(row.start)} to ${formatTime(row.end)}`;
      const fields = [];
      if (row.en) {
        const id = uid('en');
        fields.push(
          h('label', { for: id }, 'English'),
          h('textarea', {
            id, lang: 'en', rows: 2, value: row.en.text,
            'aria-describedby': legendId,
            oninput: (e) => { row.en.text = e.target.value; markDirty(); },
          })
        );
      }
      const nextButtons = [];
      for (const t of targets) {
        if (!row[t.code]) continue;
        const id = uid(t.code);
        const box = h('textarea', {
          id, lang: t.code, rows: 2, value: row[t.code].text,
          'aria-describedby': legendId,
          oninput: (e) => { row[t.code].text = e.target.value; markDirty(); },
          onkeydown: (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
              e.preventDefault();
              checkAndNext(i, t);
            }
          },
        });
        boxes[t.code][i] = box;
        const checkId = uid('check');
        const checkbox = h('input', {
          type: 'checkbox', id: checkId, checked: row[t.code].reviewed,
          onchange: (e) => { row[t.code].reviewed = e.target.checked; markDirty(); },
        });
        row.checks[t.code] = checkbox;
        fields.push(
          h('label', { for: id }, `${t.name} `, h('span', { lang: t.code }, `(${t.native})`)),
          box,
          h('div', { class: 'check' }, checkbox, h('label', { for: checkId }, `${t.name} checked`))
        );
        nextButtons.push(h('button', { type: 'button', class: 'button secondary', onclick: () => checkAndNext(i, t) },
          `${t.name} checked, go to next`));
      }
      const words = glossaryWords(row.en?.text);
      row.hasGlossaryWord = words.length > 0;
      return h('li', { 'data-glossary': row.hasGlossaryWord ? 'yes' : 'no' },
        h('fieldset', { class: 'cue' },
          h('legend', { id: legendId }, `Caption ${i + 1}, ${time}`),
          row.hasGlossaryWord && h('p', { class: 'glossary-note' },
            h('strong', {}, 'Check the glossary words: '),
            words.map((term, k) => [k ? '; ' : '', `"${term.en}"`,
              term.am ? [' = ', h('span', { lang: 'am' }, term.am)] : ' (no agreed Amharic yet)'])),
          h('div', { class: 'row' },
            h('button', { type: 'button', class: 'button secondary', onclick: () => playRow(row) }, 'Play this caption'),
            nextButtons),
          fields
        )
      );
    })
  );

  function checkAndNext(i, t) {
    const row = rows[i];
    if (!row[t.code]) return;
    row[t.code].reviewed = true;
    row.checks[t.code].checked = true;
    markDirty();
    const next = boxes[t.code].findIndex((box, j) => j > i && box && !rows[j][t.code].reviewed);
    if (next !== -1) {
      boxes[t.code][next].focus();
      boxes[t.code][next].scrollIntoView({ block: 'center' });
    } else {
      say(status, `That was the last ${t.name} caption to check. Remember to save.`);
    }
  }

  // --- Toolbar -------------------------------------------------------------
  async function save() {
    say(status, 'Saving…');
    try {
      const results = [];
      for (const lang of ['en', ...targets.map((t) => t.code)]) {
        const cues = rows.filter((r) => r[lang]).map((r) => ({ start: r.start, end: r.end, ...r[lang] }));
        if (!cues.length) continue;
        results.push(await api(`/api/v1/lessons/${lessonId}/captions/${lang}`, { method: 'PUT', json: { cues } }));
      }
      dirty = false;
      updateCounter();
      const parts = targets.map((t) => {
        const result = results.find((r) => r.lang === t.code);
        return result.status === 'reviewed'
          ? `${t.name} captions are fully checked: learners no longer see the draft notice.`
          : `${t.name} captions are still a draft (${result.drafts_left} to check).`;
      });
      say(status, ['Saved.', ...parts].join(' '));
      section.dispatchEvent(new CustomEvent('captions-saved', { bubbles: true }));
    } catch (error) {
      say(status, `Not saved: ${error.message}`);
    }
  }

  function markAll(t) {
    if (!window.confirm(`Mark every ${t.name} caption as checked? Only do this after reading them all.`)) return;
    for (const row of rows) {
      if (row[t.code]) {
        row[t.code].reviewed = true;
        row.checks[t.code].checked = true;
      }
    }
    markDirty();
    say(status, `All ${t.name} captions marked as checked. Remember to save.`);
  }

  let englishChecked = null;
  if (english) {
    const id = uid('en-checked');
    englishChecked = h('div', { class: 'check' },
      h('input', {
        type: 'checkbox', id, checked: english.status === 'reviewed',
        onchange: (e) => { rows.forEach((r) => r.en && (r.en.reviewed = e.target.checked)); markDirty(); },
      }),
      h('label', { for: id }, 'English captions checked'));
  }

  updateCounter();
  const glossaryCount = rows.filter((r) => r.hasGlossaryWord).length;
  const onlyId = uid('only-glossary');
  const onlyGlossary = glossaryCount > 0 && h('div', { class: 'check' },
    h('input', {
      type: 'checkbox', id: onlyId,
      onchange: (e) => {
        for (const item of list.children) item.hidden = e.target.checked && item.dataset.glossary !== 'yes';
        say(status, e.target.checked ? `Showing the ${glossaryCount} captions with glossary words.` : 'Showing all captions.');
      },
    }),
    h('label', { for: onlyId }, `Show only captions with glossary words (${glossaryCount})`));
  section.append(
    h('p', { class: 'hint' }, 'Tip: in a translation box, press Ctrl+Enter for "Checked, go to next". Captions with glossary words (words machines often get wrong) are marked: check those first.'),
    h('div', { class: 'toolbar' },
      counter,
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'button', onclick: save }, 'Save captions'),
        targets.map((t) => h('button', { type: 'button', class: 'button secondary', onclick: () => markAll(t) },
          `Mark all ${t.name} as checked`))
      ),
      englishChecked,
      onlyGlossary,
      status
    ),
    h('div', { class: 'editor' }, h('div', { class: 'editor-video-wrap' }, video), list)
  );
  return section;
}
