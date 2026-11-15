// Fidel form components (see assets/AGENT_TASK_fidel_forms.md): defines the
// tags. Fields first, then the summary and <fidel-form>, so a form finds its
// fields already built. Each define is guarded, so loading Fidel twice is safe.
import './components.css';
import { FidelInput, FidelTextarea } from './text-field.js';
import { FidelChoice } from './choice.js';
import { FidelSelect } from './select.js';
import { FidelFile } from './file.js';
import { FidelDate } from './date.js';
import { FidelErrorSummary } from './error-summary.js';
import { FidelForm } from './form.js';

const TAGS = {
  'fidel-input': FidelInput, // one-line text field: label, hint, errors in words, keyboard and Caps Lock hints, Listen
  'fidel-textarea': FidelTextarea, // the same for longer text
  'fidel-choice': FidelChoice, // radio buttons or checkboxes in a fieldset with a legend
  'fidel-select': FidelSelect, // a native select, optionally with "Search the list"
  'fidel-file': FidelFile, // a native file field: types and size in words, Remove
  'fidel-date': FidelDate, // a native date field with the Ethiopian calendar date under it
  'fidel-error-summary': FidelErrorSummary, // "2 fields need fixing" with links, on submit
  'fidel-form': FidelForm, // drafts, offline sending, no double submission
};

for (const [name, element] of Object.entries(TAGS)) {
  if (!customElements.get(name)) customElements.define(name, element);
}
