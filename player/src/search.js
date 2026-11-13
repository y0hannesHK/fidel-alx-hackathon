// Transcript search: find cues containing the search text.

/** Lower-case and collapse spaces. (Ethiopic script has no case; this is harmless for it.) */
export function normalize(text) {
  return text.toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Search cues in one or more languages.
 * tracks: [{ lang, cues: [{ start, end, text }] }]
 * Returns [{ lang, start, end, text }] sorted by time.
 */
export function searchCues(tracks, query) {
  const needle = normalize(query);
  if (!needle) return [];
  const results = [];
  for (const { lang, cues } of tracks) {
    for (const cue of cues) {
      if (normalize(cue.text).includes(needle)) results.push({ lang, ...cue });
    }
  }
  return results.sort((a, b) => a.start - b.start);
}

/**
 * Split text into parts so the matches can be highlighted safely
 * (the caller builds DOM nodes; no HTML strings).
 * Returns [{ text, match: boolean }].
 */
export function splitMatches(text, query) {
  const needle = normalize(query);
  if (!needle) return [{ text, match: false }];
  const lower = text.toLocaleLowerCase();
  const parts = [];
  let from = 0;
  let index = lower.indexOf(needle, from);
  while (index !== -1) {
    if (index > from) parts.push({ text: text.slice(from, index), match: false });
    parts.push({ text: text.slice(index, index + needle.length), match: true });
    from = index + needle.length;
    index = lower.indexOf(needle, from);
  }
  if (from < text.length) parts.push({ text: text.slice(from), match: false });
  return parts;
}
