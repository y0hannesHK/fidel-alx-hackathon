// Video times for screen readers.
//
// "1:23" sounds like a number to a screen reader: Narrator says "one hundred
// twenty-three" (found in a Narrator test on 15 Nov 2026). So wherever a time
// is shown, we keep "1:23" on screen and add the time in words for screen
// readers only: "Play from 1:23 (1 minute 23 seconds)". The visible "1:23" stays
// in the accessible name, so speech-control users can still say
// "click Play from 1:23" (WCAG 2.5.3 Label in Name).

const WORDS = {
  en: { h: ['hour', 'hours'], m: ['minute', 'minutes'], s: ['second', 'seconds'], zero: '0 seconds' },
  am: { h: ['ሰዓት', 'ሰዓት'], m: ['ደቂቃ', 'ደቂቃ'], s: ['ሰከንድ', 'ሰከንድ'], zero: '0 ሰከንድ' },
};

/** 83.5 -> "1 minute 23 seconds" (whole seconds; Amharic with lang 'am'). */
export function spokenTime(seconds, lang = 'en') {
  const w = WORDS[lang] || WORDS.en;
  let rest = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(rest / 3600);
  rest -= hours * 3600;
  const minutes = Math.floor(rest / 60);
  const secs = rest - minutes * 60;
  const part = (n, [one, many]) => `${n} ${n === 1 ? one : many}`;
  const parts = [];
  if (hours) parts.push(part(hours, w.h));
  if (minutes) parts.push(part(minutes, w.m));
  if (secs) parts.push(part(secs, w.s));
  return parts.length ? parts.join(' ') : w.zero;
}

/** A span only screen readers read (no global CSS needed). */
function screenReaderOnly(text) {
  const span = document.createElement('span');
  span.className = 'fidel-spoken-time';
  Object.assign(span.style, {
    position: 'absolute', width: '1px', height: '1px', margin: '-1px', padding: '0',
    overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap', border: '0',
  });
  span.textContent = text;
  return span;
}

/**
 * Fill "{time}" in a text with the time shown as "1:23" plus, for screen
 * readers, "(1 minute 23 seconds)". Returns nodes to append to an element.
 *   button.append(...timeNodes('Play from {time}', 83, '1:23', 'en'))
 */
export function timeNodes(template, seconds, shown, lang = 'en') {
  const [before, after = ''] = template.split('{time}');
  const nodes = [];
  if (before) nodes.push(document.createTextNode(before));
  nodes.push(document.createTextNode(shown), screenReaderOnly(` (${spokenTime(seconds, lang)})`));
  if (after) nodes.push(document.createTextNode(after));
  return nodes;
}
