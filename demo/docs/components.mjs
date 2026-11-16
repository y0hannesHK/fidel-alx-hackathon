// The source of truth for the Fidel component docs at /demo/docs/.
//
// One entry per registered tag. After changing anything here, rebuild the
// HTML pages with:   node scripts/build-docs.mjs
//
// Every attribute and event below was checked against the component's source
// in player/src/ (the header comment and the getAttribute / emit calls).
// Text fields may use `backticks` for inline code. Live examples use test
// data only; players use /media/lesson.mp4 and /demo/media/*.vtt.
//
// Fields:
//   tag, name, summary (one line), helps (who it helps), group (see GROUPS),
//   source (file in player/src), attributes [[name, values, default, meaning]],
//   events [[name, detail, when]], methods [[name, meaning]] (optional),
//   example (copy-paste HTML), live (HTML for the live example, may hold a
//   host <script>), liveNote (optional), keyboard [..], languages,
//   wcag [[criterion, note]], related [tags], notes [..] (optional).

export const GROUPS = [
  { id: 'video', name: 'Video and lessons', am: 'ቪዲዮ እና ትምህርቶች', intro: 'The player, and the tags that work with it on a lesson page.' },
  { id: 'reading', name: 'Reading and understanding', am: 'ማንበብ እና መረዳት', intro: 'Code, diagrams, hard words, simpler text, quizzes and tables that everyone can read.' },
  { id: 'sign', name: 'Sign language and Deaf access', am: 'የምልክት ቋንቋ እና መስማት ለተሳናቸው ተደራሽነት', intro: 'Signs for tech words, answers in sign language, and sounds you can see.' },
  { id: 'offline', name: 'Offline and data', am: 'ከመስመር ውጭ እና ዳታ', intro: 'For cheap phones, expensive data and connections that come and go.' },
  { id: 'forms', name: 'Forms', am: 'ቅጾች', intro: 'Real labels and fields, errors in words, drafts, offline sending and Amharic typing.' },
  { id: 'career', name: 'Career: jobs, certificates and events', am: 'ሙያ፦ ሥራዎች፣ የምስክር ወረቀቶች እና ዝግጅቶች', intro: 'Job adverts, verified certificates and live sessions, with schema.org data.' },
  { id: 'nav', name: 'Navigation and help', am: 'አሰሳ እና እገዛ', intro: 'Skip links, big Previous and Next links, help in the same place, and no time-outs.' },
  { id: 'display', name: 'Display and language', am: 'ማሳያ እና ቋንቋ', intro: 'Text size and colours, a language switch for one section, and dates in both calendars.' },
];

const UI_LANG = ['ui-lang', '`en`, `am`', "the page's `lang`, else `en`", 'Language of the component\'s own buttons and messages.'];
const UI_LANG_TEXT = 'Its own buttons and messages are in English or Amharic. Set `ui-lang="am"` on the tag (or on a parent); without it, the page\'s `lang` is used, else English.';
const HEADING = (def, range = '`2` to `6`') => ['heading-level', range, `\`${def}\``, 'Level of the component\'s heading, so it fits your page\'s outline.'];
const FOR_PLAYER = ['for', 'id of a `<fidel-player>`', 'the first `<fidel-player>` on the page', 'The player this component works with.'];
const PLAYER_VIDEO = 'src="/media/lesson.mp4" src-webm="/media/lesson.webm" captions-en="/demo/media/en.vtt" chapters="/demo/media/chapters.vtt" lang="en"';

// Form fields share these (player/src/components/forms/base.js).
const FIELD_COMMON = [
  ['label', 'text', 'none (required)', 'The visible label. A placeholder is never used instead of it.'],
  ['name', 'text', 'none', 'Name of the answer when the form is sent.'],
  ['hint', 'text', 'none', 'Help text under the label, read with the field.'],
  ['required', 'boolean', 'off', '"(required)" is shown next to the label, and an empty field is an error.'],
  ['disabled', 'boolean', 'off', 'As on a native field.'],
  ['describedby', 'ids', 'none', 'Ids of your own descriptions, read before Fidel\'s.'],
  ['ui-lang', '`en`, `am`', 'the nearest `ui-lang`, else the page\'s `lang`', 'Language of Fidel\'s messages (errors, hints).'],
];
const FIELD_EVENTS = [
  ['fidel-field-change', '`{ value, name }`', 'The value changed.'],
  ['fidel-field-invalid', '`{ message, name }`', 'The field was checked and is wrong (the message is shown under it).'],
  ['fidel-field-valid', '`{ name }`', 'The field was checked and is right.'],
];
const FIELD_METHODS = [
  ['value', 'Property: the current value.'],
  ['validity', 'Property: `{ valid, message }`.'],
  ['checkValidity()', 'Checks the field, shows the error if there is one, and returns true or false.'],
  ['focus()', 'Puts focus in the field.'],
];
const FIELD_WCAG = [
  ['1.3.1 Info and Relationships', 'A real `<label for>`; hints and errors are tied to the field with `aria-describedby`; all in the light DOM.'],
  ['3.3.1 Error Identification', 'Errors are in words under the field, which gets `aria-invalid`. Checked when you leave the field and on submit, never on every key.'],
  ['3.3.2 Labels or Instructions', 'A visible label is required; hints say the expected form.'],
  ['3.3.3 Error Suggestion', 'Every message says how to fix the problem.'],
  ['2.5.8 Target Size (Minimum)', 'Fields and buttons are at least 44 px tall.'],
  ['4.1.3 Status Messages', 'Errors, "Fixed" and other messages are shown and also said through a polite live region.'],
];
const FORM_KEYBOARD = ['A native field: Tab to reach it, typing as usual. Nothing happens on every key press.', 'Screen readers hear the label, "required", the hint and any error with the field.'];

export const COMPONENTS = [
  // ---------------------------------------------------------------- video
  {
    tag: 'fidel-player', name: 'Lesson player', group: 'video', source: 'player/src/fidel-player.js',
    summary: 'The accessible lesson video player: captions in three languages, sign language, transcript, audio description and offline lessons.',
    helps: 'Deaf and hard-of-hearing learners (captions, sign language), blind and low-vision learners (screen-reader controls, audio description, transcript), keyboard users, and learners on cheap phones (low-data video, offline lessons).',
    attributes: [
      ['lesson', 'URL', 'none', 'A lesson on a Fidel server (`/api/v1/lessons/ID`). Fills in all the other attributes.'],
      ['src', 'URL', 'none', 'The video (MP4).'],
      ['src-webm', 'URL', 'none', 'The same video as WebM (optional).'],
      ['src-small', 'URL', 'none', 'A small video for "Use less data".'],
      ['poster', 'URL', 'none', 'Image shown before playing.'],
      ['captions-en, captions-am, captions-om', 'URL (WebVTT)', 'none', 'Captions in English, Amharic and Afaan Oromo.'],
      ['captions-am-status, captions-om-status', '`draft`, `reviewed`', 'none', '`draft` shows the notice that the captions are machine-made and not yet checked.'],
      ['chapters-en (or chapters), chapters-am', 'URL (WebVTT)', 'none', 'Chapter titles.'],
      ['descriptions-en (or descriptions), descriptions-am, descriptions-om', 'URL (WebVTT)', 'none', 'Audio description text, read by the browser or screen reader.'],
      ['description-recordings', 'JSON', 'none', 'Recorded descriptions, e.g. `{"am":[{"start":12.5,"url":"d1.opus"}]}`.'],
      ['sign', 'URL', 'none', 'Sign-language video (WebM or MP4), shown beside or over the video.'],
      ['offline-page, offline-page-video, offline-pack', 'URL', 'none', 'Offline downloads: one-page lesson (audio and text), the same with video, and a .zip pack.'],
      ['offline-page-size, offline-page-video-size, offline-pack-size', 'bytes', 'none', 'Sizes shown on the download buttons (filled in from the lesson).'],
      ['document-html-en, document-html-am, document-pdf-en, document-pdf-am, document-brf-en, document-brf-am', 'URL', 'none', 'The lesson document as a web page, tagged PDF and Braille (filled in from the lesson).'],
      ['lang', '`en`, `am`', '`en`', 'Default language of the player\'s interface. A learner\'s own choice in the player is remembered and wins.'],
    ],
    events: [
      ['fidel-ready', '`{ lang, captionLanguages, hasSignLanguage }`', 'The player is built.'],
      ['fidel-progress', '`{ seconds, percent }`', 'At most every 5 seconds of playback.'],
      ['fidel-ended', '`{ duration }`', 'The lesson was watched to the end.'],
      ['fidel-complete', '`{}`', 'Same moment as `fidel-ended`.'],
      ['fidel-captions-change', '`{ lang }` (`en`, `am`, `om` or `off`)', 'The learner chose a caption language.'],
      ['fidel-language-change', '`{ lang }`', 'The interface language changed.'],
      ['fidel-low-data-change', '`{ lowData }`', '"Use less data" was switched on or off.'],
      ['fidel-offline-saved', '`{ url }`', 'The lesson was saved for offline use.'],
      ['fidel-prefs', '`{ captionSize, captionColor, captionLanguage, signPosition, signSize, lowData, language }`', 'The learner changed a display choice.'],
      ['fidel-error', '`{ message }`', 'Something could not be loaded.'],
    ],
    example: `<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/y0hannesHK/fidel-alx-hackathon@v1.0.0-cdn/fidel.css">
<script src="https://cdn.jsdelivr.net/gh/y0hannesHK/fidel-alx-hackathon@v1.0.0-cdn/fidel.js" defer></script>

<fidel-player src="lesson.mp4" captions-en="en.vtt" captions-am="am.vtt"
              captions-am-status="draft" chapters="chapters.vtt" sign="sign.webm"
              lang="en"></fidel-player>`,
    live: `<fidel-player id="docs-player" src="/media/lesson.mp4" src-webm="/media/lesson.webm"
  captions-en="/demo/media/en.vtt" captions-am="/demo/media/am.vtt" captions-am-status="draft"
  chapters="/demo/media/chapters.vtt" chapters-am="/demo/media/chapters-am.vtt"
  sign="/media/sign.webm" lang="en"></fidel-player>`,
    keyboard: [
      'Every control is a real `<button>` with a name (Play, Back 10 seconds, Captions, Sign language, Transcript, Full screen).',
      'While the player has focus: K or Space plays and pauses; the Left and Right arrow keys move 5 seconds. The Keyboard help button lists the keys.',
      'Transcript lines are buttons ("Play from 1:33"); "Follow along" scrolling switches off when a keyboard user enters the transcript.',
      'Times are read as words ("1 minute 33 seconds"), not as numbers.',
    ],
    languages: 'Interface in English or Amharic (`lang`). Captions, chapters and audio descriptions in English, Amharic and Afaan Oromo.',
    wcag: [
      ['1.2.2 Captions (Prerecorded)', 'Captions in three languages; machine-made captions are marked as not yet checked.'],
      ['1.2.5 Audio Description (Prerecorded)', 'Audio description read by the browser or screen reader, or recordings made by staff.'],
      ['1.2.6 Sign Language (AAA)', 'Sign-language window beside the video, in three sizes; no dragging needed.'],
      ['2.1.1 Keyboard', 'Every control works with the keyboard.'],
      ['1.4.10 Reflow', 'No sideways scrolling at 320 px; the sign window moves under the video.'],
    ],
    related: ['fidel-lesson-formats', 'fidel-lesson-map', 'fidel-notes', 'fidel-caption-report', 'fidel-session-viewer'],
  },
  {
    tag: 'fidel-session-viewer', name: 'Recorded live session', group: 'video', source: 'player/src/session-viewer.js',
    summary: 'A recorded live class with captions and transcript, and its Zoom chat beside it.',
    helps: 'Deaf learners and screen-reader users who missed a live class, and anyone who wants to find a moment from the chat.',
    attributes: [
      ['(all `<fidel-player>` attributes)', '', '', 'Passed on to the player inside.'],
      ['chat', 'URL (Zoom chat .txt)', 'none', 'The chat log saved from Zoom.'],
      ['chat-offset', '`m:ss` or `h:mm:ss`', '`0:00`', 'Zoom chat times count from the meeting start. Give how much later the recording started, e.g. `19:05`; messages from before are dropped.'],
      ['anonymize', 'boolean', 'off', 'Shows Participant 1, 2… instead of names.'],
      HEADING(3),
      ['lang', '`en`, `am`', '`en`', 'Interface language.'],
    ],
    events: [['fidel-session-ready', '`{ messages }`', 'The chat is loaded; `messages` is the number of messages.']],
    example: `<fidel-session-viewer src="session.mp4" captions-en="session.vtt"
                      chat="zoom-chat.txt" chat-offset="19:05" anonymize
                      lang="en"></fidel-session-viewer>`,
    live: `<fidel-session-viewer id="docs-session" src="/media/session/session.mp4" src-webm="/media/session/session.webm"
  captions-en="/media/session/captions-en.vtt" chat="/media/session/chat.txt" chat-offset="19:05"
  anonymize heading-level="3" lang="en"></fidel-session-viewer>`,
    keyboard: [
      'Each chat message is a button: it plays the recording from that moment.',
      'While the recording plays normally, new chat messages can be read aloud (a polite live region, grouped). While you jump around, nothing is announced.',
      'All the player\'s keys work (see `<fidel-player>`).',
    ],
    languages: 'Interface in English or Amharic (`lang`). The chat is shown as written.',
    wcag: [
      ['1.2.2 Captions (Prerecorded)', 'The recording has the player\'s captions and transcript.'],
      ['1.4.10 Reflow', 'Video and chat side by side on wide screens, one column on phones and at 200 % zoom.'],
      ['4.1.3 Status Messages', 'New chat messages are announced politely, only during normal playback.'],
    ],
    related: ['fidel-player', 'fidel-event-card'],
  },
  {
    tag: 'fidel-lesson-formats', name: 'Choose how to take the lesson', group: 'video', source: 'player/src/components/e/lesson-formats.js',
    summary: 'Buttons for Watch, Listen, Read, Sign language and Simple words; only the formats the lesson has are offered, each with its download size.',
    helps: 'Blind learners and learners on expensive data (Listen downloads no video), Deaf learners (Sign language), learners who find reading hard (Simple words), and anyone who prefers to read.',
    attributes: [
      FOR_PLAYER,
      ['audio', 'URL', 'none', 'An audio-only file, if the player\'s lesson has none.'],
      HEADING(3, '`2` to `5`'),
      UI_LANG,
    ],
    events: [['fidel-lesson-format', '`{ format }` (`watch`, `listen`, `read`, `sign`, `simple`)', 'The learner chose a format.']],
    example: `<fidel-lesson-formats for="lesson-player"></fidel-lesson-formats>
<fidel-player id="lesson-player" lesson="https://YOUR-FIDEL-HOST/api/v1/lessons/LESSON_ID"></fidel-player>`,
    live: `<fidel-lesson-formats for="docs-formats-player" heading-level="3"></fidel-lesson-formats>
<fidel-player id="docs-formats-player" ${PLAYER_VIDEO.replace('lang="en"', 'sign="/media/sign.webm" lang="en"')}></fidel-player>`,
    liveNote: 'This example uses plain video files, so only Watch and Sign language are offered. A lesson from a Fidel server also offers Listen and Read.',
    keyboard: [
      'The formats are real buttons with `aria-pressed`, in a group with a heading.',
      'The choice is announced ("Listen mode: audio and transcript.") and remembered in this browser.',
    ],
    languages: UI_LANG_TEXT,
    wcag: [
      ['1.3.1 Info and Relationships', 'The format choice is a labelled group.'],
      ['4.1.2 Name, Role, Value', '`aria-pressed` on each format button.'],
      ['4.1.3 Status Messages', 'Format changes are announced.'],
    ],
    notes: ['In Listen and Read, the `<fidel-player>` is taken out of the page (a comment keeps its place), so no video is downloaded. It comes back for the other formats.'],
    related: ['fidel-player', 'fidel-simple-mode', 'fidel-data-saver'],
  },
  {
    tag: 'fidel-code-snapshots', name: 'Code in sync with the video', group: 'video', source: 'player/src/components/a/code-snapshots.js',
    summary: 'Lists code blocks in time order; while the video plays, the current one shows "Now" and is announced once.',
    helps: 'Blind learners following a coding video where the teacher types code on screen.',
    attributes: [['for', 'id of a `<fidel-player>`', 'the first `<fidel-player>`', 'The player to follow.'], UI_LANG],
    events: [['fidel-code-snapshots-change', '`{ index, seconds }`', 'Another snapshot became current.']],
    example: `<fidel-code-snapshots for="lesson-player">
  <fidel-code-block at="0:45" language="html" label="Step 1">
<pre><code>&lt;h1&gt;My first page&lt;/h1&gt;</code></pre>
  </fidel-code-block>
  <fidel-code-block at="1:23" language="html" label="Step 2">
<pre><code>&lt;h1&gt;My first page&lt;/h1&gt;
&lt;p&gt;Hello, world.&lt;/p&gt;</code></pre>
  </fidel-code-block>
</fidel-code-snapshots>`,
    live: `<fidel-player id="docs-snap-player" ${PLAYER_VIDEO}></fidel-player>
<fidel-code-snapshots for="docs-snap-player">
  <fidel-code-block at="0:10" language="html" label="Step 1: a heading">
<pre><code>&lt;h1&gt;My first page&lt;/h1&gt;</code></pre>
  </fidel-code-block>
  <fidel-code-block at="0:59" language="html" label="Step 2: a paragraph">
<pre><code>&lt;h1&gt;My first page&lt;/h1&gt;
&lt;p&gt;Hello, world.&lt;/p&gt;</code></pre>
  </fidel-code-block>
</fidel-code-snapshots>`,
    keyboard: [
      'Each snapshot is a `<fidel-code-block>` with its own Copy, Read line by line and "Play from" buttons.',
      'When the video reaches a snapshot, a screen reader hears "Code for 0:59 is ready" once; never while the learner seeks.',
    ],
    languages: UI_LANG_TEXT,
    wcag: [
      ['1.4.1 Use of Color', 'The current snapshot has a bar, a tint and the word "Now".'],
      ['4.1.2 Name, Role, Value', '`aria-current="time"` on the current snapshot.'],
      ['4.1.3 Status Messages', '"Code for 1:23 is ready", once per snapshot.'],
    ],
    related: ['fidel-code-block', 'fidel-player', 'fidel-lesson-map'],
  },
  {
    tag: 'fidel-lesson-map', name: 'Where am I, and jump anywhere', group: 'video', source: 'player/src/components/c/lesson-map.js',
    summary: 'A lesson navigation with jump links to the parts on the page, chapter buttons, and "You have watched 40%".',
    helps: 'Blind learners who move by headings and landmarks, and everyone in a long lesson.',
    attributes: [
      ['for', 'id of a `<fidel-player>`', 'the first player with an id', 'The lesson\'s player.'],
      ['chapters', 'URL (WebVTT)', 'the player\'s `chapters` / `chapters-am`', 'Chapters for the "Play from" buttons.'],
      ['notes-id', 'id', '`notes`', 'Id of the notes part.'],
      ['code-id', 'id', '`code`', 'Id of the code part.'],
      ['next-href, next-label', 'URL, text', 'from a `<fidel-step-nav>` on the page', 'The next lesson.'],
      UI_LANG,
    ],
    events: [['fidel-lesson-map-play', '`{ seconds }`', 'A chapter button was used.']],
    example: `<fidel-lesson-map for="lesson-player" chapters="chapters.vtt"></fidel-lesson-map>`,
    live: `<fidel-lesson-map for="docs-map-player" notes-id="docs-notes" code-id="docs-code"></fidel-lesson-map>
<fidel-player id="docs-map-player" ${PLAYER_VIDEO}></fidel-player>
<div id="docs-notes"><h3>Notes</h3><p>Test notes: the map links here because this part has the id it looks for.</p></div>
<div id="docs-code"><h3>Code</h3><pre><code>print("Hello, Fidel")</code></pre></div>`,
    keyboard: [
      'A `<nav aria-label="This lesson">` with real links and buttons.',
      'Links appear only for parts that exist on the page: Video, Transcript, Notes, Code, Next lesson.',
      'Progress is never announced by itself; "Where am I?" says it on request.',
    ],
    languages: UI_LANG_TEXT,
    wcag: [
      ['2.4.1 Bypass Blocks', 'Jump links to each part of the lesson.'],
      ['1.3.1 Info and Relationships', 'A real `<nav>`, `<ul>` and `<progress>`.'],
      ['4.1.3 Status Messages', 'The "Where am I?" answer goes through a polite live region.'],
    ],
    related: ['fidel-player', 'fidel-step-nav', 'fidel-progress', 'fidel-notes'],
  },
  {
    tag: 'fidel-progress', name: 'Lesson progress', group: 'video', source: 'player/src/components/e/small-tags.js',
    summary: 'A progress bar and "40% watched", from the player\'s progress events; "Say my progress" reads it out.',
    helps: 'Everyone who wants to know how far they are, without being interrupted by announcements.',
    attributes: [FOR_PLAYER, ['label', 'text', 'none', 'Name of the lesson, used in the text.'], UI_LANG],
    events: [],
    eventsNote: 'None. It listens to the player\'s `fidel-progress` and `fidel-complete`.',
    example: `<fidel-progress for="lesson-player" label="Lesson 3"></fidel-progress>`,
    live: `<fidel-player id="docs-progress-player" ${PLAYER_VIDEO}></fidel-player>
<fidel-progress for="docs-progress-player" label="Demo lesson"></fidel-progress>`,
    keyboard: ['A `<progress>` with text. Not announced by itself; the "Say my progress" button announces it.'],
    languages: UI_LANG_TEXT,
    wcag: [
      ['1.3.1 Info and Relationships', 'A real `<progress>` plus the same value in words.'],
      ['4.1.3 Status Messages', 'Announced only on request.'],
    ],
    related: ['fidel-mark-complete', 'fidel-player', 'fidel-lesson-map'],
  },
  {
    tag: 'fidel-mark-complete', name: 'Mark as complete', group: 'video', source: 'player/src/components/e/small-tags.js',
    summary: 'A "Mark as complete" toggle button, usable once the video reaches the end (or at any time with `manual`).',
    helps: 'Learners who track their own progress, and keyboard and screen-reader users (a real toggle button).',
    attributes: [
      ['lesson-id', 'text', 'none', 'Key under which the choice is remembered in this browser (`fidel-complete:<lesson-id>`).'],
      FOR_PLAYER,
      ['manual', 'boolean', 'off', 'Usable before the end of the video.'],
      UI_LANG,
    ],
    events: [['fidel-mark-complete', '`{ done }`', 'The learner marked or unmarked the lesson.']],
    example: `<fidel-mark-complete for="lesson-player" lesson-id="html-basics"></fidel-mark-complete>`,
    live: `<fidel-mark-complete lesson-id="docs-demo" manual></fidel-mark-complete>`,
    liveNote: 'This example has `manual`, so you can use it without watching a video.',
    keyboard: ['A real button with `aria-pressed`. Before the end it has `aria-disabled` and a hint, so it stays focusable.', '"Lesson marked complete." is announced.'],
    languages: UI_LANG_TEXT,
    wcag: [
      ['4.1.2 Name, Role, Value', '`aria-pressed`, and `aria-disabled` with a hint before the end.'],
      ['1.4.1 Use of Color', 'Pressed shows a tick and words.'],
    ],
    related: ['fidel-progress', 'fidel-player'],
  },
  {
    tag: 'fidel-notes', name: 'My notes, at a time in the video', group: 'video', source: 'player/src/components/e/notes.js',
    summary: 'Timestamped notes kept only in this browser: "Add a note at 1:23", play from a note, Edit, Delete with Undo, download as .txt.',
    helps: 'Learners who revise later, screen-reader users who cannot scrub a timeline, and learners who share a phone (notes stay on this device).',
    attributes: [
      FOR_PLAYER,
      ['lesson-id', 'text', 'none', 'Notes are kept per id (`fidel-notes:<lesson-id>` in localStorage).'],
      HEADING(3, '`2` to `5`'),
      ['title-text', 'text', 'none', 'First line of the downloaded .txt file.'],
      UI_LANG,
    ],
    events: [['fidel-notes-change', '`{ count }`', 'A note was added, changed or deleted (never the text of the notes).']],
    example: `<fidel-notes for="lesson-player" lesson-id="html-basics"></fidel-notes>`,
    live: `<fidel-player id="docs-notes-player" ${PLAYER_VIDEO}></fidel-player>
<fidel-notes for="docs-notes-player" lesson-id="docs-demo" heading-level="3"></fidel-notes>`,
    keyboard: [
      'Each note is a button "Play from 1:23: …", with Edit and Delete.',
      'Delete has Undo (no confirm dialog); focus moves to Undo, then back to the restored note.',
      'Escape closes the edit form.',
    ],
    languages: UI_LANG_TEXT,
    wcag: [
      ['2.4.3 Focus Order', 'Focus moves to the new note after Save, to Undo after Delete.'],
      ['3.3.1 Error Identification', 'A wrong time is explained in words ("Use minutes:seconds…").'],
      ['4.1.3 Status Messages', 'Note added, deleted and restored are announced.'],
    ],
    related: ['fidel-player', 'fidel-question', 'fidel-input'],
  },
  {
    tag: 'fidel-question', name: 'Ask about this moment', group: 'video', source: 'player/src/components/e/question.js',
    summary: 'A button under the player that opens a dialog to ask about the current moment in writing, by voice note or in sign language.',
    helps: 'Deaf learners (ask in sign language), blind learners and learners who find writing hard (a voice note), and shy learners: no name is needed.',
    attributes: [
      FOR_PLAYER,
      ['api', 'URL', 'none', 'The Fidel API (e.g. `/api/v1`). Without it, the page receives the question as an event.'],
      ['lesson', 'id', 'from the player\'s `lesson` URL', 'Lesson id for the server.'],
      UI_LANG,
    ],
    events: [
      ['fidel-question-ready', '`{ time, kind, text | blob, mimeType }`', 'Without `api`: the question for the page to handle.'],
      ['fidel-question-sent', '`{ lessonId, time, kind }`', 'With `api`: the question reached the server.'],
    ],
    example: `<fidel-player id="lesson-player" lesson="https://YOUR-FIDEL-HOST/api/v1/lessons/LESSON_ID"></fidel-player>
<fidel-question for="lesson-player" api="https://YOUR-FIDEL-HOST/api/v1"></fidel-question>`,
    live: `<fidel-player id="docs-question-player" ${PLAYER_VIDEO}></fidel-player>
<fidel-question for="docs-question-player"></fidel-question>
<p id="docs-question-host" aria-live="off"></p>
<script>
  document.addEventListener('fidel-question-ready', (e) => {
    document.getElementById('docs-question-host').textContent = 'The page received a ' + e.detail.kind + ' question. Nothing was uploaded.';
  });
</script>`,
    liveNote: 'This example has no `api`, so the question goes to the page and nothing is uploaded.',
    keyboard: [
      'The dialog holds the video time (an editable minutes:seconds field) and the caption shown then.',
      'Write, Voice note or Sign language are radio buttons, not tabs.',
      'The video pauses while the dialog is open. Escape or Cancel closes it and returns focus to the button.',
    ],
    languages: UI_LANG_TEXT,
    wcag: [
      ['2.1.1 Keyboard', 'Every control is native; Escape closes the dialog.'],
      ['3.3.1 Error Identification', 'Wrong time, an empty question and "Record your question first" are in words.'],
      ['4.1.3 Status Messages', 'Sent, saved offline and sent later are announced.'],
    ],
    notes: ['Offline: the question is kept on the phone (recordings up to about 2 MB) and sent when the phone is online again.'],
    related: ['fidel-voice-note', 'fidel-sign-answer', 'fidel-caption-report', 'fidel-player'],
  },
  {
    tag: 'fidel-caption-report', name: 'Report a caption problem', group: 'video', source: 'player/src/components/d/caption-report.js',
    summary: 'Learners tell staff when a caption is wrong; the report arrives in Fidel Studio on the lesson\'s page.',
    helps: 'Every learner, especially Deaf learners who notice a wrong Amharic caption.',
    attributes: [
      FOR_PLAYER,
      ['api', 'URL', 'from the player\'s `lesson` URL, else `/api/v1`', 'The Fidel API.'],
      ['lesson', 'id', 'from the player\'s `lesson` URL', 'The lesson id.'],
      UI_LANG,
    ],
    events: [['fidel-caption-report-sent', '`{ lessonId, time, lang }`', 'The report reached the server.']],
    example: `<fidel-player id="lesson-player" lesson="https://YOUR-FIDEL-HOST/api/v1/lessons/LESSON_ID"></fidel-player>
<fidel-caption-report for="lesson-player"></fidel-caption-report>`,
    live: `<div id="docs-report-slot"><p>Loading the lesson video…</p></div>
<fidel-caption-report for="docs-report-player"></fidel-caption-report>
<script>
  // Host page code: the newest published lesson on this server, so the
  // report can be sent; else the demo video.
  (async () => {
    const player = document.createElement('fidel-player');
    player.id = 'docs-report-player';
    player.setAttribute('lang', 'en');
    let id = null;
    try { id = (await (await fetch('/api/v1/lessons')).json())[0]?.id; } catch { id = null; }
    if (id) player.setAttribute('lesson', '/api/v1/lessons/' + id);
    else for (const [k, v] of Object.entries({ src: '/media/lesson.mp4', 'captions-en': '/demo/media/en.vtt', chapters: '/demo/media/chapters.vtt' })) player.setAttribute(k, v);
    document.getElementById('docs-report-slot').replaceWith(player);
  })();
</script>`,
    keyboard: [
      'The dialog already holds the current time, the caption language and the caption shown. "What is wrong?" is a group of radio buttons; a correction is optional.',
      'The video pauses while the dialog is open; Escape closes it and the video plays on.',
    ],
    languages: UI_LANG_TEXT,
    wcag: [
      ['1.2.2 Captions (Prerecorded)', 'Learners can report wrong or missing captions and missing sound descriptions.'],
      ['1.3.1 Info and Relationships', '"What is wrong?" is a `<fieldset>` with a `<legend>`.'],
      ['4.1.3 Status Messages', '"Thank you. A person will check it." and "Saved on this phone…" are announced.'],
    ],
    notes: ['No name, no account. Offline, the report is kept on the phone and sent when it is back online.'],
    related: ['fidel-player', 'fidel-question'],
  },

  // -------------------------------------------------------------- reading
  {
    tag: 'fidel-code-block', name: 'Code block', group: 'reading', source: 'player/src/components/a/code-block.js',
    summary: 'Code that a screen reader and a Braille display can read: Copy, Read line by line, Symbols as words, and "Play from 1:23".',
    helps: 'Blind learners and coders: speech mangles symbols and Python indentation, and a Braille display needs real text.',
    attributes: [
      ['label', 'text', '"*language* code"', 'Visible name of the code.'],
      ['language', 'text', 'none', 'Programming language, e.g. `python`, `html`.'],
      ['at', '`m:ss`', 'none', 'Time in the video: shows "From the video at 1:23" and a "Play from" button.'],
      ['for', 'id of a `<fidel-player>` or `<video>`', 'the first `<fidel-player>`', 'The video to play.'],
      ['symbols', '`off`', 'words', '`off` starts the line view with symbols shown as symbols.'],
      UI_LANG,
    ],
    events: [
      ['fidel-code-block-copy', '`{}`', 'The code was copied.'],
      ['fidel-code-block-play', '`{ seconds }`', '"Play from" was used.'],
    ],
    example: `<fidel-code-block language="python" label="Example: a loop">
<pre><code>for i in range(3):
    print(i)</code></pre>
</fidel-code-block>`,
    live: `<fidel-code-block language="python" label="Example: a loop (Python)">
<pre><code>for i in range(3):
    print(i)</code></pre>
</fidel-code-block>`,
    keyboard: [
      'Copy, Read line by line and Symbols as words are real buttons.',
      'In the line view, the Up and Down arrow keys move between lines (one Tab stop). Each line is read with its indent: "Line 2 of 3, indent 4 spaces: print open bracket i close bracket".',
      'Escape stops reading. Line numbers are hidden from screen readers.',
    ],
    languages: UI_LANG_TEXT + ' Code itself is marked `lang="en"`.',
    wcag: [
      ['1.1.1 Non-text Content', 'Code is real text, never an image.'],
      ['1.4.10 Reflow', 'Long code scrolls inside its own focusable box (an allowed exception).'],
      ['2.1.1 Keyboard', 'All buttons; arrow keys in the line view.'],
      ['4.1.3 Status Messages', '"Copied" is announced.'],
    ],
    related: ['fidel-code-snapshots', 'fidel-callout'],
  },
  {
    tag: 'fidel-described-image', name: 'Diagram with a full description', group: 'reading', source: 'player/src/components/a/described-image.js',
    summary: 'A `<figure>` with alt text, a caption and a "Full description" that opens under the image.',
    helps: 'Blind learners, and anyone who finds a diagram hard to read.',
    attributes: [
      ['src', 'URL', 'none (required)', 'The image.'],
      ['alt', 'text', 'none (required)', 'Short text alternative. Missing alt gives a console warning, never the file name.'],
      ['caption', 'text', 'the alt text', 'Visible caption.'],
      ['long-description-id', 'id', 'none', 'Id of an element (usually `hidden`) whose content is the full description.'],
      ['description', 'text', 'none', 'Or: the full description as plain text.'],
      ['width, height', 'pixels', 'none', 'Image size, so the page does not jump while it loads.'],
      ['show-warnings', 'boolean', 'off', 'Shows a visible "no alt text" warning (for authoring pages).'],
      UI_LANG,
    ],
    events: [],
    example: `<fidel-described-image src="request-flow.png" alt="How a web request travels"
                       long-description-id="flow-desc"></fidel-described-image>
<div id="flow-desc" hidden><p>The browser sends a request to the server…</p></div>`,
    live: `<fidel-described-image width="600" height="160"
  src="data:image/svg+xml;utf8,&lt;svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 160' font-family='sans-serif' font-size='22'&gt;&lt;rect width='600' height='160' fill='white'/&gt;&lt;g fill='%23eef3fa' stroke='%230b4f9c' stroke-width='3'&gt;&lt;rect x='10' y='45' width='150' height='70' rx='8'/&gt;&lt;rect x='225' y='45' width='150' height='70' rx='8'/&gt;&lt;rect x='440' y='45' width='150' height='70' rx='8'/&gt;&lt;/g&gt;&lt;g fill='%231a1a1a' text-anchor='middle'&gt;&lt;text x='85' y='87'&gt;Browser&lt;/text&gt;&lt;text x='300' y='87'&gt;Server&lt;/text&gt;&lt;text x='515' y='87'&gt;Database&lt;/text&gt;&lt;/g&gt;&lt;/svg&gt;"
  alt="Diagram: a browser, a server and a database in a row."
  caption="How a web request travels"
  long-description-id="docs-flow-desc"></fidel-described-image>
<div id="docs-flow-desc" hidden>
  <p>Three boxes in a row: Browser, Server, Database.</p>
  <ol>
    <li>The browser sends a request to the server.</li>
    <li>The server asks the database for the data it needs.</li>
    <li>The database sends the data back, and the server sends a web page to the browser.</li>
  </ol>
</div>`,
    keyboard: ['"Full description" is a native `<details>`: Enter or Space opens it.', 'The image is read by its alt text and caption; the description is real text with lists and headings.'],
    languages: UI_LANG_TEXT,
    wcag: [
      ['1.1.1 Non-text Content', 'Always has `alt` (empty plus a warning if the author forgot it) and a long description in real text.'],
      ['1.3.1 Info and Relationships', 'Real `<figure>`, `<figcaption>` and `<details>`.'],
    ],
    related: ['fidel-word', 'fidel-callout'],
  },
  {
    tag: 'fidel-word', name: 'Tap a hard word for its meaning', group: 'reading', source: 'player/src/components/a/word.js',
    summary: 'The word becomes a button that opens a small dialog with a plain English and an Amharic meaning.',
    helps: 'Learners who read with difficulty, and Deaf learners whose first language is sign language.',
    attributes: [
      ['term', 'text', 'the text inside', 'The word to explain.'],
      ['meaning-en, meaning-am', 'text', 'none', 'The meanings (works with no server).'],
      ['glossary', 'URL', 'none', 'Optional glossary in the `/api/v1/glossary` format, used only for missing meanings. That endpoint needs the staff token, so learner pages should use the attributes.'],
      UI_LANG,
    ],
    events: [['fidel-word-open', '`{ term }`', 'The dialog opened.']],
    example: `<p>We use <fidel-word term="server" meaning-en="A computer that stores websites."
   meaning-am="ድረ-ገጾችን የሚያስቀምጥ ኮምፒውተር።">server</fidel-word> software.</p>`,
    live: `<p>Your <fidel-word term="browser"
    meaning-en="The app you use to open websites, for example Chrome or Firefox."
    meaning-am="ድረ-ገጾችን ለመክፈት የሚጠቀሙበት መተግበሪያ፤ ለምሳሌ Chrome ወይም Firefox።">browser</fidel-word>
  asks a <fidel-word term="server"
    meaning-en="A computer that stores websites and sends them to other computers when they ask."
    meaning-am="ድረ-ገጾችን የሚያስቀምጥ እና ሌሎች ኮምፒውተሮች ሲጠይቁት የሚልክ ኮምፒውተር።">server</fidel-word> for the page.</p>`,
    keyboard: ['Tab to the dotted-underlined word, Enter or Space opens the dialog.', 'Escape (or Close) closes it and returns focus to the word.', 'Listen buttons appear only if the device has a voice for that language.'],
    languages: UI_LANG_TEXT + ' The Amharic meaning is marked `lang="am"`.',
    wcag: [
      ['3.1.3 Unusual Words (AAA)', 'Meanings for hard words, written by people.'],
      ['2.5.8 Target Size (Minimum)', 'The word sits inside a sentence, so it uses the exception for inline targets.'],
      ['3.1.2 Language of Parts', 'Amharic meanings have `lang="am"`.'],
    ],
    related: ['fidel-sign-term', 'fidel-toggletip', 'fidel-simple-mode'],
  },
  {
    tag: 'fidel-read-aloud', name: 'Listen to a paragraph', group: 'reading', source: 'player/src/components/a/read-aloud.js',
    summary: 'A Listen / Stop button for a paragraph; the sentence being read is highlighted and underlined.',
    helps: 'Learners who read with difficulty, and low-vision learners who do not use a screen reader.',
    attributes: [
      ['lang', 'language code', 'the content\'s `lang`, else the page\'s', 'Language of the text.'],
      ['audio', 'URL', 'none', 'A recording to play when the device has no voice for that language (loaded only on Listen).'],
      UI_LANG,
    ],
    events: [
      ['fidel-read-aloud-start', '`{ lang, voice }` (`computer` or `recorded`)', 'Reading started.'],
      ['fidel-read-aloud-stop', '`{}`', 'Reading stopped.'],
    ],
    example: `<fidel-read-aloud lang="en">
  <p>A web page is a document. Your browser asks a server for it.</p>
</fidel-read-aloud>`,
    live: `<fidel-read-aloud lang="en">
  <p>A web page is a document. Your browser asks a server for it. Then the browser shows it on your screen.</p>
</fidel-read-aloud>
<fidel-read-aloud lang="am">
  <p lang="am">ድረ-ገጽ ሰነድ ነው። አሳሽዎ ከአገልጋይ ይጠይቀዋል። ከዚያም አሳሹ በስክሪንዎ ላይ ያሳየዋል።</p>
</fidel-read-aloud>`,
    keyboard: ['Listen and Stop are real buttons; Escape stops.', 'Nothing speaks until the learner presses Listen. "Computer voice" says the voice is the device\'s.', 'With no voice and no recording, it says listening is not available instead of showing a button.'],
    languages: UI_LANG_TEXT,
    wcag: [
      ['2.2.2 Pause, Stop, Hide', 'Reading starts only on Listen; Stop and Escape stop it.'],
      ['1.4.1 Use of Color', 'The current sentence has a background and an underline.'],
    ],
    related: ['fidel-simple-mode', 'fidel-word'],
  },
  {
    tag: 'fidel-steps', name: 'Instructions one step at a time', group: 'reading', source: 'player/src/components/a/steps.js',
    summary: '"Step 2 of 5" with Previous, Next, "I did this step" and "Show all steps"; progress is remembered.',
    helps: 'Learners new to computers, and anyone overwhelmed by a wall of text.',
    attributes: [
      ['label', 'text', 'none', 'Title of the instructions; also the key under which progress is remembered.'],
      HEADING(3, '`2` to `5`'),
      UI_LANG,
    ],
    events: [['fidel-steps-change', '`{ step, total, done }`', 'The step or a tick changed.']],
    example: `<fidel-steps label="Install VS Code">
  <ol><li>Open the website…</li><li>Download…</li><li>Run the installer…</li></ol>
</fidel-steps>`,
    live: `<fidel-steps label="Install VS Code" heading-level="3">
  <ol>
    <li>Open the website code.visualstudio.com in your browser.</li>
    <li>Press the big Download button for your computer.</li>
    <li>Open the file you downloaded. It is usually in your Downloads folder.</li>
  </ol>
</fidel-steps>`,
    keyboard: ['Focus moves to the step\'s heading on Previous and Next, so a screen reader reads where you are.', '"I did this step" is a labelled checkbox. Without JavaScript the plain list shows.'],
    languages: UI_LANG_TEXT,
    wcag: [
      ['2.4.3 Focus Order', 'Focus moves to the step heading on each change.'],
      ['4.1.3 Status Messages', 'The number of steps done is announced.'],
    ],
    related: ['fidel-simple-mode', 'fidel-callout'],
  },
  {
    tag: 'fidel-simple-mode', name: 'A simpler version of the same text', group: 'reading', source: 'player/src/components/a/simple-mode.js',
    summary: 'A "Simple words" switch between the full text and a simpler, hand-written version.',
    helps: 'Learners who read with difficulty, and learners reading in a second language.',
    attributes: [UI_LANG],
    events: [['fidel-simple-mode-change', '`{ simple }`', 'The switch changed.']],
    example: `<fidel-simple-mode>
  <div data-version="full">…original lesson text…</div>
  <div data-version="simple">…short sentences, one idea each…</div>
</fidel-simple-mode>`,
    live: `<fidel-simple-mode>
  <div data-version="full"><p>When a user requests a web page, the browser transmits an HTTP request to the server, which processes it and returns an HTML document that the browser subsequently renders.</p></div>
  <div data-version="simple"><p>You ask for a web page. Your browser sends a message to a server. The server sends the page back. Your browser shows it.</p></div>
</fidel-simple-mode>`,
    keyboard: ['"Simple words" is a toggle button (`aria-pressed`); "Simple version shown" is announced.', 'The choice is remembered (shared preference `simpleWords`) and every copy on the page follows it.'],
    languages: UI_LANG_TEXT,
    wcag: [
      ['3.1.5 Reading Level (AAA)', 'A simpler version written by a person.'],
      ['4.1.2 Name, Role, Value', '`aria-pressed` on the switch.'],
    ],
    related: ['fidel-lesson-formats', 'fidel-word', 'fidel-read-aloud'],
  },
  {
    tag: 'fidel-callout', name: 'Callout: tip, warning, example or note', group: 'reading', source: 'player/src/components/e/callout.js',
    summary: 'A box with a real heading; the type is said in words ("Warning: …"), never by colour alone.',
    helps: 'Everyone, including colour-blind and screen-reader users: the type is in words, not only colour or an icon.',
    attributes: [
      ['type', '`tip`, `warning`, `example`, `note`', '`note`', 'The kind of box.'],
      ['heading', 'text', 'none', 'The heading text.'],
      HEADING(3),
      UI_LANG,
    ],
    events: [],
    example: `<fidel-callout type="warning" heading="Do not share your password">
  <p>Staff will never ask for it.</p>
</fidel-callout>`,
    live: `<fidel-callout type="tip" heading="Save often" heading-level="3"><p>Press Ctrl+S (or Cmd+S on a Mac) every few minutes.</p></fidel-callout>
<fidel-callout type="warning" heading="Do not share your password" heading-level="3"><p>Staff will never ask for it.</p></fidel-callout>`,
    keyboard: ['Nothing to operate. Screen readers hear the heading with its type ("Warning: Do not share your password"); the icon is hidden from them.'],
    languages: UI_LANG_TEXT,
    wcag: [
      ['1.3.1 Info and Relationships', 'A real heading.'],
      ['1.4.1 Use of Color', 'Type in words plus a border style and background per type.'],
    ],
    related: ['fidel-table', 'fidel-toggletip', 'fidel-code-block'],
  },
  {
    tag: 'fidel-table', name: 'Tables that fit a phone', group: 'reading', source: 'player/src/components/e/table.js',
    summary: 'Wraps a real `<table>`: adds header scopes, becomes "Header: value" cards when narrow, and can sort.',
    helps: 'Low-vision learners at 400 % zoom and phone users (no sideways scrolling); screen readers still get a real table.',
    attributes: [
      ['sortable', '`true`', 'off', 'Each column header becomes a sort button.'],
      ['show-warnings', 'boolean', 'off', 'A visible note for authors when the `<caption>` is missing.'],
      UI_LANG,
    ],
    events: [['fidel-table-sort', '`{ column, direction }`', 'The table was sorted.']],
    example: `<fidel-table sortable="true">
  <table>
    <caption>Lessons this week</caption>
    <thead><tr><th>Lesson</th><th>Length</th></tr></thead>
    <tbody><tr><th>HTML basics</th><td>12:30</td></tr></tbody>
  </table>
</fidel-table>`,
    live: `<fidel-table sortable="true">
  <table>
    <caption>Lessons this week</caption>
    <thead><tr><th>Lesson</th><th>Length</th><th>Download size</th></tr></thead>
    <tbody>
      <tr><th>HTML basics</th><td>12:30</td><td>18 MB</td></tr>
      <tr><th>CSS colours</th><td>8:05</td><td>11 MB</td></tr>
      <tr><th>Forms that work for everyone</th><td>15:40</td><td>23 MB</td></tr>
    </tbody>
  </table>
</fidel-table>`,
    keyboard: ['Sort buttons in the column headers; `aria-sort` says the order and "Sorted by Length, ascending." is announced.', 'Sort buttons stay reachable in the card layout.'],
    languages: UI_LANG_TEXT,
    wcag: [
      ['1.3.1 Info and Relationships', 'Keeps the `<table>`, adds `<th scope>` and explicit table roles. A missing `<caption>` is warned about, not fixed.'],
      ['1.4.10 Reflow', 'Narrow tables become cards (CSS container query) instead of scrolling sideways.'],
      ['4.1.2 Name, Role, Value', '`aria-sort` on the sorted column.'],
    ],
    related: ['fidel-callout', 'fidel-quiz'],
  },
  {
    tag: 'fidel-quiz', name: 'Quiz with a timer you control', group: 'reading', source: 'player/src/components/e/quiz.js',
    summary: 'Questions as fieldsets with real radio buttons or checkboxes, feedback in words, and an optional timer that can be extended or switched off.',
    helps: 'Learners who need more time, and screen-reader users (feedback in words, focus moves to it).',
    attributes: [
      ['questions', 'JSON', 'none', 'Questions as `[{"question","options","answer","explanation","ownWay"}]`; or use child markup.'],
      ['label', 'text', 'none', 'Title of the quiz.'],
      ['time-limit', 'seconds', 'none (no time limit)', 'Adds a timer with a warning 1 minute before the end, "Add 5 minutes" and "Switch the timer off".'],
      HEADING(3, '`2` to `5`'),
      UI_LANG,
    ],
    events: [
      ['fidel-quiz-done', '`{ score, total }`', 'Every question was answered.'],
      ['fidel-quiz-own-answer', '`{ question, kind, text | blob, mimeType }`', 'An "Answer in your own way" answer (not scored).'],
    ],
    example: `<fidel-quiz label="Check what you learned">
  <div data-question data-answer="1" data-explanation="&lt;h1&gt; is the main heading.">
    <p>Which tag is the main heading of a page?</p>
    <ul><li>&lt;p&gt;</li><li>&lt;h1&gt;</li><li>&lt;a&gt;</li></ul>
  </div>
</fidel-quiz>`,
    live: `<fidel-quiz label="Practice" heading-level="3">
  <div data-question data-answer="1" data-explanation="&lt;h1&gt; is the main heading of the page.">
    <p>Which tag is the main heading of a page?</p>
    <ul><li>&lt;p&gt;</li><li>&lt;h1&gt;</li><li>&lt;a&gt;</li></ul>
  </div>
  <div data-question data-answer="0,2" data-explanation="Captions and a transcript both give the words of the video as text.">
    <p>Which of these help a Deaf learner follow a video?</p>
    <ul><li>Captions</li><li>Louder sound</li><li>A transcript</li></ul>
  </div>
</fidel-quiz>`,
    keyboard: ['Each question is a `<fieldset>` with a `<legend>`; arrow keys move between radio buttons.', '"Check answer" shows "Correct." or "Not quite: the answer is …" next to the question and moves focus there.', 'The timer starts only when the learner enters the quiz.'],
    languages: UI_LANG_TEXT,
    wcag: [
      ['2.2.1 Timing Adjustable', 'No time limit unless `time-limit` is set; then a warning, "Add 5 minutes" and "Switch the timer off".'],
      ['1.3.1 Info and Relationships', 'Fieldsets with legends and native radio buttons and checkboxes.'],
      ['2.4.3 Focus Order', 'Focus moves to the feedback after "Check answer".'],
      ['4.1.3 Status Messages', 'Score and the timer warning are announced.'],
    ],
    notes: ['Child markup: `data-answer="1"` (from 0); `data-answer="0,2"` means "choose all that apply" (checkboxes). `data-own-way` adds "Answer in your own way": writing, voice note or sign language, sent to the page, not scored.'],
    related: ['fidel-choice', 'fidel-voice-note', 'fidel-sign-answer'],
  },
  {
    tag: 'fidel-toggletip', name: 'Toggletip: an info button', group: 'reading', source: 'player/src/components/e/small-tags.js',
    summary: 'An info button that shows a short explanation on click, tap, Enter or Space, never on hover only.',
    helps: 'Learners meeting a new word or idea, and keyboard and touch users who cannot hover.',
    attributes: [['label', 'text', 'none', 'The button text.'], UI_LANG],
    events: [],
    example: `<fidel-toggletip label="What is a transcript?">
  A transcript is everything said in the video, written down.
</fidel-toggletip>`,
    live: `<p>The transcript is under the video. <fidel-toggletip label="What is a transcript?">A transcript is everything said in the video, written down. You can read it, search it, or press a line to play the video from there.</fidel-toggletip></p>`,
    keyboard: ['A real button with `aria-expanded`. Enter or Space opens the explanation, which is read through a live region.', 'Escape or a click elsewhere closes it.'],
    languages: UI_LANG_TEXT,
    wcag: [
      ['1.4.13 Content on Hover or Focus', 'Opens only on activation, never on hover; dismissable with Escape.'],
      ['2.5.8 Target Size (Minimum)', 'The button is 44 px tall.'],
      ['4.1.2 Name, Role, Value', '`aria-expanded` on the button.'],
    ],
    related: ['fidel-word', 'fidel-callout'],
  },
  {
    tag: 'fidel-reading-guide', name: 'Reading guide', group: 'reading', source: 'player/src/components/d/reading-guide.js',
    summary: 'Outlines the paragraph you are in, can dim the rest, and moves block by block with Next line and Previous line.',
    helps: 'Low-vision learners at 200 to 400 % zoom, and learners with dyslexia or attention difficulties.',
    attributes: [['target', 'CSS selector', 'none', 'The text to guide through.'], UI_LANG],
    events: [],
    eventsNote: 'None.',
    example: `<fidel-reading-guide target="#lesson-text"></fidel-reading-guide>
<div id="lesson-text">…</div>`,
    live: `<fidel-reading-guide target="#docs-reading-text"></fidel-reading-guide>
<div id="docs-reading-text">
  <p>A web page is a text file that a browser turns into what you see. The text is written in HTML.</p>
  <p>HTML uses tags, such as a heading tag and a paragraph tag, to say what each part of the page is.</p>
  <p lang="am">ድረ-ገጽ አሳሹ ወደሚያዩት ገጽ የሚቀይረው የጽሑፍ ፋይል ነው።</p>
</div>`,
    keyboard: ['"Reading guide" turns it on and off. "Next line" and "Previous line" buttons move block by block and scroll it to the middle of the screen.', 'It follows the pointer, the text cursor and keyboard focus. Overlays only: it never changes your text or takes clicks.'],
    languages: UI_LANG_TEXT,
    wcag: [
      ['1.4.1 Use of Color', 'A thick outline, not colour alone; dimmed text stays above 4.5:1.'],
      ['2.1.1 Keyboard', 'Next and Previous line buttons for keyboard and switch users.'],
    ],
    related: ['fidel-display-prefs', 'fidel-read-aloud'],
  },

  // ----------------------------------------------------------------- sign
  {
    tag: 'fidel-sign-term', name: 'A tech word with its sign', group: 'sign', source: 'player/src/components/c/sign-term.js',
    summary: 'The word becomes a button that opens a dialog with a muted, looping sign-language clip and the meaning in English and Amharic.',
    helps: 'Deaf learners, for whom written English or Amharic is often a second language.',
    attributes: [
      ['term', 'text', 'the text inside', 'The word.'],
      ['sign', 'URL (WebM or MP4)', 'none', 'The sign-language clip (downloaded only when the dialog opens).'],
      ['poster', 'URL', 'none', 'A still picture of the sign.'],
      ['meaning-en, meaning-am', 'text', 'none', 'Plain-language meaning.'],
      ['sign-placeholder', 'boolean', 'off', 'The clip is a stand-in: the dialog says "Placeholder clip".'],
      ['glossary', 'URL', 'none', 'A glossary `{ terms: [{ en, sign, meaning_en, meaning_am }] }`; attributes win.'],
      UI_LANG,
    ],
    events: [['fidel-sign-term-open', '`{ term }`', 'The dialog opened.']],
    example: `<fidel-sign-term term="login" sign="/media/signs/login.webm" poster="/media/signs/login.jpg"
                 meaning-en="Entering your name and password to open your account."
                 meaning-am="ስምዎንና የይለፍ ቃልዎን አስገብተው መለያዎን መክፈት።">login</fidel-sign-term>`,
    live: `<p>To open your account, you
  <fidel-sign-term term="log in" sign="/media/sign.webm" sign-placeholder
    meaning-en="Entering your name and password to open your account."
    meaning-am="ስምዎንና የይለፍ ቃልዎን አስገብተው መለያዎን መክፈት።">log in</fidel-sign-term>.
  Your lessons are kept on a
  <fidel-sign-term term="server"
    meaning-en="A computer that stores websites and sends them to your phone."
    meaning-am="ድር ጣቢያዎችን አስቀምጦ ወደ ስልክዎ የሚልክ ኮምፒውተር።">server</fidel-sign-term>.</p>`,
    liveNote: 'The clip for "log in" is a test pattern, not a real sign. "server" shows what a learner sees when no sign is recorded yet.',
    keyboard: ['Enter or Space on the word opens the dialog; Play/Pause and Slower (0.5×) are buttons.', 'Escape closes the dialog and returns focus to the word.'],
    languages: UI_LANG_TEXT,
    wcag: [
      ['1.2.1 Audio-only and Video-only', 'The clip is video-only; its written meaning is the alternative.'],
      ['2.2.2 Pause, Stop, Hide', 'The looping clip has a Pause button and does not start by itself with reduced motion.'],
      ['3.1.3 Unusual Words (AAA)', 'A meaning and a sign for tech words.'],
    ],
    related: ['fidel-word', 'fidel-sign-answer'],
  },
  {
    tag: 'fidel-sign-answer', name: 'Answer in sign language', group: 'sign', source: 'player/src/components/d/sign-answer.js',
    summary: 'Record a short video answer with the camera, watch it back, then send it; or use the phone\'s camera app.',
    helps: 'Deaf learners whose first language is Ethiopian Sign Language, to reply, ask or explain without writing.',
    attributes: [
      ['label', 'text', 'none', 'The heading of the box.'],
      ['upload-url', 'URL', 'none', 'Where Send POSTs the video (multipart field `video`). Without it, the page gets the video as an event.'],
      ['max-seconds', 'seconds', '`120`', 'Longest recording.'],
      HEADING(3, '`2` to `5`'),
      UI_LANG,
    ],
    events: [['fidel-sign-answer-ready', '`{ blob, durationSeconds, mimeType }`', 'Without `upload-url`: the recording for the page.']],
    example: `<fidel-sign-answer label="Ask your question in sign language"
  upload-url="/your/api/answers" max-seconds="120"></fidel-sign-answer>`,
    live: `<fidel-sign-answer label="Ask your question in sign language" max-seconds="30" heading-level="3"></fidel-sign-answer>
<p id="docs-sign-host" aria-live="off"></p>
<script>
  document.addEventListener('fidel-sign-answer-ready', (e) => {
    document.getElementById('docs-sign-host').textContent = 'The page received a ' + e.detail.mimeType + ' video. Nothing was uploaded.';
  });
</script>`,
    liveNote: 'This example has no `upload-url`, so nothing is uploaded.',
    keyboard: ['Start camera (only then is the camera asked for), Record after a 3-2-1 countdown in text, Stop recording, watch it back (Slower 0.5×), Record again or Send.', 'Focus moves to each step\'s heading. With no camera, it says so and offers a video file instead.'],
    languages: UI_LANG_TEXT,
    wcag: [
      ['2.4.3 Focus Order', 'Focus moves to each step\'s heading.'],
      ['1.4.1 Use of Color', '"Camera on" and "Recording" are written in words.'],
    ],
    notes: ['The camera starts only when the learner presses a button, is shown while on, and goes off as soon as recording stops.'],
    related: ['fidel-question', 'fidel-voice-note', 'fidel-sign-term'],
  },
  {
    tag: 'fidel-visual-alert', name: 'Sounds you can see', group: 'sign', source: 'player/src/components/c/visual-alert.js',
    summary: 'Shows a banner (icon and text) for things other people would hear; optional vibration; never flashes.',
    helps: 'Deaf and hard-of-hearing learners, who miss sounds that tell other people something happened.',
    attributes: [UI_LANG],
    methods: [['notify(message)', 'Show a message.']],
    events: [
      ['fidel-visual-alert-shown', '`{ message }`', 'A banner appeared.'],
      ['fidel-visual-alert (listened for on `document`)', '`{ message }`', 'Any script or component can send this to raise an alert.'],
    ],
    example: `<fidel-visual-alert id="alerts"></fidel-visual-alert>
<script>
  document.getElementById('alerts').notify('Your lesson finished downloading');
</script>`,
    live: `<fidel-visual-alert id="docs-alerts"></fidel-visual-alert>
<p><button type="button" class="docs-host-button" id="docs-alert-test">Show a test alert</button></p>
<script>
  document.getElementById('docs-alert-test').addEventListener('click', () => {
    document.getElementById('docs-alerts').notify('Your lesson finished downloading');
  });
</script>`,
    keyboard: ['The banner stays until the learner presses Close alert, or closes after 15 seconds if the learner chose that in "Alert settings".', 'Screen readers hear it politely. Closing an alert moves focus to the next alert, or to the settings.'],
    languages: UI_LANG_TEXT,
    wcag: [
      ['2.2.1 Timing Adjustable', 'Alerts stay until closed by default.'],
      ['2.3.1 Three Flashes', 'Nothing flashes; alerts appear once without animation.'],
      ['4.1.3 Status Messages', 'Read politely by screen readers.'],
    ],
    notes: ['Put it near the top of the page, in the page flow (it is never fixed or sticky).'],
    related: ['fidel-offline-status', 'fidel-session-keeper'],
  },

  // -------------------------------------------------------------- offline
  {
    tag: 'fidel-data-saver', name: 'Data saver: know the size first', group: 'offline', source: 'player/src/components/b/data-saver.js',
    summary: 'Shows the size before anything downloads, with a choice of the full video or a smaller version.',
    helps: 'Learners who pay for every megabyte of data.',
    attributes: [
      ['href', 'URL', 'none', 'The big file. A video or audio file plays in place after "Load it"; any other file is a link.'],
      ['size', 'bytes', 'asked with `HEAD`, else "Size unknown"', 'Its size.'],
      ['alt-href, alt-size, alt-label', 'URL, bytes, text', 'none', 'The smaller version (a link), its size and what it is.'],
      ['captions, captions-lang, captions-label', 'URL (WebVTT), code, text', '`captions-lang`: `en`', 'Captions for the video.'],
      UI_LANG,
    ],
    events: [['fidel-data-saver-choice', '`{ choice }` (`full` or `light`)', 'The learner chose a version.']],
    example: `<fidel-data-saver href="/files/lessons/ID/video.mp4" size="45000000"
                  alt-href="/api/v1/lessons/ID/offline.html" alt-size="3100000"
                  alt-label="audio and text version"></fidel-data-saver>`,
    live: `<fidel-data-saver href="/media/lesson.mp4" captions="/demo/media/en.vtt"
  alt-href="/demo/media/en.vtt" alt-label="text-only version (the captions)"></fidel-data-saver>`,
    keyboard: ['"Load it" and the smaller version are a real button and a real link, each with its size.', 'If the phone asks to save data, the smaller version comes first and the component says why.'],
    languages: UI_LANG_TEXT,
    wcag: [['2.5.8 Target Size (Minimum)', 'Buttons and links at least 44 × 44 px.'], ['1.3.1 Info and Relationships', 'Real buttons and links.']],
    related: ['fidel-download-later', 'fidel-offline-status', 'fidel-lesson-formats'],
  },
  {
    tag: 'fidel-offline-status', name: 'Offline status', group: 'offline', source: 'player/src/components/b/offline-status.js',
    summary: 'One always-visible line, "Online." or "You are offline. 3 lessons are saved on this phone.", and a list of saved lessons.',
    helps: 'Learners whose connection comes and goes.',
    attributes: [UI_LANG],
    events: [['fidel-offline-status-change', '`{ online }`', 'The connection changed.']],
    example: `<fidel-offline-status></fidel-offline-status>`,
    live: `<fidel-offline-status></fidel-offline-status>`,
    keyboard: ['"Saved lessons" is a native `<details>` with links.', 'Screen readers hear the line only when the connection changes.'],
    languages: UI_LANG_TEXT,
    wcag: [['1.4.1 Use of Color', 'Online and offline are said in words.'], ['4.1.3 Status Messages', 'Announced only on change.']],
    notes: ['It counts the same cache as the player\'s "Save for offline" and `<fidel-download-later>`.'],
    related: ['fidel-download-later', 'fidel-data-saver', 'fidel-form'],
  },
  {
    tag: 'fidel-download-later', name: 'Download when I\'m online', group: 'offline', source: 'player/src/components/b/download-later.js',
    summary: 'The lesson waits in a queue and downloads into the offline cache as soon as the phone is online.',
    helps: 'Learners who are offline now, or on expensive mobile data.',
    attributes: [
      ['href', 'URL', 'none', 'What to download. One-page lessons (`/api/v1/lessons/ID/offline.html`) are saved so they open with no internet.'],
      ['label', 'text', 'none', 'Its name, shown and announced.'],
      ['size', 'bytes', 'none', 'Shown on the button.'],
      UI_LANG,
    ],
    events: [['fidel-download-ready', '`{ href, label }`', 'The download finished.']],
    example: `<fidel-download-later href="/api/v1/lessons/ID/offline.html" label="Lesson 3" size="3100000"></fidel-download-later>`,
    live: `<fidel-download-later href="/demo/media/chapters.vtt" label="Lesson 3 (demo file)" size="196"></fidel-download-later>`,
    keyboard: ['A real button; after queueing or cancelling, focus moves to the new button.', '"Lesson 3 is ready offline" is announced. "Only on Wi-Fi" is offered only where the browser can tell (Android Chrome).'],
    languages: UI_LANG_TEXT,
    wcag: [['2.4.3 Focus Order', 'Focus moves to the new button after a change.'], ['4.1.3 Status Messages', '"is ready offline" is announced.']],
    related: ['fidel-offline-status', 'fidel-data-saver'],
  },

  // ---------------------------------------------------------------- forms
  {
    tag: 'fidel-input', name: 'Text field', group: 'forms', source: 'player/src/components/forms/text-field.js',
    summary: 'A one-line text field with a real label, hints, errors in words, keyboard-language and Caps Lock hints, and Listen.',
    helps: 'Screen-reader and Braille users (every message is shown and said), people typing Amharic on an English keyboard, and learners who find typing hard.',
    attributes: [
      ...FIELD_COMMON,
      ['value, placeholder, autocomplete, inputmode, maxlength', '', '', 'As on a native field.'],
      ['readonly', 'boolean', 'off', 'As on a native field.'],
      ['type', '`text`, `search`, `email`, `tel`', '`text`', 'Field type.'],
      ['lang', 'language code', 'the page\'s', 'Language of what is typed (`am`, `en`, `om`…), set on the field itself.'],
      ['format', '`mmss`, `phone-et`, `email`', 'none', 'Built-in checks: a time like 1:23.5; an Ethiopian phone number (tidied to +2519… when you leave the field); an email address.'],
      ['pattern, error', 'regular expression, text', 'none', 'Your own rule and the words to show when it fails.'],
      ['keyboard-hint', '`off`', 'on', 'Switches off the keyboard-language hint.'],
      ['caps-warning', '`on`, `off`', 'on for Latin-script fields', 'The Caps Lock hint.'],
      ['listen', 'boolean', 'off', 'Adds a Listen button that reads the field in its language.'],
      ['voice-api', 'URL', 'none', 'e.g. `/api/v1`: the server\'s voice for Listen when the browser has none.'],
      ['speak', '`off`, `words`, `characters`', 'the learner\'s setting (off)', 'Typing voice for this field.'],
      ['field-class', 'class names', 'none', 'Your own classes on the inner `<input>`.'],
    ],
    events: [
      ['fidel-field-input', '`{ value, name }`', 'Every change while typing.'],
      ...FIELD_EVENTS,
      ['fidel-keyboard-hint', '`{ shown, expected }`', 'The keyboard-language hint appeared or went (`expected`: `am`, `ti` or `en`).'],
      ['fidel-caps-lock', '`{ on }`', 'Caps Lock changed.'],
    ],
    methods: FIELD_METHODS,
    example: `<fidel-input label="Phone number" name="phone" format="phone-et" required
             hint="For example 0911 234567"></fidel-input>`,
    live: `<fidel-input label="Phone number" name="phone" format="phone-et" required hint="For example 0911 234567"></fidel-input>
<fidel-input label="Your name in Amharic" name="nameAm" lang="am" autocomplete="name"></fidel-input>`,
    liveNote: 'Type 12345 in the phone field and press Tab: the error says how to fix it. In the Amharic field, type "selam" and a space on an English keyboard: a hint says how to switch the keyboard.',
    keyboard: [...FORM_KEYBOARD, 'Keyboard-language and Caps Lock hints are shown and said once, only when they change. Escape stops Listen.'],
    languages: 'Messages in English or Amharic (`ui-lang`). The content language (`lang`) is set on the field, so screen readers and spell checkers use it.',
    wcag: [...FIELD_WCAG, ['1.3.5 Identify Input Purpose', '`autocomplete` is passed through; `phone-et` and `email` set it unless you do.']],
    related: ['fidel-textarea', 'fidel-form', 'fidel-amharic-keyboard', 'fidel-error-summary'],
  },
  {
    tag: 'fidel-textarea', name: 'Long text field', group: 'forms', source: 'player/src/components/forms/text-field.js',
    summary: 'The same as `<fidel-input>`, for longer text.',
    helps: 'The same learners as `<fidel-input>`: screen-reader users, Amharic typists and learners who find typing hard.',
    attributes: [
      ...FIELD_COMMON,
      ['value, placeholder, maxlength', '', '', 'As on a native field.'],
      ['readonly', 'boolean', 'off', 'As on a native field.'],
      ['rows', 'number', '`4`', 'Visible lines.'],
      ['lang', 'language code', 'the page\'s', 'Language of what is typed, set on the field itself.'],
      ['pattern, error', 'regular expression, text', 'none', 'Your own rule and the words to show when it fails.'],
      ['keyboard-hint', '`off`', 'on', 'Switches off the keyboard-language hint.'],
      ['caps-warning', '`on`, `off`', 'on for Latin-script fields', 'The Caps Lock hint.'],
      ['listen', 'boolean', 'off', 'Adds a Listen button.'],
      ['voice-api', 'URL', 'none', 'The server\'s voice for Listen.'],
      ['speak', '`off`, `words`, `characters`', 'the learner\'s setting (off)', 'Typing voice for this field.'],
      ['field-class', 'class names', 'none', 'Your own classes on the inner `<textarea>`.'],
    ],
    events: [['fidel-field-input', '`{ value, name }`', 'Every change while typing.'], ...FIELD_EVENTS, ['fidel-keyboard-hint', '`{ shown, expected }`', 'The keyboard-language hint changed.'], ['fidel-caps-lock', '`{ on }`', 'Caps Lock changed.']],
    methods: FIELD_METHODS,
    example: `<fidel-textarea label="About you" name="about" lang="am" rows="5" listen></fidel-textarea>`,
    live: `<fidel-textarea label="About you" name="about" hint="Two or three sentences are enough." listen></fidel-textarea>`,
    keyboard: FORM_KEYBOARD,
    languages: 'Messages in English or Amharic (`ui-lang`). The content language (`lang`) is set on the field.',
    wcag: FIELD_WCAG,
    related: ['fidel-input', 'fidel-amharic-keyboard', 'fidel-form'],
  },
  {
    tag: 'fidel-choice', name: 'Radio buttons or checkboxes', group: 'forms', source: 'player/src/components/forms/choice.js',
    summary: 'A `<fieldset>` with a `<legend>` and real radio buttons or checkboxes, 44 px rows.',
    helps: 'Screen-reader users (a real group with a name) and learners with tremor (whole rows are targets).',
    attributes: [
      ...FIELD_COMMON,
      ['type', '`radio`, `checkbox`', '`radio`', 'One answer or several.'],
      ['options', 'JSON `[{"value","label","lang"}]`', 'none', 'The options; or child `<option>` elements.'],
      ['value', 'comma-separated', 'none', 'The chosen value(s).'],
    ],
    events: FIELD_EVENTS,
    methods: FIELD_METHODS,
    example: `<fidel-choice type="checkbox" label="Support I need" name="support">
  <option value="sign-language">Sign language interpreter</option>
  <option value="extra-time">Extra time</option>
</fidel-choice>`,
    live: `<fidel-choice type="radio" label="How should we contact you?" name="contact" required
  options='[{"value":"sms","label":"Text message"},{"value":"call","label":"Phone call"},{"value":"email","label":"Email"}]'></fidel-choice>`,
    keyboard: ['Native radio buttons (arrow keys) or checkboxes (Space). "Choose one option." or "Choose at least one option." when required.'],
    languages: 'Messages in English or Amharic (`ui-lang`); each option can have its own `lang`.',
    wcag: FIELD_WCAG,
    related: ['fidel-select', 'fidel-form', 'fidel-quiz'],
  },
  {
    tag: 'fidel-select', name: 'Select with search', group: 'forms', source: 'player/src/components/forms/select.js',
    summary: 'A native `<select>`, optionally with a real "Search the list" box that says how many options match.',
    helps: 'Screen-reader and keyboard users (a native select), and anyone choosing from a long list.',
    attributes: [
      ...FIELD_COMMON,
      ['options', 'JSON `[{"value","label","lang"}]`', 'none', 'The options; or child `<option>` / `<optgroup>` elements.'],
      ['search', 'boolean', 'off', 'Adds "Search the list" above the select.'],
      ['placeholder', 'boolean or text', 'none', 'Adds an empty first option, "Choose…" or your own text.'],
    ],
    events: FIELD_EVENTS,
    methods: FIELD_METHODS,
    example: `<fidel-select label="Language you prefer" name="language" search>
  <option value="am" lang="am">አማርኛ</option>
  <option value="om">Afaan Oromoo</option>
  <option value="en">English</option>
</fidel-select>`,
    live: `<fidel-select label="Language you prefer" name="language" placeholder search
  options='[{"value":"am","label":"አማርኛ","lang":"am"},{"value":"om","label":"Afaan Oromoo","lang":"om"},{"value":"ti","label":"ትግርኛ","lang":"ti"},{"value":"so","label":"Soomaali","lang":"so"},{"value":"en","label":"English"}]'></fidel-select>`,
    keyboard: ['The browser\'s own select. The search box keeps the matching options and the number that match is announced.'],
    languages: 'Messages in English or Amharic (`ui-lang`); each option can have its own `lang`.',
    wcag: FIELD_WCAG,
    related: ['fidel-choice', 'fidel-form'],
  },
  {
    tag: 'fidel-file', name: 'File field', group: 'forms', source: 'player/src/components/forms/file.js',
    summary: 'A native file field: types and size limit in words, the chosen file\'s name and size, and Remove.',
    helps: 'Screen-reader users (the chosen file is said), and everyone who would otherwise find out too late that a file is too big.',
    attributes: [
      ...FIELD_COMMON,
      ['accept', 'file types', 'any', 'Accepted types, e.g. `.pdf,.doc` or `video/*`.'],
      ['max-size', 'e.g. `5MB`', 'none', 'Largest file. The hint says "Video, up to 50 MB".'],
    ],
    events: [['fidel-field-change', '`{ file, name }`', 'A file was chosen or removed.'], ...FIELD_EVENTS.slice(1)],
    methods: FIELD_METHODS,
    example: `<fidel-file label="CV" name="cv" accept=".pdf,.doc,.docx" max-size="5MB"></fidel-file>`,
    live: `<fidel-file label="CV" name="cv" accept=".pdf,.doc,.docx" max-size="5MB"></fidel-file>`,
    keyboard: ['The browser\'s own file button. A wrong type or a file too big is refused in words; "Remove" clears the choice.'],
    languages: 'Messages in English or Amharic (`ui-lang`).',
    wcag: FIELD_WCAG,
    related: ['fidel-form', 'fidel-voice-note'],
  },
  {
    tag: 'fidel-date', name: 'Date field', group: 'forms', source: 'player/src/components/forms/date.js',
    summary: 'A native date field with the same date in the Ethiopian calendar under it, read with the field.',
    helps: 'Every Ethiopian learner and employer, who think in the Ethiopian calendar.',
    attributes: [
      ...FIELD_COMMON,
      ['value, min, max', '`YYYY-MM-DD`', 'none', 'The date and the allowed range.'],
    ],
    events: FIELD_EVENTS,
    methods: FIELD_METHODS,
    example: `<fidel-date label="Date you can start" name="startDate"></fidel-date>`,
    live: `<fidel-date label="Date you can start" name="start" value="2026-11-15"></fidel-date>`,
    keyboard: ['The browser\'s own date field. The Ethiopian date under it is always in words.'],
    languages: 'Messages in English or Amharic (`ui-lang`).',
    wcag: [...FIELD_WCAG, ['Native date picker', 'Partially supports: its look and Amharic support vary between browsers and phones.']],
    related: ['fidel-ethiopian-date', 'fidel-form'],
  },
  {
    tag: 'fidel-error-summary', name: 'Error summary', group: 'forms', source: 'player/src/components/forms/error-summary.js',
    summary: 'On submit, "2 fields need fixing" with a link to each field; focus moves to it and nothing typed is lost.',
    helps: 'Screen-reader and keyboard users, who would otherwise have to hunt for each error.',
    attributes: [
      ['for', 'id of a `<form>`', 'none', 'The form to check.'],
      HEADING(2),
      UI_LANG,
    ],
    events: [],
    eventsNote: 'None. The fields send their own events.',
    example: `<fidel-error-summary for="job-form"></fidel-error-summary>
<form id="job-form">
  <fidel-input label="Full name" name="fullName" required></fidel-input>
  <button type="submit">Send</button>
</form>`,
    live: `<fidel-error-summary for="docs-summary-form" heading-level="3"></fidel-error-summary>
<form id="docs-summary-form" action="#">
  <fidel-input label="Full name" name="fullName" autocomplete="name" required></fidel-input>
  <fidel-input label="Email" name="email" format="email" required></fidel-input>
  <p><button type="submit" class="docs-host-button">Send</button></p>
</form>`,
    liveNote: 'Press Send with nothing filled in.',
    keyboard: ['Focus moves to the summary\'s heading; each link puts you in its field. As each field is fixed, its link goes away.', 'It turns off the browser\'s own pop-up checks (`novalidate`), so every message is in words.'],
    languages: UI_LANG_TEXT,
    wcag: [
      ['3.3.1 Error Identification', 'Every wrong field listed with a link.'],
      ['2.4.3 Focus Order', 'Focus moves to the summary on a failed submit.'],
    ],
    notes: ['`<fidel-form>` adds one by itself.'],
    related: ['fidel-form', 'fidel-input'],
  },
  {
    tag: 'fidel-form', name: 'Form with drafts and offline sending', group: 'forms', source: 'player/src/components/forms/form.js',
    summary: 'Wraps your `<form>`: saves a draft as you type, sends later when offline, never sends twice, and adds the error summary.',
    helps: 'Anyone whose session times out or whose connection drops, and screen-reader users (every message is shown and said).',
    attributes: [
      ['api, action', 'URL', 'none', 'Address to POST the answers to as JSON (multipart with a file). Without it, the page gets `fidel-form-submit`.'],
      ['sensitive', 'comma-separated names', 'none', 'Fields NEVER stored on the device. Files and passwords are never stored either.'],
      ['draft', '`off`', 'on', 'No draft.'],
      ['draft-key', 'text', 'the element\'s id', 'Storage name (`fidel-form-draft:<key>`, `fidel-form-outbox:<key>`).'],
      ['ui-lang', '`en`, `am`', 'the page\'s `lang`', 'Messages of the form and every field inside.'],
    ],
    events: [
      ['fidel-form-submit', '`{ data, queued }`', 'Without `api`: the answers for the page. Call `preventDefault()` to show your own message.'],
      ['fidel-form-sent', '`{ data, status }`', 'With `api`: sent.'],
      ['fidel-form-queued', '`{ data }`', 'Kept for later (offline).'],
      ['fidel-form-draft-saved', '`{}`', 'Draft saved.'],
      ['fidel-form-draft-restored', '`{ data }`', 'Draft put back after a reload.'],
    ],
    example: `<fidel-form id="apply" sensitive="support">
  <form>
    <fidel-input label="Full name" name="fullName" required></fidel-input>
    <fidel-date label="Date you can start" name="startDate"></fidel-date>
    <button type="submit">Send</button>
  </form>
</fidel-form>`,
    live: `<fidel-form id="docs-form" draft="off">
  <form>
    <fidel-input label="Full name" name="fullName" autocomplete="name" required></fidel-input>
    <fidel-input label="Phone number" name="phone" format="phone-et" hint="For example 0911 234567"></fidel-input>
    <p><button type="submit" class="docs-host-button">Send</button></p>
  </form>
</fidel-form>
<p id="docs-form-host" aria-live="off"></p>
<script>
  document.addEventListener('fidel-form-submit', (e) => {
    document.getElementById('docs-form-host').textContent = 'The page received the answers. Nothing was uploaded.';
  });
</script>`,
    liveNote: 'This example has no `api` and no draft, so nothing is sent or stored.',
    keyboard: ['A second press while sending does nothing. "Draft saved", "Sent. Thank you." and "Saved on this phone. It will be sent when you are online." are shown and said.'],
    languages: 'Messages in English or Amharic (`ui-lang`), passed to every field inside.',
    wcag: [
      ['2.2.1 Timing Adjustable', 'A draft is put back after a reload or a session time-out.'],
      ['3.3.7 Redundant Entry', 'Answers are kept after a failed or offline send. Sensitive fields are not kept, by design.'],
      ['4.1.3 Status Messages', 'Draft saved, sent and saved offline are announced.'],
    ],
    related: ['fidel-error-summary', 'fidel-input', 'fidel-session-keeper'],
  },
  {
    tag: 'fidel-amharic-keyboard', name: 'Amharic keyboard', group: 'forms', source: 'player/src/components/d/amharic-keyboard.js',
    summary: 'Type Amharic with no Amharic keyboard installed: choose the consonant, then its form.',
    helps: 'Refugees and learners on shared or borrowed computers with no Amharic keyboard, and anyone who cannot remember the key combinations.',
    attributes: [
      ['for', 'id of an `<input>`, `<textarea>`, `<fidel-input>` or `<fidel-textarea>`', 'none', 'The field to type into.'],
      UI_LANG,
    ],
    events: [],
    eventsNote: 'None. The field\'s own `input` event fires, so your listeners and validation see each letter.',
    example: `<label for="answer">Your answer</label>
<textarea id="answer" lang="am"></textarea>
<fidel-amharic-keyboard for="answer"></fidel-amharic-keyboard>`,
    live: `<label for="docs-answer">Your answer in Amharic</label>
<textarea id="docs-answer" lang="am" rows="3" class="docs-host-field"></textarea>
<fidel-amharic-keyboard for="docs-answer"></fidel-amharic-keyboard>`,
    keyboard: ['"Show Amharic keyboard" opens it. The letters are one Tab stop: arrow keys, Home and End move between them; Enter or Space chooses.', 'Choose ለ, then ሉ: the letter goes in at the cursor. Escape in step 2 goes back. "Delete one letter" and "Back to the text" are buttons.', 'Each consonant button is also named in Latin letters, e.g. "ለ, le".'],
    languages: UI_LANG_TEXT + ' The letters are marked `lang="am"`.',
    wcag: [
      ['2.1.1 Keyboard', 'One Tab stop, arrow keys, Home and End, Enter or Space, Escape.'],
      ['3.1.2 Language of Parts', 'Ethiopic letters carry `lang="am"`; each name adds a Latin reading.'],
      ['1.4.10 Reflow', 'The letter grid wraps at 320 px.'],
    ],
    related: ['fidel-input', 'fidel-textarea'],
  },
  {
    tag: 'fidel-voice-note', name: 'Voice note', group: 'forms', source: 'player/src/components/e/voice-note.js',
    summary: 'Record a short voice message, play it back, then send it; no speech-to-text.',
    helps: 'Learners who speak more easily than they write, and blind learners. The recording is never turned into text by a cloud service.',
    attributes: [
      ['label', 'text', 'none', 'The heading of the box.'],
      ['max-seconds', 'seconds', '`120`', 'Longest recording.'],
      ['upload-url', 'URL', 'none', 'Where Send POSTs the recording (multipart field `audio`). Without it, the page gets an event.'],
      ['no-send', 'boolean', 'off', 'Hides Send (a parent such as `<fidel-question>` sends it).'],
      HEADING(3, '`2` to `5`'),
      UI_LANG,
    ],
    events: [
      ['fidel-voice-note-ready', '`{ blob, mimeType, durationSeconds }`', 'Without `upload-url`: the recording for the page.'],
      ['fidel-voice-note-recorded', '`{ mimeType, durationSeconds, size }`', 'A recording was made.'],
    ],
    example: `<fidel-voice-note label="Leave a voice message for your mentor" upload-url="/your/api/voice"></fidel-voice-note>`,
    live: `<fidel-voice-note label="Leave a voice message for your mentor" max-seconds="60" heading-level="3"></fidel-voice-note>`,
    liveNote: 'This example has no `upload-url`, so nothing is uploaded.',
    keyboard: ['The microphone is asked for only after "Start recording". A "Recording" banner with the time and Stop; then play back, Record again, and the size before Send.', 'No microphone or permission refused: the reason in words and a file picker for the phone\'s own recorder.'],
    languages: UI_LANG_TEXT,
    wcag: [
      ['3.3.2 Labels or Instructions', 'Says that nothing is recorded or sent until the learner chooses.'],
      ['2.4.3 Focus Order', 'Focus moves to each step\'s heading.'],
    ],
    related: ['fidel-question', 'fidel-sign-answer', 'fidel-quiz'],
  },

  // --------------------------------------------------------------- career
  {
    tag: 'fidel-job-card', name: 'Job card', group: 'career', source: 'player/src/job-card.js',
    summary: 'A job advert from a Fidel server: employer, place, closing date in both calendars, accommodations, and a summary to read or listen to.',
    helps: 'Disabled job seekers (workplace accommodations in words), learners who find reading hard (Listen), and search engines (schema.org JobPosting).',
    attributes: [
      ['job', 'URL', 'none', 'A job on a Fidel server (`/api/v1/jobs/ID`).'],
      ['lang', '`en`, `am`', "the page's `lang`, else `en`", 'Interface language.'],
      HEADING(3),
    ],
    events: [
      ['fidel-job-ready', '`{ id, title }`', 'The job is shown.'],
      ['fidel-summary-play', '`{ lang }`', 'The learner played the summary.'],
    ],
    example: `<fidel-job-card job="https://YOUR-FIDEL-HOST/api/v1/jobs/JOB_ID" lang="en"></fidel-job-card>`,
    live: `<div id="docs-job-slot"><p>Looking for a job on this server…</p></div>
<script>
  // Host page code: show the first job on this Fidel server, if there is one.
  fetch('/api/v1/jobs').then((r) => r.json()).then((jobs) => {
    const slot = document.getElementById('docs-job-slot');
    if (!jobs.length) { slot.innerHTML = '<p>There are no jobs on this server yet. Staff add them in Fidel Studio.</p>'; return; }
    const card = document.createElement('fidel-job-card');
    card.setAttribute('job', jobs[0].url);
    card.setAttribute('heading-level', '3');
    slot.replaceWith(card);
  }).catch(() => { document.getElementById('docs-job-slot').innerHTML = '<p>The job list could not be loaded.</p>'; });
</script>`,
    keyboard: ['"Listen to summary" is a button; Stop stops it.', 'English uses a recording or the browser\'s voice; Amharic needs a recording, so there is no Amharic button without one.'],
    languages: 'Interface in English or Amharic (`lang`). The closing date is in both calendars, e.g. 30 Nov 2026 / ህዳር 21 2019.',
    wcag: [['1.3.1 Info and Relationships', 'A heading and a description list.'], ['1.4.10 Reflow', 'No sideways scrolling at 320 px.']],
    notes: ['It also puts the job as schema.org/JobPosting JSON-LD on the page.'],
    related: ['fidel-certificate', 'fidel-event-card', 'fidel-ethiopian-date'],
  },
  {
    tag: 'fidel-certificate', name: 'Verified certificate', group: 'career', source: 'player/src/certificate-card.js',
    summary: 'A certificate card that always asks the Fidel server: "✓ Verified certificate", revoked, or not found.',
    helps: 'Learners showing their certificate to employers, and employers checking it.',
    attributes: [
      ['certificate', 'URL', 'none', 'A certificate on a Fidel server (`/api/v1/certificates/ID`).'],
      ['lang', '`en`, `am`', "the page's `lang`, else `en`", 'Interface language.'],
      HEADING(3),
    ],
    events: [['fidel-certificate-ready', '`{ status }` (`valid`, `revoked`, `missing`)', 'The check finished.']],
    example: `<fidel-certificate certificate="https://YOUR-FIDEL-HOST/api/v1/certificates/CERT_ID"></fidel-certificate>`,
    live: `<fidel-certificate certificate="/api/v1/certificates/docs-example-not-issued" heading-level="3"></fidel-certificate>`,
    liveNote: 'This example asks for a certificate that was never issued, so it shows the "not found" state.',
    keyboard: ['A link to the official check page (`/verify/ID`). The status is in words and a symbol, not colour alone.'],
    languages: 'Interface in English or Amharic (`lang`). The date is in both calendars.',
    wcag: [['1.4.1 Use of Color', 'Verified, revoked and not found are in words.'], ['2.4.4 Link Purpose', '"Check this certificate on its official page".']],
    related: ['fidel-job-card', 'fidel-ethiopian-date'],
  },
  {
    tag: 'fidel-event-card', name: 'Live session card', group: 'career', source: 'player/src/components/d/event-card.js',
    summary: 'A live session with its access support in words, "Request access support", "Add to calendar" and, later, the recording.',
    helps: 'Deaf, hard-of-hearing and blind learners deciding whether they can follow a live class, and asking for the support they need.',
    attributes: [
      ['title', 'text', 'none', 'The session\'s name.'],
      ['start, end', 'ISO 8601 with a time zone', 'none', 'When it is.'],
      ['join-url', 'URL', 'none', 'The live link; shown from 15 minutes before the start until the end.'],
      ['captions', '`yes`, `no`', 'none', 'Live captions.'],
      ['sign-language', '`yes`, `no`, `on-request`', 'none', 'Ethiopian Sign Language interpreter.'],
      ['languages', 'comma-separated codes', 'none', 'Spoken languages, e.g. `en,am`.'],
      ['recording-url', 'URL', 'none', 'After the end: "Watch the recording".'],
      ['request-url', 'URL', 'none', 'Where access requests are POSTed as JSON `{eventId, needs, other?}`.'],
      ['reply-by', '`email`', 'none', 'The card says "The organisers will reply by email".'],
      ['event-id', 'text', 'none', 'Id used in events and the .ics file.'],
      HEADING(3),
      UI_LANG,
    ],
    events: [['fidel-event-request', '`{ eventId, needs, other? }`', 'The learner asked for access support.']],
    example: `<fidel-event-card title="Office hours: how to present"
  start="2026-11-20T19:00:00+03:00" end="2026-11-20T20:30:00+03:00"
  join-url="https://meet.example.org/office-hours" captions="yes"
  sign-language="on-request" languages="en,am" event-id="ev1"></fidel-event-card>`,
    live: `<fidel-event-card title="Office hours: how to present" event-id="docs-office-hours"
  start="2026-12-04T19:00:00+03:00" end="2026-12-04T20:30:00+03:00"
  join-url="https://meet.example.org/office-hours" captions="yes" sign-language="on-request"
  languages="en,am" heading-level="3"></fidel-event-card>`,
    keyboard: ['"Request access support" asks only which support is needed, never why.', '"Add to calendar" downloads an .ics file made in the browser.'],
    languages: UI_LANG_TEXT + ' Date and time are in both calendars.',
    wcag: [['1.3.1 Info and Relationships', 'A heading and a description list; access needs are a labelled group.'], ['2.5.8 Target Size (Minimum)', 'Buttons at least 44 × 44 px.']],
    notes: ['It also puts a schema.org `Event` in JSON-LD on the page.'],
    related: ['fidel-session-viewer', 'fidel-ethiopian-date', 'fidel-job-card'],
  },

  // ------------------------------------------------------------------ nav
  {
    tag: 'fidel-skip-link', name: 'Skip link', group: 'nav', source: 'player/src/components/e/small-tags.js',
    summary: 'A "Skip to the lesson" link, hidden until it has keyboard focus, that moves focus to the lesson.',
    helps: 'Keyboard, switch and screen-reader users, who would otherwise Tab through the whole header first.',
    attributes: [
      ['target', 'CSS selector', '`#main`', 'Where focus goes (`tabindex="-1"` is added when needed).'],
      ['label', 'text', '"Skip to the lesson"', 'The link text.'],
      UI_LANG,
    ],
    events: [],
    example: `<body>
  <fidel-skip-link target="#lesson"></fidel-skip-link>
  …
  <div id="lesson">…</div>`,
    live: `<p><fidel-skip-link target="#docs-skip-target" label="Skip to the example lesson"></fidel-skip-link></p>
<div id="docs-skip-target"><p>The example lesson starts here.</p></div>`,
    liveNote: 'Press Tab into this example: the link appears when it has focus.',
    keyboard: ['Hidden until focused. Enter moves focus to the target.'],
    languages: UI_LANG_TEXT,
    wcag: [['2.4.1 Bypass Blocks', 'The first Tab stop, if you put it first in `<body>`.']],
    related: ['fidel-lesson-map', 'fidel-step-nav'],
  },
  {
    tag: 'fidel-step-nav', name: 'Big Previous and Next links', group: 'nav', source: 'player/src/components/c/step-nav.js',
    summary: 'Previous and Next links at the end of a lesson, with "Lesson 3 of 8", at least 48 px tall.',
    helps: 'Learners with tremor, one hand or a switch, who need large targets that say where they go.',
    attributes: [
      ['prev-href, prev-label', 'URL, text', 'none', 'The previous lesson (no href, no link).'],
      ['next-href, next-label', 'URL, text', 'none', 'The next lesson.'],
      ['position, total', 'numbers', 'none', '"Lesson 3 of 8".'],
      ['label', 'text', '"Lesson"', 'Name of the `<nav>` landmark.'],
      UI_LANG,
    ],
    events: [['fidel-step-nav-go', '`{ direction }` (`previous` or `next`)', 'A link was used.']],
    example: `<fidel-step-nav prev-href="lesson-2.html" prev-label="Lesson 2: Forms"
                next-href="lesson-4.html" next-label="Lesson 4: Tables"
                position="3" total="8"></fidel-step-nav>`,
    live: `<fidel-step-nav prev-href="/demo/blank.html" prev-label="Lesson 2: The player on a blank page"
  next-href="/demo/savanna-mock/" next-label="Lesson 4: A lesson inside Savanna"
  position="3" total="8" label="Example lessons"></fidel-step-nav>`,
    keyboard: ['Real links inside a `<nav>`; each says the lesson it opens. In the page flow, never sticky.'],
    languages: UI_LANG_TEXT,
    wcag: [['2.5.8 Target Size (Minimum)', 'At least 48 px tall and full width on phones.'], ['2.4.4 Link Purpose', 'Each link names its lesson.'], ['2.4.11 Focus Not Obscured', 'Never fixed or sticky.']],
    related: ['fidel-lesson-map', 'fidel-skip-link'],
  },
  {
    tag: 'fidel-help', name: 'Help in the same place', group: 'nav', source: 'player/src/components/c/help.js',
    summary: 'A "Get help" button that lists the help routes you give, text first: chat, email, an interpreter video call, phone.',
    helps: 'Everyone; text comes first, so Deaf learners are never sent to a phone line.',
    attributes: [
      ['chat-url, email, video-call-url, phone', 'URL, address, URL, number', 'none', 'The routes (at least one; none = nothing shown).'],
      ['hours', 'text', 'none', 'Working hours, shown in the dialog.'],
      UI_LANG,
    ],
    events: [
      ['fidel-help-open', '`{}`', 'The dialog opened.'],
      ['fidel-help-choose', '`{ route }` (`chat`, `email`, `video`, `phone`)', 'A route was chosen.'],
    ],
    example: `<fidel-help chat-url="https://t.me/example_help" email="help@example.org"
            video-call-url="https://meet.example.org/interpreter" phone="+251 11 000 0000"
            hours="Monday to Friday, 8:30 to 17:00"></fidel-help>`,
    live: `<fidel-help chat-url="https://t.me/example_help" email="help@example.org"
  video-call-url="https://meet.example.org/interpreter" phone="+251 11 000 0000"
  hours="Monday to Friday, 8:30 to 17:00"></fidel-help>`,
    keyboard: ['"Get help" opens a dialog of real links. Escape closes it and returns focus to the button.'],
    languages: UI_LANG_TEXT,
    wcag: [['3.2.6 Consistent Help', 'Supports when you put it in the same place on every page.']],
    related: ['fidel-visual-alert', 'fidel-session-keeper'],
  },
  {
    tag: 'fidel-session-keeper', name: 'Never lose work to a time-out', group: 'nav', source: 'player/src/components/c/session-keeper.js',
    summary: 'Before your time-out, a dialog asks "Do you need more time?" with "Yes, more time" focused.',
    helps: 'Everyone who types slowly or uses assistive technology, so a form never times out on them.',
    attributes: [
      ['timeout', 'seconds', '`1800`', 'Length of your session.'],
      ['warn-before', 'seconds', '`120` (at least 20)', 'When the warning opens.'],
      ['extend-url', 'URL', 'none', 'POSTed to (same-origin cookies) when the learner asks for more time.'],
      ['max-extend', 'number', '`20` (never below 10)', 'How many extensions.'],
      ['off', 'boolean', 'off', 'No time limit on this page.'],
      ['manual', 'boolean', 'off', 'The timer starts only when you call `start()`.'],
      UI_LANG,
    ],
    methods: [['start()', '(Re)starts the timer, e.g. when your own session is renewed.'], ['stop()', 'Stops it.']],
    events: [
      ['fidel-session-warning', '`{}`', 'The dialog opened.'],
      ['fidel-session-extend', '`{ count }`', 'Extend your session now.'],
      ['fidel-session-decline', '`{}`', 'The learner pressed "No".'],
      ['fidel-session-timeout', '`{}`', 'Time ran out.'],
      ['fidel-session-no-timeout', '`{ never }`', 'The learner\'s "Never time me out" choice.'],
    ],
    example: `<fidel-session-keeper timeout="1800" warn-before="120"
                      extend-url="/api/v1/session/extend"></fidel-session-keeper>`,
    live: `<fidel-session-keeper id="docs-session-keeper" timeout="40" warn-before="30" manual></fidel-session-keeper>
<p><button type="button" class="docs-host-button" id="docs-session-start">Start a 40-second test session</button></p>
<script>
  document.getElementById('docs-session-start').addEventListener('click', () => {
    document.getElementById('docs-session-keeper').start();
  });
</script>`,
    liveNote: 'After 10 seconds the dialog asks "Do you need more time?".',
    keyboard: ['The dialog focuses "Yes, more time"; the learner has at least 20 seconds and can extend at least 10 times.', '"Never time me out" is a checkbox; your page receives the choice as an event and decides what to do.'],
    languages: UI_LANG_TEXT,
    wcag: [['2.2.1 Timing Adjustable', 'Warns at least 20 s before, allows at least 10 extensions, offers "Never time me out". Your page must still extend its own session on `fidel-session-extend`.']],
    related: ['fidel-form', 'fidel-help'],
  },

  // -------------------------------------------------------------- display
  {
    tag: 'fidel-display-prefs', name: 'Display settings', group: 'display', source: 'player/src/components/b/display-prefs.js',
    summary: 'A "Display settings" dialog: text size, line spacing, colours, stop motion, thicker focus and an easy-read font.',
    helps: 'Low-vision learners, learners with dyslexia, and people sensitive to motion.',
    attributes: [['target', 'CSS selector', 'none', 'The content to adjust. Settings are `fidel-dp-*` classes on those elements and on Fidel components; never on `<html>` or `<body>`.'], UI_LANG],
    events: [['fidel-display-prefs-change', 'the settings', 'A setting changed.']],
    example: `<fidel-display-prefs target="#lesson"></fidel-display-prefs>`,
    live: `<fidel-display-prefs target="#docs-prefs-lesson"></fidel-display-prefs>
<div id="docs-prefs-lesson" class="docs-sample">
  <p>A web page is a document that a browser shows. Headings help screen-reader users jump to the part they need.</p>
  <p lang="am">ድረ-ገጽ አሳሽ የሚያሳየው ሰነድ ነው።</p>
</div>`,
    keyboard: ['Escape closes the dialog and focus goes back to "Display settings". Settings apply at once and are remembered.'],
    languages: UI_LANG_TEXT,
    wcag: [
      ['1.4.4 Resize Text', 'Text 100, 125, 150 or 200 % (text sized in `em` or `%`).'],
      ['1.4.12 Text Spacing', '"Wide" spacing; no letter-spacing, for Ethiopic.'],
      ['2.2.2 Pause, Stop, Hide', '"Stop motion" stops CSS animation and looping videos in the target.'],
    ],
    notes: ['It is not an overlay: it does not try to repair the host page, only changes how accessible content is shown.'],
    related: ['fidel-reading-guide', 'fidel-lang'],
  },
  {
    tag: 'fidel-lang', name: 'Language for one section', group: 'display', source: 'player/src/components/b/section-lang.js',
    summary: 'Switch language for one section, not the whole page; each button is written in its own language.',
    helps: 'Learners who mix Amharic and English, and Afaan Oromo, Tigrinya, Somali and Arabic readers.',
    attributes: [['label', 'text', 'none', 'Name of the section.'], UI_LANG],
    events: [['fidel-lang-change', '`{ lang }`', 'Another language was chosen.']],
    example: `<fidel-lang label="Lesson summary">
  <div lang="en">…</div>
  <div lang="am">…</div>
</fidel-lang>`,
    live: `<fidel-lang label="Lesson summary">
  <div lang="en"><p>In this lesson you build one simple web page and check it with a screen reader.</p></div>
  <div lang="am"><p>በዚህ ትምህርት አንድ ቀላል ድረ-ገጽ ትሠራላችሁ፤ ከዚያም በስክሪን አንባቢ ትፈትሹታላችሁ።</p></div>
  <div lang="om"><p>Barnoota kana keessatti fuula weebii salphaa tokko ijaarta.</p></div>
</fidel-lang>`,
    keyboard: ['One real button per version; the current one has `aria-current="true"`. "Showing Amharic" is announced.', 'The choice is remembered. Arabic gets `dir="rtl"`.'],
    languages: 'Content in English, Amharic, Afaan Oromo, Tigrinya, Somali or Arabic; its own buttons follow `ui-lang`.',
    wcag: [['3.1.2 Language of Parts', 'Each button and each version has its own `lang`.'], ['1.3.2 Meaningful Sequence', 'Arabic gets `dir="rtl"`.']],
    related: ['fidel-display-prefs', 'fidel-ethiopian-date'],
  },
  {
    tag: 'fidel-ethiopian-date', name: 'Ethiopian date', group: 'display', source: 'player/src/components/b/ethiopian-date.js',
    summary: 'A date in both calendars inside a real `<time>`.',
    helps: 'Every Ethiopian learner and employer.',
    attributes: [
      ['datetime', '`YYYY-MM-DD`', 'none', 'The date.'],
      ['format', '`short`, `long`', '`short`', '`short`: 15 Nov 2026 / ህዳር 6 2019. `long`: with the weekday.'],
      ['ui-lang', '`en`, `am`', "the page's `lang`", '`en`: Gregorian first. `am`: Ethiopian first.'],
    ],
    events: [],
    example: `<fidel-ethiopian-date datetime="2026-11-15"></fidel-ethiopian-date>`,
    live: `<ul>
  <li>Applications close on <fidel-ethiopian-date datetime="2026-11-15"></fidel-ethiopian-date>.</li>
  <li>Amharic order: <fidel-ethiopian-date datetime="2026-11-15" ui-lang="am"></fidel-ethiopian-date></li>
  <li>Long format: <fidel-ethiopian-date datetime="2026-11-15" format="long"></fidel-ethiopian-date></li>
</ul>`,
    keyboard: ['Nothing to operate. Each calendar is read in its own language.'],
    languages: 'Both calendars, each with its own `lang`. `ui-lang` decides which comes first.',
    wcag: [['3.1.2 Language of Parts', 'Each calendar has its own `lang`.'], ['1.3.1 Info and Relationships', 'A real `<time datetime>`.']],
    related: ['fidel-date', 'fidel-event-card', 'fidel-job-card'],
  },
];
