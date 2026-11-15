// <fidel-lang label="Lesson summary">
//   <div lang="en">…</div>  <div lang="am">…</div>  <div lang="om">…</div>
// </fidel-lang>
//
// B5. Switch language for ONE section, not the whole page. One real button
// per version, labelled in that language's own name (English, አማርኛ,
// Afaan Oromoo), with lang and translate="no"; the current one has
// aria-current="true". Only the chosen version is shown; the choice is
// remembered (prefs key sectionLanguage). Arabic gets dir="rtl".
// Without JavaScript every version stays visible.
//
// Attributes: label (what this section is), ui-lang (en | am)
// Event: fidel-lang-change { lang }
import { h, uid } from '../../dom.js';
import { emit } from '../../events.js';
import { announce } from '../../announce.js';
import { loadPrefs, savePrefs } from '../../prefs.js';
import { AUTONYMS, RTL, chooseLanguage } from './logic.js';
import { entry, langOf, translator } from './strings.js';

const code = (el) => (el.getAttribute('lang') || '').toLowerCase().split('-')[0];

export class FidelLang extends HTMLElement {
  connectedCallback() {
    if (this.bar) return;
    this.versions = [...this.children].filter((el) => code(el));
    if (this.versions.length < 2) return; // nothing to choose: leave the content as it is
    const ui = langOf(this);
    const tr = translator(ui);
    this.ui = ui;
    for (const el of this.versions) {
      if (RTL.has(code(el)) && !el.hasAttribute('dir')) el.setAttribute('dir', 'rtl');
    }
    const labelId = uid('fidel-lang-label');
    const label = this.getAttribute('label');
    this.buttons = this.versions.map((el) => h('button', {
      type: 'button', class: 'fidel-button', lang: code(el), translate: 'no',
      dir: RTL.has(code(el)) ? 'rtl' : null,
      onclick: () => this.show(code(el), true),
    }, AUTONYMS[code(el)] || code(el)));
    this.bar = h('div', { class: 'fidel-lang-bar', role: 'group', 'aria-labelledby': labelId, lang: ui },
      h('p', { class: 'fidel-lang-bar-label', id: labelId }, label ? tr('languageOf', { label }) : tr('languageChoice')),
      this.buttons);
    this.prepend(this.bar);
    const available = this.versions.map(code);
    this.show(chooseLanguage(available, loadPrefs().sectionLanguage, ui), false);
  }

  show(lang, byLearner) {
    this.versions.forEach((el) => { el.hidden = code(el) !== lang; });
    this.buttons.forEach((b) => {
      if (b.lang === lang) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });
    if (!byLearner) return;
    savePrefs({ ...loadPrefs(), sectionLanguage: lang });
    const names = entry(this.ui, 'languageNames') || {};
    announce(translator(this.ui)('showing', { name: names[lang] || AUTONYMS[lang] || lang }));
    emit(this, 'fidel-lang-change', { lang });
  }
}
