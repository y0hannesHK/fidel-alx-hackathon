// Package A (see assets/AGENT_TASK_fidel_components.md): defines this
// package's tags. Only tags that are finished are registered here, each
// guarded so a page that loads Fidel twice does not fail:
//   if (!customElements.get('fidel-example')) customElements.define('fidel-example', FidelExample);
import './components.css';
import { FidelCodeBlock } from './code-block.js';
import { FidelCodeSnapshots } from './code-snapshots.js';
import { FidelDescribedImage } from './described-image.js';
import { FidelWord } from './word.js';

// Order matters: code blocks first, so snapshots can move finished blocks.
const TAGS = [
  ['fidel-code-block', FidelCodeBlock],
  ['fidel-code-snapshots', FidelCodeSnapshots],
  ['fidel-described-image', FidelDescribedImage],
  ['fidel-word', FidelWord],
];

for (const [name, element] of TAGS) {
  if (!customElements.get(name)) customElements.define(name, element);
}
