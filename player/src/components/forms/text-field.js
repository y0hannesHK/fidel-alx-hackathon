// <fidel-input label="Phone" name="phone" format="phone-et" required></fidel-input>
// <fidel-textarea label="About you" name="about" lang="am" rows="5" listen></fidel-textarea>
//
// A real <label> and a real <input>/<textarea> in the light DOM, so the field
// submits with the page's own <form> and works with any screen reader.
//
// Attributes
//   label (required), name, value, placeholder (never instead of the label),
//   autocomplete, inputmode, required, disabled, readonly, maxlength,
//   type (input only: text | search | email | tel), rows (textarea only),
//   lang (language of what is typed), ui-lang (en | am: our messages), hint,
//   format (mmss | phone-et | email), pattern + error (your own rule and words),
//   keyboard-hint ("off" to switch off), caps-warning (on | off),
//   listen (adds "Listen"), voice-api (e.g. /api/v1: the server voice for Listen),
//   speak (off | words | characters: typing voice; default from the settings),
//   describedby (ids of the page's own descriptions, read before ours),
//   field-class (the page's own class names for the inner <input>/<textarea>).
// Properties and methods: value, validity, checkValidity(), focus().
// Events (bubble, composed): fidel-field-input, fidel-field-change,
//   fidel-field-invalid {message}, fidel-field-valid, fidel-keyboard-hint {shown, expected},
//   fidel-caps-lock {on}.
//
// Errors are checked when you leave the field and on submit, never on every
// key ("1:" is fine while you are still typing). After an error, each change
// is re-checked and "Fixed" is said as soon as it is right.
import { h } from '../../dom.js';
import { announce } from '../../announce.js';
import { loadPrefs } from '../../prefs.js';
import { FidelFieldBase } from './base.js';
import { baseLang, emit, srOnly } from './common.js';
import { capsWarningDefault, checkFormat, echoText, keyboardHint, normalise } from './logic.js';
import { browserVoice, serverVoiceLanguages, speakWithBrowser, speakWithServer, stopSpeaking, voicesReady } from './speech.js';

const COPY = ['name', 'placeholder', 'autocomplete', 'inputmode', 'maxlength', 'rows', 'spellcheck', 'enterkeyhint'];
const NO_HINT_KEY = 'fidel-field-no-keyboard-hint:';

export class FidelTextField extends FidelFieldBase {
  static get observedAttributes() { return [...super.observedAttributes, 'lang']; }

  get multiline() { return false; }

  /** Language of what is typed (the host's lang, else the page's). */
  get contentLang() {
    return this.getAttribute('lang') || this.parentElement?.closest('[lang]')?.getAttribute('lang') || 'en';
  }

  buildField({ initial, content }) {
    const format = this.getAttribute('format');
    const extra = this.getAttribute('field-class'); // the page's own class(es) for the inner field
    const attrs = { id: this.ids.field, class: `fidel-field-control${extra ? ` ${extra}` : ''}`, lang: this.getAttribute('lang') || null };
    for (const name of COPY) if (this.hasAttribute(name)) attrs[name] = this.getAttribute(name);
    if (this.multiline) {
      attrs.rows = attrs.rows || '4';
      this.control = h('textarea', attrs);
      this.control.defaultValue = initial ?? content.trim();
    } else {
      const type = this.getAttribute('type');
      attrs.type = ['text', 'search', 'email', 'tel'].includes(type) ? type
        : format === 'phone-et' ? 'tel' : format === 'email' ? 'email' : 'text';
      if (format === 'phone-et') attrs.autocomplete ??= 'tel-national';
      if (format === 'email') attrs.autocomplete ??= 'email';
      if (format === 'mmss') attrs.spellcheck ??= 'false';
      this.control = h('input', attrs);
      this.control.defaultValue = initial ?? '';
    }
    this.control.value = this.control.defaultValue;

    // Messages under the field: error, keyboard-language hint, Caps Lock.
    this.kbText = h('span', {});
    this.kbHintEl = h('div', { class: 'fidel-field-note fidel-field-keyboard', id: `${this.ids.field}-kb`, hidden: true },
      h('p', {}, this.kbText),
      this.kbButton = h('button', { type: 'button', class: 'fidel-field-button', onclick: () => this.dontRemind() }));
    this.capsEl = h('p', { class: 'fidel-field-note fidel-field-caps', id: `${this.ids.field}-caps`, hidden: true });
    this.statusEl = h('p', { class: 'fidel-field-note fidel-field-status', hidden: true });
    this.buttons = h('div', { class: 'fidel-field-buttons', hidden: true });
    this.root.append(this.labelEl, this.hintEl, this.control, this.errorEl, this.kbHintEl, this.capsEl, this.statusEl, this.buttons);

    const c = this.control;
    c.addEventListener('input', (event) => this.onInput(event));
    c.addEventListener('compositionend', (event) => this.echo(event.data));
    c.addEventListener('change', () => this.onChange());
    c.addEventListener('blur', () => this.onBlur());
    c.addEventListener('keydown', (event) => this.onCapsKey(event));
    c.addEventListener('keyup', (event) => this.onCapsKey(event));
    this.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.speaking) {
        event.preventDefault();
        stopSpeaking();
        announce(this.tt('listen.stopped'));
      }
    });
    if (this.hasAttribute('listen')) this.setUpListen();
  }

  currentValue() { return this.control.value; }

  setValue(value) {
    this.control.value = value ?? '';
    this.recheck();
    this.updateKeyboardHint();
  }

  problem() {
    const value = this.control.value;
    if (!value.trim()) return this.required ? { key: 'field.errors.required' } : null;
    const max = Number(this.getAttribute('maxlength'));
    if (max > 0 && value.length > max) return { key: 'field.errors.tooLong', values: { max } };
    const found = checkFormat(this.getAttribute('format'), value, this.getAttribute('pattern'));
    if (!found) return null;
    if (found === 'pattern' && this.hasAttribute('error')) return { key: 'custom', custom: this.getAttribute('error') };
    return { key: `field.errors.${found}` };
  }

  /** The host's own error words (pattern + error) are not in our JSON. */
  tt(key, values) {
    if (key === 'custom') return this.getAttribute('error') || super.tt('field.errors.pattern');
    return super.tt(key, values);
  }

  describedBy() {
    const ids = super.describedBy();
    if (!this.kbHintEl.hidden) ids.push(this.kbHintEl.id);
    if (!this.capsEl.hidden) ids.push(this.capsEl.id);
    return ids;
  }

  refresh() {
    super.refresh();
    const c = this.control;
    c.required = this.required;
    c.disabled = this.hasAttribute('disabled');
    c.readOnly = this.hasAttribute('readonly');
    if (this.hasAttribute('lang')) c.setAttribute('lang', this.getAttribute('lang'));
    this.kbButton.textContent = this.tt('keyboard.dontRemind');
    if (this.expected) this.kbText.textContent = this.tt(`keyboard.${this.expected}`);
    if (!this.capsEl.hidden) this.capsEl.textContent = this.tt('caps.on');
    if (this.listenButton) this.updateListenButton();
  }

  afterReset() {
    this.updateKeyboardHint();
  }

  // ---------- typing --------------------------------------------------------------

  onInput(event) {
    emit(this, 'fidel-field-input', { value: this.control.value, name: this.getAttribute('name') });
    this.recheck();
    this.updateKeyboardHint();
    // Amharic input methods compose letters: those are said on compositionend.
    if (!event.isComposing && event.inputType !== 'insertCompositionText') this.echo(event.data);
  }

  onChange() {
    // Phone numbers are tidied to +251... once they are right.
    const format = this.getAttribute('format');
    if (format && !checkFormat(format, this.control.value)) {
      const tidy = normalise(format, this.control.value.trim());
      if (tidy !== this.control.value.trim()) this.control.value = tidy;
    }
    emit(this, 'fidel-field-change', { value: this.control.value, name: this.getAttribute('name') });
  }

  onBlur() {
    // Only once something is typed (Tab through an empty form gives no errors),
    // or to update an error already shown.
    if (this.control.value.trim() || this.errorState) this.checkValidity();
    this.hideCaps();
  }

  // ---------- keyboard-language hint ---------------------------------------------

  get hintStorageKey() { return NO_HINT_KEY + (this.getAttribute('name') || this.ids.field); }

  hintAllowed() {
    if (this.getAttribute('keyboard-hint') === 'off' || this.hintDone) return false;
    try {
      return !sessionStorage.getItem(this.hintStorageKey);
    } catch {
      return true;
    }
  }

  updateKeyboardHint() {
    const expected = this.hintAllowed() ? keyboardHint(this.control.value, this.contentLang) : null;
    if (expected && this.kbHintEl.hidden) {
      this.expected = expected;
      this.kbText.textContent = this.tt(`keyboard.${expected}`);
      this.kbHintEl.hidden = false;
      this.describe();
      announce(this.kbText.textContent);
      emit(this, 'fidel-keyboard-hint', { shown: true, expected });
    } else if (!expected && !this.kbHintEl.hidden) {
      this.hideKeyboardHint();
      this.hintDone = true; // shown once: it does not come back
    }
  }

  hideKeyboardHint() {
    this.kbHintEl.hidden = true;
    this.describe();
    emit(this, 'fidel-keyboard-hint', { shown: false, expected: this.expected });
  }

  dontRemind() {
    try {
      sessionStorage.setItem(this.hintStorageKey, '1');
    } catch { /* not remembered: still hidden for now */ }
    this.hintDone = true;
    this.hideKeyboardHint();
    announce(this.tt('keyboard.willNotRemind'));
    this.control.focus();
  }

  // ---------- Caps Lock -------------------------------------------------------------

  capsEnabled() {
    const setting = this.getAttribute('caps-warning');
    if (setting === 'on') return true;
    if (setting === 'off') return false;
    return capsWarningDefault(this.contentLang);
  }

  /** Shown and said only when Caps Lock CHANGES (first key: only if it is on). */
  onCapsKey(event) {
    if (!this.capsEnabled() || typeof event.getModifierState !== 'function') return;
    const on = event.getModifierState('CapsLock');
    if (on === this.capsOn || (this.capsOn === undefined && !on)) {
      this.capsOn = on;
      return;
    }
    this.capsOn = on;
    this.capsEl.textContent = this.tt('caps.on');
    this.capsEl.hidden = !on;
    this.describe();
    announce(this.tt(on ? 'caps.on' : 'caps.off'));
    emit(this, 'fidel-caps-lock', { on });
  }

  hideCaps() {
    this.capsOn = undefined; // unknown until the next key in this field
    if (this.capsEl.hidden) return;
    this.capsEl.hidden = true;
    this.describe();
  }

  // ---------- Listen ----------------------------------------------------------------

  async setUpListen() {
    await voicesReady();
    const lang = this.contentLang;
    this.voice = browserVoice(lang);
    const api = this.getAttribute('voice-api');
    if (!this.voice) {
      const languages = await serverVoiceLanguages(api);
      if (!languages.includes(baseLang(lang))) return; // no voice: no button
      this.serverApi = api;
    }
    this.listenText = h('span', {});
    this.listenButton = h('button', { type: 'button', class: 'fidel-field-button', onclick: () => this.toggleListen() },
      this.listenText, srOnly(''));
    this.voiceNote = h('span', { class: 'fidel-field-voice' });
    this.buttons.replaceChildren(this.listenButton, this.voiceNote);
    this.buttons.hidden = false;
    this.updateListenButton();
  }

  updateListenButton() {
    this.listenText.textContent = this.tt(this.speaking ? 'listen.stop' : 'listen.listen');
    this.listenButton.lastChild.textContent = `: ${this.label}`;
    this.voiceNote.textContent = this.tt('listen.computerVoice');
  }

  showStatus(message) {
    this.statusEl.textContent = message;
    this.statusEl.hidden = !message;
  }

  async toggleListen() {
    if (this.speaking) {
      stopSpeaking();
      announce(this.tt('listen.stopped'));
      return;
    }
    const words = this.control.value.trim();
    if (!words) {
      this.showStatus(this.tt('listen.empty'));
      announce(this.tt('listen.empty'));
      return;
    }
    this.speaking = true;
    this.showStatus(this.tt('listen.reading'));
    this.updateListenButton();
    const onEnd = () => {
      this.speaking = false;
      this.showStatus('');
      this.updateListenButton();
    };
    if (this.voice) {
      speakWithBrowser(words, this.voice, { onEnd });
      return;
    }
    try {
      await speakWithServer(this.serverApi, words, this.contentLang, { onEnd });
    } catch {
      this.showStatus(this.tt('listen.failed'));
      announce(this.tt('listen.failed'));
    }
  }

  // ---------- Typing voice ----------------------------------------------------------

  echoMode() {
    const own = this.getAttribute('speak');
    const mode = own || loadPrefs().typingVoice || 'off';
    return mode === 'letters' ? 'characters' : mode;
  }

  /** Say the letter or word just typed, if the person chose a typing voice. */
  echo(inserted) {
    const mode = this.echoMode();
    if (mode === 'off' || !inserted) return;
    const words = echoText(mode, { inserted, value: this.control.value, cursor: this.control.selectionStart ?? undefined });
    if (!words) return;
    const voice = browserVoice(this.contentLang);
    if (voice) speakWithBrowser(words, voice, { rate: 1.2 });
  }
}

export class FidelInput extends FidelTextField {}

export class FidelTextarea extends FidelTextField {
  get multiline() { return true; }
}
