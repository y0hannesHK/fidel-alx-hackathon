// <fidel-file label="Your CV" name="cv" accept=".pdf,.doc,.docx" max-size="5MB" hint="..." required>
//
// A NATIVE <input type="file">. The hint says in words what is accepted
// ("PDF or Word document, up to 5 MB"). After choosing, the file's name and
// size are shown and said ("Chosen: cv.pdf, 1.2 MB"). A wrong type or a file
// that is too big is refused at once, in words that say what to do. "Remove"
// empties the field and puts you back in it.
// Attributes: label, name, accept, max-size (e.g. 50MB, 500KB or bytes),
//   hint (added after the automatic one), required, disabled, ui-lang.
// Events: fidel-field-change {file: {name, size, type} | null},
//   fidel-field-invalid {message}, fidel-field-valid.
import { h } from '../../dom.js';
import { announce } from '../../announce.js';
import { FidelFieldBase } from './base.js';
import { emit, srOnly } from './common.js';
import { acceptKinds, extensionOf, fileAccepted, parseSize, sizeText } from './logic.js';

export class FidelFile extends FidelFieldBase {
  buildField() {
    this.control = h('input', {
      type: 'file', id: this.ids.field, class: 'fidel-field-control',
      name: this.getAttribute('name') || null, accept: this.getAttribute('accept') || null,
    });
    this.chosenEl = h('p', { class: 'fidel-field-chosen', id: `${this.ids.field}-chosen`, hidden: true });
    this.removeText = h('span', {});
    this.removeName = srOnly('');
    this.removeButton = h('button', { type: 'button', class: 'fidel-field-button', onclick: () => this.remove() }, this.removeText, this.removeName);
    this.buttons = h('div', { class: 'fidel-field-buttons', hidden: true }, this.removeButton);
    this.root.append(this.labelEl, this.hintEl, this.control, this.chosenEl, this.errorEl, this.buttons);
    this.control.addEventListener('change', () => this.onChoose());
  }

  get maxBytes() { return parseSize(this.getAttribute('max-size')); }

  get file() { return this.control.files?.[0] || null; }

  /** "PDF or Word document" from the accept attribute. */
  typesInWords() {
    const words = acceptKinds(this.getAttribute('accept')).map((kind) => {
      const known = this.tt(`file.kinds.${kind}`);
      return known === `file.kinds.${kind}` ? kind.replace(/^\./, '').toUpperCase() : known;
    });
    if (!words.length) return this.tt('file.anyFile');
    if (words.length === 1) return words[0];
    return `${words.slice(0, -1).join(', ')} ${this.tt('file.or')} ${words.at(-1)}`;
  }

  hintText() {
    const max = this.maxBytes;
    const types = this.typesInWords();
    const auto = max ? this.tt('file.upTo', { types, size: sizeText(max) }) : types;
    return [auto, this.getAttribute('hint')].filter(Boolean).join('. ');
  }

  onChoose() {
    const file = this.file;
    this.rejected = null;
    if (file && !fileAccepted(this.getAttribute('accept'), file)) {
      this.rejected = { key: 'file.wrongType', values: { ext: extensionOf(file.name) || file.type || '?', types: this.typesInWords() } };
    } else if (file && this.maxBytes && file.size > this.maxBytes) {
      this.rejected = { key: 'file.tooBig', values: { size: sizeText(file.size), max: sizeText(this.maxBytes) } };
    }
    if (this.rejected) {
      this.control.value = ''; // never keep a file that cannot be sent
      this.showChosen(null);
      this.checkValidity();
      return;
    }
    this.hideError();
    this.showChosen(file);
    if (file) announce(this.chosenEl.textContent);
    emit(this, 'fidel-field-change', { file: file && { name: file.name, size: file.size, type: file.type }, name: this.getAttribute('name') });
  }

  showChosen(file) {
    this.chosenFile = file;
    this.chosenEl.textContent = file ? this.tt('file.chosen', { name: file.name, size: sizeText(file.size) }) : '';
    this.chosenEl.hidden = !file;
    this.buttons.hidden = !file;
    this.removeName.textContent = file ? `: ${file.name}` : '';
    this.describe();
  }

  remove() {
    this.control.value = '';
    this.rejected = null;
    this.showChosen(null);
    announce(this.tt('file.removed'));
    emit(this, 'fidel-field-change', { file: null, name: this.getAttribute('name') });
    this.control.focus();
  }

  afterReset() {
    this.rejected = null;
    this.showChosen(null);
  }

  describedBy() {
    const ids = super.describedBy();
    if (!this.chosenEl.hidden) ids.push(this.chosenEl.id);
    return ids;
  }

  currentValue() { return this.file; }

  setValue(value) {
    // Browsers only let a person choose a file; only clearing is possible.
    if (!value) this.remove();
  }

  problem() {
    if (this.rejected) return this.rejected;
    return this.required && !this.file ? { key: 'file.required' } : null;
  }

  refresh() {
    super.refresh();
    this.control.required = this.required;
    this.control.disabled = this.hasAttribute('disabled');
    this.removeText.textContent = this.tt('file.remove');
    if (this.chosenFile) this.chosenEl.textContent = this.tt('file.chosen', { name: this.chosenFile.name, size: sizeText(this.chosenFile.size) });
  }
}
