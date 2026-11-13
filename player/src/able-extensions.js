// Small changes to Able Player's behaviour, made from outside.
//
// We do NOT edit Able Player's files. Each change below wraps one Able Player
// method on its prototype, calls the original, then adjusts the result.
// If Able Player is upgraded, check these method names still exist.
import AblePlayer from 'ableplayer';
import amharic from '../i18n/am.json';

// Text that Fidel wants to say differently in English.
const ENGLISH_OVERRIDES = {
  autoScroll: 'Follow along',
};

const proto = AblePlayer.prototype;

// 1. Add Amharic to the list of interface languages Able Player accepts.
const originalGetSupportedLangs = proto.getSupportedLangs;
proto.getSupportedLangs = function () {
  const langs = originalGetSupportedLangs.call(this);
  return this.fidelOnlyBuiltInLangs ? langs : { ...langs, am: 'Amharic' };
};

// getSampleDescriptionText() reads Able Player's private table for every
// supported language, which has no "am" entry. Let it see only the built-in
// languages, then add the Amharic sample ourselves.
const originalGetSampleDescriptionText = proto.getSampleDescriptionText;
proto.getSampleDescriptionText = function () {
  this.fidelOnlyBuiltInLangs = true;
  try {
    originalGetSampleDescriptionText.call(this);
  } finally {
    this.fidelOnlyBuiltInLangs = false;
  }
  if (this.translationFiles && Array.isArray(this.sampleText)) {
    this.sampleText.push({ lang: 'Amharic', text: amharic.sampleDescriptionText });
  }
};

// 2. Use our Amharic strings when the player language is "am".
//    Able Player only knows its own bundled languages, so for "am" it would
//    load nothing and fall back to English.
const originalGetTranslationText = proto.getTranslationText;
proto.getTranslationText = function () {
  originalGetTranslationText.call(this);
  if (this.lang === 'am') {
    this.tt = { ...amharic };
    this.translationFiles = true;
  } else if (this.lang === 'en') {
    this.tt = { ...this.tt, ...ENGLISH_OVERRIDES };
  }
};

// 3. Make the transcript keyboard-usable by default, so every line can be
//    reached with Tab and activated with Enter (the brief requires this).
//    Users can still turn it off in Able Player's Preferences.
const originalGetAvailablePreferences = proto.getAvailablePreferences;
proto.getAvailablePreferences = function () {
  const prefs = originalGetAvailablePreferences.call(this);
  const tabbable = prefs.find((p) => p.name === 'prefTabbable');
  if (tabbable) tabbable.default = 1;
  return prefs;
};

// 4. Fix the sign video's file type. Able Player 5.0.0 builds it from the
//    last three letters of the file name, so "sign.webm" becomes "video/ebm"
//    and the browser refuses to play it.
const originalInjectSignPlayerCode = proto.injectSignPlayerCode;
proto.injectSignPlayerCode = function () {
  originalInjectSignPlayerCode.call(this);
  const source = this.signVideo?.querySelector('source');
  if (source) {
    const extension = (source.getAttribute('src') || '').split('?')[0].split('.').pop().toLowerCase();
    const types = { webm: 'video/webm', mp4: 'video/mp4', ogv: 'video/ogg' };
    if (types[extension] && source.type !== types[extension]) {
      source.type = types[extension];
      this.signVideo.load();
    }
  }
};

export default AblePlayer;
