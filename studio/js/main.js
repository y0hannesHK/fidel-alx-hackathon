// Fidel Studio: sign in, upload lessons, list them, open one to edit.
// Pages are switched with the address hash: #/ (home) and #/lesson/ID.
import { api, ApiError, token, uploadWithProgress } from './api.js';
import { lessonPage } from './lesson.js';
import { h, say, uid } from './util.js';

const main = document.getElementById('main');
const signOut = document.getElementById('sign-out');

signOut.addEventListener('click', () => {
  token.clear();
  location.hash = '#/';
  route();
});

async function route() {
  signOut.hidden = !token.get();
  if (!token.get()) return signInPage();
  const match = location.hash.match(/^#\/lesson\/([a-f0-9]{12})$/);
  try {
    if (match) await lessonPage(main, match[1]);
    else await homePage();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      token.clear();
      return signInPage('Your staff token is no longer accepted. Please sign in again.');
    }
    main.replaceChildren(
      h('h1', { tabindex: '-1' }, 'Something went wrong'),
      h('p', { role: 'alert' }, error.message),
      h('p', {}, h('a', { href: '#/' }, 'Back to all lessons'))
    );
    main.querySelector('h1').focus();
  }
}
window.addEventListener('hashchange', route);
route();

// --- Sign in -------------------------------------------------------------------------

function signInPage(message = '') {
  document.title = 'Sign in – Fidel Studio';
  const inputId = uid('token');
  const error = h('p', { class: 'error', role: 'alert' }, message);
  const form = h('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      token.set(form.querySelector('input').value.trim());
      try {
        await api('/api/v1/staff/check');
        route();
      } catch (problem) {
        token.clear();
        error.textContent = problem.status === 401 ? 'That staff token is not right.' : problem.message;
      }
    },
  },
  h('label', { for: inputId }, 'Staff token'),
  h('input', { type: 'password', id: inputId, autocomplete: 'current-password', required: true }),
  h('button', { type: 'submit', class: 'button' }, 'Sign in'));
  main.replaceChildren(
    h('h1', { tabindex: '-1' }, 'Sign in to Fidel Studio'),
    h('p', {}, 'Use the staff token set by your administrator (FIDEL_STAFF_TOKEN). It is forgotten when you close this tab.'),
    form, error);
  form.querySelector('input').focus();
}

// --- Home: upload + list ----------------------------------------------------------------

async function homePage() {
  document.title = 'Lessons – Fidel Studio';
  const lessons = await api('/api/v1/lessons');
  main.replaceChildren(
    h('h1', { tabindex: '-1' }, 'Lessons'),
    uploadSection(),
    lessonList(lessons)
  );
  main.querySelector('h1').focus();
}

function uploadSection() {
  const ids = { title: uid('title'), lang: uid('lang'), file: uid('file') };
  const status = h('p', { class: 'status', role: 'status' });
  const progress = h('progress', { max: 1, value: 0, hidden: true, 'aria-label': 'Upload progress' });
  const form = h('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      const data = new FormData(form);
      progress.hidden = false;
      say(status, 'Uploading… you can keep this page open while it uploads.');
      try {
        const created = await uploadWithProgress('/api/v1/lessons', data, (p) => (progress.value = p));
        say(status, 'Uploaded. Processing has started.');
        location.hash = `#/lesson/${created.id}`;
      } catch (error) {
        say(status, `Not uploaded: ${error.message}`);
      } finally {
        progress.hidden = true;
      }
    },
  },
  h('div', { class: 'field' },
    h('label', { for: ids.title }, 'Lesson title'),
    h('input', { id: ids.title, name: 'title', required: true, maxlength: 200 })),
  h('div', { class: 'field' },
    h('label', { for: ids.lang }, 'Language spoken in the video'),
    h('select', { id: ids.lang, name: 'spoken_language' },
      h('option', { value: 'en' }, 'English'),
      h('option', { value: 'am', lang: 'am' }, 'አማርኛ (Amharic)'))),
  h('div', { class: 'field' },
    h('label', { for: ids.file }, 'Video file'),
    h('input', { id: ids.file, name: 'video', type: 'file', accept: 'video/*', required: true })),
  h('button', { type: 'submit', class: 'button' }, 'Upload and process'),
  progress, status);

  return h('section', { class: 'card', 'aria-labelledby': 'upload-heading' },
    h('h2', { id: 'upload-heading' }, 'Add a lesson'),
    h('p', {}, 'Fidel makes captions, an Amharic draft, and small versions for slow connections. You then check the Amharic before publishing.'),
    form);
}

function lessonList(lessons) {
  const section = h('section', { class: 'card', 'aria-labelledby': 'list-heading' },
    h('h2', { id: 'list-heading' }, 'All lessons'));
  if (!lessons.length) {
    section.append(h('p', {}, 'No lessons yet.'));
    return section;
  }
  section.append(h('table', {},
    h('thead', {}, h('tr', {},
      h('th', { scope: 'col' }, 'Title'),
      h('th', { scope: 'col' }, 'Added'),
      h('th', { scope: 'col' }, 'Published'))),
    h('tbody', {}, lessons.map((lesson) => h('tr', {},
      h('td', {}, h('a', { href: `#/lesson/${lesson.id}` }, lesson.title)),
      h('td', {}, new Date(lesson.created_at).toLocaleString()),
      h('td', {}, lesson.published ? 'Yes' : 'No'))))));
  return section;
}
