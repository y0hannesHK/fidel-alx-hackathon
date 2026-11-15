// <fidel-display-prefs target="#lesson"></fidel-display-prefs>
//
// B6. A "Display settings" button that opens a <dialog>: text size
// (100/125/150/200 %), line spacing, colours (normal, high contrast, yellow on
// black), stop motion, thicker focus outline. The settings are applied as
// fidel-dp-* classes ONLY to the element(s) named in target="..." and to the
// Fidel components on the page (fidel-* tags), never to <html> or <body>
// (Technical Guide plug-in rule). It is not an "overlay": it only changes how
// content that is already accessible is shown.
// Remembered in this browser (localStorage key fidel-display-prefs).
//
// Attributes: target (a CSS selector, optional), ui-lang (en | am)
// Event: fidel-display-prefs-change { size, spacing, contrast, still, focus }
import { h, radioGroup, uid } from '../../dom.js';
import { emit } from '../../events.js';
import { TEXT_SIZES, cleanDisplay, displayClasses } from './logic.js';
import { langOf, translator } from './strings.js';

const KEY = 'fidel-display-prefs';

function loadDisplay() {
  try {
    return cleanDisplay(JSON.parse(localStorage.getItem(KEY) || '{}'));
  } catch {
    return cleanDisplay({});
  }
}
function saveDisplay(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Not remembered next time; still applied now.
  }
}

export class FidelDisplayPrefs extends HTMLElement {
  connectedCallback() {
    if (this.dialog) return;
    this.settings = loadDisplay();
    this.applied = new Set();
    this.build();
    this.apply();
    // Components defined later than this one get the settings too.
    if (document.readyState !== 'complete') window.addEventListener('load', () => this.apply(), { once: true });
  }

  /** The elements the settings change: the target(s), and Fidel components outside them. */
  targets() {
    let named = [];
    const selector = this.getAttribute('target');
    if (selector) {
      try {
        named = [...document.querySelectorAll(selector)].filter((el) => el !== document.body && el !== document.documentElement);
      } catch {
        console.warn('<fidel-display-prefs>: target is not a valid CSS selector:', selector);
      }
    }
    const inside = (el) => named.some((t) => t.contains(el));
    const components = [...document.querySelectorAll('*')]
      .filter((el) => el.localName.startsWith('fidel-') && !inside(el))
      .filter((el, i, all) => !all.some((other) => other !== el && other.contains(el))); // outermost only
    return [...named, ...components];
  }

  apply() {
    const classes = displayClasses(this.settings);
    for (const el of this.applied) [...el.classList].filter((c) => c.startsWith('fidel-dp-')).forEach((c) => el.classList.remove(c));
    this.applied = new Set(this.targets());
    for (const el of this.applied) {
      el.classList.add(...classes);
      if (this.settings.still) {
        el.querySelectorAll('video').forEach((v) => { if (!v.paused && (v.autoplay || v.loop)) v.pause(); });
      }
    }
  }

  change(key, value) {
    this.settings = cleanDisplay({ ...this.settings, [key]: value });
    saveDisplay(this.settings);
    this.apply();
    emit(this, 'fidel-display-prefs-change', { ...this.settings });
  }

  build() {
    const lang = langOf(this);
    const tr = translator(lang);
    const titleId = uid('fidel-display-title');
    const check = (key, label) => {
      const id = uid('fidel-display');
      return h('div', { class: 'fidel-display-check' },
        h('input', { type: 'checkbox', id, checked: this.settings[key], onchange: (e) => this.change(key, e.target.checked) }),
        h('label', { for: id }, label));
    };
    const body = () => [
      radioGroup({
        legend: tr('textSize'), name: uid('fidel-dp-size'), checked: String(this.settings.size),
        options: TEXT_SIZES.map((s) => ({ value: String(s), label: `${s} %` })),
        onChange: (v) => this.change('size', Number(v)),
      }),
      radioGroup({
        legend: tr('lineSpacing'), name: uid('fidel-dp-spacing'), checked: this.settings.spacing,
        options: [{ value: 'normal', label: tr('spacingNormal') }, { value: 'wide', label: tr('spacingWide') }],
        onChange: (v) => this.change('spacing', v),
      }),
      radioGroup({
        legend: tr('contrast'), name: uid('fidel-dp-contrast'), checked: this.settings.contrast,
        options: [{ value: 'normal', label: tr('contrastNormal') }, { value: 'high', label: tr('contrastHigh') },
          { value: 'yellow', label: tr('contrastYellow') }],
        onChange: (v) => this.change('contrast', v),
      }),
      check('still', tr('stopMotion')),
      check('focus', tr('thickFocus')),
    ];
    const controls = h('div', {}, body());
    const opener = h('button', {
      type: 'button', class: 'fidel-button', 'aria-haspopup': 'dialog',
      onclick: () => this.dialog.showModal(),
    }, tr('displaySettings'));
    this.dialog = h('dialog', { class: 'fidel-display-dialog', 'aria-labelledby': titleId, lang },
      h('h2', { id: titleId }, tr('displaySettings')),
      h('p', {}, tr('displayNote')),
      controls,
      h('div', { class: 'fidel-display-actions' },
        h('button', {
          type: 'button', class: 'fidel-button',
          onclick: () => {
            this.settings = cleanDisplay({});
            saveDisplay(this.settings);
            this.apply();
            controls.replaceChildren(...body());
            emit(this, 'fidel-display-prefs-change', { ...this.settings });
          },
        }, tr('reset')),
        h('button', { type: 'button', class: 'fidel-button', onclick: () => this.dialog.close() }, tr('close'))));
    // Escape (or Close) closes the dialog; focus goes back to the button.
    this.dialog.addEventListener('close', () => opener.focus());
    this.replaceChildren(opener, this.dialog);
  }
}
