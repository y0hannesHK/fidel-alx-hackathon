// Savanna (accessible rebuild): the lesson page.
//
// lesson.html is lesson 4 (the video lesson, written in the HTML). The other
// lessons of the module are short reading lessons: with ?n=1..6 this script
// swaps in their text BEFORE fidel.js runs (fidel.js is deferred, so it
// starts after this script), so a reading lesson never loads the video.
// All content is made up for the demo.

(() => {
  const LESSONS = [
    {
      title: 'Welcome to the course',
      body: [
        'Welcome to Digital Skills for Everyone. In six short lessons per module you learn to study online, use common tools and find work that uses your new skills.',
        'Every lesson works with a keyboard, a screen reader, a phone and a slow connection. Videos have captions in English and Amharic, a transcript and sign language.',
      ],
    },
    {
      title: 'How to learn online',
      body: [
        'Set a regular time for learning, even 20 minutes a day. Short, regular sessions help more than one long session a week.',
        'Use the course contents list to see what is done and what comes next. Write notes as you go: you can add a note at any moment of a video.',
      ],
    },
    {
      title: 'Your learning tools',
      body: [
        'You need a browser, an internet connection for part of the time, and somewhere to keep notes. A phone is enough.',
        'Lessons can be saved for offline use. Captions, the transcript and the sign-language window are under each video, in the same place on every lesson.',
      ],
    },
    null, // lesson 4 is the video lesson in lesson.html
    {
      title: 'Accessible platforms for everyone',
      body: [
        'An accessible platform works for people who use it in different ways: with a screen reader, with captions, with sign language, with a keyboard only, or zoomed in on a small phone.',
        'Accessibility is built in from the start, not added at the end. When a page has real headings, real buttons and text alternatives, every learner can reach the same content.',
      ],
    },
    {
      title: 'Module 2 wrap-up',
      body: [
        'In this module you learned how to study online, which tools you need, why tech education can be an equalizer, and what makes a platform accessible.',
        'Next, open Module 3 from your course home page. If anything was hard to use, press "Get help" at the bottom of the page and tell us.',
      ],
    },
  ];
  const TOTAL = LESSONS.length;
  const n = Number(new URLSearchParams(location.search).get('n'));
  if (!Number.isInteger(n) || n < 1 || n > TOTAL || n === 4) return;

  const lesson = LESSONS[n - 1];
  const { escapeHtml } = window.savanna;
  const href = (i) => (i === 4 ? 'lesson.html' : `lesson.html?n=${i}`);
  const label = (i) => `Lesson ${i}: ${i === 4 ? 'Tech education as an equalizer' : LESSONS[i - 1].title}`;

  document.title = `${lesson.title} – Savanna (accessible rebuild, demo)`;
  document.getElementById('page-title').textContent = lesson.title;
  document.getElementById('lesson-content').innerHTML =
    `<p class="lesson-meta">Lesson ${n} of ${TOTAL}. A reading lesson.</p>`
    + lesson.body.map((p) => `<p>${escapeHtml(p)}</p>`).join('');

  // Course contents: move "You are here" (aria-current) to this lesson.
  for (const [i, link] of [...document.querySelectorAll('#curriculum-list a')].entries()) {
    if (i + 1 === n) {
      link.setAttribute('aria-current', 'page');
      link.append(document.querySelector('.lesson-here'));
    } else link.removeAttribute('aria-current');
  }

  const done = document.querySelector('fidel-mark-complete');
  done.setAttribute('lesson-id', `savanna-rebuild-lesson-${n}`);

  const nav = document.querySelector('fidel-step-nav');
  nav.setAttribute('position', String(n));
  for (const [side, i] of [['prev', n - 1], ['next', n + 1]]) {
    if (i >= 1 && i <= TOTAL) {
      nav.setAttribute(`${side}-href`, href(i));
      nav.setAttribute(`${side}-label`, label(i));
    } else {
      nav.removeAttribute(`${side}-href`);
      nav.removeAttribute(`${side}-label`);
    }
  }
})();
