// Turning captions on/off, picking their language, and placing them.
// These functions drive Able Player directly, so our visible panel and
// Able Player's own CC button stay in step.

/** Which caption language is showing now: 'en', 'am', ... or 'off'. */
export function currentCaptionLang(player) {
  return player.captionsOn && player.captionLang ? player.captionLang : 'off';
}

/** Show captions in a language ('en', 'am', ...) or turn them off ('off'). */
export function selectCaptions(player, lang) {
  if (lang === 'off') {
    player.captionsOn = false;
    player.prefCaptions = 0;
  } else {
    if (!player.captions.some((track) => track.language === lang)) return;
    player.captionsOn = true;
    player.prefCaptions = 1;
    player.syncTrackLanguages('captions', lang); // also switches the transcript
    player.currentCaption = -1; // force the caption box to redraw
  }
  player.updateCaption(player.media.currentTime);
  if (player.captionsPopup) player.updateCaptionsMenu(lang === 'off' ? undefined : lang);
  player.updatePreferences('prefCaptions');
  player.refreshControls('captions');
  markCaptionLanguage(player);
}

/** Put the right lang attribute on the caption box, so screen readers and
 *  fonts treat Amharic text as Amharic (WCAG 3.1.2). */
export function markCaptionLanguage(player) {
  const box = player.$captionsWrapper?.[0];
  if (!box) return;
  const lang = currentCaptionLang(player);
  if (lang === 'off') box.removeAttribute('lang');
  else box.setAttribute('lang', lang);
}

/** position: 'below' | 'over-bottom' | 'over-top' */
export function placeCaptions(player, host, position) {
  player.prefCaptionsPosition = position === 'below' ? 'below' : 'overlay';
  player.positionCaptions();
  player.updatePreferences('prefCaptionsPosition');
  host.dataset.captionPosition = position; // fidel.css moves "over-top" up
}
