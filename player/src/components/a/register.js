// Package A (see assets/AGENT_TASK_fidel_components.md): defines this
// package's tags. Only tags that are finished are registered here, each
// guarded so a page that loads Fidel twice does not fail:
//   if (!customElements.get('fidel-example')) customElements.define('fidel-example', FidelExample);
import './components.css';
