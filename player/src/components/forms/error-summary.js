// <fidel-error-summary for="job-form" heading-level="2" ui-lang="en|am">
//
// Put it at the top of a form (or anywhere before it). When the form is
// submitted it checks every Fidel field in it. If any is wrong it stops the
// submit, shows "2 fields need fixing" with a link to each field (the link
// puts you in the field), and moves focus to its heading. Nothing typed is
// lost. As each field is fixed, its link goes away.
// <fidel-form> adds one by itself.
//
// It switches off the browser's own pop-up checks on that form (novalidate),
// so every message is in words, in the page's language, under the field.
// It listens in the capture phase, so the form's own submit listeners only
// run when everything is right.
import { h, uid } from '../../dom.js';
import { FIELD_TAGS, text, uiLang } from './common.js';

export class FidelErrorSummary extends HTMLElement {
  static get observedAttributes() { return ['ui-lang']; }

  connectedCallback() {
    if (!this.built) {
      this.built = true;
      const level = Math.min(6, Math.max(2, Number(this.getAttribute('heading-level')) || 2));
      this.heading = h(`h${level}`, { class: 'fidel-error-summary-title', id: uid('fidel-error-summary'), tabindex: '-1' });
      this.list = h('ul', { class: 'fidel-error-summary-list' });
      this.box = h('div', { class: 'fidel-error-summary', hidden: true }, this.heading, this.list);
      this.replaceChildren(this.box);
      this.onSubmit = (event) => {
        if (event.target !== this.form) return;
        if (!this.check()) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      };
      this.onValid = (event) => this.removeLink(event.target);
    }
    document.addEventListener('submit', this.onSubmit, true);
    this.attach();
    if (!this.form) document.addEventListener('DOMContentLoaded', () => this.attach(), { once: true });
  }

  disconnectedCallback() {
    document.removeEventListener('submit', this.onSubmit, true);
    this.form?.removeEventListener('fidel-field-valid', this.onValid);
  }

  attributeChangedCallback() {
    if (this.built && !this.box.hidden) this.render();
  }

  get form() {
    const target = document.getElementById(this.getAttribute('for') || '');
    return target?.localName === 'form' ? target : (this.closest('form') || null);
  }

  attach() {
    const form = this.form;
    if (!form || form === this.attached) return;
    this.attached = form;
    form.noValidate = true; // our messages instead of the browser's pop-ups
    form.addEventListener('fidel-field-valid', this.onValid);
  }

  /** The Fidel fields in the form that are in use. */
  fields() {
    const form = this.form;
    if (!form) return [];
    return [...form.querySelectorAll(FIELD_TAGS.join(','))].filter((f) => typeof f.checkValidity === 'function' && f.built);
  }

  /** Check every field; show the summary and focus it if any is wrong. True when all are fine. */
  check() {
    this.attach();
    this.failing = this.fields().filter((field) => !field.checkValidity({ quiet: true }));
    if (!this.failing.length) {
      this.box.hidden = true;
      return true;
    }
    this.render();
    this.box.hidden = false;
    this.heading.focus();
    return false;
  }

  render() {
    const lang = uiLang(this);
    this.box.setAttribute('lang', lang);
    const count = this.failing.length;
    this.heading.textContent = count === 1 ? text(lang, 'summary.one') : text(lang, 'summary.many', { count });
    this.list.replaceChildren(...this.failing.map((field) => h('li', {},
      h('a', {
        href: `#${field.fieldId}`,
        onclick: (event) => {
          event.preventDefault();
          field.focus();
          field.scrollIntoView?.({ block: 'center' });
        },
      }, text(lang, 'field.errorIn', { label: field.label, message: field.validity.message })))));
  }

  removeLink(field) {
    if (this.box.hidden || !this.failing?.includes(field)) return;
    this.failing = this.failing.filter((f) => f !== field);
    if (!this.failing.length) this.box.hidden = true;
    else this.render();
  }
}
