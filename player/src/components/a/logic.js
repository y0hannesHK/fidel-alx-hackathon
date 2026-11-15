// Package A: pure logic (no DOM), so it can be unit tested with node:test.
// See player/test/components-a.test.js.

/** Fill {placeholders} in a text: fill('Line {n}', { n: 2 }) -> 'Line 2'. */
export function fill(text, values = {}) {
  return String(text).replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}

/** '1:23' -> 83, '1:02:03' -> 3723, '45' -> 45. Bad input -> null. */
export function parseTime(text) {
  if (text === null || text === undefined) return null;
  const parts = String(text).trim().split(':');
  if (!parts.length || parts.length > 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return null;
  return parts.reduce((total, part) => total * 60 + Number(part), 0);
}

/** 83 -> '1:23', 3723 -> '1:02:03'. */
export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const secs = String(s % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${secs}` : `${minutes}:${secs}`;
}

/** Leading whitespace of a line: { spaces, tabs, rest }. */
export function indentOf(line) {
  const match = /^[ \t]*/.exec(line)[0];
  return {
    spaces: (match.match(/ /g) || []).length,
    tabs: (match.match(/\t/g) || []).length,
    rest: line.slice(match.length),
  };
}

/**
 * Spell punctuation in words: 'print(i)' -> 'print open bracket i close bracket'.
 * symbolWords maps a symbol (one or more characters) to its words; longer
 * symbols win ('==' before '=').
 */
export function spellSymbols(text, symbolWords) {
  const symbols = Object.keys(symbolWords).sort((a, b) => b.length - a.length);
  const out = [];
  let word = '';
  for (let i = 0; i < text.length;) {
    const symbol = symbols.find((s) => text.startsWith(s, i));
    if (symbol) {
      if (word.trim()) out.push(word.trim());
      word = '';
      out.push(symbolWords[symbol]);
      i += symbol.length;
    } else if (/\s/.test(text[i])) {
      if (word.trim()) out.push(word.trim());
      word = '';
      i += 1;
    } else {
      word += text[i];
      i += 1;
    }
  }
  if (word.trim()) out.push(word.trim());
  return out.join(' ');
}

/**
 * How one line of code is read in the line-by-line view:
 * 'Line 2 of 3, indent 4 spaces: print open bracket i close bracket'.
 * strings: the language file (lineOf, indentSpace(s), indentTab(s), blankLine, symbolWords).
 */
export function describeLine(line, n, total, strings, { symbols = true } = {}) {
  const head = fill(strings.lineOf, { n, total });
  const { spaces, tabs, rest } = indentOf(line);
  if (!rest.trim()) return `${head}: ${strings.blankLine}`;
  const indents = [];
  if (spaces) indents.push(spaces === 1 ? strings.indentSpace : fill(strings.indentSpaces, { n: spaces }));
  if (tabs) indents.push(tabs === 1 ? strings.indentTab : fill(strings.indentTabs, { n: tabs }));
  const code = symbols ? spellSymbols(rest, strings.symbolWords) : rest.trimEnd();
  return `${[head, ...indents].join(', ')}: ${code}`;
}

/** Code text -> lines, without the empty first/last line that HTML markup often adds. */
export function codeLines(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  while (lines.length > 1 && !lines[0].trim()) lines.shift();
  while (lines.length > 1 && !lines[lines.length - 1].trim()) lines.pop();
  return lines;
}

/**
 * Sentences of a text as [start, end) offsets, for reading aloud one
 * sentence at a time. Ends at . ! ? and the Ethiopic full stop and question
 * mark (። ፧ ፨); the end includes the punctuation.
 */
export function splitSentences(text) {
  const result = [];
  const re = /[^.!?።፧፨]+(?:[.!?።፧፨]+|$)/g;
  let match;
  while ((match = re.exec(text))) {
    if (!match[0]) { re.lastIndex += 1; continue; }
    const lead = match[0].length - match[0].trimStart().length;
    const start = match.index + lead;
    const end = match.index + match[0].trimEnd().length;
    if (end > start) result.push([start, end]);
  }
  return result;
}

/** Index of the snapshot that is current at `seconds` (times sorted ascending), or -1. */
export function currentIndex(times, seconds) {
  let index = -1;
  times.forEach((time, i) => { if (time <= seconds + 0.25) index = i; });
  return index;
}

/** Saved progress of <fidel-steps>: keep only valid numbers. */
export function cleanStepState(saved, total) {
  const state = saved && typeof saved === 'object' ? saved : {};
  const current = Number.isInteger(state.current) && state.current >= 0 && state.current < total ? state.current : 0;
  const done = Array.isArray(state.done) ? [...new Set(state.done.filter((i) => Number.isInteger(i) && i >= 0 && i < total))] : [];
  return { current, done };
}
