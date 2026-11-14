// Studio: jobs (schema.org/JobPosting) and certificates.
import { api, uploadWithProgress, voiceLanguages } from './api.js';
import { h, say, uid } from './util.js';
import { rowsEditor } from './rows-editor.js';

const ACCOMMODATIONS = {
  sign_language_interpreter: 'Sign language interpreter available',
  screen_reader_tools: 'Screen-reader compatible tools',
  flexible_hours: 'Flexible hours',
  step_free_access: 'Step-free access',
  remote_work: 'Remote work possible',
  captioned_meetings: 'Captioned meetings',
};
const EMPLOYMENT = {
  FULL_TIME: 'Full time', PART_TIME: 'Part time', CONTRACTOR: 'Contract',
  TEMPORARY: 'Temporary', INTERN: 'Internship', VOLUNTEER: 'Volunteer',
};

function field(label, control, hint) {
  const id = uid('f');
  control.id = id;
  return h('div', { class: 'field' }, h('label', { for: id }, label), hint && h('p', { class: 'hint' }, hint), control);
}

// --- Jobs --------------------------------------------------------------------------

export async function jobsPage(main) {
  document.title = 'Jobs – Fidel Studio';
  const [jobs, voice] = await Promise.all([api('/api/v1/jobs'), voiceLanguages()]);
  main.replaceChildren(
    h('h1', { tabindex: '-1' }, 'Jobs'),
    jobForm(main),
    jobList(jobs, voice)
  );
  main.querySelector('h1').focus();
}

function jobForm(main) {
  const status = h('p', { class: 'status', role: 'status' });
  const today = new Date().toISOString().slice(0, 10);
  const input = (name, attrs = {}) => h('input', { name, ...attrs });
  const area = (name, attrs = {}) => h('textarea', { name, rows: 3, ...attrs });
  const accommodationBoxes = Object.entries(ACCOMMODATIONS).map(([key, label]) => {
    const id = uid('acc');
    return h('div', { class: 'check' }, h('input', { type: 'checkbox', id, name: 'accommodations', value: key }), h('label', { for: id }, label));
  });
  const remoteId = uid('remote');

  const form = h('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const value = (k) => (data.get(k) || '').trim() || null;
      const body = {
        title: value('title'), organization: value('organization'), description: value('description'),
        location: value('location'), remote: data.get('remote') === 'on',
        employment_type: data.get('employment_type'), closing_date: data.get('closing_date'),
        apply_email: value('apply_email'), apply_url: value('apply_url'), how_to_apply: value('how_to_apply'),
        accommodations: data.getAll('accommodations'),
        other_accommodations: (value('other_accommodations') || '').split(',').map((s) => s.trim()).filter(Boolean),
        summary_en: value('summary_en'), summary_am: value('summary_am'),
      };
      try {
        await api('/api/v1/jobs', { method: 'POST', json: body });
        say(status, 'Job added.');
        await jobsPage(main);
      } catch (error) {
        say(status, `Not added: ${error.message}`);
      }
    },
  },
  field('Job title', input('title', { required: true, maxlength: 150 })),
  field('Employer', input('organization', { required: true, maxlength: 150 })),
  field('Description', area('description', { required: true, rows: 5 })),
  field('Town or city', input('location', { maxlength: 100 }), 'Leave empty for remote-only jobs.'),
  h('div', { class: 'check' }, h('input', { type: 'checkbox', id: remoteId, name: 'remote' }), h('label', { for: remoteId }, 'Can be done remotely (from Ethiopia)')),
  field('Job type', h('select', { name: 'employment_type' }, Object.entries(EMPLOYMENT).map(([v, l]) => h('option', { value: v }, l)))),
  field('Closing date', input('closing_date', { type: 'date', required: true, min: today })),
  field('How to apply', area('how_to_apply', { required: true }), 'In plain words, e.g. "Send your CV by email."'),
  field('Email for applications', input('apply_email', { type: 'email' })),
  field('Website for applications', input('apply_url', { type: 'url' })),
  h('fieldset', {}, h('legend', {}, 'Workplace accommodations offered'), accommodationBoxes,
    field('Other accommodations', input('other_accommodations'), 'Separate with commas.')),
  field('Short summary in English', area('summary_en', { required: true, maxlength: 600, lang: 'en' }), 'Learners can read it or listen to it.'),
  field('Short summary in Amharic', area('summary_am', { maxlength: 600, lang: 'am' })),
  h('button', { type: 'submit', class: 'button' }, 'Add job'),
  status);

  return h('section', { class: 'card', 'aria-labelledby': 'add-job' },
    h('details', {}, h('summary', {}, h('h2', { id: 'add-job', class: 'inline' }, 'Add a job')), form));
}

function jobList(jobs, voice) {
  const section = h('section', { class: 'card', 'aria-labelledby': 'open-jobs' }, h('h2', { id: 'open-jobs' }, 'Open jobs'));
  if (!jobs.length) {
    section.append(h('p', {}, 'No open jobs.'));
    return section;
  }
  section.append(h('ul', { class: 'items' }, jobs.map((job) => {
    const status = h('p', { class: 'status', role: 'status' });
    const snippet = `<fidel-job-card job="${job.url}"></fidel-job-card>`;
    return h('li', { class: 'item' },
      h('h3', {}, job.title),
      h('p', {}, `${job.organization}. Closes ${job.closing_date}.`),
      h('p', {}, h('a', { href: `/demo/savanna-mock/jobs.html?id=${job.id}` }, 'Preview the job card'),
        ' · ', h('a', { href: job.url }, 'JSON-LD')),
      field('Embed code', h('input', { readonly: true, value: snippet })),
      ['en', 'am'].map((lang) => recordingUpload(job.id, lang, status, voice.has(lang) && (lang === 'en' || job.has_summary_am))),
      h('button', {
        type: 'button', class: 'button secondary small',
        onclick: async (e) => {
          if (!window.confirm(`Delete "${job.title}"?`)) return;
          await api(`/api/v1/jobs/${job.id}`, { method: 'DELETE' });
          e.target.closest('li').remove();
        },
      }, `Delete "${job.title}"`),
      status);
  })));
  return section;
}

function recordingUpload(jobId, lang, status, canMachineRead) {
  const name = lang === 'en' ? 'English' : 'Amharic';
  const file = h('input', { type: 'file', accept: 'audio/*,video/*' });
  return h('div', { class: 'row' },
    field(`Recording of the ${name} summary`, file),
    h('button', {
      type: 'button', class: 'button secondary small',
      onclick: async () => {
        if (!file.files[0]) return say(status, 'Choose a recording first.');
        const form = new FormData();
        form.append('audio', file.files[0]);
        try {
          await uploadWithProgress(`/api/v1/jobs/${jobId}/summary-recording/${lang}`, form, () => {});
          say(status, `${name} recording attached.`);
        } catch (error) {
          say(status, `Not attached: ${error.message}`);
        }
      },
    }, `Attach ${name} recording`),
    // Optional voice engine (ToucanTTS): only shown when it is running.
    canMachineRead && h('button', {
      type: 'button', class: 'button secondary small',
      onclick: async (e) => {
        e.target.disabled = true;
        say(status, `Making a machine-read ${name} recording…`);
        try {
          await api(`/api/v1/jobs/${jobId}/summary-recording/${lang}/machine`, { method: 'POST' });
          say(status, `Machine-read ${name} recording attached. The job card tells learners it is a computer voice.`);
        } catch (error) {
          say(status, `No machine-read recording: ${error.message}`);
        }
        e.target.disabled = false;
      },
    }, `Make machine-read ${name} recording`));
}

// --- Certificates --------------------------------------------------------------------

export async function certificatesPage(main) {
  document.title = 'Certificates – Fidel Studio';
  const certificates = await api('/api/v1/certificates');
  const status = h('p', { class: 'status', role: 'status' });
  const form = h('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      const data = new FormData(form);
      try {
        const cert = await api('/api/v1/certificates', {
          method: 'POST',
          json: { learner_name: data.get('learner_name').trim(), course: data.get('course').trim(), issued_on: data.get('issued_on') },
        });
        await certificatesPage(main);
        say(main.querySelector('.status'), `Issued. Share this link with the learner: ${cert.verify_url}`);
      } catch (error) {
        say(status, `Not issued: ${error.message}`);
      }
    },
  },
  field('Learner name', h('input', { name: 'learner_name', required: true, maxlength: 120 }), 'Write it exactly as the learner wants it shown.'),
  field('Course', h('input', { name: 'course', required: true, maxlength: 200 })),
  field('Date', h('input', { name: 'issued_on', type: 'date', required: true, value: new Date().toISOString().slice(0, 10) })),
  h('button', { type: 'submit', class: 'button' }, 'Issue certificate'),
  status);

  const rows = certificates.map((cert) => h('tr', {},
    h('td', {}, cert.learner_name),
    h('td', {}, cert.course),
    h('td', {}, `${cert.issued_on} / `, h('span', { lang: 'am' }, cert.issued_on_ethiopian)),
    h('td', {}, cert.status === 'valid' ? 'Valid' : 'Revoked'),
    h('td', {}, h('a', { href: cert.verify_url }, 'Check page'),
      h('label', { class: 'embed-label' }, `Embed code for ${cert.learner_name}`,
        h('input', { readonly: true, value: `<fidel-certificate certificate="${cert.verify_url.replace('/verify/', '/api/v1/certificates/')}"></fidel-certificate>` })),
      cert.status === 'valid' && h('button', {
        type: 'button', class: 'button secondary small',
        onclick: async () => {
          if (!window.confirm(`Revoke the certificate for ${cert.learner_name}? Employers will see it is no longer valid.`)) return;
          await api(`/api/v1/certificates/${cert.id}/revoke`, { method: 'POST' });
          await certificatesPage(main);
          say(main.querySelector('.status'), 'Certificate revoked.');
        },
      }, `Revoke for ${cert.learner_name}`))));

  main.replaceChildren(
    h('h1', { tabindex: '-1' }, 'Certificates'),
    h('section', { class: 'card', 'aria-labelledby': 'issue' }, h('h2', { id: 'issue' }, 'Issue a certificate'), form),
    h('section', { class: 'card', 'aria-labelledby': 'issued' },
      h('h2', { id: 'issued' }, 'Issued certificates'),
      certificates.length
        ? h('div', { class: 'table-wrap' }, h('table', {},
          h('thead', {}, h('tr', {}, ['Learner', 'Course', 'Date', 'Status', 'Actions'].map((c) => h('th', { scope: 'col' }, c)))),
          h('tbody', {}, rows)))
        : h('p', {}, 'None yet.')));
  main.querySelector('h1').focus();
}

// --- Glossary ---------------------------------------------------------------------------

export async function glossaryPage(main) {
  document.title = 'Glossary – Fidel Studio';
  const { terms } = await api('/api/v1/glossary');
  main.replaceChildren(
    h('h1', { tabindex: '-1' }, 'Glossary'),
    h('p', {}, 'Key words that machine translation often gets wrong, with the agreed Amharic. '
      + 'In the caption editor, every caption containing one of these words is marked so reviewers check it first. '
      + 'The Amharic must be written by a fluent speaker.'),
    rowsEditor({
      heading: 'Words',
      itemName: 'Word',
      emptyText: 'No words yet.',
      addLabel: 'Add word',
      saveLabel: 'Save glossary',
      fields: [
        { key: 'en', label: 'English word or phrase', kind: 'text', lang: 'en' },
        { key: 'am', label: 'Agreed Amharic', kind: 'text', lang: 'am', optional: true },
        { key: 'note', label: 'Note for reviewers', kind: 'text', optional: true },
      ],
      rows: terms,
      newRow: () => ({ en: '', am: '', note: '' }),
      getVideoTime: () => 0,
      save: async (rows) => {
        const saved = await api('/api/v1/glossary', { method: 'PUT', json: { terms: rows.map((r) => ({ en: r.en, am: r.am || null, note: r.note || null })) } });
        const missing = saved.terms.filter((t) => !t.am).length;
        return { rows: saved.terms, message: `Saved ${saved.terms.length} words.${missing ? ` ${missing} still need the agreed Amharic.` : ''}` };
      },
    })
  );
  main.querySelector('h1').focus();
}
