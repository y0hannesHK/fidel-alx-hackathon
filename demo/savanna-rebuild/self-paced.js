// Savanna (accessible rebuild): the self-paced homepage.
//  - Module switcher: real buttons with aria-pressed; the panel under them
//    lists the chosen module's activities. Focus stays on the button.
//  - Programme details: a native <dialog> opened with showModal(). Escape
//    (the browser's own) or Close shuts it, and focus goes back to the
//    button that opened it.
// All data is made up for the demo.

(() => {
  const { html, escapeHtml } = window.savanna;

  const MODULES = [
    {
      title: 'Module 1: Getting started', state: 'Complete',
      activities: [['About this programme', 'Done'], ['Meet your study group', 'Done'], ['Module 1 check', 'Done, 9 of 10']],
    },
    {
      title: 'Module 2: Learning online', state: 'In progress',
      activities: [
        ['Welcome to the course', 'Done', 'lesson.html?n=1'], ['How to learn online', 'Done', 'lesson.html?n=2'],
        ['Your learning tools', 'Done', 'lesson.html?n=3'], ['Tech education as an equalizer', 'In progress', 'lesson.html'],
        ['Accessible platforms for everyone', 'Not started', 'lesson.html?n=5'], ['Module 2 wrap-up', 'Not started', 'lesson.html?n=6'],
      ],
    },
    {
      title: 'Module 3: Working with others', state: 'Not started',
      activities: [['Working in a remote team', 'Opens after Module 2'], ['Giving and receiving feedback', 'Opens after Module 2'], ['Module 3 check', 'Opens after Module 2']],
    },
  ];
  let shown = 2;

  const switcher = document.getElementById('module-switch');
  const panel = document.getElementById('module-panel');

  function render() {
    const focused = document.activeElement?.dataset?.module;
    switcher.innerHTML = MODULES.map((m, i) => `<li><button type="button" class="btn" data-module="${i + 1}" aria-pressed="${i + 1 === shown}" aria-controls="module-panel">`
      + `${escapeHtml(m.title)} <span class="chip-state">(${escapeHtml(m.state.toLowerCase())})</span></button></li>`).join('');
    const module = MODULES[shown - 1];
    panel.innerHTML = `<h3>${html('activities', 'Activities')}: ${escapeHtml(module.title)}</h3><ul class="task-list">`
      + module.activities.map(([title, state, href]) => `<li><p>${href ? `<a href="${href}">${escapeHtml(title)}</a>` : escapeHtml(title)}</p><p class="small">${escapeHtml(state)}</p></li>`).join('')
      + '</ul>';
    if (focused) switcher.querySelector(`[data-module="${focused}"]`)?.focus();
  }
  switcher.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-module]');
    if (!button) return;
    shown = Number(button.dataset.module);
    render();
  });
  document.addEventListener('savanna-lang', render);
  render();

  // Programme dialog.
  const dialog = document.getElementById('programme');
  const opener = document.getElementById('programme-open');
  opener.addEventListener('click', () => {
    dialog.showModal();
    document.getElementById('programme-close').focus();
  });
  document.getElementById('programme-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => opener.focus());
})();
