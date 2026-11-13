// One lesson in Studio: progress, publish, preview, captions, chapters,
// audio description and sign-language video.
import { api, uploadWithProgress } from './api.js';
import { captionEditor } from './caption-editor.js';
import { rowsEditor } from './rows-editor.js';
import { h, say, uid } from './util.js';

const STEP_LABELS = {
  extract_audio: 'Extract audio',
  renditions: 'Make web videos (and low-data and audio-only versions)',
  transcribe: 'English captions (speech-to-text)',
  translate: 'Amharic draft captions (machine translation)',
  sign_video: 'Sign-language video',
};
const STATUS_LABELS = { pending: 'Waiting', running: 'Running…', done: 'Done', failed: 'Failed', skipped: 'Skipped' };

export async function lessonPage(main, lessonId) {
  let manifest = await api(`/api/v1/lessons/${lessonId}`);
  document.title = `${manifest.title} – Fidel Studio`;

  // "Use video time" buttons use whichever video staff played last.
  let lastVideo = null;
  main.addEventListener('timeupdate', (e) => (lastVideo = e.target), true);
  const videoTime = () => Math.round((lastVideo?.currentTime || 0) * 10) / 10;

  const heading = h('h1', { tabindex: '-1' }, manifest.title);
  main.replaceChildren(
    h('p', {}, h('a', { href: '#/' }, '← All lessons')),
    heading,
    progressSection(lessonId, manifest, async () => {
      manifest = await api(`/api/v1/lessons/${lessonId}`);
      refreshPreview();
    }),
    publishSection(lessonId, manifest)
  );

  // Preview: the lesson exactly as learners will see it.
  const previewSlot = h('div');
  const previewSection = h('section', { class: 'card', 'aria-labelledby': 'preview-heading' },
    h('h2', { id: 'preview-heading' }, 'Preview'),
    h('p', {}, 'This is what learners see, with your saved changes.'),
    previewSlot);
  main.append(previewSection);
  function refreshPreview() {
    if (!manifest.video.mp4 && !manifest.video.webm) {
      previewSlot.replaceChildren(h('p', {}, 'The video is still being prepared.'));
      return;
    }
    const player = document.createElement('fidel-player');
    player.id = 'studio-preview';
    const attrs = {
      src: manifest.video.mp4 || manifest.video.webm,
      'src-webm': manifest.video.webm,
      sign: manifest.sign,
      'chapters-en': manifest.chapters.en,
      'chapters-am': manifest.chapters.am,
      'descriptions-en': manifest.descriptions.en,
      'descriptions-am': manifest.descriptions.am,
      'src-small': manifest.video.small_mp4,
      'description-recordings': Object.keys(manifest.description_recordings).length
        ? JSON.stringify(manifest.description_recordings) : null,
    };
    for (const track of manifest.captions) {
      attrs[`captions-${track.lang}`] = `${track.url}?v=${Date.now()}`; // skip the browser cache after edits
      attrs[`captions-${track.lang}-status`] = track.status;
    }
    for (const [name, value] of Object.entries(attrs)) if (value) player.setAttribute(name, value);
    previewSlot.replaceChildren(player);
  }
  refreshPreview();

  const captions = await captionEditor(lessonId, manifest);
  main.append(captions);
  main.addEventListener('captions-saved', async () => {
    manifest = await api(`/api/v1/lessons/${lessonId}`);
    refreshPreview();
  });

  main.append(await chaptersSection(lessonId, videoTime, async () => {
    manifest = await api(`/api/v1/lessons/${lessonId}`);
    refreshPreview();
  }));
  main.append(await descriptionsSection(lessonId, videoTime, async () => {
    manifest = await api(`/api/v1/lessons/${lessonId}`);
    refreshPreview();
  }));
  main.append(signSection(lessonId, manifest));
  heading.focus();
}

// --- Progress and "run again" --------------------------------------------------

function progressSection(lessonId, manifest, onChange) {
  const live = h('p', { class: 'status', role: 'status' });
  const list = h('ul', { class: 'steps' });
  let previous = {};

  function render(steps) {
    list.replaceChildren(...Object.keys(STEP_LABELS).filter((name) => steps[name]).map((name) => {
      const step = steps[name];
      return h('li', { class: `step ${step.status}` },
        h('span', { class: 'step-name' }, STEP_LABELS[name]),
        h('span', { class: 'step-status' }, STATUS_LABELS[step.status] || step.status),
        step.message && h('span', { class: 'step-message' }, step.message));
    }));
  }

  async function poll() {
    let steps;
    try {
      steps = await api(`/api/v1/lessons/${lessonId}/status`);
    } catch {
      return setTimeout(poll, 5000);
    }
    // Announce only what changed, so screen readers are not flooded.
    const changes = Object.entries(steps)
      .filter(([name, s]) => previous[name] && previous[name].status !== s.status && s.status !== 'pending')
      .map(([name, s]) => `${STEP_LABELS[name]}: ${STATUS_LABELS[s.status]}.`);
    if (changes.length) say(live, changes.join(' '));
    if (changes.length && Object.values(steps).every((s) => !['pending', 'running'].includes(s.status))) onChange();
    previous = steps;
    render(steps);
    if (Object.values(steps).some((s) => ['pending', 'running'].includes(s.status))) setTimeout(poll, 3000);
  }
  render(manifest.steps);
  previous = manifest.steps;
  poll();

  // Run steps again (e.g. after downloading a model).
  const boxes = Object.entries(STEP_LABELS).map(([name, label]) => {
    const id = uid('step');
    return h('div', { class: 'check' }, h('input', { type: 'checkbox', id, value: name }), h('label', { for: id }, label));
  });
  const runAgain = h('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      const chosen = [...runAgain.querySelectorAll('input:checked')].map((i) => i.value);
      if (!chosen.length) return say(live, 'Choose at least one step to run again.');
      try {
        render(await api(`/api/v1/lessons/${lessonId}/rebuild`, { method: 'POST', json: { steps: chosen } }));
        say(live, 'Started. Progress is shown above.');
        setTimeout(poll, 1000);
      } catch (error) {
        say(live, `Could not start: ${error.message}`);
      }
    },
  },
  h('fieldset', {}, h('legend', {}, 'Run steps again'), boxes),
  h('p', { class: 'hint' }, 'Captions a person has checked are never replaced.'),
  h('button', { type: 'submit', class: 'button secondary' }, 'Run chosen steps'));

  return h('section', { class: 'card', 'aria-labelledby': 'progress-heading' },
    h('h2', { id: 'progress-heading' }, 'Progress'), list, live,
    h('details', {}, h('summary', {}, 'Run steps again'), runAgain));
}

// --- Publish ------------------------------------------------------------------------

function publishSection(lessonId, manifest) {
  const status = h('p', { class: 'status', role: 'status' });
  const state = h('p', {});
  const button = h('button', { type: 'button', class: 'button' });
  let published = manifest.published;
  const amDraft = manifest.captions.some((c) => c.lang === 'am' && c.status === 'draft');

  function render() {
    state.textContent = published
      ? 'Published: learners can open this lesson.'
      : 'Not published: only staff can see this lesson.';
    button.textContent = published ? 'Unpublish' : 'Publish';
  }
  button.addEventListener('click', async () => {
    try {
      const result = await api(`/api/v1/lessons/${lessonId}/publish`, { method: 'POST', json: { published: !published } });
      published = result.published;
      render();
      say(status, published
        ? `Published.${amDraft ? ' Note: the Amharic captions are still a draft, so learners see the "not yet reviewed" notice.' : ''}`
        : 'Unpublished.');
    } catch (error) {
      say(status, `Could not change: ${error.message}`);
    }
  });
  render();
  return h('section', { class: 'card', 'aria-labelledby': 'publish-heading' },
    h('h2', { id: 'publish-heading' }, 'Publish'),
    state,
    h('div', { class: 'row' }, button,
      h('a', { href: `/demo/savanna-mock/lesson.html?id=${lessonId}`, class: 'button secondary' }, 'Open learner page')),
    status);
}

// --- Chapters -----------------------------------------------------------------------

async function chaptersSection(lessonId, videoTime, onSaved) {
  const { chapters } = await api(`/api/v1/lessons/${lessonId}/chapters`);
  return rowsEditor({
    heading: 'Chapters',
    intro: 'Chapters let learners jump to a part of the lesson. Give each an English and an Amharic title; the Amharic chapter list is used only when every chapter has an Amharic title.',
    itemName: 'Chapter',
    emptyText: 'No chapters yet.',
    addLabel: 'Add chapter',
    saveLabel: 'Save chapters',
    fields: [
      { key: 'start', label: 'Start', kind: 'time' },
      { key: 'title_en', label: 'English title', kind: 'text', lang: 'en' },
      { key: 'title_am', label: 'Amharic title', kind: 'text', lang: 'am', optional: true },
    ],
    rows: chapters,
    newRow: (time) => ({ start: time, title_en: '', title_am: '' }),
    getVideoTime: videoTime,
    save: async (rows) => {
      const body = rows.map((r) => ({ start: r.start, title_en: r.title_en.trim(), title_am: r.title_am?.trim() || null }));
      await api(`/api/v1/lessons/${lessonId}/chapters`, { method: 'PUT', json: { chapters: body } });
      onSaved();
      const missing = body.filter((c) => !c.title_am).length;
      return missing
        ? `Saved. ${missing} chapter(s) have no Amharic title, so learners see English chapter titles.`
        : 'Saved in English and Amharic.';
    },
  });
}

// --- Audio description ----------------------------------------------------------------

async function descriptionsSection(lessonId, videoTime, onSaved) {
  const wrapper = h('div');
  const editors = {};
  for (const [lang, name] of [['en', 'English'], ['am', 'Amharic']]) {
    const { cues } = await api(`/api/v1/lessons/${lessonId}/descriptions/${lang}`);
    editors[lang] = rowsEditor({
      heading: `Audio description (${name})`,
      intro: lang === 'en'
        ? 'Describe what is shown on screen but not said aloud (slides, code, actions). Each description is read out at its time.'
        : null,
      itemName: 'Description',
      emptyText: 'No descriptions yet.',
      addLabel: 'Add description',
      saveLabel: `Save ${name} descriptions`,
      fields: [
        { key: 'start', label: 'Start', kind: 'time' },
        { key: 'end', label: 'End', kind: 'time' },
        { key: 'text', label: 'Description', kind: 'text', lang, long: true },
      ],
      rows: cues,
      newRow: (time) => ({ start: time, end: time + 4, text: '' }),
      getVideoTime: videoTime,
      save: async (rows) => {
        const body = rows.map((r) => ({ start: r.start, end: r.end, text: r.text.trim() }));
        const saved = await api(`/api/v1/lessons/${lessonId}/descriptions/${lang}`, { method: 'PUT', json: { cues: body } });
        onSaved();
        return { message: `Saved ${body.length} ${name} description(s).`, rows: saved.cues };
      },
      // A recording of each description being read aloud. Needed for Amharic:
      // most phones have no Amharic voice to read the text.
      extra: (row, { status, rerender }) => recordingControls(lessonId, lang, row, status, rerender, onSaved),
    });
    wrapper.append(editors[lang]);
  }
  return wrapper;
}

function recordingControls(lessonId, lang, row, status, rerender, onSaved) {
  const url = (start) => `/api/v1/lessons/${lessonId}/descriptions/${lang}/recording?start=${start}`;
  if (row.has_recording === undefined) {
    return h('p', { class: 'hint' }, 'Save the descriptions first; then you can add a recording of this one.');
  }
  if (row.has_recording) {
    return h('div', { class: 'row' },
      h('span', {}, '✓ Recording attached.'),
      h('button', {
        type: 'button', class: 'button secondary small',
        onclick: async () => {
          await api(url(row.start), { method: 'DELETE' });
          row.has_recording = false;
          rerender();
          onSaved();
          say(status, 'Recording removed.');
        },
      }, 'Remove recording'));
  }
  const id = uid('recording');
  const input = h('input', { type: 'file', id, accept: 'audio/*,video/*' });
  return h('div', { class: 'field' },
    h('label', { for: id }, 'Recording of this description (optional)'),
    h('div', { class: 'row' }, input,
      h('button', {
        type: 'button', class: 'button secondary small',
        onclick: async () => {
          if (!input.files[0]) return say(status, 'Choose a recording first.');
          const form = new FormData();
          form.append('audio', input.files[0]);
          say(status, 'Uploading recording…');
          try {
            await uploadWithProgress(url(row.start), form, () => {});
            row.has_recording = true;
            rerender();
            onSaved();
            say(status, 'Recording attached.');
          } catch (error) {
            say(status, `Recording not attached: ${error.message}`);
          }
        },
      }, 'Attach recording')));
}

// --- Sign language video ----------------------------------------------------------------

function signSection(lessonId, manifest) {
  const fileId = uid('sign-file');
  const status = h('p', { class: 'status', role: 'status' });
  const progress = h('progress', { max: 1, value: 0, hidden: true, 'aria-label': 'Upload progress' });
  const form = h('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      const file = form.querySelector('input[type=file]').files[0];
      if (!file) return say(status, 'Choose a video file first.');
      const data = new FormData();
      data.append('video', file);
      progress.hidden = false;
      say(status, 'Uploading…');
      try {
        await uploadWithProgress(`/api/v1/lessons/${lessonId}/sign`, data, (p) => (progress.value = p));
        say(status, 'Uploaded. It is being prepared: follow "Sign-language video" under Progress. Reload this page when it is done to preview it.');
      } catch (error) {
        say(status, `Not uploaded: ${error.message}`);
      } finally {
        progress.hidden = true;
      }
    },
  },
  h('label', { for: fileId }, 'Sign-language video file'),
  h('input', { type: 'file', id: fileId, accept: 'video/*' }),
  h('button', { type: 'submit', class: 'button' }, 'Upload sign-language video'),
  progress);
  return h('section', { class: 'card', 'aria-labelledby': 'sign-heading' },
    h('h2', { id: 'sign-heading' }, 'Sign-language video'),
    h('p', {}, manifest.sign
      ? 'This lesson has a sign-language video. Check it in the preview above: it must stay in time with the lesson.'
      : 'No sign-language video yet. Record the interpreter so the video starts at exactly the same moment as the lesson video.'),
    form, status);
}
