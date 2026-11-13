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

// 5. Recorded audio descriptions. Most phones have no Amharic voice, so
//    reading Amharic description text aloud does not work. When a description
//    has a recording (player.fidelRecordings = { am: [{ start, url }] }), we
//    play the recording instead of synthetic speech. While it plays, the
//    lesson is paused (if the learner chose "pause during description") or
//    made quieter, then restored.
const flatten = (component) =>
  component.type === 'string' ? component.value : (component.children || []).map(flatten).join('');

function playRecording(player, url, text) {
  player.fidelDescAudio?.pause();
  const media = player.media;
  if (player.prefDescVisible && player.$descDiv) player.$descDiv.text(text);
  let restoreVolume = null;
  if (player.prefDescPause) {
    player.pauseMedia();
    player.pausedForDescription = true;
  } else {
    restoreVolume = media.volume;
    media.volume = restoreVolume * 0.3; // "ducking": keep the lesson audible but quiet
  }
  const audio = new Audio(url);
  player.fidelDescAudio = audio;
  const finish = () => {
    if (player.fidelDescAudio !== audio) return; // a newer description took over
    player.fidelDescAudio = null;
    if (restoreVolume !== null) media.volume = restoreVolume;
    if (player.pausedForDescription) {
      player.pausedForDescription = false;
      player.playMedia();
    }
  };
  audio.addEventListener('ended', finish);
  audio.addEventListener('error', finish);
  audio.play().catch(finish);
}

const originalShowDescription = proto.showDescription;
proto.showDescription = function (now) {
  const lang = this.selectedDescriptions?.language;
  const recordings = this.fidelRecordings?.[lang];
  if (!recordings?.length || !this.playing || !this.descOn) return originalShowDescription.call(this, now);
  const cues = this.selectedDescriptions.cues || [];
  const index = cues.findIndex((cue) => cue.start <= now && cue.end > now);
  const recording = index >= 0 && recordings.find((r) => Math.abs(r.start - cues[index].start) < 0.05);
  if (!recording) return originalShowDescription.call(this, now);
  if (this.currentDescription === index) return;
  this.currentDescription = index;
  playRecording(this, recording.url, flatten(cues[index].components));
};

export default AblePlayer;
