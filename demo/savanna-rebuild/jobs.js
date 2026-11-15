// Savanna (accessible rebuild): the jobs page.
// Lists the open jobs from Fidel's API (GET /api/v1/jobs) as
// <fidel-job-card job="..."> elements (the card shows its dates in both
// calendars). With no open jobs, it says so in words. Today's date is shown
// with <fidel-ethiopian-date>; it is set here, before fidel.js runs.

(() => {
  const { t } = window.savanna;
  const status = document.getElementById('jobs-status');
  const list = document.getElementById('jobs');

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  document.getElementById('today').setAttribute('datetime', `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);

  let result = 'loading';
  let count = 0;

  function showStatus() {
    const am = window.savanna.lang === 'am';
    const text = {
      loading: t('loading', 'Loading the jobs…'),
      error: t('jobsError', 'The jobs could not be loaded. Open the page again.'),
      none: t('noJobs', 'There are no open jobs right now. Please look again later.'),
      some: am ? t('jobCount', '').replace('{n}', count) : `${count} open ${count === 1 ? 'job' : 'jobs'}.`,
    }[result];
    status.textContent = text;
    if (am) status.lang = 'am'; else status.removeAttribute('lang');
  }

  fetch('/api/v1/jobs')
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((jobs) => {
      count = jobs.length;
      result = count ? 'some' : 'none';
      for (const job of jobs) {
        const item = document.createElement('li');
        const card = document.createElement('fidel-job-card');
        card.setAttribute('job', job.url);
        card.setAttribute('heading-level', '2');
        item.append(card);
        list.append(item);
      }
      list.hidden = !count;
      showStatus();
    })
    .catch(() => {
      result = 'error';
      list.hidden = true;
      showStatus();
    });

  document.addEventListener('savanna-lang', showStatus);
  showStatus();
})();
