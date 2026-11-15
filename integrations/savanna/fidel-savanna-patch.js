// Fidel's patch for two defects in ALX's Savanna starter page that get in the
// way of a keyboard user reaching the Fidel player (see README, "Starter
// defects we patched"). It never edits ALX's files: scripts/setup-savanna.sh
// copies this file next to the page and adds one <script> line for it.
//
// 1. No "skip to content" link (WCAG 2.4.1): at 100% zoom a keyboard user
//    pressed Tab 24 times (logo, 9 sidebar links, the module menu and its 13
//    lesson links) before reaching the player. We add "Skip to the lesson" as
//    the first thing on the page; it goes to #curriculum_navigation_content.
// 2. The fixed header (56-72 px) and the fixed curriculum bar (63 px) cover
//    the element that has keyboard focus when the page scrolls up (Shift+Tab
//    through the player's transcript), at 200% and 400% zoom (WCAG 2.4.11).
//    We set scroll-padding-top to the height of those bars, so the browser
//    always scrolls the focused element out from under them.
//
// Only adds; removes nothing. Safe to load twice.
(() => {
  'use strict';
  if (document.documentElement.dataset.fidelSavannaPatch) return;
  document.documentElement.dataset.fidelSavannaPatch = '1';

  const TARGET_ID = 'curriculum_navigation_content';

  const style = document.createElement('style');
  style.textContent = `
    .fidel-savanna-skip {
      position: fixed; inset-block-start: 0.5rem; inset-inline-start: 0.5rem; z-index: 3000;
      padding: 0.75rem 1rem; min-block-size: 2.75rem; box-sizing: border-box;
      background: #ffffff; color: #1a1a6e; font-weight: 700; text-decoration: underline;
      border: 3px solid #1a1a6e; border-radius: 0.25rem;
      transform: translateY(-200%);
    }
    .fidel-savanna-skip:focus { transform: none; outline: 3px solid #1a1a6e; outline-offset: 2px; }
    html { scroll-padding-block-start: var(--fidel-savanna-bars, 8rem); }
    #${TARGET_ID}:focus { outline: none; }
    @media (prefers-reduced-motion: no-preference) { .fidel-savanna-skip { transition: transform 0.1s; } }
  `;
  document.head.append(style);

  function addSkipLink() {
    const target = document.getElementById(TARGET_ID);
    if (!target || document.querySelector('.fidel-savanna-skip')) return;
    const link = document.createElement('a');
    link.className = 'fidel-savanna-skip';
    link.href = `#${TARGET_ID}`;
    link.textContent = 'Skip to the lesson';
    link.addEventListener('click', (event) => {
      event.preventDefault();
      // Land on the lesson's first heading, not the whole lesson: focusing a big
      // container makes Narrator read everything in it at once (Narrator test,
      // 15 Nov 2026). Focusable only from script, so Tab continues from there.
      const place = target.querySelector('h1, h2, h3') || target;
      if (!place.hasAttribute('tabindex')) place.setAttribute('tabindex', '-1');
      place.focus();
      place.scrollIntoView({ block: 'start' });
    });
    document.body.prepend(link);
  }

  // Height of the fixed bars at the top: the header, plus the curriculum bar
  // (it slides away when scrolling down but comes back when scrolling up).
  function updateScrollPadding() {
    const header = document.querySelector('.header.position-fixed');
    const bar = document.getElementById('student-current-curriculum');
    const height = (header?.offsetHeight || 0) + (bar?.offsetHeight || 0);
    if (height) document.documentElement.style.setProperty('--fidel-savanna-bars', `${height + 8}px`);
  }

  function start() {
    addSkipLink();
    updateScrollPadding();
    window.addEventListener('resize', updateScrollPadding);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
