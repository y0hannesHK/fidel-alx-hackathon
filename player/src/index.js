// Entry point of the fidel.js bundle.
// Loads the CSS (Able Player's first, then ours so ours can override it),
// registers the Ethiopic font, and defines <fidel-player> and <fidel-job-card>.
import 'ableplayer/build/ableplayer.min.css';
import './fidel.css';
import { registerEthiopicFont } from './fonts.js';
import { FidelPlayer } from './fidel-player.js';
import { FidelJobCard } from './job-card.js';

// document.currentScript is only set while this script first runs.
registerEthiopicFont(document.currentScript?.src);

if (!customElements.get('fidel-player')) {
  customElements.define('fidel-player', FidelPlayer);
}
if (!customElements.get('fidel-job-card')) {
  customElements.define('fidel-job-card', FidelJobCard);
}
