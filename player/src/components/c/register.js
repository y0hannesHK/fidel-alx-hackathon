// Package C (see assets/AGENT_TASK_fidel_components.md): defines this
// package's tags. Only tags that are finished are registered here, each
// guarded so a page that loads Fidel twice does not fail.
import './components.css';
import { FidelSignTerm } from './sign-term.js';
import { FidelVisualAlert } from './visual-alert.js';
import { FidelStepNav } from './step-nav.js';
import { FidelSessionKeeper } from './session-keeper.js';
import { FidelLessonMap } from './lesson-map.js';
import { FidelHelp } from './help.js';

const TAGS = {
  'fidel-sign-term': FidelSignTerm,
  'fidel-visual-alert': FidelVisualAlert,
  'fidel-step-nav': FidelStepNav,
  'fidel-session-keeper': FidelSessionKeeper,
  'fidel-lesson-map': FidelLessonMap,
  'fidel-help': FidelHelp,
};
for (const [tag, element] of Object.entries(TAGS)) {
  if (!customElements.get(tag)) customElements.define(tag, element);
}
