// Entry point of the fidel.js bundle.
// Loads the CSS (Able Player's first, then ours so ours can override it)
// and registers the <fidel-player> custom element.
import 'ableplayer/build/ableplayer.min.css';
import './fidel.css';
import { FidelPlayer } from './fidel-player.js';

if (!customElements.get('fidel-player')) {
  customElements.define('fidel-player', FidelPlayer);
}
