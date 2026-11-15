# Manual testing checklists

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
- [ ] With an authorized, same-duration EthSL recording: play/pause, seek in both directions, change speed, wait for buffering, then play to the end; the signer stays aligned and stops at completion.
- [ ] Seek while paused; the signer jumps to the same point and stays paused until the lesson resumes.
- [ ] Remove or block a caption file and a video file in turn; an accessible error is shown instead of a silent empty player.

## Experimental BSL avatar (Kozha, English captions only)

For a local integration smoke test, run `.\scripts\make-qa-video.ps1` and open
`http://localhost:8000/demo/savanna-mock/?source=qa`. This fixture combines
CC0 flower footage with locally generated English narration and matching
captions; it is synthetic test content, not the Digital Bridge lesson, and
does not validate sign meaning.

For an owner-provided English video, run
`.\scripts\make-captioned-video.ps1 'C:\path\to\your-video.mp4'` and open
`http://localhost:8000/demo/savanna-mock/?source=original`. Whisper captions
are drafts and must be checked against the audio before use.

Use only a matching, authorized video and English WebVTT track. Do not use the
silent flower sample by itself or pair these captions with unrelated footage.
The output is experimental BSL, not EthSL, and is not a human-verified
interpretation. Non-commercial use only.

- [ ] Confirm the self-hosted Kozha service is healthy at `http://localhost:8001/api/chat2hamnosys/health`, and that its local config, avatar archives, XSLT, and shaders load from port 8001.
- [ ] Select **Show sign language**; wait for the avatar-ready status (not just the iframe or canvas), and verify the visible warning identifies the configured service and experimental status.
- [ ] Confirm CWASA configuration, avatar, and SiGML assets load from the self-hosted service, not `kozha-translate.com`.
- [ ] Play a captioned lesson; the active English cue drives the BSL plan. Amharic captions remain unchanged and are not sent to Kozha.
- [ ] Pause, resume, seek across cue boundaries, change speed, buffer, and end the lesson; verify event handling and note that avatar animation speed/timing is approximate.
- [ ] Check that API or avatar failures are announced, and that missing English captions do not fall back to Amharic.
- [ ] Have a fluent BSL interpreter review signs, gloss choices, omissions, and cue alignment before presenting the output as an interpretation.

## Co-designer session (from the 10 November training)

- Ask them to show how they normally do the task first. Then watch; do not help; take notes; do not defend the design.
- Speak to the Deaf co-designer, not the interpreter; one person talks at a time; share new words ("caption", "transcript", "offline") with the interpreter beforehand.
- Ask consent before using their name, photo, voice or words in the pitch.
- Test, fix, test again: **at least twice before the pitch**.

## Results

| Date | Tester (with consent) | Setup | Task step | Result | Problem found | Fixed? |
|---|---|---|---|---|---|---|
| | | | | | | |
