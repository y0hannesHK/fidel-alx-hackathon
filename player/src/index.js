// Entry point of the fidel.js bundle.
// Loads the CSS (Able Player's first, then ours so ours can override it),
// registers the Ethiopic font, and defines the <fidel-player> element.
import 'ableplayer/build/ableplayer.min.css';
import './fidel.css';
import { registerEthiopicFont } from './fonts.js';
import { FidelPlayer } from './fidel-player.js';

// document.currentScript is only set while this script first runs.
registerEthiopicFont(document.currentScript?.src);

if (!customElements.get('fidel-player')) {
  customElements.define('fidel-player', FidelPlayer);
}
