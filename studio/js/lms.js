// Studio: LMS connections (LTI 1.3). Register a learning platform (Moodle,
// Canvas) so it can open Fidel lessons, and copy Fidel's own addresses into it.
import { api } from './api.js';
import { h, say, uid } from './util.js';

function field(label, control, hint) {
  const id = uid('f');
  const hintId = hint && uid('hint');
  control.id = id;
  if (hintId) control.setAttribute('aria-describedby', hintId);
  return h('div', { class: 'field' }, h('label', { for: id }, label), hint && h('p', { class: 'hint', id: hintId }, hint), control);
}

/** Copy text; falls back to selecting it where the clipboard API is missing (plain http). */
async function copy(input, status, label) {
  try {
    await navigator.clipboard.writeText(input.value);
  } catch {
    input.select();
    if (!document.execCommand('copy')) return say(status, `Could not copy. The ${label} is selected: press Ctrl+C.`);
  }
  say(status, `Copied the ${label}.`);
}

export async function lmsPage(main) {
  document.title = 'LMS connections – Fidel Studio';
  const tool = await api('/api/v1/lti/tool');
  const heading = h('h1', { tabindex: '-1' }, 'LMS connections');
  const intro = h('p', {}, 'A learning platform such as Moodle or Canvas can open Fidel lessons inside a course. '
    + 'Learners are signed in by the platform, and "completed" goes to its gradebook. This uses the LTI 1.3 standard.');

  if (!tool.enabled) {
    main.replaceChildren(heading, intro,
      h('section', { class: 'card', 'aria-labelledby': 'lti-off' },
        h('h2', { id: 'lti-off' }, 'Switched off'),
        h('p', {}, 'LMS connections are off on this server. To switch them on, set ', h('code', {}, 'FIDEL_LTI_ENABLED=true'),
          ' and ', h('code', {}, 'FIDEL_PUBLIC_URL'), ' (the address platforms reach Fidel at) in the .env file, then restart Fidel.')));
    heading.focus();
    return;
  }

  const platforms = await api('/api/v1/lti/platforms');
  main.replaceChildren(heading, intro, fidelDetails(tool), addPlatform(main), platformList(main, platforms));
  heading.focus();
}

// --- Fidel's addresses, to paste into the platform ------------------------------------------

function fidelDetails(tool) {
  const status = h('p', { class: 'status', role: 'status' });
  const a = tool.addresses;
  const rows = [
    ['Tool URL', a.tool_url],
    ['Initiate login URL', a.login_url],
    ['Redirection URI(s)', a.redirect_urls.join('\n')],
    ['Public keyset URL', a.key_set_url],
    ['Content Selection URL (Deep Linking)', a.deep_link_url],
  ].map(([label, value]) => {
    const multiline = value.includes('\n');
    const input = multiline
      ? h('textarea', { readonly: true, rows: value.split('\n').length, value })
      : h('input', { readonly: true, value });
    return h('div', { class: 'row copy-row' },
      field(label, input),
      h('button', { type: 'button', class: 'button secondary small', 'aria-label': `Copy ${label}`, onclick: () => copy(input, status, label) }, 'Copy'));
  });

  return h('section', { class: 'card', 'aria-labelledby': 'fidel-details' },
    h('h2', { id: 'fidel-details' }, "Fidel's details for your platform"),
    h('p', {}, 'In Moodle: Site administration › Plugins › Activity modules › External tool › Manage tools › "configure a tool manually". '
      + 'Choose LTI version "LTI 1.3", Public key type "Keyset URL", tick "Supports Deep Linking", and paste these:'),
    !tool.public_url_set && h('p', { class: 'glossary-note' },
      'These addresses use the address you opened Studio with. Set FIDEL_PUBLIC_URL so they use the address the platform can reach.'),
    rows, status);
}

// --- Register a platform -------------------------------------------------------------------

function addPlatform(main) {
  const status = h('p', { class: 'status', role: 'status' });
  const input = (name, attrs = {}) => h('input', { name, required: true, ...attrs });
  const form = h('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const body = Object.fromEntries(['name', 'issuer', 'client_id', 'auth_login_url', 'auth_token_url', 'key_set_url']
        .map((key) => [key, data.get(key).trim()]));
      body.deployment_ids = data.get('deployment_ids').split(/[\s,]+/).filter(Boolean);
      try {
        const platform = await api('/api/v1/lti/platforms', { method: 'POST', json: body });
        await lmsPage(main);
        say(main.querySelector('#platforms-status'), `Added ${platform.name}.`);
      } catch (error) {
        say(status, `Not added: ${error.message}`);
      }
    },
  },
  h('p', {}, 'After you save the tool in Moodle, open "View configuration details" next to it (the list icon) and copy each value here.'),
  field('Name', input('name', { maxlength: 100 }), 'For staff only, e.g. "ALX Moodle".'),
  field('Platform ID (issuer)', input('issuer', { type: 'url', maxlength: 500 }), 'The platform\'s main address, e.g. https://moodle.example.org'),
  field('Client ID', input('client_id', { maxlength: 255, autocomplete: 'off' })),
  field('Deployment ID', h('textarea', { name: 'deployment_ids', required: true, rows: 2 }), 'More than one? Put each on its own line.'),
  field('Authentication request URL', input('auth_login_url', { type: 'url', maxlength: 500 }), 'Moodle: ends in /mod/lti/auth.php'),
  field('Access token URL', input('auth_token_url', { type: 'url', maxlength: 500 }), 'Moodle: ends in /mod/lti/token.php'),
  field('Public keyset URL', input('key_set_url', { type: 'url', maxlength: 500 }), 'Moodle: ends in /mod/lti/certs.php'),
  h('button', { type: 'submit', class: 'button' }, 'Add platform'),
  status);

  return h('section', { class: 'card', 'aria-labelledby': 'add-platform' },
    h('details', {}, h('summary', {}, h('h2', { id: 'add-platform', class: 'inline' }, 'Add a platform')), form));
}

// --- Registered platforms ------------------------------------------------------------------

function platformList(main, platforms) {
  const status = h('p', { class: 'status', role: 'status', id: 'platforms-status' });
  const section = h('section', { class: 'card', 'aria-labelledby': 'connected' }, h('h2', { id: 'connected' }, 'Connected platforms'));
  if (!platforms.length) {
    section.append(h('p', {}, 'None yet.'), status);
    return section;
  }
  section.append(h('ul', { class: 'items' }, platforms.map((p) => h('li', { class: 'item' },
    h('h3', {}, p.name),
    h('dl', { class: 'details-list' },
      [['Platform ID', p.issuer], ['Client ID', p.client_id], ['Deployment ID', p.deployment_ids.join(', ')],
        ['Authentication request URL', p.auth_login_url], ['Access token URL', p.auth_token_url],
        ['Public keyset URL', p.key_set_url], ['Added', new Date(p.created_at).toLocaleString()]]
        .map(([term, value]) => [h('dt', {}, term), h('dd', {}, value)])),
    h('button', {
      type: 'button', class: 'button secondary small',
      onclick: async () => {
        if (!window.confirm(`Remove ${p.name}? Its courses can no longer open Fidel lessons.`)) return;
        try {
          await api(`/api/v1/lti/platforms/${p.id}`, { method: 'DELETE' });
          await lmsPage(main);
          say(main.querySelector('#platforms-status'), `Removed ${p.name}.`);
        } catch (error) {
          say(status, `Not removed: ${error.message}`);
        }
      },
    }, `Remove ${p.name}`)))), status);
  return section;
}
