// <fidel-job-card job="https://HOST/api/v1/jobs/ID" lang="en|am">
//
// An accessible job card read from schema.org/JobPosting JSON-LD:
// title, employer, place, closing date in both calendars, how to apply,
// workplace accommodations, and a short summary to read or LISTEN to.
// Events: fidel-job-ready, fidel-summary-play.
// It also puts the JSON-LD on the page, so search engines and job boards
// can read the job (schema.org/JobPosting, Level 3 integration).
//
// "Listen to summary" plays a recording made by staff. Without a recording,
// English falls back to the browser's voice; Amharic needs a recording
// (most phones have no Amharic voice), so there is no Amharic button then.
import { h } from './dom.js';
import { formatBoth } from './ethiopian-calendar.js';
import { emit } from './events.js';

const STRINGS = {
  en: {
    employer: 'Employer', location: 'Location', orRemote: 'or remote', remoteOnly: 'Remote (from Ethiopia)',
    applyBy: 'Apply by', jobType: 'Job type', howToApply: 'How to apply', email: 'Email', applyOnline: 'Apply online',
    accommodations: 'Workplace accommodations', none: 'None listed.',
    summary: 'Summary', listenEn: 'Listen to summary (English)', listenAm: 'Listen to summary (Amharic)',
    stop: 'Stop', playing: 'Playing the summary.', stopped: 'Stopped.',
    noAmharicAudio: 'An Amharic recording of the summary is not available yet.',
    machineReadAm: 'The Amharic recording is read by a computer voice, not a person.',
    loadError: 'This job could not be loaded.',
  },
  am: {
    employer: 'ቀጣሪ', location: 'ቦታ', orRemote: 'ወይም ከርቀት', remoteOnly: 'ከርቀት (ከኢትዮጵያ)',
    applyBy: 'የማመልከቻ የመጨረሻ ቀን', jobType: 'የሥራ ዓይነት', howToApply: 'እንዴት ማመልከት እንደሚቻል', email: 'ኢሜይል', applyOnline: 'በመስመር ላይ ያመልክቱ',
    accommodations: 'በሥራ ቦታ የሚደረጉ ማመቻቻዎች', none: 'ምንም አልተዘረዘረም።',
    summary: 'ማጠቃለያ', listenEn: 'ማጠቃለያውን ያዳምጡ (እንግሊዝኛ)', listenAm: 'ማጠቃለያውን ያዳምጡ (አማርኛ)',
    stop: 'አቁም', playing: 'ማጠቃለያው እየተጫወተ ነው።', stopped: 'ቆሟል።',
    noAmharicAudio: 'የማጠቃለያው የአማርኛ ቅጂ ገና አልተዘጋጀም።',
    machineReadAm: 'የአማርኛው ቅጂ የተነበበው በሰው ሳይሆን በኮምፒውተር ድምፅ ነው።', // TODO: review by an Amharic speaker
    loadError: 'ይህ ሥራ ሊጫን አልቻለም።',
  },
};

const EMPLOYMENT = {
  FULL_TIME: ['Full time', 'ሙሉ ጊዜ'], PART_TIME: ['Part time', 'የትርፍ ጊዜ'], CONTRACTOR: ['Contract', 'ኮንትራት'],
  TEMPORARY: ['Temporary', 'ጊዜያዊ'], INTERN: ['Internship', 'የሥራ ልምምድ'], VOLUNTEER: ['Volunteer', 'በጎ ፈቃደኝነት'],
};
const ACCOMMODATIONS = {
  sign_language_interpreter: ['Sign language interpreter available', 'የምልክት ቋንቋ አስተርጓሚ አለ'],
  screen_reader_tools: ['Screen-reader compatible tools', 'ከስክሪን አንባቢ ጋር የሚሠሩ መሣሪያዎች'],
  flexible_hours: ['Flexible hours', 'ተለዋዋጭ የሥራ ሰዓት'],
  step_free_access: ['Step-free access', 'ደረጃ የሌለው መግቢያ'],
  remote_work: ['Remote work possible', 'ከርቀት መሥራት ይቻላል'],
  captioned_meetings: ['Captioned meetings', 'የግርጌ ጽሑፍ ያላቸው ስብሰባዎች'],
};

let cardCount = 0;

export class FidelJobCard extends HTMLElement {
  async connectedCallback() {
    if (this.loaded) return;
    this.loaded = true;
    cardCount += 1;
    const lang = (this.getAttribute('lang') || document.documentElement.lang || 'en').startsWith('am') ? 'am' : 'en';
    const t = STRINGS[lang];
    let job;
    try {
      const response = await fetch(this.getAttribute('job'));
      if (!response.ok) throw new Error(String(response.status));
      job = await response.json();
    } catch {
      this.replaceChildren(h('p', { class: 'fidel-error', role: 'alert' }, t.loadError));
      return;
    }
    this.render(job, lang, t, `fidel-job-${cardCount}`);
    emit(this, 'fidel-job-ready', { id: job.identifier?.value, title: job.title });
  }

  disconnectedCallback() {
    this.stopSummary?.();
  }

  render(job, lang, t, id) {
    const level = Math.min(6, Math.max(2, Number(this.getAttribute('heading-level')) || 3));
    const pick = ([en, am]) => (lang === 'am' ? am : en);
    const dates = formatBoth(job.validThrough);
    const place = job.jobLocation?.address?.addressLocality;
    const remote = job.jobLocationType === 'TELECOMMUTE';
    const contact = job.applicationContact || {};

    const accommodations = [
      ...(job['fidel:accommodations'] || []).map((key) => (ACCOMMODATIONS[key] ? pick(ACCOMMODATIONS[key]) : key)),
      ...(job['fidel:otherAccommodations'] || []),
    ];

    const status = h('p', { class: 'fidel-job-status', role: 'status' });
    const audio = job['fidel:summaryAudio'] || {};
    const machineRead = job['fidel:summaryAudioMachineRead'] || [];
    const summaries = { en: job['fidel:summaryEn'], am: job['fidel:summaryAm'] };
    const listen = [];
    for (const summaryLang of ['en', 'am']) {
      if (!summaries[summaryLang]) continue;
      const canSpeak = summaryLang === 'en' && 'speechSynthesis' in window;
      if (!audio[summaryLang] && !canSpeak) continue; // no way to play it: no button
      const label = summaryLang === 'en' ? t.listenEn : t.listenAm;
      const button = h('button', {
        type: 'button', class: 'fidel-button', 'aria-pressed': 'false',
        onclick: () => (button.getAttribute('aria-pressed') === 'true'
          ? this.stopSummary()
          : this.playSummary(summaryLang, audio[summaryLang], summaries[summaryLang], button, status, t)),
      }, label);
      listen.push(button);
    }

    const headingId = `${id}-title`;
    const sub = `h${Math.min(6, level + 1)}`;
    const jsonld = h('script', { type: 'application/ld+json' });
    jsonld.textContent = JSON.stringify(job);

    this.replaceChildren(
      h('article', { class: 'fidel-job', lang, 'aria-labelledby': headingId },
        h(`h${level}`, { id: headingId, class: 'fidel-job-title', lang: /[ሀ-፿]/.test(job.title) ? 'am' : 'en' }, job.title),
        h('dl', { class: 'fidel-job-facts' },
          h('dt', {}, t.employer), h('dd', {}, job.hiringOrganization?.name),
          h('dt', {}, t.location),
          h('dd', {}, place ? (remote ? `${place}, ${t.orRemote}` : place) : t.remoteOnly),
          h('dt', {}, t.applyBy),
          h('dd', {}, h('span', { lang: 'en' }, dates.gregorian), ' / ', h('span', { lang: 'am' }, dates.ethiopian)),
          h('dt', {}, t.jobType), h('dd', {}, EMPLOYMENT[job.employmentType] ? pick(EMPLOYMENT[job.employmentType]) : job.employmentType),
          h('dt', {}, t.howToApply),
          h('dd', {},
            h('p', {}, job['fidel:howToApply']),
            contact.email && h('p', {}, `${t.email}: `, h('a', { href: `mailto:${contact.email}` }, contact.email)),
            contact.url && h('p', {}, h('a', { href: contact.url }, t.applyOnline)))),
        h('section', { 'aria-labelledby': `${id}-acc` },
          h(sub, { id: `${id}-acc` }, t.accommodations),
          accommodations.length
            ? h('ul', { class: 'fidel-job-accommodations' }, accommodations.map((a) => h('li', {}, a)))
            : h('p', {}, t.none)),
        h('section', { 'aria-labelledby': `${id}-sum` },
          h(sub, { id: `${id}-sum` }, t.summary),
          listen.length > 0 && h('div', { class: 'fidel-row' }, listen),
          status,
          // The summary is always shown as text too (a transcript of the audio).
          summaries.en && h('p', { lang: 'en', class: 'fidel-job-summary' }, summaries.en),
          summaries.am && h('p', { lang: 'am', class: 'fidel-job-summary' }, summaries.am),
          summaries.am && !audio.am && h('p', { class: 'fidel-job-note' }, t.noAmharicAudio),
          audio.am && machineRead.includes('am') && h('p', { class: 'fidel-job-note' }, t.machineReadAm)),
        jsonld)
    );
  }

  playSummary(lang, url, text, button, status, t) {
    this.stopSummary?.();
    const done = () => {
      button.setAttribute('aria-pressed', 'false');
      button.firstChild.textContent = lang === 'en' ? t.listenEn : t.listenAm;
      this.stopSummary = null;
    };
    button.setAttribute('aria-pressed', 'true');
    button.firstChild.textContent = t.stop;
    status.textContent = t.playing;
    emit(this, 'fidel-summary-play', { lang });
    if (url) {
      const player = new Audio(url);
      player.addEventListener('ended', done);
      player.addEventListener('error', done);
      player.play().catch(done);
      this.stopSummary = () => {
        player.pause();
        done();
        status.textContent = t.stopped;
      };
    } else {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en';
      utterance.addEventListener('end', done);
      utterance.addEventListener('error', done);
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
      this.stopSummary = () => {
        speechSynthesis.cancel();
        done();
        status.textContent = t.stopped;
      };
    }
  }
}
