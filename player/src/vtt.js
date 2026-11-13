// Small WebVTT helpers: parse cues, and format times for people.

const TIMING = /^((?:\d+:)?\d{1,2}:\d{2}(?:\.\d+)?)\s+-->\s+((?:\d+:)?\d{1,2}:\d{2}(?:\.\d+)?)/;

/** "01:02:03.500" or "02:03.500" -> seconds */
export function parseTimestamp(text) {
  return text.split(':').reduce((total, part) => total * 60 + parseFloat(part), 0);
}

/**
 * Parse WebVTT text into cues: [{ start, end, text }].
 * Cue settings, NOTE/STYLE blocks and simple tags like <i> are ignored.
 */
export function parseVtt(source) {
  const cues = [];
  const blocks = source.replace(/\r\n?/g, '\n').split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split('\n');
    if (/^(NOTE|STYLE|REGION)\b/.test(lines[0].trim())) continue; // comments and styling, not cues
    const timingIndex = lines.findIndex((line) => TIMING.test(line));
    if (timingIndex === -1) continue;
    const [, start, end] = lines[timingIndex].match(TIMING);
    const text = lines
      .slice(timingIndex + 1)
      .join('\n')
      .replace(/<[^>]+>/g, '') // strip tags such as <i> or <v Speaker>
      .trim();
    if (text) cues.push({ start: parseTimestamp(start), end: parseTimestamp(end), text });
  }
  return cues;
}

/** 93.4 -> "1:33", 3725 -> "1:02:05" */
export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
