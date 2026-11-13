// The visible "Accessibility settings" panel under the video.
//
// Everything uses native HTML controls (buttons, radio buttons in fieldsets,
// <details> disclosures), so it works with keyboard, NVDA, TalkBack and touch
// without custom ARIA widgets. The panel only reports what the learner chose
// (through the `on` callbacks); fidel-player.js applies it.
import { h, radioGroup } from './dom.js';
import { t, UI_LANGUAGES } from './strings.js';
import { COLOUR_PRESETS, BACKGROUND_OPACITIES, CAPTION_POSITIONS } from './caption-style.js';
import { CAPTION_SIZE } from './prefs.js';
import { SIGN_CORNERS } from './sign-window.js';

const LANGUAGE_NAMES = { en: 'English', am: 'አማርኛ' };

/**
 * options: {
 *   lang, idPrefix, headingLevel, prefs,
 *   captionLangs: ['en', 'am'], captionLang: 'en' | 'am' | 'off',
 *   hasSign, signVisible,
 *   on: { uiLang, captionLang, captionSize, captionColours, captionBackground,
 *         captionPosition, signVisible, signLayout, signSize, signCorner }
 * }
 */
export function buildPanel(options) {
  const { lang, idPrefix, headingLevel, prefs, on } = options;
  const tr = (key, values) => t(lang, key, values);
  const name = (part) => `${idPrefix}-${part}`; // radio group names, unique per player
  const headingId = `${idPrefix}-settings-heading`;

  // --- Interface language: two toggle buttons -----------------------------
  const languageButtons = UI_LANGUAGES.map(({ code, name: label }) =>
    h(
      'button',
      {
        type: 'button',
        class: 'fidel-button',
        lang: code,
        'aria-pressed': String(code === lang),
        'data-fidel-ui-lang': code,
        onclick: () => code !== lang && on.uiLang(code),
      },
      label
    )
  );

  // --- Captions --------------------------------------------------------------
  const sizeOutput = h('output', { class: 'fidel-size-value' }, `${prefs.captionSize}%`);
  const smaller = h('button', { type: 'button', class: 'fidel-button', onclick: () => changeSize(-1) }, '− ', tr('smaller'));
  const larger = h('button', { type: 'button', class: 'fidel-button', onclick: () => changeSize(1) }, '+ ', tr('larger'));
  let size = prefs.captionSize;
  function changeSize(direction) {
    size = Math.min(CAPTION_SIZE.max, Math.max(CAPTION_SIZE.min, size + direction * CAPTION_SIZE.step));
    sizeOutput.value = `${size}%`;
    smaller.disabled = size <= CAPTION_SIZE.min;
    larger.disabled = size >= CAPTION_SIZE.max;
    on.captionSize(size);
  }
  smaller.disabled = size <= CAPTION_SIZE.min;
  larger.disabled = size >= CAPTION_SIZE.max;

  const captionLangGroup = radioGroup({
    legend: tr('captionLanguage'),
    name: name('caption-lang'),
    options: [
      { value: 'off', label: tr('off') },
      ...options.captionLangs.map((code) => ({ value: code, label: LANGUAGE_NAMES[code] || code, lang: code })),
    ],
    checked: options.captionLang,
    onChange: on.captionLang,
  });

  const sizeGroupLabelId = `${idPrefix}-size-label`;
  const captions = h(
    'details',
    { class: 'fidel-group', open: true },
    h('summary', {}, tr('captions')),
    h(
      'div',
      { class: 'fidel-group-body' },
      captionLangGroup,
      h(
        'div',
        { class: 'fidel-size', role: 'group', 'aria-labelledby': sizeGroupLabelId },
        h('span', { id: sizeGroupLabelId, class: 'fidel-label' }, tr('textSize')),
        h('div', { class: 'fidel-row' }, smaller, sizeOutput, larger)
      ),
      radioGroup({
        legend: tr('colours'),
        name: name('caption-colours'),
        options: Object.entries(COLOUR_PRESETS).map(([value, preset]) => ({ value, label: tr(preset.labelKey) })),
        checked: prefs.captionColours,
        onChange: on.captionColours,
      }),
      radioGroup({
        legend: tr('background'),
        name: name('caption-bg'),
        options: BACKGROUND_OPACITIES.map((value) => ({
          value: String(value),
          label: value === 100 ? tr('solid') : `${value}%`,
        })),
        checked: String(prefs.captionBackground),
        onChange: (value) => on.captionBackground(Number(value)),
      }),
      radioGroup({
        legend: tr('position'),
        name: name('caption-position'),
        options: Object.entries(CAPTION_POSITIONS).map(([value, key]) => ({ value, label: tr(key) })),
        checked: prefs.captionPosition,
        onChange: on.captionPosition,
      })
    )
  );

  // --- Sign language ---------------------------------------------------------
  let signToggle = null;
  let cornerGroup = null;
  let signBody;
  if (!options.hasSign) {
    signBody = h('p', {}, tr('noSign'));
  } else {
    signToggle = h(
      'button',
      {
        type: 'button',
        class: 'fidel-button',
        'aria-pressed': String(options.signVisible),
        onclick: () => on.signVisible(signToggle.getAttribute('aria-pressed') !== 'true'),
      },
      tr('showSign')
    );
    cornerGroup = h(
      'fieldset',
      { class: 'fidel-corners', hidden: prefs.signLayout !== 'floating' },
      h('legend', {}, tr('corner')),
      h(
        'div',
        { class: 'fidel-row' },
        SIGN_CORNERS.map((corner) =>
          h(
            'button',
            { type: 'button', class: 'fidel-button', onclick: () => on.signCorner(corner) },
            tr(corner.replace(/-(\w)/, (_, c) => c.toUpperCase())) // 'top-left' -> 'topLeft'
          )
        )
      )
    );
    signBody = [
      signToggle,
      radioGroup({
        legend: tr('signPlace'),
        name: name('sign-layout'),
        options: [
          { value: 'docked', label: tr('besideVideo') },
          { value: 'floating', label: tr('overVideo') },
        ],
        checked: prefs.signLayout,
        onChange: (layout) => {
          cornerGroup.hidden = layout !== 'floating';
          on.signLayout(layout);
        },
      }),
      radioGroup({
        legend: tr('size'),
        name: name('sign-size'),
        options: ['small', 'medium', 'large'].map((value) => ({ value, label: tr(value) })),
        checked: prefs.signSize,
        onChange: on.signSize,
      }),
      cornerGroup,
    ];
  }
  const sign = h(
    'details',
    { class: 'fidel-group', open: true },
    h('summary', {}, tr('sign')),
    h('div', { class: 'fidel-group-body' }, signBody)
  );

  const panel = h(
    'section',
    { class: 'fidel-panel', 'aria-labelledby': headingId },
    h(`h${headingLevel}`, { id: headingId, class: 'fidel-heading' }, tr('settings')),
    h(
      'div',
      { class: 'fidel-ui-lang', role: 'group', 'aria-labelledby': `${idPrefix}-ui-lang-label` },
      h('span', { id: `${idPrefix}-ui-lang-label`, class: 'fidel-label' }, tr('interfaceLanguage')),
      h('div', { class: 'fidel-row' }, languageButtons)
    ),
    captions,
    sign
  );

  // Methods so fidel-player.js can keep the panel in step when the learner
  // uses Able Player's own buttons instead (e.g. the CC button).
  return {
    element: panel,
    setCaptionLang(lang) {
      for (const input of captionLangGroup.querySelectorAll('input')) {
        input.checked = input.value === lang;
      }
    },
    setSignVisible(visible) {
      signToggle?.setAttribute('aria-pressed', String(visible));
    },
  };
}
