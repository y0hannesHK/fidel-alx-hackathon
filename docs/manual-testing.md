# Manual testing checklists

## The gate (opening presentation, 14 Nov, slide 14)

Pass or fail; a module that does not pass is not scored:

1. A co-designer completes the **main task unaided**, with **NVDA, TalkBack,
   keyboard only, 200% zoom, and sound off**.
2. **axe-core is clean**: zero critical and zero serious issues.
3. A **WCAG 2.2 AA conformance report** is submitted with the code
   ([CONFORMANCE.md](../CONFORMANCE.md)).

What the machine checks (`e2e/tests/gate.spec.js`, plus the reflow, keyboard
and offline tests), last run 15 Nov 2026 on the `speech-engines` branch:

| Check | Pages | Result |
|---|---|---|
| axe-core, WCAG 2.0–2.2 A/AA | Demo lesson, Amharic lesson (captions and descriptions in English, Amharic and Afaan Oromo), job card, live-session viewer, blank page, lesson document, offline lesson, all 5 Studio pages | **0 critical, 0 serious**, at 100%, 200% and 400% zoom |
| 200% zoom (640 CSS px) | the same pages | No sideways scrolling |
| 400% zoom (320 CSS px, WCAG 1.4.10) | the same pages | No sideways scrolling, after two fixes: the transcript toolbar now wraps; Studio's lesson table scrolls inside its own box |
| Keyboard only | learner pages | Tab reaches every control and never gets stuck; the main task (Amharic captions, bigger, sign language, search) is done with the keyboard in `savanna-mock.spec.js` |

Still to be done by people (a machine cannot judge these): **NVDA**,
**TalkBack**, **sound off**, and **the co-designer doing the main task
unaided**. Use the checklists below and write the results in the table at the
end.

Automated tests (axe, keyboard, reflow) pass, but they cannot tell us whether
a real person can use Fidel. Run these with **NVDA**, **TalkBack**, the
**keyboard only**, **200% zoom** and **sound off**, and above all **with our
co-designer**. Write the results in the table at the end and add them to
[CONFORMANCE.md](../CONFORMANCE.md).

Test on: `http://<laptop IP>:8000/demo/savanna-mock/` (phones on the same Wi-Fi)
and `http://<laptop IP>:8000/demo/savanna-mock/jobs.html`.

Note: over plain `http://` to a laptop's IP address, browsers do not allow
service workers, so **"Save for offline" is not shown** there (the download
links still work). It appears on `https://` sites and on `localhost`.

## The main task (the judging gate)

The co-designer should finish this **without help**:

1. Open the lesson.
2. Turn on **Amharic captions** and make them **bigger**.
3. Open the **sign-language window**.
4. **Read and search** the transcript; jump to a search result.
5. **Download the offline lesson** (or "Save for offline").
6. Open a **job card** and **hear its summary**.

## NVDA (Windows, Chrome or Firefox)

- [ ] Press H to move by headings: "Lesson video", "Media player", "Accessibility settings", "Transcript" are found.
- [ ] Tab reaches every player button; each is read with a name ("Play", "Captions", …).
- [ ] "Caption language" group: arrow keys move between Off / English / አማርኛ; the choice is read.
- [ ] Amharic option is read with an Amharic voice (if installed), or at least not garbled in English.
- [ ] "Larger captions": the new size ("175%") is read after pressing.
- [ ] Draft notice is read when Amharic captions are turned on.
- [ ] "Show sign language" is read as a toggle button, pressed / not pressed.
- [ ] Search: typing a word and pressing Enter reads "N results for …"; Tab reaches "Play from 1:33 …" buttons.
- [ ] Tabbing into the transcript text switches "Follow along" off (the page stops jumping).
- [ ] Able Player shortcut keys do not clash with NVDA keys (they need Alt+Ctrl by default).
- [ ] Switching the interface to አማርኛ: focus stays on the language button; Able Player buttons are now in Amharic.
- [ ] Job card: heading, facts list, accommodations list, "Listen to summary" are all read; Stop works.
- [ ] Certificate check page: "Verified by ALX Digital Bridge" is read near the top.

## TalkBack (Android, Chrome)

- [ ] Swipe through the player: every control is announced with a name; none are skipped.
- [ ] Double-tap works on every button (no action needs a drag or a keyboard shortcut).
- [ ] Touch targets are easy to hit (44 × 44 px).
- [ ] Amharic captions: read by TalkBack's voice or shown clearly; Ethiopic letters display correctly.
- [ ] Sign window "Beside the video" sits below the video on the phone, not on top of slides.
- [ ] Download the offline lesson, switch on **airplane mode**, open it from Downloads in Chrome: audio plays, sentences highlight, tapping a sentence jumps there.
- [ ] Job card: "Listen to summary" plays; the summary text is visible.

## Keyboard only (no mouse)

- [ ] Every control can be reached with Tab and used with Enter/Space; the focus ring is always visible.
- [ ] No keyboard trap (Able Player Preferences dialog closes with Escape).
- [ ] Studio: review captions with Ctrl+Enter ("Checked, go to next"); the focused box is never hidden under the sticky toolbar.

## 200% zoom and small screens

- [ ] Browser zoom 200%: no sideways scrolling; nothing overlaps.
- [ ] Captions at 250% still fit and stay readable.
- [ ] Text spacing (use a text-spacing bookmarklet): nothing is cut off.

## Sound off (Deaf and hard-of-hearing learners)

- [ ] Everything spoken is available as captions or transcript.
- [ ] No information is given by sound only (status changes are shown as text).
- [ ] Sign-language window keeps time with the video after pause, seek and speed change.

## Co-designer session (from the 10 November training)

- Ask them to show how they normally do the task first. Then watch; do not help; take notes; do not defend the design.
- Speak to the Deaf co-designer, not the interpreter; one person talks at a time; share new words ("caption", "transcript", "offline") with the interpreter beforehand.
- Ask consent before using their name, photo, voice or words in the pitch.
- Test, fix, test again: **at least twice before the pitch**.

## Results

| Date | Tester (with consent) | Setup | Task step | Result | Problem found | Fixed? |
|---|---|---|---|---|---|---|
| | | | | | | |

## Component library (`demo/components.html`): NVDA, TalkBack, Braille display, keyboard

<!-- PACKAGE A START -->
<!-- PACKAGE A END -->

<!-- PACKAGE B START -->
<!-- PACKAGE B END -->

<!-- PACKAGE C START -->
<!-- PACKAGE C END -->

<!-- PACKAGE D START -->
### Package D: caption reports, sound-off check, keyboard, event card, sign answer, reading guide, Savanna patch

- [ ] NVDA: "Report a caption problem" is read as a button; in the dialog, the time, language and current caption are read, and "What is wrong?" is read as a group.
- [ ] TalkBack: the same on Android Chrome; the Amharic caption is read or shown correctly.
- [ ] Keyboard: Escape closes the dialog and focus returns to the button; the video plays on only if it was playing.
- [ ] Airplane mode: send a report, see "Saved on this phone", go back online, check that it arrives in Studio.
- [ ] Studio: "Go to this caption", "Resolved" and "Dismiss" work and are announced.
- [ ] Savanna lesson page (after `sh scripts/setup-savanna.sh`): the first Tab shows "Skip to the lesson"; at 200% and 400% zoom, Shift+Tab never leaves focus hidden under the fixed bars.
- [ ] Studio sound-off check: the gaps are read with their times; "Add a sound caption here" expands (aria-expanded), saving announces the result and focus lands on the "Sound-off check" heading.
- [ ] Amharic keyboard with NVDA (no Amharic voice): letters are read with their Latin reading ("ለ, le"); arrows move, Enter types, the added letter is announced; Escape goes back to the letters.
- [ ] Amharic keyboard on a phone with TalkBack: 44 px keys, the grid wraps, no sideways scrolling.
- [ ] Event card with NVDA: heading, both dates and the access line are read as text; the request dialog asks only which support; Escape returns focus to "Request access support". Open the downloaded .ics in a calendar app.
- [ ] Sign answer: a **Deaf co-designer on their own phone over HTTPS** (a tunnel, see the Technical Guide section 2) records, watches at 0.5x and sends; also refuse the camera once and use the phone's camera app instead.
- [ ] Reading guide at 200% and 400% zoom: Next/Previous line keep the block in view; Dim the rest stays readable; with Windows High Contrast the outline still shows.
<!-- PACKAGE D END -->
