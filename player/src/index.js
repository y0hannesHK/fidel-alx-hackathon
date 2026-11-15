// Entry point of the fidel.js bundle.
// Loads the CSS (Able Player's first, then ours so ours can override it),
// registers the Ethiopic font, and defines <fidel-player>, <fidel-job-card>
// <fidel-session-viewer> and <fidel-certificate>.
//
// The component library (Packages A–E, form fields: <fidel-quiz>,
// <fidel-input>, ...) is in a second file, fidel-components.js, loaded below
// only when the page uses one of those tags. So hosts still add one <script>,
// and a page with only a player downloads about a third less.
import 'ableplayer/build/ableplayer.min.css';
import './fidel.css';
import { registerEthiopicFont } from './fonts.js';
import { FidelPlayer } from './fidel-player.js';
import { FidelJobCard } from './job-card.js';
import { FidelSessionViewer } from './session-viewer.js';
import { FidelCertificate } from './certificate-card.js';
import { VERSION } from './events.js';
import { needsComponents, componentFileUrls } from './component-loader.js';

// window.Fidel.version tells a page which Fidel it has loaded.
export { VERSION as version };

// document.currentScript is only set while this script first runs.
const scriptUrl = document.currentScript?.src;
registerEthiopicFont(scriptUrl);

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

// --- Load fidel-components.js the first time a component tag appears --------
let requested = false;

/** Load the component library now (also available as window.Fidel.loadComponents()). */
export function loadComponents() {
  if (requested || !scriptUrl) return;
  requested = true;
  observer.disconnect();
  if (document.querySelector('script[data-fidel-components]') || customElements.get('fidel-input')) return; // already there
  const { script, style } = componentFileUrls(scriptUrl);
  const tag = Object.assign(document.createElement('script'), { src: script, async: true });
  tag.setAttribute('data-fidel-components', '');
  document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: style }), tag);
}

const observer = new MutationObserver((records) => {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node.nodeType === 1 && needsComponents(node)) return loadComponents();
    }
  }
});

function start() {
  if (needsComponents(document.documentElement)) loadComponents();
  else observer.observe(document.documentElement, { childList: true, subtree: true });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
