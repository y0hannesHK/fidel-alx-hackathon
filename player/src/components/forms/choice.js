// <fidel-choice type="radio|checkbox" label="Support I need" name="support" hint="..." required
//   options='[{"value":"sign","label":"Sign language interpreter"},{"value":"am","label":"አማርኛ","lang":"am"}]'>
//   <option value="braille">Braille</option>      (options can also be child <option> elements)
// </fidel-choice>
//
// A real <fieldset> with a visible <legend>, a hint, real radio buttons or
// checkboxes (each with its own <label>, a 44 px tall target and its own
// lang), and an error in words: "Choose one option." / "Choose at least one option."
// value: the chosen value (radio) or an array of values (checkbox); the value
// attribute may list them with commas. Events: fidel-field-change {value},
// fidel-field-invalid {message}, fidel-field-valid.
import { h } from '../../dom.js';
import { FidelFieldBase } from './base.js';
import { emit } from './common.js';
import { nameList } from './logic.js';

export class FidelChoice extends FidelFieldBase {
  get type() { return this.getAttribute('type') === 'checkbox' ? 'checkbox' : 'radio'; }

  createRoot(className) {
    return h('fieldset', { class: className });
  }

  buildLabel() {
    this.requiredEl = h('span', { class: 'fidel-field-required', 'aria-hidden': 'true' });
    this.labelText = h('span', {});
    return h('legend', { class: 'fidel-field-legend' }, this.labelText, ' ', this.requiredEl);
  }

  /** Options from the JSON attribute, else from child <option> elements. */
  readOptions(children) {
    try {
      const list = JSON.parse(this.getAttribute('options') || 'null');
      if (Array.isArray(list)) return list.map((o) => ({ value: String(o.value), label: String(o.label ?? o.value), lang: o.lang, checked: !!o.checked }));
    } catch {
      console.warn('<fidel-choice>: options must be JSON, e.g. [{"value":"a","label":"A"}]');
    }
    return children.filter((c) => c.localName === 'option').map((o) => ({
      value: o.getAttribute('value') ?? o.textContent.trim(), label: o.textContent.trim(),
      lang: o.getAttribute('lang'), checked: o.hasAttribute('selected') || o.hasAttribute('checked'),
    }));
  }

  buildField({ initial, children }) {
    const name = this.getAttribute('name') || this.ids.field;
    const chosen = initial !== null ? nameList(initial) : null;
    this.inputs = this.readOptions(children).map((option, i) => {
      const id = `${this.ids.field}-${i + 1}`;
      const input = h('input', { type: this.type, id, name, value: option.value });
      input.defaultChecked = chosen ? chosen.includes(option.value) : option.checked;
      input.checked = input.defaultChecked;
      return { input, row: h('div', { class: 'fidel-field-option' }, input, h('label', { for: id, lang: option.lang || null }, option.label)) };
    });
    this.control = this.inputs[0]?.input;
    this.root.append(this.labelEl, this.hintEl, h('div', { class: 'fidel-field-options' }, this.inputs.map((i) => i.row)), this.errorEl);
    this.root.addEventListener('change', () => {
      this.recheck();
      emit(this, 'fidel-field-change', { value: this.currentValue(), name: this.getAttribute('name') });
    });
  }

  /** The first chosen option gets focus (else the first option). */
  get fieldId() { return (this.inputs.find((i) => i.input.checked) || this.inputs[0])?.input.id; }

  focus(options) { document.getElementById(this.fieldId)?.focus(options); }

  currentValue() {
    const chosen = this.inputs.filter((i) => i.input.checked).map((i) => i.input.value);
    return this.type === 'checkbox' ? chosen : (chosen[0] ?? '');
  }

  setValue(value) {
    const values = Array.isArray(value) ? value.map(String) : nameList(value);
    for (const { input } of this.inputs) input.checked = values.includes(input.value);
    this.recheck();
  }

  problem() {
    if (!this.required || this.inputs.some((i) => i.input.checked)) return null;
    return { key: `choice.${this.type}` };
  }

  invalidControls() { return this.inputs.map((i) => i.input); }

  describedControls() { return [this.root]; }

  refresh() {
    super.refresh();
    const disabled = this.hasAttribute('disabled');
    this.root.disabled = disabled;
    // A required radio group: every radio says "required"; for checkboxes only the group does.
    for (const { input } of this.inputs) input.required = this.required && this.type === 'radio';
  }
}
