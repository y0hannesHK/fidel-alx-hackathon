// Learner questions panel on a lesson's Studio page (Package E, E2).
//
// Learners ask about a moment with <fidel-question> under the player: in
// writing, with a voice note, or in sign language. Here staff see the open
// questions in video-time order, play the recording (fetched with the staff
// token: recordings are never public), go to that moment in the caption
// editor's video, and mark each question "Answered" or "Dismiss" it.
//
// Hooked into lesson.js with one line:
//   main.append(await (await import('./questions.js')).questionsSection(lessonId));
import { api, token } from './api.js';
import { formatTime, h, say } from './util.js';

const KIND = { text: 'Written', voice: 'Voice note', sign: 'Sign language' };

export async function questionsSection(lessonId) {
  const heading = h('h2', { id: 'questions-heading' });
  const status = h('p', { class: 'status', role: 'status' });
  const list = h('ul', { class: 'questions-list', style: 'list-style: none; padding: 0; margin: 0;' });
  const section = h('section', { class: 'card', 'aria-labelledby': 'questions-heading' },
    heading,
    h('p', {}, 'Learners ask about a moment in the lesson ("Ask about this moment"): in writing, with a voice note or in sign language. No names are collected. Voice notes are not turned into text: listen to them.'),
    list, status);
  const urls = [];

  let questions = [];
  try {
    questions = await api(`/api/v1/lessons/${lessonId}/questions?status=open`);
  } catch (error) {
    heading.textContent = 'Learner questions';
    list.replaceWith(h('p', {}, `Questions could not be loaded: ${error.message}`));
    return section;
  }

  function render() {
    heading.textContent = `Learner questions (${questions.length} open)`;
    if (!questions.length) {
      list.replaceChildren(h('li', {}, 'No open questions.'));
      return;
    }
    list.replaceChildren(...questions.map((question) => questionItem(question)));
  }

  /** The recording, fetched with the staff token, in an <audio> or <video>. */
  function recording(question) {
    const slot = h('div', {});
    const load = h('button', { type: 'button', class: 'button secondary small', 'aria-describedby': `question-${question.id}`,
      onclick: async () => {
        load.disabled = true;
        try {
          const response = await fetch(question.media_url, { headers: { Authorization: `Bearer ${token.get()}` } });
          if (!response.ok) throw new Error(`error ${response.status}`);
          const url = URL.createObjectURL(await response.blob());
          urls.push(url);
          const tag = question.kind === 'sign' ? 'video' : 'audio';
          const player = h(tag, { controls: true, src: url, style: 'display: block; max-width: 100%;',
            'aria-label': question.kind === 'sign' ? 'Learner’s question in sign language' : 'Learner’s voice note' });
          slot.replaceChildren(player);
          player.focus();
        } catch (error) {
          load.disabled = false;
          say(status, `The recording could not be loaded: ${error.message}`);
        }
      } }, question.kind === 'sign' ? 'Show the sign-language video' : 'Load the voice note');
    slot.append(load);
    return slot;
  }

  function questionItem(question) {
    const summaryId = `question-${question.id}`;
    const describe = { 'aria-describedby': summaryId };
    return h('li', { style: 'border-top: 1px solid #c4c8cf; padding: 0.75rem 0;' },
      h('p', { id: summaryId, style: 'margin: 0 0 0.25rem; font-weight: 600;' },
        `${formatTime(question.time)}: ${KIND[question.kind] || question.kind}`),
      question.caption && h('p', { style: 'margin: 0 0 0.25rem;' }, 'Caption at that moment: ', h('q', {}, question.caption)),
      question.text && h('p', { style: 'margin: 0 0 0.25rem; white-space: pre-wrap;' }, question.text),
      question.media_url && recording(question),
      h('p', { class: 'hint', style: 'margin: 0;' }, `Received ${new Date(question.created_at).toLocaleString()}`),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'button secondary small', ...describe, onclick: () => goTo(question) }, 'Go to this moment'),
        h('button', { type: 'button', class: 'button secondary small', ...describe, onclick: () => setStatus(question, 'answered') }, 'Answered'),
        h('button', { type: 'button', class: 'button secondary small', ...describe, onclick: () => setStatus(question, 'dismissed') }, 'Dismiss')));
  }

  function goTo(question) {
    const video = document.querySelector('.editor-video');
    if (!video) {
      say(status, 'The caption editor video was not found on this page.');
      return;
    }
    video.currentTime = question.time;
    video.scrollIntoView({ block: 'center' });
    video.focus();
    say(status, `The editor video is at ${formatTime(question.time)}. Press play to watch it.`);
  }

  async function setStatus(question, newStatus) {
    try {
      await api(`/api/v1/questions/${question.id}`, { method: 'PATCH', json: { status: newStatus } });
    } catch (error) {
      say(status, `Not changed: ${error.message}`);
      return;
    }
    const index = questions.indexOf(question);
    questions = questions.filter((q) => q !== question);
    render();
    say(status, `${newStatus === 'answered' ? 'Marked answered' : 'Dismissed'}. ${questions.length} open question${questions.length === 1 ? '' : 's'} left.`);
    // Keep keyboard focus in the list: the next question's first action, else the heading.
    const next = list.children[Math.min(index, questions.length - 1)]?.querySelector('.row button');
    if (next && questions.length) next.focus();
    else {
      heading.tabIndex = -1;
      heading.focus();
    }
  }

  render();
  return section;
}
