// <fidel-select label="Region" name="region" hint="..." required search placeholder>
//   <option value="aa">Addis Ababa</option> ...           (or options='[{"value":"aa","label":"Addis Ababa"}]')
// </fidel-select>
//
// A NATIVE <select> (never a fake dropdown) with a label, hint and an error in
// words ("Choose an option from the list."). With the search attribute, a real
// "Search the list" text box above it keeps only the options that contain
// what you type, and says how many match. The chosen option is always kept.
// placeholder (or required) adds an empty first option "Choose…".
// Events: fidel-field-change {value}, fidel-field-invalid {message}, fidel-field-valid.
import { h } from '../../dom.js';
import { announce } from '../../announce.js';
import { FidelFieldBase } from './base.js';
import { emit, srOnly } from './common.js';

export class FidelSelect extends FidelFieldBase {
  buildField({ initial, children }) {
    this.control = h('select', { id: this.ids.field, class: 'fidel-field-control', name: this.getAttribute('name') || null });
    let options = [];
    try {
      const list = JSON.parse(this.getAttribute('options') || 'null');
      if (Array.isArray(list)) options = list.map((o) => h('option', { value: String(o.value), lang: o.lang || null }, String(o.label ?? o.value)));
    } catch {
      console.warn('<fidel-select>: options must be JSON, e.g. [{"value":"a","label":"A"}]');
    }
    if (!options.length) options = children.filter((c) => ['option', 'optgroup'].includes(c.localName));
    if (this.hasAttribute('placeholder') || (this.required && !options.some((o) => o.localName === 'option' && o.value === ''))) {
      this.emptyOption = h('option', { value: '' });
      this.control.append(this.emptyOption);
    }
    this.control.append(...options);
    if (initial !== null) this.control.value = initial;
    for (const option of this.control.options) option.defaultSelected = option.selected;
    this.allNodes = [...this.control.childNodes]; // the full list, for search

    const parts = [this.labelEl, this.hintEl];
    if (this.hasAttribute('search')) {
      const searchId = `${this.ids.field}-search`;
      this.searchLabel = h('span', {});
      this.searchName = srOnly('');
      this.searchInput = h('input', { type: 'search', id: searchId, class: 'fidel-field-control', autocomplete: 'off', 'aria-controls': this.ids.field });
      this.countEl = h('p', { class: 'fidel-field-count', id: `${searchId}-count`, hidden: true });
      this.searchInput.setAttribute('aria-describedby', this.countEl.id);
      this.searchInput.addEventListener('input', () => this.filter());
      this.searchInput.addEventListener('keydown', (event) => {
        // Enter in the search box: go to the list instead of sending the form.
        if (event.key === 'Enter') {
          event.preventDefault();
          this.control.focus();
        }
      });
      parts.push(h('div', { class: 'fidel-field-search' },
        h('label', { for: searchId }, this.searchLabel, this.searchName), this.searchInput, this.countEl));
    }
    parts.push(this.control, this.errorEl);
    this.root.append(...parts);
    this.control.addEventListener('change', () => {
      this.recheck();
      emit(this, 'fidel-field-change', { value: this.control.value, name: this.getAttribute('name') });
    });
    this.control.addEventListener('blur', () => { if (this.errorState) this.checkValidity(); });
  }

  /** Keep only the options containing the search words (and the chosen one). */
  filter() {
    const query = this.searchInput.value.trim().toLocaleLowerCase();
    const chosen = this.control.value;
    if (!query) {
      this.control.replaceChildren(...this.allNodes);
      this.control.value = chosen;
      this.countEl.hidden = true;
      return;
    }
    const every = this.allNodes.flatMap((n) => (n.localName === 'optgroup' ? [...n.children] : [n]));
    const matches = every.filter((o) => o !== this.emptyOption && o.textContent.toLocaleLowerCase().includes(query));
    const keep = every.filter((o) => o === this.emptyOption || matches.includes(o) || (o.value === chosen && chosen !== ''));
    this.control.replaceChildren(...keep);
    this.control.value = chosen;
    const count = matches.length;
    this.countEl.textContent = count === 0 ? this.tt('select.none') : count === 1 ? this.tt('select.one') : this.tt('select.many', { count });
    this.countEl.hidden = false;
    clearTimeout(this.countTimer);
    this.countTimer = setTimeout(() => announce(this.countEl.textContent), 600);
  }

  currentValue() { return this.control.value; }

  setValue(value) {
    this.control.value = value ?? '';
    this.recheck();
  }

  afterReset() {
    if (this.searchInput) {
      this.searchInput.value = '';
      this.filter();
    }
  }

  problem() {
    return this.required && !this.control.value ? { key: 'select.required' } : null;
  }

  refresh() {
    super.refresh();
    this.control.required = this.required;
    this.control.disabled = this.hasAttribute('disabled');
    if (this.emptyOption) this.emptyOption.textContent = this.getAttribute('placeholder') || this.tt('select.choose');
    if (this.searchLabel) {
      this.searchLabel.textContent = this.tt('select.search');
      this.searchName.textContent = `: ${this.label}`;
    }
  }
}
