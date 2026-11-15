// The part every Fidel form field shares: a visible label, a hint, an error
// message in words, and the methods <fidel-error-summary> and <fidel-form> use.
//
// Each field builds its parts in the LIGHT DOM (no shadow DOM), in this order:
//   label -> hint -> field -> messages -> buttons
// so <label for>, aria-describedby and the host page's own <form> all work.
//
// A subclass sets this.control (the element that gets focus) and implements:
//   buildField()   the real <input>/<textarea>/<select>/<fieldset> and extras
//   problem()      null when fine, else { key, values } (a key in the JSON)
//   currentValue() and setValue(value)
// and may override describedControls() and refresh().
import { h, uid } from '../../dom.js';
import { announce } from '../../announce.js';
import { emit, text, uiLang } from './common.js';

export class FidelFieldBase extends HTMLElement {
  static get observedAttributes() { return ['ui-lang', 'label', 'hint', 'disabled', 'readonly', 'required', 'describedby']; }

  connectedCallback() {
    if (this.built) return;
    this.built = true;
    const base = this.id ? `${this.id}-field` : uid('fidel-field');
    this.ids = { field: base, hint: `${base}-hint`, error: `${base}-error` };
    this.errorState = null; // { key, values } while an error is shown
    this.root = this.createRoot(`fidel-field fidel-field-${this.localName.slice(6)}`);
    this.labelEl = this.buildLabel();
    this.hintEl = h('p', { class: 'fidel-field-hint', id: this.ids.hint, hidden: true });
    this.errorEl = h('p', { class: 'fidel-field-error', id: this.ids.error, hidden: true });
    const initial = this.getAttribute('value');
    const content = this.textContent; // e.g. a <fidel-textarea>'s starting text
    const children = [...this.children]; // e.g. <option> elements for choices and selects
    this.buildField({ initial, content, children });
    this.replaceChildren(this.root);
    this.closest('form')?.addEventListener('reset', () => {
      this.hideError();
      // After the browser has reset the fields.
      setTimeout(() => this.afterReset?.(), 0);
    });
    this.refresh();
  }

  attributeChangedCallback() {
    if (this.built) this.refresh();
  }

  /** The box around the parts (choices use a <fieldset>). */
  createRoot(className) {
    return h('div', { class: className });
  }

  /** The <label> (choices use a <legend> instead). */
  buildLabel() {
    this.requiredEl = h('span', { class: 'fidel-field-required', 'aria-hidden': 'true' });
    this.labelText = h('span', {});
    return h('label', { class: 'fidel-field-label', for: this.ids.field }, this.labelText, ' ', this.requiredEl);
  }

  /** Short helper for this component's text in the interface language. */
  tt(key, values) {
    return text(uiLang(this), key, values);
  }

  get label() { return this.getAttribute('label') || ''; }

  get required() { return this.hasAttribute('required'); }

  /** The id of the element that gets focus (used by the error summary's links). */
  get fieldId() { return this.control?.id; }

  get value() { return this.built ? this.currentValue() : this.getAttribute('value') ?? ''; }

  set value(value) {
    if (this.built) this.setValue(value);
    else this.setAttribute('value', value);
  }

  focus(options) { this.control?.focus(options); }

  /** { valid, message } without showing anything. */
  get validity() {
    const found = this.built ? this.problem() : null;
    return { valid: !found, message: found ? this.tt(found.key, found.values) : '' };
  }

  /**
   * Check the field and SHOW the result: the error under the field (or remove
   * it). quiet: true = do not announce (the error summary speaks instead).
   * Returns true when the field is fine.
   */
  checkValidity({ quiet = false } = {}) {
    if (!this.built) return true;
    if (this.hasAttribute('disabled')) {
      this.hideError();
      return true;
    }
    const found = this.problem();
    if (found) {
      this.showError(found);
      const message = this.tt(found.key, found.values);
      if (!quiet) announce(this.tt('field.errorIn', { label: this.label, message }));
      emit(this, 'fidel-field-invalid', { message, name: this.getAttribute('name') });
      return false;
    }
    this.hideError();
    emit(this, 'fidel-field-valid', { name: this.getAttribute('name') });
    return true;
  }

  /** After an error: re-check as the person types and say "Fixed" as soon as it is. */
  recheck() {
    if (!this.errorState) return;
    const found = this.problem();
    if (!found) {
      this.hideError();
      announce(this.tt('field.fixed'));
      emit(this, 'fidel-field-valid', { name: this.getAttribute('name') });
    } else if (found.key !== this.errorState.key) {
      this.showError(found); // a different problem now: update the words, quietly
    }
  }

  showError(found) {
    this.errorState = found;
    this.errorEl.textContent = `⚠ ${this.tt(found.key, found.values)}`;
    this.errorEl.hidden = false;
    for (const control of this.invalidControls()) control.setAttribute('aria-invalid', 'true');
    this.describe();
  }

  hideError() {
    if (!this.errorEl) return;
    this.errorState = null;
    this.errorEl.hidden = true;
    this.errorEl.textContent = '';
    for (const control of this.invalidControls()) control.removeAttribute('aria-invalid');
    this.describe();
  }

  /** Elements that get aria-invalid (radio groups: every radio). */
  invalidControls() { return this.control ? [this.control] : []; }

  /** Elements that get aria-describedby. */
  describedControls() { return this.control ? [this.control] : []; }

  /** Ids of the visible messages, in reading order. Subclasses add theirs. */
  describedBy() {
    // describedby="id1 id2" on the host: the page's own descriptions come first
    // (e.g. Studio links each caption's boxes to that caption's legend).
    const ids = (this.getAttribute('describedby') || '').split(/\s+/).filter(Boolean);
    if (!this.hintEl.hidden) ids.push(this.ids.hint);
    if (!this.errorEl.hidden) ids.push(this.ids.error);
    return ids;
  }

  describe() {
    const ids = this.describedBy().join(' ');
    for (const control of this.describedControls()) {
      if (ids) control.setAttribute('aria-describedby', ids);
      else control.removeAttribute('aria-describedby');
    }
  }

  /** Re-apply attributes and words (after ui-lang, label, hint... change). */
  refresh() {
    const lang = uiLang(this);
    this.root.setAttribute('lang', lang);
    this.labelText.textContent = this.label;
    this.requiredEl.textContent = this.required ? this.tt('field.required') : '';
    const hint = this.hintText();
    this.hintEl.textContent = hint;
    this.hintEl.hidden = !hint;
    if (this.errorState) this.errorEl.textContent = `⚠ ${this.tt(this.errorState.key, this.errorState.values)}`;
    this.describe();
  }

  hintText() { return this.getAttribute('hint') || ''; }
}
