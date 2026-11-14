// The transcript section: a heading, a search box with results, and the
// interactive transcript itself (Able Player fills `body` with the text and
// highlights the current line while the video plays).
import { h } from './dom.js';
import { t } from './strings.js';
import { searchCues, splitMatches } from './search.js';
import { formatTime } from './vtt.js';

/**
 * options: {
 *   lang, idPrefix, headingLevel,
 *   loadTracks: () => Promise<[{ lang, cues }]>,  // caption text to search
 *   playFrom: (seconds) => void,
 *   transcriptLang: () => 'en' | 'am' | 'om',       // language shown now
 * }
 * Returns { element, bodyId }.
 */
export function buildTranscript({ lang, idPrefix, headingLevel, loadTracks, playFrom, transcriptLang }) {
  const tr = (key, values) => t(lang, key, values);
  const headingId = `${idPrefix}-transcript-heading`;
  const inputId = `${idPrefix}-search`;
  const bodyId = `${idPrefix}-transcript-body`;

  const input = h('input', { type: 'search', id: inputId, autocomplete: 'off' });
  const status = h('p', { class: 'fidel-search-status', role: 'status' });
  const results = h('ul', { class: 'fidel-search-results' });

  async function runSearch(event) {
    event.preventDefault();
    const query = input.value.trim();
    results.replaceChildren();
    if (!query) {
      status.textContent = '';
      return;
    }
    const matches = searchCues(await loadTracks(), query);
    status.textContent =
      matches.length === 0
        ? tr('noResults', { q: query })
        : matches.length === 1
          ? tr('oneResult', { q: query })
          : tr('results', { n: matches.length, q: query });

    for (const match of matches) {
      const text = splitMatches(match.text, query).map((part) =>
        part.match ? h('mark', {}, part.text) : part.text
      );
      results.append(
        h(
          'li',
          {},
          h(
            'button',
            { type: 'button', class: 'fidel-result', onclick: () => playFrom(match.start) },
            h('span', { class: 'fidel-result-time' }, tr('playFrom', { time: formatTime(match.start) })),
            h('span', { class: 'fidel-result-text', lang: match.lang }, text)
          )
        )
      );
    }
  }

  // Download the transcript as a text file, made here in the browser from the
  // captions already loaded (works with or without a Fidel server).
  async function downloadText() {
    const tracks = await loadTracks();
    const wanted = transcriptLang();
    const track = tracks.find((tr_) => tr_.lang === wanted && tr_.cues.length) || tracks.find((tr_) => tr_.cues.length);
    if (!track) return;
    const text = track.cues.map((cue) => cue.text.replace(/\n/g, ' ')).join('\n') + '\n';
    // The byte-order mark helps Windows Notepad open Amharic text correctly.
    const url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/plain;charset=utf-8' }));
    const link = h('a', { href: url, download: `transcript-${track.lang}.txt`, hidden: true });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  const element = h(
    'section',
    { class: 'fidel-transcript', 'aria-labelledby': headingId },
    h(`h${headingLevel}`, { id: headingId, class: 'fidel-heading' }, tr('transcript')),
    h(
      'form',
      { class: 'fidel-search', role: 'search', onsubmit: runSearch },
      h('label', { for: inputId }, tr('searchLabel')),
      h('div', { class: 'fidel-row' }, input, h('button', { type: 'submit', class: 'fidel-button' }, tr('search')))
    ),
    status,
    results,
    h('p', {}, h('button', { type: 'button', class: 'fidel-button', onclick: downloadText }, tr('downloadTranscript'))),
    h('div', { id: bodyId, class: 'fidel-transcript-body' })
  );

  return { element, bodyId };
}
