// Sound-off check on a lesson's Studio page (Package D, D3).
//
// Deaf learners need every sound that carries meaning as a caption, such as
// [music] or [door closes] (Technical Guide, Track 2 step 6). Speech-to-text
// writes only words, so a person must add them. This panel:
//   - counts captions with a sound description in [brackets], per language;
//   - lists silent gaps longer than 3 seconds between captions, each with
//     "Add a sound caption here" (saved as a new caption in every language
//     through the normal caption API: PUT /api/v1/lessons/{id}/captions/{lang});
//   - has a "Sound-off check done" box per lesson, shown on the lesson list.
//     It warns but never blocks publishing. It is remembered in this browser
//     only (localStorage), not on the server.
//
// Hooked in with one line each:
//   lesson.js: main.append(await (await import('./sound-check.js')).soundCheckSection(lessonId, manifest));
//   main.js:   (await import('./sound-check.js')).markLessonList(main);
import { api } from './api.js';
import { formatTime, h, parseTime, say, uid } from './util.js';

export const MIN_GAP_SECONDS = 3;

// ---------------------------------------------------------------------------
// Pure logic (unit-tested in player/test/components-d.test.js)

/** True if the caption contains a sound description in square brackets, like [music]. */
export function hasSoundDescription(textValue) {
  return /\[[^\]\n]*\S[^\]\n]*\]/.test(textValue || '');
}

/** How many captions contain a sound description. */
export function countSoundDescriptions(cues) {
  return cues.filter((cue) => hasSoundDescription(cue.text)).length;
}

/**
 * Silent gaps longer than minGap seconds: [{ start, end }], before the first
 * caption, between captions (overlaps handled) and, if the video length is
 * known, after the last one.
 */
export function findGaps(cues, { minGap = MIN_GAP_SECONDS, duration = null } = {}) {
  const sorted = [...cues].sort((a, b) => a.start - b.start);
  const gaps = [];
  let coveredUntil = 0;
  for (const cue of sorted) {
    if (cue.start - coveredUntil > minGap) gaps.push({ start: coveredUntil, end: cue.start });
    coveredUntil = Math.max(coveredUntil, cue.end);
  }
  if (duration && duration - coveredUntil > minGap) gaps.push({ start: coveredUntil, end: duration });
  return gaps.map((gap) => ({ start: round(gap.start), end: round(gap.end) }));
}

/** Insert a cue in time order (other cues and their review state unchanged). */
export function insertCue(cues, cue) {
  return [...cues, cue].sort((a, b) => a.start - b.start);
}

const round = (seconds) => Math.round(seconds * 10) / 10;

// ---------------------------------------------------------------------------
// "Sound-off check done", remembered in this browser.

const DONE_KEY = 'fidel-sound-check-done';

function doneLessons() {
  try {
    return JSON.parse(localStorage.getItem(DONE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function setDone(lessonId, done) {
  const all = doneLessons();
  if (done) all[lessonId] = new Date().toISOString();
  else delete all[lessonId];
  try {
    localStorage.setItem(DONE_KEY, JSON.stringify(all));
  } catch {
    /* storage blocked: not remembered */
  }
}

/** Adds a "Sound-off check" column to the lesson list table on the home page. */
export function markLessonList(root) {
  const table = root.querySelector('table');
  if (!table || table.querySelector('.sound-check-column')) return;
  const done = doneLessons();
  table.querySelector('thead tr')?.append(h('th', { scope: 'col', class: 'sound-check-column' }, 'Sound-off check'));
  for (const row of table.querySelectorAll('tbody tr')) {
    const id = row.querySelector('a[href^="#/lesson/"]')?.getAttribute('href').split('/').pop();
    row.append(h('td', {}, done[id] ? 'Done' : 'Not yet'));
  }
}

// ---------------------------------------------------------------------------
// The panel

const LANGUAGES = { en: 'English', am: 'Amharic', om: 'Afaan Oromo' };
// Common sound descriptions: [English, Amharic]. Other languages get the
// English words, as a draft for a translator to check.
const SOUNDS = [
  ['[music]', '[ሙዚቃ]'],
  ['[laughter]', '[ሳቅ]'],
  ['[applause]', '[ጭብጨባ]'],
  ['[notification sound]', '[የማሳወቂያ ድምፅ]'],
  ['[silence]', '[ጸጥታ]'],
];

let flash = ''; // message to show after the page is drawn again

/** Length of the lesson video in seconds (null if it cannot be read). */
function videoDuration(manifest) {
  const src = manifest.video?.mp4 || manifest.video?.webm;
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    const done = (value) => {
      video.removeAttribute('src');
      video.load();
      resolve(value);
    };
    video.addEventListener('loadedmetadata', () => done(Number.isFinite(video.duration) ? video.duration : null), { once: true });
    video.addEventListener('error', () => done(null), { once: true });
    setTimeout(() => done(null), 8000);
    video.src = src;
  });
}

export async function soundCheckSection(lessonId, manifest) {
  const headingId = 'sound-check-heading';
  const heading = h('h2', { id: headingId, tabindex: '-1' }, 'Sound-off check');
  const status = h('p', { class: 'status', role: 'status' });
  const section = h('section', { class: 'card', 'aria-labelledby': headingId },
    heading,
    h('p', {}, 'Watch the lesson with the sound off. Every sound that carries meaning needs a caption in square brackets, such as [music] or [door closes], so Deaf learners get it too. Speech-to-text never writes these.'));

  const languages = manifest.captions.map((track) => track.lang);
  if (!languages.length) {
    section.append(h('p', {}, 'No captions yet: the check can start when the lesson has captions.'));
    return section;
  }
  const tracks = {};
  for (const lang of languages) {
    try {
      tracks[lang] = (await api(`/api/v1/lessons/${lessonId}/captions/${lang}/cues`)).cues;
    } catch {
      tracks[lang] = [];
    }
  }

  // Counts per language.
  section.append(h('ul', {}, languages.map((lang) => {
    const count = countSoundDescriptions(tracks[lang]);
    return h('li', {}, `${LANGUAGES[lang] || lang}: ${count} sound description${count === 1 ? '' : 's'} in ${tracks[lang].length} captions.`);
  })));

  // Silent gaps, from the spoken-language track (or the first one).
  const base = tracks.en?.length ? tracks.en : tracks[languages[0]];
  const gaps = findGaps(base, { duration: await videoDuration(manifest) });
  const gapsHeadingId = uid('gaps');
  section.append(h('h3', { id: gapsHeadingId }, `Silent gaps longer than ${MIN_GAP_SECONDS} seconds (${gaps.length})`));
  if (!gaps.length) {
    section.append(h('p', {}, 'None: there is a caption at least every 3 seconds.'));
  } else {
    section.append(h('ul', { 'aria-labelledby': gapsHeadingId, style: 'padding-inline-start: 1.25rem;' },
      gaps.map((gap) => gapItem(gap))));
  }

  // "Sound-off check done" (warns, never blocks publishing).
  const checkId = uid('sound-done');
  const box = h('input', {
    type: 'checkbox', id: checkId, checked: Boolean(doneLessons()[lessonId]),
    onchange: (e) => {
      setDone(lessonId, e.target.checked);
      note.textContent = e.target.checked ? '' : notDone;
      say(status, e.target.checked ? 'Sound-off check marked done.' : 'Sound-off check marked not done.');
    },
  });
  const notDone = 'Not done yet. You can still publish, but Deaf learners may miss sounds that matter.';
  const note = h('p', { class: 'hint' }, box.checked ? '' : notDone);
  section.append(
    h('div', { class: 'check' }, box, h('label', { for: checkId }, 'Sound-off check done for this lesson')),
    h('p', { class: 'hint' }, 'Remembered in this browser. Shown on the list of lessons.'),
    note, status);

  if (flash) {
    say(status, flash);
    flash = '';
    setTimeout(() => heading.focus(), 0);
  }
  return section;

  // --- one gap, with its "Add a sound caption here" form ----------------------
  function gapItem(gap) {
    const formId = uid('sound-form');
    const toggle = h('button', {
      type: 'button', class: 'button secondary small', 'aria-expanded': 'false', 'aria-controls': formId,
      onclick: () => {
        const open = form.hidden;
        form.hidden = !open;
        toggle.setAttribute('aria-expanded', String(open));
        if (open) form.querySelector('input').focus();
      },
    }, 'Add a sound caption here');
    const name = uid('sound');
    const otherIds = { en: uid('other-en'), am: uid('other-am') };
    const timeIds = { start: uid('sound-start'), end: uid('sound-end') };
    const formStatus = h('p', { class: 'status', role: 'status' });
    const choices = [...SOUNDS, ['other', '']].map(([en, am]) => {
      const id = uid('sound-choice');
      return h('div', { class: 'check' },
        h('input', { type: 'radio', id, name, value: en, checked: en === '[music]', style: 'width: 1.5rem; height: 1.5rem; margin: 0;' }),
        h('label', { for: id }, en === 'other' ? 'Other (write it below)' : [en, ' / ', h('span', { lang: 'am' }, am)]));
    });
    const form = h('form', {
      id: formId, hidden: true,
      onsubmit: async (e) => {
        e.preventDefault();
        const choice = form.querySelector(`input[name="${name}"]:checked`).value;
        const start = parseTime(form.querySelector(`#${timeIds.start}`).value);
        const end = parseTime(form.querySelector(`#${timeIds.end}`).value);
        let texts;
        if (choice === 'other') {
          const en = form.querySelector(`#${otherIds.en}`).value.trim();
          const am = form.querySelector(`#${otherIds.am}`).value.trim();
          if (!en) return say(formStatus, 'Write the sound in English, in square brackets, for example [door closes].');
          texts = { en: bracket(en), am: am ? bracket(am) : null };
        } else {
          texts = Object.fromEntries([SOUNDS.find(([en]) => en === choice)].map(([en, am]) => [['en', en], ['am', am]]).flat());
        }
        if (!(start >= 0) || !(end > start)) return say(formStatus, 'Write a start time and an end time after it (minutes:seconds, like 1:23.5).');
        if (/unsaved changes/.test(document.querySelector('.counter')?.textContent || '')) {
          return say(formStatus, 'Not saved: the caption editor above has unsaved changes. Save them first.');
        }
        say(formStatus, 'Saving…');
        try {
          const saved = [];
          for (const lang of languages) {
            const fresh = (await api(`/api/v1/lessons/${lessonId}/captions/${lang}/cues`)).cues;
            // Amharic needs its own words; without them it gets the English as a draft to translate.
            const textForLang = texts[lang] || texts.en;
            const reviewed = lang === 'en' || Boolean(texts[lang]);
            await api(`/api/v1/lessons/${lessonId}/captions/${lang}`, {
              method: 'PUT', json: { cues: insertCue(fresh, { start, end, text: textForLang, reviewed }) },
            });
            saved.push(LANGUAGES[lang] || lang);
          }
          flash = `Sound caption added at ${formatTime(start)} in ${saved.join(', ')}.`;
          // Draw the lesson page again so the caption editor shows the new caption.
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        } catch (error) {
          say(formStatus, `Not saved: ${error.message}`);
        }
      },
    },
    h('fieldset', {}, h('legend', {}, 'Which sound?'), choices),
    h('div', { class: 'field' }, h('label', { for: otherIds.en }, 'Other sound, in English'),
      h('input', { id: otherIds.en, type: 'text', lang: 'en', maxlength: 100 })),
    h('div', { class: 'field' }, h('label', { for: otherIds.am }, 'Other sound, in Amharic (optional)'),
      h('input', { id: otherIds.am, type: 'text', lang: 'am', maxlength: 100 })),
    h('div', { class: 'row' },
      h('div', { class: 'field time' }, h('label', { for: timeIds.start }, 'Start'),
        h('input', { id: timeIds.start, type: 'text', inputmode: 'decimal', value: formatTime(gap.start) })),
      h('div', { class: 'field time' }, h('label', { for: timeIds.end }, 'End'),
        h('input', { id: timeIds.end, type: 'text', inputmode: 'decimal', value: formatTime(Math.min(gap.end, gap.start + 3)) }))),
    h('p', { class: 'hint' }, `Saved as a new caption in ${languages.map((l) => LANGUAGES[l] || l).join(', ')}.`
      + (languages.some((l) => !['en', 'am'].includes(l)) ? ' Other languages get the English words as a draft to translate.' : '')),
    h('button', { type: 'submit', class: 'button' }, 'Save sound caption'),
    formStatus);

    return h('li', { style: 'margin-bottom: 0.75rem;' },
      h('p', { style: 'margin: 0 0 0.25rem;' },
        `${formatTime(gap.start)} to ${formatTime(gap.end)}: no caption. Is there a sound that matters here, such as music or a notification sound?`),
      toggle, form);
  }
}

const bracket = (value) => (/^\[.*\]$/.test(value) ? value : `[${value.replace(/^\[|\]$/g, '')}]`);
