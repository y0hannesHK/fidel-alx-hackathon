// Package D (see assets/AGENT_TASK_fidel_package_D.md): defines this
// package's tags. Only finished tags are registered here, each guarded:
//   if (!customElements.get('fidel-example')) customElements.define('fidel-example', FidelExample);
import './components.css';
import { FidelCaptionReport } from './caption-report.js';
import { FidelAmharicKeyboard } from './amharic-keyboard.js';

const TAGS = {
  'fidel-caption-report': FidelCaptionReport, // D2: learners report a caption problem
  'fidel-amharic-keyboard': FidelAmharicKeyboard, // D4: type Amharic without an Amharic keyboard
};

for (const [name, element] of Object.entries(TAGS)) {
  if (!customElements.get(name)) customElements.define(name, element);
}
