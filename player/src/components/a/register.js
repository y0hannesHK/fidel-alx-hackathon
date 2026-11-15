// Package A (see assets/AGENT_TASK_fidel_components.md): defines this
// package's tags. Only tags that are finished are registered here, each
// guarded so a page that loads Fidel twice does not fail:
//   if (!customElements.get('fidel-example')) customElements.define('fidel-example', FidelExample);
import './components.css';
import { FidelCodeBlock } from './code-block.js';

const TAGS = [
  ['fidel-code-block', FidelCodeBlock],
];

for (const [name, element] of TAGS) {
  if (!customElements.get(name)) customElements.define(name, element);
}
