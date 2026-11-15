// <fidel-form api="/api/v1/applications" sensitive="support" ui-lang="am">
//   <form> ...Fidel fields... <button type="submit">Send</button> </form>
// </fidel-form>
//
// Wraps a native <form> and makes sure nothing typed is lost:
//  - Draft: every field is saved on this device (localStorage,
//    "fidel-form-draft:<id>") as the person types, and put back after a reload
//    or a time-out. "Draft saved" shows; "Clear draft" empties it.
//    Fields named in sensitive="a,b" are NEVER saved (nor files or passwords).
//  - Errors: adds a <fidel-error-summary> at the top of the form.
//  - Sending: api (or action) = POST the answers as JSON (multipart when a file
//    is chosen). Without it, the event fidel-form-submit {data} is fired for
//    the page to handle (call preventDefault() on it to show your own message).
//    A second press while sending does nothing. Success is said in words.
//  - Offline at submit: "Saved on this phone. It will be sent when you are
//    online" ("fidel-form-outbox:<id>"), sent on the browser's online event.
//    Sensitive answers wait only in memory: sent if this page is still open.
// Attributes: api | action, sensitive, draft ("off" = no draft), draft-key, ui-lang.
// Events: fidel-form-submit {data, queued}, fidel-form-sent {data, status},
//   fidel-form-queued {data}, fidel-form-draft-saved, fidel-form-draft-restored.
import { h, uid } from '../../dom.js';
import { announce } from '../../announce.js';
import { FIELD_TAGS, emit, text, uiLang } from './common.js';
import { DRAFT_PREFIX, OUTBOX_PREFIX, draftData, entriesToObject, nameList, readStored, writeStored } from './logic.js';

const storage = () => globalThis.localStorage;

export class FidelForm extends HTMLElement {
  static get observedAttributes() { return ['ui-lang']; }

  connectedCallback() {
    if (this.built) return;
    const form = this.querySelector('form');
    if (!form) {
      console.warn('<fidel-form> needs a <form> inside it.');
      return;
    }
    this.built = true;
    this.form = form;
    if (!form.id) form.id = uid('fidel-form');
    form.noValidate = true;
    if (!document.querySelector(`fidel-error-summary[for="${form.id}"]`) && !form.querySelector('fidel-error-summary')) {
      const summary = document.createElement('fidel-error-summary');
      summary.setAttribute('for', form.id);
      form.prepend(summary);
    }
    this.statusEl = h('p', { class: 'fidel-form-status', hidden: true });
    this.privateEl = h('p', { class: 'fidel-form-private', hidden: !this.sensitive.length });
    this.clearButton = h('button', { type: 'button', class: 'fidel-field-button', hidden: true, onclick: () => this.clearDraft() });
    this.bar = h('div', { class: 'fidel-form-bar' }, this.statusEl, this.privateEl, this.clearButton);
    form.after(this.bar);
    this.refresh();

    form.addEventListener('input', () => this.scheduleSave());
    form.addEventListener('change', () => this.scheduleSave());
    form.addEventListener('submit', (event) => this.onSubmit(event));
    window.addEventListener('online', () => this.flushOutbox());
    // Put the draft back once every field has been built.
    Promise.all(FIELD_TAGS.map((tag) => customElements.whenDefined(tag))).then(() => setTimeout(() => {
      this.restoreDraft();
      if (navigator.onLine) this.flushOutbox();
    }, 0));
  }

  attributeChangedCallback() {
    if (!this.built) return;
    this.refresh();
    // Fields inherit ui-lang from here: tell them to re-read it.
    for (const el of this.querySelectorAll(`${FIELD_TAGS.join(',')},fidel-error-summary,fidel-ethiopian-date`)) {
      if (el.built && typeof el.refresh === 'function') el.refresh();
      else if (el.localName === 'fidel-error-summary') el.attributeChangedCallback?.();
    }
  }

  tt(key, values) { return text(uiLang(this), key, values); }

  refresh() {
    this.bar.setAttribute('lang', uiLang(this));
    this.privateEl.textContent = this.tt('form.privateNote');
    this.clearButton.textContent = this.tt('form.clearDraft');
    if (this.statusKey) this.statusEl.textContent = this.tt(this.statusKey, this.statusValues);
  }

  get sensitive() { return nameList(this.getAttribute('sensitive')); }

  get key() { return this.getAttribute('draft-key') || this.id || this.form.id; }

  get draftOn() { return this.getAttribute('draft') !== 'off'; }

  /** Show a message under the form; say it too unless quiet. */
  status(key, values, { quiet = false, assertive = false } = {}) {
    this.statusKey = key;
    this.statusValues = values;
    this.statusEl.textContent = this.tt(key, values);
    this.statusEl.hidden = false;
    if (!quiet) announce(this.statusEl.textContent, { assertive });
  }

  /** Every answer as a plain object (checkbox groups as arrays; files left out). */
  collect() {
    const multiple = [...new Set([...this.form.querySelectorAll('input[type=checkbox][name]')].map((c) => c.name))];
    return entriesToObject(new FormData(this.form).entries(), multiple);
  }

  /** Names never stored on the device: sensitive ones, passwords and files. */
  neverStored() {
    const own = [...this.form.querySelectorAll('input[type=password][name], input[type=file][name]')].map((i) => i.name);
    return [...this.sensitive, ...own];
  }

  // ---------- Draft ----------------------------------------------------------------

  scheduleSave() {
    if (!this.draftOn || this.restoring) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveDraft(), 400);
  }

  saveDraft() {
    const data = draftData(this.collect(), this.neverStored());
    const empty = Object.values(data).every((v) => (Array.isArray(v) ? !v.length : !String(v).trim()));
    if (empty) {
      writeStored(storage(), DRAFT_PREFIX + this.key, null);
      this.clearButton.hidden = true;
      return;
    }
    if (!writeStored(storage(), DRAFT_PREFIX + this.key, { savedAt: new Date().toISOString(), data })) {
      if (!this.storageWarned) this.status('form.noStorage');
      this.storageWarned = true;
      return;
    }
    // Said once; afterwards only shown (it would interrupt every pause in typing).
    this.status('form.draftSaved', null, { quiet: this.draftAnnounced });
    this.draftAnnounced = true;
    this.clearButton.hidden = false;
    emit(this, 'fidel-form-draft-saved', {});
  }

  restoreDraft() {
    if (!this.draftOn) return;
    const saved = readStored(storage(), DRAFT_PREFIX + this.key);
    if (!saved?.data || typeof saved.data !== 'object') return;
    this.restoring = true;
    const never = this.neverStored();
    for (const [name, value] of Object.entries(saved.data)) {
      if (!never.includes(name)) this.fill(name, value);
    }
    this.restoring = false;
    this.status('form.draftRestored');
    this.clearButton.hidden = false;
    emit(this, 'fidel-form-draft-restored', { data: saved.data });
  }

  /** Put a saved value back into the field(s) with that name. */
  fill(name, value) {
    const found = this.form.elements.namedItem(name);
    if (!found) return;
    const controls = found instanceof Element ? [found] : [...found];
    const values = Array.isArray(value) ? value.map(String) : [String(value)];
    for (const control of controls) {
      if (control.type === 'radio' || control.type === 'checkbox') {
        control.checked = values.includes(control.value);
        continue;
      }
      const host = control.closest(FIELD_TAGS.join(','));
      if (host && host.built && 'value' in host) host.value = values[0];
      else control.value = values[0];
    }
  }

  clearDraft() {
    writeStored(storage(), DRAFT_PREFIX + this.key, null);
    this.form.reset();
    this.clearButton.hidden = true;
    this.form.querySelector('fidel-error-summary .fidel-error-summary')?.setAttribute('hidden', '');
    this.status('form.draftCleared');
    this.firstField()?.focus();
  }

  firstField() {
    return this.form.querySelector(FIELD_TAGS.join(','));
  }

  // ---------- Sending --------------------------------------------------------------

  get endpoint() { return this.getAttribute('api') || this.getAttribute('action') || ''; }

  submitButtons() {
    return [...this.form.querySelectorAll('button[type=submit], button:not([type]), input[type=submit]')];
  }

  setBusy(busy) {
    this.busy = busy;
    for (const button of this.submitButtons()) {
      if (busy) button.setAttribute('aria-disabled', 'true');
      else button.removeAttribute('aria-disabled');
    }
  }

  async onSubmit(event) {
    // <fidel-error-summary> has already stopped the submit if a field is wrong.
    event.preventDefault();
    if (this.busy) return; // no double submission
    const data = this.collect();
    const files = [...this.form.querySelectorAll('input[type=file]')].some((input) => input.files?.length);
    if (!navigator.onLine) {
      if (files && this.endpoint) this.status('form.offlineFile', null, { assertive: true });
      else this.queue(data);
      return;
    }
    await this.send(data, files);
  }

  /** Keep the answers on this device until the browser is online again. */
  queue(data) {
    const key = OUTBOX_PREFIX + this.key;
    const waiting = readStored(storage(), key) || [];
    waiting.push({ savedAt: new Date().toISOString(), data: draftData(data, this.sensitive) });
    writeStored(storage(), key, waiting);
    // Sensitive answers are never written to the device: they wait in memory.
    this.waitingSensitive = Object.fromEntries(this.sensitive.filter((n) => n in data).map((n) => [n, data[n]]));
    this.status('form.offline');
    emit(this, 'fidel-form-queued', { data });
  }

  async flushOutbox() {
    const key = OUTBOX_PREFIX + this.key;
    const waiting = readStored(storage(), key) || [];
    if (!waiting.length || this.busy) return;
    let sent = 0;
    for (const item of waiting) {
      const data = { ...item.data, ...(this.waitingSensitive || {}) };
      if (!(await this.deliver(data, false, true))) break;
      sent += 1;
    }
    const rest = waiting.slice(sent);
    writeStored(storage(), key, rest.length ? rest : null);
    if (sent) {
      this.waitingSensitive = null;
      this.status('form.sentLater');
    }
  }

  async send(data, files) {
    this.setBusy(true);
    this.status('form.sending');
    const ok = await this.deliver(data, files, false);
    this.setBusy(false);
    if (ok === 'queued') return;
    if (!ok) return;
    writeStored(storage(), DRAFT_PREFIX + this.key, null);
    this.clearButton.hidden = true;
    this.form.reset();
    if (ok !== 'host') this.status('form.sent');
    else this.statusEl.hidden = true;
  }

  /**
   * Send one set of answers. Returns true when sent, 'host' when the page
   * handled the event itself, 'queued' when the network failed and the
   * answers were kept, false on a server error (message shown).
   */
  async deliver(data, files, queued) {
    if (!this.endpoint) {
      const handled = !emit(this, 'fidel-form-submit', { data, queued }, { cancelable: true });
      return handled ? 'host' : true;
    }
    let body;
    const headers = { Accept: 'application/json' };
    if (files) {
      body = new FormData(this.form);
    } else {
      body = JSON.stringify(data);
      headers['Content-Type'] = 'application/json';
    }
    let response;
    try {
      response = await fetch(this.endpoint, { method: 'POST', headers, body });
    } catch {
      if (queued) return false; // still offline: keep it waiting
      if (files) {
        this.status('form.offlineFile', null, { assertive: true });
        return false;
      }
      this.queue(data);
      return 'queued';
    }
    if (!response.ok) {
      this.status('form.failed', { status: response.status }, { assertive: true });
      return false;
    }
    emit(this, 'fidel-form-sent', { data, status: response.status });
    return true;
  }
}
