// Savanna (accessible rebuild): shared page code for the four demo pages.
// Team GNU's own code, written from scratch (no Bootstrap, no ALX script).
//
//  - English / Amharic switch for the page chrome: real buttons with
//    aria-pressed. Elements with data-i18n="key" (text) or
//    data-i18n-label="key" (aria-label) get the Amharic text and lang="am";
//    switching back restores the English written in the HTML. Remembered in
//    localStorage ("savanna-rebuild-lang"). Pages listen for the
//    "savanna-lang" event to re-render their own parts with savanna.t().
//  - Menu button: shows or hides the sidebar navigation (aria-expanded),
//    remembered in localStorage ("savanna-rebuild-sidebar").
//
// Course content (lesson text, course data) stays in English; only the
// interface around it changes language.

(() => {
  const LANG_KEY = 'savanna-rebuild-lang';
  const SIDEBAR_KEY = 'savanna-rebuild-sidebar';

  // Every Amharic string of the demo's interface.
  const AM = {
    skip: 'ወደ ዋናው ይዘት ይዝለሉ',
    menu: 'ምናሌ',
    brandNote: '(ተደራሽ ሆኖ እንደገና የተሠራ)',
    builtWith: 'የተገነባው በ',
    language: 'የገጹ ቋንቋ',
    demoNote: 'ማሳያ፦ የSavanna ገጾች በGNU ቡድን ለDigital Bridge ሃካቶን እንደገና የተሠሩ ናቸው። የALX ምርት አይደለም።',
    navMain: 'ዋና ማውጫ',
    navHome: 'መነሻ (በሳምንት የሚሄድ ኮርስ)',
    navSelf: 'በራስ ፍጥነት የሚሄድ ኮርስ',
    navLesson: 'ትምህርት',
    navJobs: 'ሥራዎች',
    footer: 'በእነዚህ ገጾች ያሉት ሰዎች፣ ኮርሶች እና ውጤቶች በሙሉ ምናባዊ ናቸው።',
    // Paced homepage
    greeting: 'እንደምን አሉ፣ ሰላም',
    yourCourse: 'የእርስዎ ኮርስ',
    switchCourse: 'ኮርስ ይቀይሩ',
    weeks: 'የኮርሱ ሳምንታት',
    week: 'ሳምንት',
    thisWeek: 'ይህ ሳምንት',
    continue: 'ካቆሙበት ይቀጥሉ',
    deliverables: 'የሚቀርቡ ሥራዎች',
    score: 'አጠቃላይ ውጤትዎ',
    events: 'የሚመጡ ዝግጅቶች',
    offline: 'ከመስመር ውጭ',
    // Self-paced homepage
    selfTitle: 'በራስ ፍጥነት የሚሄድ ኮርስ',
    courseProgress: 'የኮርስ ሂደት',
    modules: 'ሞጁሎች',
    activities: 'ተግባራት',
    programme: 'የፕሮግራሙ ዝርዝር',
    close: 'ዝጋ',
    // Lesson page
    contents: 'የኮርሱ ይዘት',
    keyPoint: 'ዋና ነጥብ',
    takeAway: 'ትምህርቱን ይዘው ይሂዱ',
    // Jobs page
    jobsTitle: 'ለDigital Bridge ተማሪዎች የሚሆኑ ሥራዎች',
    today: 'ዛሬ',
    noJobs: 'አሁን ክፍት ሥራ የለም። ቆይተው እንደገና ይመልከቱ።',
    loading: 'ሥራዎች በመጫን ላይ…',
    jobsError: 'ሥራዎቹን መጫን አልተቻለም። ገጹን እንደገና ይክፈቱ።',
    jobCount: 'ክፍት ሥራዎች፦ {n}',
  };

  let lang = localStorage.getItem(LANG_KEY) === 'am' ? 'am' : 'en';

  /** The Amharic text for key in Amharic mode, else the English given. */
  function t(key, english) {
    return lang === 'am' && AM[key] ? AM[key] : english;
  }

  function applyLang(next) {
    lang = next === 'am' ? 'am' : 'en';
    for (const el of document.querySelectorAll('[data-i18n]')) {
      if (el.dataset.en === undefined) el.dataset.en = el.textContent;
      const am = AM[el.dataset.i18n];
      if (lang === 'am' && am) {
        el.textContent = am;
        el.lang = 'am';
      } else {
        el.textContent = el.dataset.en;
        el.removeAttribute('lang');
      }
    }
    for (const el of document.querySelectorAll('[data-i18n-label]')) {
      if (el.dataset.enLabel === undefined) el.dataset.enLabel = el.getAttribute('aria-label') || '';
      const am = AM[el.dataset.i18nLabel];
      el.setAttribute('aria-label', lang === 'am' && am ? am : el.dataset.enLabel);
    }
    for (const button of document.querySelectorAll('.lang-switch button[data-lang]')) {
      button.setAttribute('aria-pressed', String(button.dataset.lang === lang));
    }
    localStorage.setItem(LANG_KEY, lang);
    document.dispatchEvent(new CustomEvent('savanna-lang', { detail: { lang } }));
  }

  function setUpLanguageSwitch() {
    for (const button of document.querySelectorAll('.lang-switch button[data-lang]')) {
      button.addEventListener('click', () => applyLang(button.dataset.lang));
    }
    applyLang(lang);
  }

  function setUpSidebar() {
    const toggle = document.querySelector('.menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const layout = document.querySelector('.layout');
    if (!toggle || !sidebar) return;
    const show = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      sidebar.hidden = !open;
      layout?.classList.toggle('sidebar-closed', !open);
    };
    show(localStorage.getItem(SIDEBAR_KEY) !== 'closed');
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      show(open);
      localStorage.setItem(SIDEBAR_KEY, open ? 'open' : 'closed');
    });
  }

  /** Escape text for safe use in HTML made by the pages. */
  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /** Like t(), as HTML: Amharic text is wrapped in <span lang="am">. */
  function html(key, english) {
    const text = escapeHtml(t(key, english));
    return lang === 'am' && AM[key] ? `<span lang="am">${text}</span>` : text;
  }

  window.savanna = { t, html, get lang() { return lang; }, escapeHtml };

  setUpSidebar();
  setUpLanguageSwitch();
})();
