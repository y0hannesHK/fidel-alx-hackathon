// Package B (see assets/AGENT_TASK_fidel_components.md): defines this
// package's tags. Only tags that are finished are registered here, each
// guarded so a page that loads Fidel twice does not fail:
//   if (!customElements.get('fidel-example')) customElements.define('fidel-example', FidelExample);
import './components.css';
import { FidelDataSaver } from './data-saver.js';
import { FidelOfflineStatus } from './offline-status.js';
import { FidelDownloadLater } from './download-later.js';
import { FidelEthiopianDate } from './ethiopian-date.js';
import { FidelLang } from './section-lang.js';
import { FidelDisplayPrefs } from './display-prefs.js';

const TAGS = {
  'fidel-data-saver': FidelDataSaver,
  'fidel-offline-status': FidelOfflineStatus,
  'fidel-download-later': FidelDownloadLater,
  'fidel-ethiopian-date': FidelEthiopianDate,
  'fidel-lang': FidelLang,
  'fidel-display-prefs': FidelDisplayPrefs,
};

for (const [name, Element] of Object.entries(TAGS)) {
  if (!customElements.get(name)) customElements.define(name, Element);
}
