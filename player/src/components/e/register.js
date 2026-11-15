// Package E (see assets/AGENT_TASK_fidel_package_E.md): defines this
// package's tags. Only finished tags are registered here, each guarded, so
// loading Fidel twice is safe.
import './components.css';
import { FidelLessonFormats } from './lesson-formats.js';
import { FidelVoiceNote } from './voice-note.js';
import { FidelQuestion } from './question.js';
import { FidelCallout } from './callout.js';
import { FidelTable } from './table.js';
import { FidelNotes } from './notes.js';
import { FidelQuiz } from './quiz.js';
import { FidelMarkComplete, FidelProgress, FidelSkipLink, FidelToggletip } from './small-tags.js';

const TAGS = {
  'fidel-lesson-formats': FidelLessonFormats, // E1: watch, listen, read, sign language or simple words
  'fidel-voice-note': FidelVoiceNote, // E2: record a voice message (no speech-to-text)
  'fidel-question': FidelQuestion, // E2: ask about this moment in writing, voice or sign language
  'fidel-callout': FidelCallout, // E3: tip, warning, example or note box
  'fidel-table': FidelTable, // E4: tables that become cards when narrow; sortable
  'fidel-notes': FidelNotes, // E5: timestamped notes kept on this device
  'fidel-quiz': FidelQuiz, // E6: quiz with feedback in words, optional timer that can be extended or switched off
  'fidel-progress': FidelProgress, // E7: "40% watched"
  'fidel-mark-complete': FidelMarkComplete, // E7: "Mark as complete"
  'fidel-skip-link': FidelSkipLink, // E7: "Skip to the lesson"
  'fidel-toggletip': FidelToggletip, // E7: an info button with a short explanation
};

for (const [name, element] of Object.entries(TAGS)) {
  if (!customElements.get(name)) customElements.define(name, element);
}
