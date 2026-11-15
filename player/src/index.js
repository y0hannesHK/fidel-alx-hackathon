// Entry point of the fidel.js bundle.
// Loads the CSS (Able Player's first, then ours so ours can override it),
// registers the Ethiopic font, and defines <fidel-player>, <fidel-job-card>
// <fidel-session-viewer> and <fidel-certificate>.
import 'ableplayer/build/ableplayer.min.css';
import './fidel.css';
import { registerEthiopicFont } from './fonts.js';
import { FidelPlayer } from './fidel-player.js';
import { FidelJobCard } from './job-card.js';
import { FidelSessionViewer } from './session-viewer.js';
import { FidelCertificate } from './certificate-card.js';
import { VERSION } from './events.js';
// Component library (assets/AGENT_TASK_fidel_components.md): one line per package.
import './components/a/register.js'; // Package A: reading and understanding
import './components/b/register.js'; // Package B: data, offline, dates and language
import './components/c/register.js'; // Package C: Deaf learners, motor access, navigation, help
import './components/d/register.js'; // Package D: Amharic keyboard, sign answers, live events, caption reports
import './components/forms/register.js'; // Forms: text fields, form, choices, select, file, date
import './components/e/register.js'; // Package E: lesson formats, questions, notes, quiz, callouts, tables

// window.Fidel.version tells a page which Fidel it has loaded.
export { VERSION as version };

// document.currentScript is only set while this script first runs.
registerEthiopicFont(document.currentScript?.src);

if (!customElements.get('fidel-player')) {
  customElements.define('fidel-player', FidelPlayer);
}
if (!customElements.get('fidel-job-card')) {
  customElements.define('fidel-job-card', FidelJobCard);
}
if (!customElements.get('fidel-session-viewer')) {
  customElements.define('fidel-session-viewer', FidelSessionViewer);
}
if (!customElements.get('fidel-certificate')) {
  customElements.define('fidel-certificate', FidelCertificate);
}
