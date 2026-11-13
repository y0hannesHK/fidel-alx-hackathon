// Caption appearance. We set CSS custom properties on <fidel-player>;
// fidel.css applies them to Able Player's caption box.

// Colour presets from the brief. All pairs have contrast well above 4.5:1.
export const COLOUR_PRESETS = {
  'white-on-black': { text: '#ffffff', background: '0 0 0', labelKey: 'whiteOnBlack' },
  'yellow-on-black': { text: '#ffff00', background: '0 0 0', labelKey: 'yellowOnBlack' },
  'black-on-white': { text: '#000000', background: '255 255 255', labelKey: 'blackOnWhite' },
  'black-on-cream': { text: '#000000', background: '255 248 220', labelKey: 'blackOnCream' },
};

export const BACKGROUND_OPACITIES = [100, 75, 50];

export const CAPTION_POSITIONS = {
  below: 'belowVideo',
  'over-bottom': 'overBottom',
  'over-top': 'overTop',
};

/** Returns the CSS custom properties for the given preferences. */
export function captionCssVars(prefs) {
  const preset = COLOUR_PRESETS[prefs.captionColours] || COLOUR_PRESETS['white-on-black'];
  return {
    '--fidel-caption-size': `${prefs.captionSize}%`,
    '--fidel-caption-color': preset.text,
    '--fidel-caption-bg': `rgb(${preset.background} / ${prefs.captionBackground / 100})`,
  };
}
