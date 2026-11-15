#!/usr/bin/env sh
# Get ALX's official Savanna starter pages and add Fidel to them.
#
#   sh scripts/setup-savanna.sh
#
# 1. Downloads https://github.com/alx-africa/Savanna-static-pages into ./savanna/
#    (git-ignored: we do not republish ALX's files).
# 2. Adds Fidel to the lesson page exactly where the Team Technical Guide says
#    (inside #curriculum_navigation_content .savanna-styles, under the banner):
#    two lines in <head> and one <fidel-player> tag. Nothing else is changed.
# 3. Adds pages/jobs.html: the starter's own <head> and layout with Fidel job cards.
# 4. Copies integrations/savanna/fidel-savanna-patch.js to savanna/fidel/ and
#    loads it on the lesson page (skip link, focus never hidden under the
#    fixed bars). ALX's own files are not edited.
#
# The Fidel server then serves them at http://localhost:8000/savanna/ .
# Safe to run again: it only adds what is missing.
set -e
cd "$(dirname "$0")/.."

if [ ! -d savanna/.git ]; then
  git clone --depth 1 https://github.com/alx-africa/Savanna-static-pages.git savanna
fi

# Use python3 where it really works, else python (Windows).
if python3 -c "" 2>/dev/null; then PYTHON=python3; else PYTHON=python; fi
"$PYTHON" - <<'PY'
from pathlib import Path

MARK = "<!-- Fidel -->"
HEAD = f"""  {MARK}
  <link rel="stylesheet" href="/embed/v1/fidel.css">
  <script src="/embed/v1/fidel.js" defer></script>
</head>"""

page = Path("savanna/pages/concept-with-navigation.html")
html = page.read_text(encoding="utf-8")
if MARK not in html:
    html = html.replace("</head>", HEAD, 1)
    spot = '<div class="savanna-styles">'
    assert spot in html, "mount point not found: the starter has changed"
    player = f"""{spot}
{MARK}
<fidel-player src="/media/lesson.mp4" src-webm="/media/lesson.webm"
  captions-en="/demo/media/en.vtt" captions-am="/demo/media/am.vtt" captions-am-status="draft"
  chapters="/demo/media/chapters.vtt" chapters-am="/demo/media/chapters-am.vtt"
  sign="/media/sign.webm" lang="en"></fidel-player>
"""
    html = html.replace(spot, player, 1)
    page.write_text(html, encoding="utf-8")
    print("Fidel added to", page)
else:
    print("Fidel already in", page)

# Fidel's patch for the starter's keyboard defects (skip link, focus hidden
# under the fixed bars): our own file, copied next to the pages, one <script>
# line added. See integrations/savanna/fidel-savanna-patch.js.
PATCH_MARK = "<!-- Fidel Savanna patch -->"
Path("savanna/fidel").mkdir(exist_ok=True)
Path("savanna/fidel/fidel-savanna-patch.js").write_bytes(Path("integrations/savanna/fidel-savanna-patch.js").read_bytes())
if PATCH_MARK not in html:
    html = html.replace("</head>", f'  {PATCH_MARK}\n  <script src="../fidel/fidel-savanna-patch.js" defer></script>\n</head>', 1)
    page.write_text(html, encoding="utf-8")
    print("Savanna patch added to", page)

# Jobs page: the starter's <head> (Savanna's styles) and a main area with job cards.
jobs = Path("savanna/pages/jobs.html")
if not jobs.exists():
    head = html[: html.index("</head>")]
    jobs.write_text(head + """</head>
<body>
  <a class="visually-hidden-focusable" href="#main">Skip to jobs</a>
  <main id="main" class="container py-4">
    <h1>Jobs for Digital Bridge learners</h1>
    <p>Test jobs from the Fidel server. Every card is a &lt;fidel-job-card&gt;.</p>
    <ul id="jobs" class="list-unstyled d-flex flex-column gap-3"></ul>
  </main>
  <script>
    fetch('/api/v1/jobs').then((r) => r.json()).then((jobs) => {
      const list = document.getElementById('jobs');
      if (!jobs.length) list.outerHTML = '<p>No open jobs right now.</p>';
      for (const job of jobs) {
        const item = document.createElement('li');
        const card = document.createElement('fidel-job-card');
        card.setAttribute('job', job.url);
        card.setAttribute('heading-level', '2');
        item.append(card);
        list.append(item);
      }
    });
  </script>
</body>
</html>
""", encoding="utf-8")
    print("Created", jobs)
PY
echo "Open http://localhost:8000/savanna/pages/concept-with-navigation.html"
