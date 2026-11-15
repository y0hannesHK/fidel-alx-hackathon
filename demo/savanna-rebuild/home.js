// Savanna (accessible rebuild): the paced homepage.
//  - Course switcher: a disclosure. A real <button aria-expanded> shows a list
//    of course buttons; the chosen one has aria-current="true". Escape closes
//    the list and focus goes back to the switcher button.
//  - Week strip: real buttons with aria-pressed. They wrap onto more lines
//    instead of scrolling sideways. Pressing one shows that week's tasks in
//    the panel under the strip; focus stays on the button.
// All data is made up for the demo.

(() => {
  const { html, escapeHtml } = window.savanna;

  const COURSES = [
    { id: 'wf100', name: 'Web Foundations (WF-100)', cohort: 'Cohort November 2026, week 6 of 8' },
    { id: 'ds101', name: 'Digital Skills for Everyone (DS-101)', cohort: 'Self-paced, 16% done' },
    { id: 'cc110', name: 'Communication at Work (CC-110)', cohort: 'Cohort January 2027, starts 11 January' },
  ];
  let course = 'wf100';

  const WEEKS = [
    { title: 'Getting started', tasks: ['Set up your learning tools', 'Introduce yourself to your group'] },
    { title: 'How the web works', tasks: ['Watch: browsers and servers', 'Quiz: requests and responses'] },
    { title: 'Your first HTML page', tasks: ['Write a page with headings and paragraphs', 'Peer review: one page'] },
    { title: 'Links and images', tasks: ['Add links between two pages', 'Write alt text for three images'] },
    { title: 'Forms that everyone can use', tasks: ['Build a form with labels', 'Test it with the keyboard only'] },
    { title: 'Accessible pages', tasks: ['Lesson: Tech education as an equalizer', 'Project: a personal web page', 'Quiz: how the web works'] },
    { title: 'Styling with CSS', tasks: ['Colours with enough contrast', 'Layouts that fit a phone'] },
    { title: 'Final project', tasks: ['Publish your web page', 'Present it to your group'] },
  ];
  const CURRENT_WEEK = 6;
  let shownWeek = CURRENT_WEEK;

  // ---------- Course switcher ----------
  const switchButton = document.getElementById('course-switch');
  const list = document.getElementById('course-list');

  function renderCourses() {
    list.innerHTML = COURSES.map((c) => `<li><button type="button" class="btn" data-course="${c.id}"${c.id === course ? ' aria-current="true"' : ''}>${escapeHtml(c.name)}</button></li>`).join('');
  }
  function openList(open) {
    switchButton.setAttribute('aria-expanded', String(open));
    list.hidden = !open;
  }
  switchButton.addEventListener('click', () => {
    const open = switchButton.getAttribute('aria-expanded') !== 'true';
    openList(open);
    if (open) list.querySelector('[aria-current="true"]')?.focus();
  });
  list.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-course]');
    if (!button) return;
    course = button.dataset.course;
    const chosen = COURSES.find((c) => c.id === course);
    document.getElementById('course-name').textContent = chosen.name;
    document.getElementById('course-cohort').textContent = chosen.cohort;
    renderCourses();
    openList(false);
    switchButton.focus();
  });
  document.querySelector('.switcher').addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !list.hidden) {
      openList(false);
      switchButton.focus();
    }
  });
  // Close the list when focus or a click leaves the switcher.
  document.addEventListener('click', (event) => {
    if (!list.hidden && !event.target.closest('.switcher')) openList(false);
  });
  renderCourses();

  // ---------- Week strip ----------
  const strip = document.getElementById('week-strip');
  const panel = document.getElementById('week-panel');

  function weekState(n) {
    if (n < CURRENT_WEEK) return 'done';
    if (n === CURRENT_WEEK) return html('thisWeek', 'this week');
    return 'coming';
  }
  function renderStrip() {
    strip.innerHTML = WEEKS.map((w, i) => {
      const n = i + 1;
      return `<li><button type="button" class="btn" data-week="${n}" aria-pressed="${n === shownWeek}" aria-controls="week-panel">`
        + `<span>${html('week', 'Week')} ${n}</span> <span class="chip-state">(${weekState(n)})</span></button></li>`;
    }).join('');
  }
  function renderPanel() {
    const week = WEEKS[shownWeek - 1];
    const status = shownWeek < CURRENT_WEEK ? 'Done.' : shownWeek === CURRENT_WEEK ? 'This is the current week.' : 'Opens later.';
    panel.innerHTML = `<h3 id="week-panel-title">${html('week', 'Week')} ${shownWeek}: ${escapeHtml(week.title)}</h3>`
      + `<p>${status}</p><ul>${week.tasks.map((task) => `<li>${escapeHtml(task)}</li>`).join('')}</ul>`;
  }
  strip.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-week]');
    if (!button) return;
    shownWeek = Number(button.dataset.week);
    for (const b of strip.querySelectorAll('button[data-week]')) b.setAttribute('aria-pressed', String(b === button));
    renderPanel();
  });

  function render() {
    const focusedWeek = document.activeElement?.dataset?.week;
    renderStrip();
    renderPanel();
    if (focusedWeek) strip.querySelector(`[data-week="${focusedWeek}"]`)?.focus();
  }
  document.addEventListener('savanna-lang', render);
  render();
})();
