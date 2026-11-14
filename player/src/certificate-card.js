// <fidel-certificate certificate="https://HOST/api/v1/certificates/ID" lang="en|am">
//
// A verified-certificate card that a learner's profile, a job platform or an
// employer's site can embed. It always asks the Fidel server, so a revoked
// certificate shows as revoked everywhere straight away.
// Event: fidel-certificate-ready { status: 'valid' | 'revoked' | 'missing' }.
import { h } from './dom.js';
import { formatBoth } from './ethiopian-calendar.js';
import { emit } from './events.js';

const STRINGS = {
  en: {
    valid: '✓ Verified certificate', revoked: '✗ This certificate was revoked', missing: '✗ Certificate not found',
    name: 'Name', course: 'Course', date: 'Date', issuer: 'Issued by', check: 'Check this certificate on its official page',
  },
  am: {
    valid: '✓ የተረጋገጠ የምስክር ወረቀት', revoked: '✗ ይህ የምስክር ወረቀት ተሰርዟል', missing: '✗ የምስክር ወረቀቱ አልተገኘም',
    name: 'ስም', course: 'ኮርስ', date: 'ቀን', issuer: 'የሰጠው', check: 'ይህን የምስክር ወረቀት በይፋዊ ገጹ ላይ ያረጋግጡ',
  },
};

export class FidelCertificate extends HTMLElement {
  async connectedCallback() {
    if (this.loaded) return;
    this.loaded = true;
    const lang = (this.getAttribute('lang') || document.documentElement.lang || 'en').startsWith('am') ? 'am' : 'en';
    const t = STRINGS[lang];
    const level = Math.min(6, Math.max(2, Number(this.getAttribute('heading-level')) || 3));
    let cert = null;
    try {
      const response = await fetch(this.getAttribute('certificate'));
      if (response.ok) cert = await response.json();
    } catch {
      cert = null;
    }
    const status = cert ? cert.status : 'missing';
    const heading = h(`h${level}`, { class: 'fidel-cert-status' }, t[status === 'valid' ? 'valid' : status]);
    const body = [heading];
    if (cert) {
      const dates = formatBoth(cert.issued_on);
      body.push(h('dl', { class: 'fidel-cert-facts' },
        h('dt', {}, t.name), h('dd', {}, cert.learner_name),
        h('dt', {}, t.course), h('dd', {}, cert.course),
        h('dt', {}, t.date), h('dd', {}, h('span', { lang: 'en' }, dates.gregorian), ' / ', h('span', { lang: 'am' }, dates.ethiopian)),
        h('dt', {}, t.issuer), h('dd', {}, cert.issuer)),
      h('p', {}, h('a', { href: cert.verify_url }, t.check)));
    }
    this.replaceChildren(h('article', { class: `fidel-cert fidel-cert-${status}`, lang }, body));
    emit(this, 'fidel-certificate-ready', { status });
  }
}
