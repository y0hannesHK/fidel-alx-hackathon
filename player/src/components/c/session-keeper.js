// <fidel-session-keeper timeout="1800" warn-before="120"
//                       extend-url="/api/v1/session/extend"></fidel-session-keeper>
//
// Never lose work to a time-out (WCAG 2.2.1). Before the host's time-out a
// dialog asks "Do you need more time?" with "Yes, more time" (focused) and
// "No". The learner always has at least 20 seconds to answer and can extend
// at least 10 times. "Yes" calls extend-url (if given) and always sends
// fidel-session-extend so the host can extend its own session.
// The countdown text changes at most every 30 seconds (no per-second noise).
//
// Attributes:
//   timeout       seconds until the host ends the session (default 1800)
//   warn-before   seconds before that to ask (default 120, at least 20)
//   extend-url    POSTed to when the learner asks for more time
//   max-extend    how many times the learner may extend (default 20, never below 10)
//   off           no time limit: nothing is timed
//   manual        the timer starts only when the host calls start()
//   ui-lang
// Methods: start() (re)starts the timer (call it when the host's own session is renewed), stop().
// Events: fidel-session-warning, fidel-session-extend { count }, fidel-session-decline,
//   fidel-session-timeout, fidel-session-no-timeout { never: true|false }.
// The learner's "Never time me out" choice is remembered (localStorage "fidel-components-c").
import { announce } from '../../announce.js';
import { emit } from '../../events.js';
import { h, langOf, translator, settings, nextId } from './shared.js';
import { sessionPlan, maxExtensions, canExtend, timeLeftPhrase, durationPhrase } from './logic.js';

const TICK_MS = 1000;

export class FidelSessionKeeper extends HTMLElement {
  connectedCallback() {
    if (!this.built) this.build();
    if (!this.hasAttribute('manual') && !this.hasAttribute('off')) this.start();
  }

  disconnectedCallback() {
    this.stop();
  }

  phrase(p) {
    return this.tr(p.key, { n: p.n });
  }

  build() {
    this.built = true;
    this.lang_ = langOf(this);
    const tr = translator(this.lang_);
    this.tr = tr;
    this.plan = sessionPlan(this.getAttribute('timeout'), this.getAttribute('warn-before'));
    this.max = maxExtensions(this.getAttribute('max-extend'));
    this.extensions = 0;
    const off = this.hasAttribute('off');
    const never = settings.load().neverTimeOut;

    // The always-visible part: a small "Time limit" disclosure with the setting.
    const neverId = nextId('fidel-session-never');
    this.neverNote = h('p', { class: 'fidel-c-note', hidden: !never }, tr('sessionNeverOn'));
    this.status = h('p', { class: 'fidel-session-keeper-ended', hidden: true });
    this.replaceChildren(
      h('div', { class: 'fidel-session-keeper', lang: this.lang_ },
        h('details', {},
          h('summary', {}, tr('sessionSummary')),
          off
            ? h('p', {}, tr('sessionOff'))
            : [
              h('p', {}, tr('sessionExplain', { time: this.phrase(durationPhrase(this.plan.timeout)) })),
              h('div', { class: 'fidel-c-check' },
                h('input', {
                  type: 'checkbox', id: neverId, checked: never,
                  onchange: (event) => this.setNever(event.target.checked),
                }),
                h('label', { for: neverId }, tr('sessionNever'))),
              this.neverNote,
            ]),
        this.status));

    // The warning dialog.
    const titleId = nextId('fidel-session-title');
    this.countdown = h('p', {});
    this.noMore = h('p', { hidden: true }, tr('sessionNoMore'));
    this.yes = h('button', { type: 'button', class: 'fidel-c-button fidel-c-primary', autofocus: true, onclick: () => this.extend() }, tr('sessionYes'));
    this.no = h('button', { type: 'button', class: 'fidel-c-button', onclick: () => this.decline() }, tr('sessionNo'));
    this.dialog = h('dialog', { class: 'fidel-c-dialog fidel-session-keeper-dialog', lang: this.lang_, 'aria-labelledby': titleId },
      h('h2', { id: titleId, class: 'fidel-c-dialog-title' }, tr('sessionTitle')),
      this.countdown,
      this.noMore,
      h('div', { class: 'fidel-c-row' }, this.yes, this.no));
    // Escape = "not now": the dialog closes, the time keeps running.
    this.dialog.addEventListener('close', () => {
      if (this.returnFocus?.isConnected) this.returnFocus.focus();
      this.returnFocus = null;
    });
    this.append(this.dialog);
  }

  /** (Re)start the timer from now. */
  start() {
    if (!this.built) this.build();
    this.stop();
    if (this.hasAttribute('off') || settings.load().neverTimeOut) return;
    this.status.hidden = true;
    this.startedAt = Date.now();
    this.warned = false;
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  /** Seconds left before the host's time-out. */
  secondsLeft() {
    return this.plan.timeout - (Date.now() - this.startedAt) / 1000;
  }

  tick() {
    const left = this.secondsLeft();
    if (left <= 0) {
      this.expire();
      return;
    }
    if (!this.warned && left <= this.plan.warnBefore) this.warn();
    if (this.dialog.open) this.updateCountdown(left);
  }

  updateCountdown(left) {
    const text = this.tr('sessionEndsIn', { time: this.phrase(timeLeftPhrase(left)) });
    // Changes only when the words change (at most every 30 seconds).
    if (this.countdown.textContent !== text) this.countdown.textContent = text;
  }

  warn() {
    this.warned = true;
    const allowed = canExtend(this.extensions, this.max);
    this.yes.hidden = !allowed;
    this.noMore.hidden = allowed;
    this.updateCountdown(this.secondsLeft());
    this.returnFocus = document.activeElement;
    if (!this.dialog.open) this.dialog.showModal();
    (allowed ? this.yes : this.no).focus();
    emit(this, 'fidel-session-warning', {});
  }

  async extend() {
    if (!canExtend(this.extensions, this.max)) return;
    this.extensions += 1;
    this.dialog.close();
    this.start();
    emit(this, 'fidel-session-extend', { count: this.extensions });
    announce(this.tr('sessionExtended', { time: this.phrase(durationPhrase(this.plan.timeout)) }));
    const url = this.getAttribute('extend-url');
    if (!url) return;
    try {
      const response = await fetch(url, { method: 'POST', credentials: 'same-origin' });
      if (!response.ok) throw new Error(String(response.status));
    } catch {
      this.status.textContent = this.tr('sessionExtendFailed');
      this.status.hidden = false;
      announce(this.tr('sessionExtendFailed'), { assertive: true });
    }
  }

  decline() {
    this.dialog.close();
    emit(this, 'fidel-session-decline', {});
  }

  expire() {
    this.stop();
    if (this.dialog.open) this.dialog.close();
    this.status.textContent = this.tr('sessionEnded');
    this.status.hidden = false;
    announce(this.tr('sessionEnded'), { assertive: true });
    emit(this, 'fidel-session-timeout', {});
  }

  setNever(never) {
    settings.save({ neverTimeOut: never });
    this.neverNote.hidden = !never;
    emit(this, 'fidel-session-no-timeout', { never });
    if (never) this.stop();
    else if (this.startedAt || !this.hasAttribute('manual')) this.start();
  }
}
