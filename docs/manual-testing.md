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
**Package A: reading and understanding** (section "Reading and understanding").

Keyboard only (no mouse):
- [ ] Tab moves through every button in order and leaves the section; focus is always visible.
- [ ] Code block: Copy says "Copied"; Read line by line opens the list and focus lands on line 1; Up/Down/Home/End move between lines; Tab leaves the list in one press.
- [ ] Word: Enter opens the meaning window; Tab stays inside it; Escape closes it and focus is back on the word.
- [ ] Steps: Next and Previous put focus on "Step N of 5"; Space ticks "I did this step"; reload keeps the place.
- [ ] Read aloud: Listen starts, Escape stops.

NVDA (Windows, Chrome or Firefox) and TalkBack (Android, Chrome):
- [ ] Code block: browse mode reads the code without line numbers; the line view reads "Line 2 of 2, indent 4 spaces: print open bracket i close bracket"; Symbols as words is read as a toggle button, pressed / not pressed.
- [ ] Code snapshots: play the video past 0:59: "Code for 0:59 is ready" is heard once; "Now" is read before the current snapshot. Pressing "Play from 2:10" does not announce.
- [ ] Image: read as the alt text, then the caption; "Full description" is a collapsed/expanded control and the description is a normal list.
- [ ] Word: the word is read as a button; the window is read as a dialog named by the word; the Amharic meaning is read with an Amharic voice if one is installed (lang="am").
- [ ] Read aloud: with NVDA running, pressing Listen gives two voices at once: check this is understandable, or that NVDA users simply do not press it (it never speaks by itself).
- [ ] Simple words: read as a toggle button; pressing it says "Simple version shown".
- [ ] Amharic interface ("ፋይል አስቀምጥ" steps, the word "accessible"): labels are read in Amharic.

Braille display (NVDA + a display):
- [ ] The code shows as real text, line by line, with its indentation; the line view gives the indent in words.
- [ ] Short messages ("Copied", "Code for 0:59 is ready") appear briefly and are readable.

Look and zoom:
- [ ] 200 % and 400 % browser zoom, and a 320 px wide phone: nothing scrolls sideways (long code scrolls inside its box).
- [ ] Windows High Contrast: buttons, the pressed state, the "Now" label and the reading highlight are visible.
<!-- PACKAGE A END -->

<!-- PACKAGE B START -->
### Package B: data, offline, dates and language

Keyboard only (no mouse):
- [ ] Tab reaches "Load it", the smaller-version link, "Download when I'm online", the four language buttons, "Display settings" and the link in the example lesson, in that order, with a visible focus ring.
- [ ] "Display settings": Enter opens the dialog; Tab stays inside it; Escape closes it and focus is back on the button.

NVDA (Firefox or Chrome) and TalkBack (Android Chrome):
- [ ] Data saver: the size is read before the buttons; "Load it (2.2 MB)" is announced as a button; after pressing it, the video is focused and "Loading the video" is heard.
- [ ] Offline status: turn on airplane mode: "You are offline…" is heard **once**; turn it off: "Online." is heard once. Nothing is read at page load.
- [ ] Download later: airplane mode on, press the button: "… will download when you are online"; airplane mode off: "… is ready offline" is heard once.
- [ ] Ethiopian date: the English date is read with the English voice, the Ethiopian date with the Amharic voice (if one is installed).
- [ ] Section language: buttons are read as "English, button, current" / "አማርኛ, button"; pressing አማርኛ says "Showing Amharic" and the summary is read in Amharic.
- [ ] Display settings: the dialog is announced with its name; each group (Text size, Line spacing, Colours) is announced with its legend.
- [ ] TalkBack on Android Chrome: "Only on Wi-Fi" appears, and with it checked, mobile data does not start the download.

Braille display (NVDA):
- [ ] Short messages ("Online.", "Showing Amharic", "Lesson 3 (demo file) is ready offline.") are shown in full on the display.

Low vision / zoom:
- [ ] At 400 % browser zoom and with 200 % text + wide spacing + yellow on black from the settings, nothing scrolls sideways and the Amharic text is readable.
<!-- PACKAGE B END -->

<!-- PACKAGE C START -->
**Package C** (section "Deaf learners, motor access, navigation and help"):

Keyboard only:
- [ ] Tab to "log in", press Enter: the dialog opens and focus is inside. Tab through Pause, Slower and Close; Escape closes and focus is back on "log in".
- [ ] "server": the dialog says "No sign recorded yet for this word" (no broken player).
- [ ] "Show a test alert": the banner shows; Tab to "Close alert", press Enter; focus does not jump to the top of the page.
- [ ] Previous / Next links: easy to hit with a mouse held in the wrong hand, or with one finger on a phone.
- [ ] "Start a 40-second test session": after 10 s the dialog opens with "Yes, more time" focused; Enter extends. Try ten times in a row.
- [ ] Lesson map: each jump link moves to that part; "Play from 0:59" plays the video from there.
- [ ] "Get help": text chat first, phone last; Escape returns to "Get help".

NVDA (Firefox or Chrome) and TalkBack (Chrome on Android):
- [ ] "log in" is read as "log in (sign and meaning), button"; the dialog title "log in" is read when it opens.
- [ ] An alert is read once, politely ("Alert: Your lesson finished downloading"); it is not read twice.
- [ ] Landmarks list (NVDA+F7 / TalkBack landmarks) has "Lesson" and "This lesson" navigation.
- [ ] The session dialog reads "Do you need more time?" and the time left; nothing counts down out loud every second.
- [ ] Lesson map: "You have watched …" is not read by itself while the video plays; "Where am I?" says the percentage and chapter.
- [ ] With `ui-lang="am"` (the Amharic "Get help"): the Amharic voice (or Braille) reads the Amharic text.

Braille display:
- [ ] The alert message and "Time extended" appear briefly and are short enough to read.
- [ ] The meanings in the sign-term dialog are real text, line by line.

Deaf co-designer:
- [ ] Is the sign dialog clear without sound? Is "Slower" useful? Which tech words need signs first?
- [ ] Do the visual alerts get noticed? Should "Keep alerts until I close them" stay on by default?
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

<!-- PACKAGE FORMS START -->
### Form fields (demo/inputs.html)

- [ ] NVDA + Chrome/Firefox: each field is read as label, "required", hint; after Tab out of a wrong Start time, "Start: Use minutes:seconds..." is read once (not twice); typing it right says "Fixed".
- [ ] NVDA: empty submit moves to "3 fields need fixing"; each link puts the cursor in the field; the field reads its error.
- [ ] NVDA: "Draft saved" is said once, not at every pause; after reload "Your draft was restored." is said.
- [ ] NVDA with the typing voice OFF: nothing is spoken twice. Turn on "Words": check it does not fight NVDA's own echo (expected: people who use NVDA leave it off).
- [ ] TalkBack on Android Chrome: the Amharic form, the select with "Search the list", the date picker (Ethiopian date read after it), choosing a CV from the phone, "Remove".
- [ ] TalkBack: flight mode, send the caption form: "Saved on this phone"; flight mode off: "Your saved form was sent."
- [ ] **Amharic-keyboard typist** (Windows Amharic IME or Keyman, and Android Gboard Amharic): type in the Amharic name and "About you" boxes. The keyboard-language hint must NOT appear while typing Amharic normally, must appear for "selam " typed by mistake with an English keyboard, and disappear at the first Amharic letter. Does Caps Lock matter with the Amharic layout? (decides the Caps Lock default, see BACKLOG).
- [ ] Amharic typist with the typing voice on "Letters": each finished letter (not each Latin key) is spoken, if the device has an Amharic voice.
- [ ] **Co-designer** (blind, Braille display): errors and hints are short enough to read on one Braille line; "⚠" is shown as a symbol the display can show.
- [ ] Co-designer (low vision, 200% and 400% zoom, Windows High Contrast): errors, hints and the summary box stay visible, nothing scrolls sideways, focus is always visible.
- [ ] Listen: on a device with an English voice, "Listen" reads the English box; Escape stops it. With the Toucan voice engine running (`docker compose --profile amharic-voice up -d`), "Listen" appears under the Amharic boxes and reads them.
- [ ] Studio caption editor: Start/End errors in words on leaving the field; Ctrl+Enter still moves to the next translation; the keyboard-language hint shows in the Amharic box when typing English.
<!-- PACKAGE FORMS END -->

<!-- PACKAGE E START -->
### Package E: lesson formats, questions, notes, quiz, callouts, tables, small tags, reading font

Open `demo/components.html?lesson=ID` with a published lesson that has sound and captions.

- [ ] NVDA + Chrome: "How do you want this lesson?" is read as a group; each format is read with "toggle button, pressed / not pressed" and its size; choosing Listen announces "Listen mode: audio and transcript." and the transcript lines are read as "Play from 0:05" buttons followed by the text.
- [ ] Phone on mobile data (Chrome DevTools or a real phone): choose Listen and reload: no video is downloaded (check the data used).
- [ ] TalkBack on Android Chrome: "Ask about this moment", the time field, the caption, the three ways (radio buttons), Send; "Saved on this phone…" in flight mode and "Your saved question was sent." after.
- [ ] Keyboard only: Tab through the Package E section; Escape closes the question dialog (focus back on the button, video plays on if it was playing), the toggletip and a note being edited.
- [ ] **Blind co-designer** (screen reader on their own phone, over HTTPS): record a voice note in the question dialog: is "Start recording" / "Recording" / "Stop recording" / "Step 3: listen to your voice note" clear; is the size before Send useful; refuse the microphone once and use the phone's recorder through the file picker.
- [ ] **Deaf co-designer** (EthSL, own phone over HTTPS): ask a question in sign language from the question dialog; choose "Sign language" in the formats and check the signer is large enough; check "Ask about this moment" never needs sound.
- [ ] Studio, lesson page, "Learner questions": NVDA reads time and kind; "Load the voice note" / "Show the sign-language video" play the recording; "Answered" announces the count left and keeps focus in the list.
- [ ] Notes with NVDA: "Add a note at 1:23", the note buttons "Play from 1:23: …", "Delete note at 1:23" then Undo (focus on Undo, then on the restored note). Open the downloaded .txt.
- [ ] Quiz with NVDA: questions read as groups; after "Check answer" the feedback is read; with a time limit the 1-minute warning is announced once; "Add 5 minutes" and "Switch the timer off" work.
- [ ] Table at 400% zoom and on a phone: each row is a card "Length: 12:30"; NVDA in browse mode at 100% still reads it as a table with column headers; sorting announces "Sorted by …".
- [ ] Callouts with Windows High Contrast: the border and the word "Warning:" still show the type.
- [ ] Display settings → Reading font → Easy-read font: English text changes to Atkinson Hyperlegible, Amharic text stays in Noto Sans Ethiopic, code stays monospace, the player's button icons still show.
- [ ] Amharic reviewer: read every string in `player/i18n/components-e.am.json` in place (`ui-lang="am"`).
<!-- PACKAGE E END -->
