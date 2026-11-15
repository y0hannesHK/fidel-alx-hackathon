// <fidel-quiz label="Check what you learned" heading-level="3" time-limit="600" ui-lang="en|am"
//   questions='[{"question":"…","options":["…","…"],"answer":1,"explanation":"…","ownWay":true}]'>
// or child markup (readable without JavaScript):
//   <div data-question data-answer="1" data-explanation="…" data-own-way>
//     <p>Which tag makes the biggest heading?</p>
//     <ul><li>&lt;p&gt;</li><li>&lt;h1&gt;</li></ul>
//   </div>
// "answer" is the option number from 0; a list ([0, 2] or "0,2") means
// "choose all that apply" (checkboxes instead of radio buttons).
//
// E6. Each question is a <fieldset> with a <legend> and real radio buttons
// or checkboxes. "Check answer" shows the feedback in words next to the
// question ("Correct." / "Not quite: the answer is …" and the explanation)
// and moves focus to it. No time limit unless time-limit="seconds": then a
// banner shows the time left, warns 1 minute before the end, and has
// "Add 5 minutes" and "Switch the timer off" (WCAG 2.2.1). The timer starts
// when the learner first enters the quiz.
// Optional per question (ownWay): "Answer in your own way" in writing, a
// voice note or sign language; these answers go to the page (event
// fidel-quiz-own-answer) and are not scored.
// The score at the end in words and as a <progress>.
// Events: fidel-quiz-done { score, total }, fidel-quiz-own-answer { question, kind, text | blob, mimeType }.
import { h, uid } from '../../dom.js';
import { announce } from '../../announce.js';
import { emit, translator, uiLang } from './common.js';
import {
  answerText, cleanQuestions, extendTimer, isCorrect, minutesSeconds, quizScore, remainingSeconds, timerState,
} from './logic.js';

const EXTEND_SECONDS = 300;

/** Questions from child markup ([data-question]). */
function questionsFromMarkup(root) {
  return [...root.querySelectorAll('[data-question]')].map((el) => {
    const answer = String(el.dataset.answer || '0');
    const list = answer.split(',').map((n) => Number(n.trim()));
    return {
      question: (el.querySelector('p, h3, h4, h5, [data-text]')?.textContent || '').trim(),
      options: [...el.querySelectorAll('li')].map((li) => li.textContent.trim()),
      answer: answer.includes(',') || el.hasAttribute('data-multiple') ? list : list[0],
      explanation: el.dataset.explanation || '',
      lang: el.getAttribute('lang'),
      ownWay: el.hasAttribute('data-own-way'),
    };
  });
}

export class FidelQuiz extends HTMLElement {
  connectedCallback() {
    if (this.built) return;
    let list = null;
    try {
      list = JSON.parse(this.getAttribute('questions') || 'null');
    } catch {
      console.warn('<fidel-quiz>: questions must be JSON.');
    }
    this.questions = cleanQuestions(list || questionsFromMarkup(this));
    if (!this.questions.length) return; // leave the markup as it is
    this.built = true;
    this.lang = uiLang(this);
    this.tt = translator(this.lang, 'quiz');
    this.level = Math.min(5, Math.max(2, Number(this.getAttribute('heading-level')) || 3));
    this.results = this.questions.map(() => null);
    this.ownWay = this.questions.map(() => false);
    const headingId = uid('fidel-quiz-heading');
    this.scoreBox = h('div', { class: 'fidel-quiz-score', hidden: true });
    const items = this.questions.map((q, i) => this.questionItem(q, i));
    this.replaceChildren(h('section', { class: 'fidel-quiz', lang: this.lang, 'aria-labelledby': headingId },
      h(`h${this.level}`, { id: headingId, class: 'fidel-quiz-heading' }, this.getAttribute('label') || this.tt('heading')),
      this.timerBanner(),
      h('ol', { class: 'fidel-quiz-list' }, items),
      h('div', { class: 'fidel-e-actions' },
        h('button', { type: 'button', class: 'fidel-e-button', onclick: () => this.finish({ focus: true }) }, this.tt('seeScore'))),
      this.scoreBox));
  }

  disconnectedCallback() {
    clearInterval(this.ticker);
    this.built = false;
  }

  questionItem(q, index) {
    const tt = this.tt;
    const id = uid('fidel-quiz-q');
    const type = q.multiple ? 'checkbox' : 'radio';
    const feedback = h('div', { class: 'fidel-quiz-feedback', id: `${id}-feedback`, tabindex: '-1', hidden: true });
    const hint = q.multiple && h('p', { class: 'fidel-e-hint', id: `${id}-hint` }, tt('chooseAll'));
    const fieldset = h('fieldset', { class: 'fidel-quiz-fieldset', 'aria-describedby': q.multiple ? `${id}-hint` : null },
      h('legend', { lang: q.lang }, h('span', { class: 'fidel-quiz-number' }, tt('number', { n: index + 1 })), ' ', q.question),
      hint,
      q.options.map((option, n) => h('div', { class: 'fidel-quiz-option' },
        h('input', { type, id: `${id}-${n}`, name: id, value: String(n) }),
        h('label', { for: `${id}-${n}`, lang: q.lang }, option))));
    const check = h('button', { type: 'button', class: 'fidel-e-button fidel-e-primary', onclick: () => this.check(index, fieldset, feedback) },
      tt('check'), h('span', { class: 'fidel-e-sr' }, ` ${tt('number', { n: index + 1 })}`));
    return h('li', { class: 'fidel-quiz-item' },
      fieldset,
      h('div', { class: 'fidel-e-actions' }, check),
      feedback,
      q.ownWay && this.ownWayPart(index, id));
  }

  check(index, fieldset, feedback) {
    const tt = this.tt;
    const q = this.questions[index];
    const chosen = [...fieldset.querySelectorAll('input:checked')].map((input) => Number(input.value));
    feedback.hidden = false;
    feedback.classList.remove('fidel-quiz-right', 'fidel-quiz-wrong');
    if (!chosen.length) {
      feedback.replaceChildren(h('p', {}, tt(q.multiple ? 'chooseFirstMany' : 'chooseFirst')));
      feedback.focus();
      return;
    }
    const right = isCorrect(q, chosen);
    this.results[index] = right;
    feedback.classList.add(right ? 'fidel-quiz-right' : 'fidel-quiz-wrong');
    feedback.replaceChildren(
      h('p', { class: 'fidel-quiz-verdict' },
        h('span', { 'aria-hidden': 'true' }, right ? '✓ ' : '✗ '),
        right ? tt('correct') : tt('notQuite', { answer: answerText(q, tt('and')) })),
      q.explanation && h('p', { lang: q.lang }, q.explanation));
    feedback.focus();
    if (this.results.every((r, i) => r !== null || this.ownWay[i])) this.finish({ focus: false });
  }

  ownWayPart(index, id) {
    const tt = this.tt;
    const panel = h('div', { class: 'fidel-quiz-own', id: `${id}-own`, hidden: true });
    const toggle = h('button', {
      type: 'button', class: 'fidel-e-button', 'aria-expanded': 'false', 'aria-controls': `${id}-own`,
      onclick: () => {
        const open = toggle.getAttribute('aria-expanded') !== 'true';
        toggle.setAttribute('aria-expanded', String(open));
        panel.hidden = !open;
        if (open && !panel.firstChild) panel.append(...this.ownWayContent(index, id));
      },
    }, tt('ownWay'), h('span', { class: 'fidel-e-sr' }, ` ${tt('number', { n: index + 1 })}`));
    return h('div', { class: 'fidel-quiz-own-wrap' }, toggle, panel);
  }

  ownWayContent(index, id) {
    const tt = this.tt;
    const how = h('fidel-choice', {
      id: `${id}-how`, type: 'radio', name: `${id}-how`, label: tt('ownHow'), 'ui-lang': this.lang, value: 'text',
      options: JSON.stringify(['text', 'voice', 'sign'].map((k) => ({ value: k, label: tt(`ownKinds.${k}`) }))),
    });
    const status = h('p', { class: 'fidel-e-status' });
    const done = (detail) => {
      this.ownWay[index] = true;
      emit(this, 'fidel-quiz-own-answer', { question: index + 1, ...detail });
      status.textContent = tt('ownSaved');
      announce(status.textContent);
    };
    const words = h('fidel-textarea', { id: `${id}-words`, label: tt('ownText'), rows: 3, maxlength: 2000, 'ui-lang': this.lang });
    const panels = {
      text: h('div', {}, words, h('div', { class: 'fidel-e-actions' }, h('button', {
        type: 'button', class: 'fidel-e-button fidel-e-primary',
        onclick: () => {
          const value = words.value.trim();
          if (!value) return words.focus();
          done({ kind: 'text', text: value });
        },
      }, tt('ownSend')))),
      voice: h('div', { hidden: true }, h('fidel-voice-note', { 'heading-level': Math.min(5, this.level + 1), 'ui-lang': this.lang, label: tt('ownKinds.voice') })),
      sign: h('div', { hidden: true }, h('fidel-sign-answer', { 'heading-level': Math.min(5, this.level + 1), 'ui-lang': this.lang, label: tt('ownKinds.sign') })),
    };
    for (const [kind, eventName] of [['voice', 'fidel-voice-note-ready'], ['sign', 'fidel-sign-answer-ready']]) {
      panels[kind].addEventListener(eventName, (event) => {
        event.stopPropagation();
        done({ kind, blob: event.detail.blob, mimeType: event.detail.mimeType });
      });
    }
    const show = () => {
      for (const [kind, panel] of Object.entries(panels)) panel.hidden = kind !== (how.value || 'text');
    };
    how.addEventListener('fidel-field-change', show);
    how.addEventListener('change', show);
    return [how, ...Object.values(panels), status];
  }

  finish({ focus }) {
    const tt = this.tt;
    const scored = this.results.filter((r, i) => !this.ownWay[i]);
    const { score, total, percent } = quizScore(scored.map((r) => r === true));
    const own = this.ownWay.filter(Boolean).length;
    const headingId = uid('fidel-quiz-score');
    const heading = h(`h${Math.min(6, this.level + 1)}`, { id: headingId, tabindex: '-1' }, tt('scoreHeading'));
    this.scoreBox.replaceChildren(heading,
      h('p', { class: 'fidel-quiz-words' }, tt('score', { score, total, percent })),
      h('progress', { max: String(Math.max(1, total)), value: String(score), 'aria-labelledby': headingId }),
      own ? h('p', {}, tt('ownCount', { n: own })) : null);
    this.scoreBox.hidden = false;
    this.stopTimer();
    if (focus) heading.focus();
    else announce(tt('score', { score, total, percent }));
    if (!this.doneSent) emit(this, 'fidel-quiz-done', { score, total });
    this.doneSent = true;
  }

  // --- Optional time limit (WCAG 2.2.1) -----------------------------------------

  timerBanner() {
    const seconds = Number(this.getAttribute('time-limit'));
    if (!(seconds > 0)) return null;
    const tt = this.tt;
    this.limit = seconds;
    this.timerOn = true;
    this.timeText = h('span', { class: 'fidel-quiz-time' });
    this.warning = h('p', { class: 'fidel-quiz-warning', hidden: true });
    this.banner = h('div', { class: 'fidel-quiz-timer', role: 'group', 'aria-label': tt('timer') },
      h('p', { class: 'fidel-quiz-time-line' }, this.timeText),
      this.warning,
      h('div', { class: 'fidel-e-actions' },
        this.extendButton = h('button', { type: 'button', class: 'fidel-e-button', onclick: () => this.extend() }, tt('extend')),
        this.offButton = h('button', { type: 'button', class: 'fidel-e-button', onclick: () => this.timerOff() }, tt('timerOff'))));
    const { minutes } = minutesSeconds(seconds);
    this.timeText.textContent = tt('limitBefore', { minutes: Math.max(1, minutes) });
    this.addEventListener('focusin', () => this.startTimer(), { once: true });
    this.addEventListener('pointerdown', () => this.startTimer(), { once: true });
    return this.banner;
  }

  startTimer() {
    if (!this.limit || this.endsAt || !this.timerOn) return;
    this.endsAt = Date.now() + this.limit * 1000;
    this.tick();
    this.ticker = setInterval(() => this.tick(), 1000);
  }

  tick() {
    const tt = this.tt;
    const left = remainingSeconds(this.endsAt, Date.now());
    const state = timerState(left, { on: this.timerOn });
    const { minutes, seconds } = minutesSeconds(left);
    this.timeText.textContent = tt('left', { minutes, seconds });
    this.banner.classList.toggle('fidel-quiz-timer-warning', state === 'warning');
    if (state === 'warning' && !this.warned) {
      this.warned = true;
      this.warning.textContent = tt('warning');
      this.warning.hidden = false;
      announce(tt('warning'), { assertive: true });
    }
    if (state === 'over') {
      this.stopTimer();
      this.timeText.textContent = tt('over');
      announce(tt('over'), { assertive: true });
      this.finish({ focus: false });
    }
  }

  extend() {
    if (!this.endsAt) this.startTimer();
    this.endsAt = extendTimer(this.endsAt, Date.now(), EXTEND_SECONDS);
    if (!this.ticker) this.ticker = setInterval(() => this.tick(), 1000);
    this.warned = false;
    this.warning.hidden = true;
    this.tick();
    announce(this.tt('extended'));
  }

  stopTimer() {
    clearInterval(this.ticker);
    this.ticker = null;
  }

  timerOff() {
    this.timerOn = false;
    this.stopTimer();
    this.banner.classList.remove('fidel-quiz-timer-warning');
    this.warning.hidden = true;
    this.timeText.textContent = this.tt('off');
    this.extendButton.hidden = true;
    this.offButton.hidden = true;
    announce(this.tt('off'));
    this.banner.querySelector('.fidel-quiz-time-line').setAttribute('tabindex', '-1');
    this.banner.querySelector('.fidel-quiz-time-line').focus();
  }
}
