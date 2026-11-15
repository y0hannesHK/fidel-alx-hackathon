// <fidel-date label="Date you can start" name="start" value="2026-12-01" min="2026-11-16" max="2027-12-31" required>
//
// A NATIVE date field. Under it, the same date in the Ethiopian calendar
// (with <fidel-ethiopian-date> from Package B), read out with the field.
// Errors in words: "Enter a date.", "Enter a full date: day, month and year.",
// "Choose 16 November 2026 or later."
// Attributes: label, name, value, min, max (YYYY-MM-DD), hint, required, disabled, ui-lang.
// Events: fidel-field-change {value}, fidel-field-invalid {message}, fidel-field-valid.
import { h } from '../../dom.js';
import { FidelFieldBase } from './base.js';
import { emit, uiLang } from './common.js';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export class FidelDate extends FidelFieldBase {
  static get observedAttributes() { return [...super.observedAttributes, 'min', 'max']; }

  buildField({ initial }) {
    this.control = h('input', { type: 'date', id: this.ids.field, class: 'fidel-field-control', name: this.getAttribute('name') || null });
    this.control.defaultValue = initial && ISO.test(initial) ? initial : '';
    this.control.value = this.control.defaultValue;
    this.ethiopianLabel = h('span', {});
    this.ethiopianDate = null; // made with the first date (it needs a datetime)
    this.ethiopianEl = h('p', { class: 'fidel-field-ethiopian', id: `${this.ids.field}-ethiopian`, hidden: true },
      this.ethiopianLabel, ' ');
    this.root.append(this.labelEl, this.hintEl, this.control, this.ethiopianEl, this.errorEl);
    this.control.addEventListener('input', () => {
      this.showEthiopian();
      this.recheck();
    });
    this.control.addEventListener('change', () => {
      this.showEthiopian();
      emit(this, 'fidel-field-change', { value: this.control.value, name: this.getAttribute('name') });
    });
    this.control.addEventListener('blur', () => {
      if (this.control.value || this.control.validity.badInput || this.errorState) this.checkValidity();
    });
  }

  showEthiopian() {
    const value = this.control.value;
    const show = ISO.test(value);
    if (show) {
      if (!this.ethiopianDate) {
        this.ethiopianDate = document.createElement('fidel-ethiopian-date');
        this.ethiopianDate.setAttribute('datetime', value);
        this.ethiopianEl.append(this.ethiopianDate);
      }
      this.ethiopianDate.setAttribute('ui-lang', uiLang(this));
      this.ethiopianDate.setAttribute('datetime', value);
    }
    this.ethiopianEl.hidden = !show;
    this.describe();
  }

  /** "16 November 2026" in the interface language. */
  spoken(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    const locale = uiLang(this) === 'am' ? 'am-ET' : 'en-GB';
    try {
      return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', calendar: 'gregory', timeZone: 'UTC' })
        .format(new Date(Date.UTC(y, m - 1, d)));
    } catch {
      return iso;
    }
  }

  problem() {
    const value = this.control.value;
    if (this.control.validity.badInput) return { key: 'date.badInput' };
    if (!value) return this.required ? { key: 'date.required' } : null;
    const min = this.getAttribute('min');
    const max = this.getAttribute('max');
    if (min && ISO.test(min) && value < min) return { key: 'date.tooEarly', values: { min: this.spoken(min) } };
    if (max && ISO.test(max) && value > max) return { key: 'date.tooLate', values: { max: this.spoken(max) } };
    return null;
  }

  currentValue() { return this.control.value; }

  setValue(value) {
    this.control.value = value && ISO.test(value) ? value : '';
    this.showEthiopian();
    this.recheck();
  }

  afterReset() { this.showEthiopian(); }

  describedBy() {
    const ids = super.describedBy();
    if (!this.ethiopianEl.hidden) ids.splice(ids.indexOf(this.ids.error) === -1 ? ids.length : ids.indexOf(this.ids.error), 0, this.ethiopianEl.id);
    return ids;
  }

  refresh() {
    super.refresh();
    const c = this.control;
    c.required = this.required;
    c.disabled = this.hasAttribute('disabled');
    c.min = this.getAttribute('min') || '';
    c.max = this.getAttribute('max') || '';
    this.ethiopianLabel.textContent = this.tt('date.ethiopian');
    this.showEthiopian();
  }
}
