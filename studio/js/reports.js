// Caption reports panel on a lesson's Studio page (Package D, D2).
//
// Learners report caption problems with <fidel-caption-report> under the
// player. Here staff see the open reports, go to the caption in the caption
// editor, and mark each report "Resolved" or "Dismiss" it.
//
// Hooked into lesson.js with one line:
//   main.append(await (await import('./reports.js')).reportsSection(lessonId));
//
// "Go to this caption" finds the caption in the caption editor by its time
// (the editor's own Start/End boxes), moves focus to the text box in the
// report's language and plays nothing: staff press "Play this caption".
import { api } from './api.js';
import { formatTime, h, parseTime, say } from './util.js';

const KIND = {
  wrong_words: 'Wrong words',
  wrong_time: 'Wrong time',
  missing_caption: 'Missing caption',
  missing_sound: 'Missing sound description',
  other: 'Other',
};
const LANGUAGE = { en: 'English', am: 'Amharic', om: 'Afaan Oromo' };

/** The caption editor's list item showing `time` (or the last one starting before it). */
export function findCaptionItem(time, root = document) {
  let best = null;
  for (const item of root.querySelectorAll('.cue-list > li')) {
    const [start, end] = [...item.querySelectorAll('input.time-input')].map((input) => parseTime(input.value));
    if (!(start <= time)) continue;
    if (time < end) return item;
    best = item;
  }
  return best;
}

export async function reportsSection(lessonId) {
  const heading = h('h2', { id: 'caption-reports-heading' });
  const status = h('p', { class: 'status', role: 'status' });
  const list = h('ul', { class: 'reports-list', style: 'list-style: none; padding: 0; margin: 0;' });
  const section = h('section', { class: 'card', 'aria-labelledby': 'caption-reports-heading' },
    heading,
    h('p', {}, 'Learners report caption problems from the player ("Report a caption problem"). No names are collected.'),
    list, status);

  let reports = [];
  try {
    reports = await api(`/api/v1/lessons/${lessonId}/caption-reports?status=open`);
  } catch (error) {
    heading.textContent = 'Caption reports';
    list.replaceWith(h('p', {}, `Reports could not be loaded: ${error.message}`));
    return section;
  }

  function render() {
    heading.textContent = `Caption reports (${reports.length} open)`;
    if (!reports.length) {
      list.replaceChildren(h('li', {}, 'No open reports.'));
      return;
    }
    list.replaceChildren(...reports.map((report) => reportItem(report)));
  }

  function reportItem(report) {
    const summaryId = `report-${report.id}`;
    const describe = { 'aria-describedby': summaryId };
    return h('li', { style: 'border-top: 1px solid #c4c8cf; padding: 0.75rem 0;' },
      h('p', { id: summaryId, style: 'margin: 0 0 0.25rem; font-weight: 600;' },
        `${formatTime(report.time)}, ${LANGUAGE[report.lang] || report.lang}: ${KIND[report.kind] || report.kind}`),
      report.caption && h('p', { style: 'margin: 0 0 0.25rem;' }, 'Caption shown: ', h('q', { lang: report.lang }, report.caption)),
      report.correction
        ? h('p', { style: 'margin: 0 0 0.25rem;' }, 'Learner’s correction: ', h('q', { lang: report.lang }, report.correction))
        : h('p', { style: 'margin: 0 0 0.25rem;' }, 'No correction written.'),
      h('p', { class: 'hint', style: 'margin: 0;' }, `Received ${new Date(report.created_at).toLocaleString()}`),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'button secondary small', ...describe, onclick: () => goTo(report) }, 'Go to this caption'),
        h('button', { type: 'button', class: 'button secondary small', ...describe, onclick: () => setStatus(report, 'resolved') }, 'Resolved'),
        h('button', { type: 'button', class: 'button secondary small', ...describe, onclick: () => setStatus(report, 'dismissed') }, 'Dismiss')));
  }

  function goTo(report) {
    const item = findCaptionItem(report.time);
    const box = item?.querySelector(`textarea[lang="${report.lang}"]`) || item?.querySelector('textarea');
    if (!box) {
      say(status, `There is no caption at ${formatTime(report.time)} in the caption editor. Add one there, or use the sound-off check below.`);
      document.getElementById('captions-heading')?.scrollIntoView();
      return;
    }
    box.scrollIntoView({ block: 'center' });
    box.focus();
    // Show the same moment in the editor's video, so staff can play it.
    const video = document.querySelector('.editor-video');
    if (video) video.currentTime = report.time;
  }

  async function setStatus(report, newStatus) {
    try {
      await api(`/api/v1/caption-reports/${report.id}`, { method: 'PATCH', json: { status: newStatus } });
    } catch (error) {
      say(status, `Not changed: ${error.message}`);
      return;
    }
    const index = reports.indexOf(report);
    reports = reports.filter((r) => r !== report);
    render();
    say(status, `${newStatus === 'resolved' ? 'Marked resolved' : 'Dismissed'}. ${reports.length} open report${reports.length === 1 ? '' : 's'} left.`);
    // Keep keyboard focus in the list: the next report's first button, else the heading.
    const next = list.querySelectorAll('li button')[Math.min(index, reports.length - 1) * 3];
    if (next) next.focus();
    else {
      heading.tabIndex = -1;
      heading.focus();
    }
  }

  render();
  return section;
}
