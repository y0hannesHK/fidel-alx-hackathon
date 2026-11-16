"""The pages a learner sees during an LTI sign-in: waiting, problems, success.

Every message is in English and Amharic, in words, and says what to do next.
Problems also show a short reason code for the course administrator.
The Amharic was written with machine help and needs a fluent speaker's review
(BACKLOG.md).
"""

import html
import json
import re
from pathlib import Path

from fastapi.responses import HTMLResponse

TEMPLATE = Path(__file__).resolve().parent.parent / "templates" / "lti.html"
LESSON_TEMPLATE = Path(__file__).resolve().parent.parent / "templates" / "lti-lesson.html"
SCRIPT = Path(__file__).resolve().parent / "lti-page.js"
LESSON_SCRIPT = Path(__file__).resolve().parent / "lti-lesson.js"

AGAIN_EN = "Go back to your course and open the activity again."
AGAIN_AM = "ወደ ኮርስዎ ተመልሰው እንቅስቃሴውን እንደገና ይክፈቱ።"

# reason (or group of reasons) -> (HTTP status, English, Amharic)
PROBLEMS = {
    "unknown_platform": (400, "This learning platform is not connected to Fidel. Ask the Fidel administrator to add it "
                              "(Fidel Studio, LMS connections).",
                         "ይህ የመማሪያ መድረክ ከፊደል ጋር አልተገናኘም። የፊደል አስተዳዳሪውን እንዲያገናኙት ይጠይቁ።"),
    "unknown_deployment": (400, "This course's connection to Fidel is not registered. Ask the Fidel administrator to add "
                                "its deployment ID.",
                           "የዚህ ኮርስ ከፊደል ጋር ያለው ግንኙነት አልተመዘገበም። የፊደል አስተዳዳሪውን ይጠይቁ።"),
    "bad_request": (400, "Your learning platform sent an incomplete request. " + AGAIN_EN,
                    "የመማሪያ መድረክዎ ያልተሟላ ጥያቄ ላከ። " + AGAIN_AM),
    "platform_error": (400, "Your learning platform did not sign you in. " + AGAIN_EN,
                       "የመማሪያ መድረክዎ አላስገባዎትም። " + AGAIN_AM),
    "sign_in_used": (400, "This sign-in has expired or was already used. " + AGAIN_EN,
                     "ይህ መግቢያ ጊዜው አልፎበታል ወይም ቀድሞ ጥቅም ላይ ውሏል። " + AGAIN_AM),
    "cookie_blocked": (400, "Your browser blocked Fidel's sign-in check inside the course page. " + AGAIN_EN
                            + " If it happens again, ask your teacher to set the activity to open in a new window.",
                       "አሳሽዎ በኮርሱ ገጽ ውስጥ የፊደልን የመግቢያ ማረጋገጫ ከለከለ። " + AGAIN_AM
                       + " እንደገና ከተከሰተ መምህርዎ እንቅስቃሴው በአዲስ መስኮት እንዲከፈት እንዲያደርጉ ይጠይቁ።"),
    "not_confirmed": (401, "Fidel could not confirm that this request came from your learning platform, so nothing "
                           "was opened. " + AGAIN_EN,
                      "ፊደል ይህ ጥያቄ ከመማሪያ መድረክዎ መምጣቱን ማረጋገጥ ስላልቻለ ምንም አልተከፈተም። " + AGAIN_AM),
    "platform_unreachable": (502, "Fidel could not reach your learning platform to check this sign-in. "
                                  "Try again in a few minutes.",
                             "ፊደል ይህን መግቢያ ለማረጋገጥ የመማሪያ መድረክዎን ማግኘት አልቻለም። ከጥቂት ደቂቃዎች በኋላ እንደገና ይሞክሩ።"),
    "not_supported": (400, "Fidel cannot open this kind of activity yet. Tell your teacher.",
                      "ፊደል ይህን ዓይነት እንቅስቃሴ ገና መክፈት አይችልም። ለመምህርዎ ይንገሩ።"),
    "no_lesson": (404, "This activity does not say which Fidel lesson to open, or the lesson is not available "
                       "(removed, or not published yet). Tell your teacher.",
                  "ይህ እንቅስቃሴ የትኛውን የፊደል ትምህርት እንደሚከፍት አይገልጽም፣ ወይም ትምህርቱ አይገኝም። ለመምህርዎ ይንገሩ።"),
}

# Reason codes from the checks (lti/launch.py) -> the message learners see.
GROUP = {
    "platform_keys_unreachable": "platform_unreachable",
    "wrong_message_type": "not_supported",
    "unknown_deployment": "unknown_deployment",
}


def render(title_en: str, title_am: str, body: str, data: dict | None = None, status_code: int = 200) -> HTMLResponse:
    script = ""
    if data is not None:
        # JSON inside <script>: "<" escaped so no value can close the element.
        payload = json.dumps(data).replace("<", "\\u003c")
        script = (f'<script type="application/json" id="lti-data">{payload}</script>\n'
                  f"<script>\n{SCRIPT.read_text(encoding='utf-8')}</script>")
    e = html.escape
    values = {"{{TITLE_EN}}": e(title_en), "{{TITLE_AM}}": e(title_am), "{{BODY}}": body, "{{SCRIPT}}": script}
    page = re.sub(r"\{\{[A-Z_]+\}\}", lambda m: values.get(m.group(0), ""), TEMPLATE.read_text(encoding="utf-8"))
    return HTMLResponse(page, status_code=status_code,
                        headers={"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"})


def status_box(kind: str, english: str, amharic: str, role: str = "") -> str:
    role_attr = f' role="{role}"' if role else ""
    return (f'<div class="status {kind}"{role_attr}><p>{html.escape(english)}</p>'
            f'<p lang="am">{html.escape(amharic)}</p></div>')


def problem(reason: str, detail: str = "") -> HTMLResponse:
    """A page saying what went wrong, in words, with the reason for administrators."""
    key = reason if reason in PROBLEMS else GROUP.get(reason, "not_confirmed")
    code, english, amharic = PROBLEMS[key]
    admin = f"{reason}: {detail}" if detail else reason
    body = (status_box("bad", english, amharic, role="alert")
            + f'<p class="detail">Details for your course administrator <span lang="am">/ ለአስተዳዳሪው</span>: '
              f"<code>{html.escape(admin[:300])}</code></p>")
    return render("Fidel could not open this lesson", "ፊደል ይህን ትምህርት መክፈት አልቻለም", body, status_code=code)


def login_page(data: dict, login_url: str) -> HTMLResponse:
    """Shown for a moment while the sign-in continues at the platform."""
    e = html.escape
    body = (
        '<div id="lti-wait">'
        + status_box("wait", "Signing you in through your learning platform…", "በመማሪያ መድረክዎ በኩል እየገቡ ነው…", role="status")
        + f'<noscript><p><a class="button" href="{e(data["authUrl"])}">Continue <span lang="am">/ ቀጥል</span></a></p></noscript>'
        + "</div>"
        + '<div id="lti-new-window" hidden>'
        + status_box("bad", "Your browser blocks Fidel's sign-in inside the course page. Open the lesson in a new "
                            "window instead; you stay signed in to your course.",
                     "አሳሽዎ በኮርሱ ገጽ ውስጥ የፊደልን መግቢያ ይከለክላል። ትምህርቱን በአዲስ መስኮት ይክፈቱ።", role="alert")
        + f'<p><a class="button" href="{e(login_url)}" target="_blank" rel="noopener">Open in a new window '
          f'<span lang="am">/ በአዲስ መስኮት ክፈት</span></a></p>'
        + "</div>")
    return render("Signing in", "በመግባት ላይ", body, data={**data, "page": "login"})


def launch_check_page(data: dict, form: dict) -> HTMLResponse:
    """The cookie was blocked: check the state in the platform's storage, then send the launch on."""
    e = html.escape
    fields = "".join(f'<input type="hidden" name="{e(k)}" value="{e(v)}">' for k, v in form.items())
    body = (
        '<div id="lti-wait">'
        + status_box("wait", "Checking your sign-in…", "መግቢያዎን በማረጋገጥ ላይ…", role="status")
        + f'<form id="lti-continue" method="post" action="/lti/launch">{fields}'
          f'<input type="hidden" name="platform_storage" value="checked">'
          f'<noscript><p>Fidel needs JavaScript to check this sign-in inside the course page. '
          f'<span lang="am">ፊደል ይህን መግቢያ ለማረጋገጥ JavaScript ያስፈልገዋል።</span></p></noscript></form>'
        + "</div>"
        + '<div id="lti-check-failed" hidden>'
        + status_box("bad", PROBLEMS["cookie_blocked"][1], PROBLEMS["cookie_blocked"][2], role="alert")
        + "</div>")
    return render("Checking your sign-in", "መግቢያዎን በማረጋገጥ ላይ", body, data={**data, "page": "launch-check"})


def lesson_page(platform_name: str, lesson: dict, launch_token: str, lang: str, grades: bool) -> HTMLResponse:
    """The launch passed every check: the normal Fidel player, in the course's language.
    The launch token is only in this page (for "completed"), never in an address."""
    e = html.escape
    intro = (f'<p class="from"><span lang="en">Opened from {e(platform_name)}.</span> '
             f'<span lang="am">ከ{e(platform_name)} የተከፈተ።</span></p>')
    if grades:
        intro += ('<p class="note"><span lang="en">When you watch the video to the end, Fidel tells your course '
                  'that you completed this lesson.</span> <span lang="am">ቪዲዮውን እስከ መጨረሻው ሲመለከቱ፣ ፊደል '
                  'ትምህርቱን እንደጨረሱ ለኮርስዎ ያሳውቃል።</span></p>')
    payload = json.dumps({"launch": launch_token}).replace("<", "\\u003c")
    script = (f'<script type="application/json" id="lti-data">{payload}</script>\n'
              f"<script>\n{LESSON_SCRIPT.read_text(encoding='utf-8')}</script>")
    values = {"{{LANG}}": lang, "{{TITLE}}": e(lesson["title"]), "{{INTRO}}": intro,
              "{{LESSON_ID}}": e(lesson["id"]), "{{SCRIPT}}": script}
    page = re.sub(r"\{\{[A-Z_]+\}\}", lambda m: values.get(m.group(0), ""),
                  LESSON_TEMPLATE.read_text(encoding="utf-8"))
    return HTMLResponse(page, headers={"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"})
