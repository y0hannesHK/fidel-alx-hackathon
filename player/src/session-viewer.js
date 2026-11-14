// <fidel-session-viewer>: a recorded live session (e.g. a Zoom class) with
// captions, interactive transcript and the timestamped CHAT LOG side by side
// (one column on narrow screens and at 200% zoom).
//
//   <fidel-session-viewer src="session.mp4" captions-en="session.vtt"
//                         chat="chat.txt" anonymize lang="en"></fidel-session-viewer>
//
// - The player is a normal <fidel-player> (all its attributes are passed on).
// - Each chat message is a button: it plays the recording from that moment.
// - While the recording plays normally, new chat messages can be read aloud
//   (polite live region, grouped at most every few seconds). While the learner
//   jumps around, nothing is announced.
// - "anonymize": show Participant 1, 2... instead of names (no consent needed).
import { h } from './dom.js';
import { parseZoomChat, anonymize } from './chat.js';
import { formatTime } from './vtt.js';
import { emit } from './events.js';

const STRINGS = {
  en: {
    chat: 'Chat', messages: '{n} messages', none: 'No chat messages.', playFrom: 'Play from',
    readAloud: 'Read new chat messages aloud while the recording plays', loadError: 'The chat could not be loaded.',
  },
  am: {
    chat: 'ውይይት', messages: '{n} መልዕክቶች', none: 'ምንም የውይይት መልዕክት የለም።', playFrom: 'ከዚህ ጀምሮ አጫውት፦',
    readAloud: 'ቀረጻው ሲጫወት አዲስ የውይይት መልዕክቶችን በድምፅ አንብብ', loadError: 'ውይይቱ ሊጫን አልቻለም።',
  },
};
const PASSED_ON = ['src', 'src-webm', 'src-small', 'poster', 'captions-en', 'captions-am', 'captions-am-status',
  'chapters', 'chapters-en', 'chapters-am', 'sign', 'lang'];
const ANNOUNCE_EVERY_MS = 4000;
let count = 0;

export class FidelSessionViewer extends HTMLElement {
  async connectedCallback() {
    if (this.built) return;
    this.built = true;
    count += 1;
    const id = this.id || `fidel-session-${count}`;
    const lang = (this.getAttribute('lang') || 'en') === 'am' ? 'am' : 'en';
    const t = (key, n) => STRINGS[lang][key].replace('{n}', n);
    const level = Math.min(6, Math.max(2, Number(this.getAttribute('heading-level')) || 3));

    const player = document.createElement('fidel-player');
    player.id = `${id}-player`;
    for (const name of PASSED_ON) if (this.hasAttribute(name)) player.setAttribute(name, this.getAttribute(name));

    const list = h('ol', { class: 'fidel-chat-list' });
    const heading = h(`h${level}`, { id: `${id}-chat-heading`, class: 'fidel-heading' }, t('chat'));
    const count_ = h('p', { class: 'fidel-chat-count' });
    const announcer = h('div', { class: 'fidel-sr-only', 'aria-live': 'polite', 'aria-atomic': 'true' });
    const readAloud = h('input', { type: 'checkbox', id: `${id}-read-aloud`, checked: true });
    this.replaceChildren(h('div', { class: 'fidel-session', lang },
      h('div', { class: 'fidel-session-player' }, player),
      h('section', { class: 'fidel-chat', 'aria-labelledby': heading.id },
        heading, count_,
        h('div', { class: 'fidel-check' }, readAloud, h('label', { for: readAloud.id }, t('readAloud'))),
        list, announcer)));

    // Chat messages.
    let messages = [];
    try {
      const response = await fetch(this.getAttribute('chat'));
      if (!response.ok) throw new Error(String(response.status));
      messages = parseZoomChat(await response.text());
      if (this.hasAttribute('anonymize')) messages = anonymize(messages, lang === 'am' ? 'ተሳታፊ' : 'Participant');
    } catch {
      list.replaceWith(h('p', { class: 'fidel-error', role: 'alert' }, t('loadError')));
      return;
    }
    count_.textContent = messages.length ? t('messages', messages.length) : t('none');
    const items = messages.map((message) => {
      const button = h('button', { type: 'button', class: 'fidel-chat-message', onclick: () => this.playFrom(message.time) },
        h('span', { class: 'fidel-sr-only' }, `${t('playFrom')} `),
        h('span', { class: 'fidel-chat-time' }, formatTime(message.time)),
        ' ',
        h('span', { class: 'fidel-chat-name' }, `${message.name}:`),
        ' ',
        h('span', { class: 'fidel-chat-text' }, message.text));
      const item = h('li', {}, button);
      list.append(item);
      return item;
    });
    this.player = player;

    // Follow the recording: mark messages already sent; announce new ones.
    const follow = () => {
      const video = player.ablePlayer?.media;
      if (!video || video.fidelChatFollowing) return;
      video.fidelChatFollowing = true; // the player rebuilds (language, low data): attach once per video
      let last = video.currentTime;
      let pending = [];
      let lastAnnounce = 0;
      const flush = () => {
        if (!pending.length) return;
        announcer.textContent = pending.map((m) => `${m.name}: ${m.text}`).join('. ');
        pending = [];
        lastAnnounce = Date.now();
      };
      video.addEventListener('seeking', () => announcer.setAttribute('aria-live', 'off'));
      video.addEventListener('seeked', () => {
        last = video.currentTime; // jumped: do not announce what was skipped
        pending = [];
        setTimeout(() => announcer.setAttribute('aria-live', 'polite'), 500);
      });
      video.addEventListener('timeupdate', () => {
        const now = video.currentTime;
        messages.forEach((m, i) => {
          items[i].classList.toggle('fidel-chat-past', m.time <= now);
        });
        const normalPlay = !video.paused && !video.seeking && now >= last && now - last < 2;
        if (normalPlay && readAloud.checked) {
          pending.push(...messages.filter((m) => m.time > last && m.time <= now));
          if (Date.now() - lastAnnounce >= ANNOUNCE_EVERY_MS) flush();
        }
        last = now;
      });
    };
    if (player.ablePlayer?.playerCreated) follow();
    player.addEventListener('fidel-ready', follow);
    emit(this, 'fidel-session-ready', { messages: messages.length });
  }

  playFrom(seconds) {
    const able = this.player?.ablePlayer;
    if (!able) return;
    able.seekTo(seconds);
    able.playMedia();
  }
}
