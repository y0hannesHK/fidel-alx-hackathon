// Caption editor: the video on one side, the list of captions on the other.
//
// Each caption shows its time, the English text and the Amharic text, both
// editable, a "Play this caption" button and an "Amharic checked" box.
// Machine Amharic stays a draft until a person ticks "checked" for every
// caption; only then does the player stop showing the draft notice.
//
// Shortcut (with a visible button for each): in an Amharic box,
// Ctrl+Enter = "Checked, go to next".
import { api } from './api.js';
import { formatTime, h, say, uid } from './util.js';

export async function captionEditor(lessonId, manifest) {
  const languages = manifest.captions.map((c) => c.lang);
  const section = h('section', { class: 'card', 'aria-labelledby': 'captions-heading' },
    h('h2', { id: 'captions-heading' }, 'Captions'));
  if (!languages.length) {
    section.append(h('p', {}, 'No captions yet. They appear here when the "transcribe" step is done.'));
    return section;
  }

  // Load both languages. They share timings (the Amharic is translated cue by cue).
  const load = async (lang) => (languages.includes(lang) ? api(`/api/v1/lessons/${lessonId}/captions/${lang}/cues`) : null);
  const [english, amharic] = await Promise.all([load('en'), load('am')]);
  const base = english || amharic;
  const rows = base.cues.map((cue, i) => ({
    start: cue.start,
    end: cue.end,
    en: english?.cues[i] ? { ...english.cues[i] } : null,
    am: amharic?.cues[i] ? { ...amharic.cues[i] } : null,
  }));

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

  function draftsLeft() {
    return rows.filter((r) => r.am && !r.am.reviewed).length;
  }
  function updateCounter() {
    const left = draftsLeft();
    counter.textContent = amharic
      ? left === 0
        ? 'All Amharic captions are checked.'
        : `${left} of ${rows.length} Amharic captions still to check.`
      : 'No Amharic captions yet.';
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
  const amharicBoxes = [];
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
      let checkbox = null;
      if (row.am) {
        const id = uid('am');
        const box = h('textarea', {
          id, lang: 'am', rows: 2, value: row.am.text,
          'aria-describedby': legendId,
          oninput: (e) => { row.am.text = e.target.value; markDirty(); },
          onkeydown: (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
              e.preventDefault();
              checkAndNext(i);
            }
          },
        });
        amharicBoxes[i] = box;
        const checkId = uid('check');
        checkbox = h('input', {
          type: 'checkbox', id: checkId, checked: row.am.reviewed,
          onchange: (e) => { row.am.reviewed = e.target.checked; markDirty(); },
        });
        row.checkbox = checkbox;
        fields.push(
          h('label', { for: id }, 'Amharic ', h('span', { lang: 'am' }, '(አማርኛ)')),
          box,
          h('div', { class: 'check' }, checkbox, h('label', { for: checkId }, 'Amharic checked'))
        );
      }
      return h('li', {},
        h('fieldset', { class: 'cue' },
          h('legend', { id: legendId }, `Caption ${i + 1}, ${time}`),
          h('div', { class: 'row' },
            h('button', { type: 'button', class: 'button secondary', onclick: () => playRow(row) }, 'Play this caption'),
            row.am && h('button', { type: 'button', class: 'button secondary', onclick: () => checkAndNext(i) }, 'Checked, go to next')
          ),
          fields
        )
      );
    })
  );

  function checkAndNext(i) {
    const row = rows[i];
    if (!row.am) return;
    row.am.reviewed = true;
    row.checkbox.checked = true;
    markDirty();
    const next = amharicBoxes.findIndex((box, j) => j > i && box && !rows[j].am.reviewed);
    if (next !== -1) {
      amharicBoxes[next].focus();
      amharicBoxes[next].scrollIntoView({ block: 'center' });
    } else {
      say(status, 'That was the last Amharic caption to check. Remember to save.');
    }
  }

  // --- Toolbar -------------------------------------------------------------
  async function save() {
    say(status, 'Saving…');
    try {
      const results = [];
      for (const lang of ['en', 'am']) {
        const cues = rows.filter((r) => r[lang]).map((r) => ({ start: r.start, end: r.end, ...r[lang] }));
        if (!cues.length) continue;
        results.push(await api(`/api/v1/lessons/${lessonId}/captions/${lang}`, { method: 'PUT', json: { cues } }));
      }
      dirty = false;
      updateCounter();
      const am = results.find((r) => r.lang === 'am');
      say(status, am
        ? `Saved. Amharic captions are ${am.status === 'reviewed' ? 'fully checked: learners no longer see the draft notice' : `still a draft (${am.drafts_left} to check)`}.`
        : 'Saved.');
      section.dispatchEvent(new CustomEvent('captions-saved', { bubbles: true }));
    } catch (error) {
      say(status, `Not saved: ${error.message}`);
    }
  }

  function markAll() {
    if (!window.confirm('Mark every Amharic caption as checked? Only do this after reading them all.')) return;
    for (const row of rows) {
      if (row.am) {
        row.am.reviewed = true;
        row.checkbox.checked = true;
      }
    }
    markDirty();
    say(status, 'All Amharic captions marked as checked. Remember to save.');
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
  section.append(
    h('p', { class: 'hint' }, 'Tip: in an Amharic box, press Ctrl+Enter for "Checked, go to next".'),
    h('div', { class: 'toolbar' },
      counter,
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'button', onclick: save }, 'Save captions'),
        amharic && h('button', { type: 'button', class: 'button secondary', onclick: markAll }, 'Mark all Amharic as checked')
      ),
      englishChecked,
      status
    ),
    h('div', { class: 'editor' }, h('div', { class: 'editor-video-wrap' }, video), list)
  );
  return section;
}
