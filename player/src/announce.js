// Shared announcer for screen-reader users.
//
// Creates two visually hidden live regions once per document (polite and
// assertive). A message repeated within 2 seconds is dropped. The region is
// cleared before the new text is set, so the same message can be read again
// later. Keep messages short: Braille displays show them only briefly.
//
//   import { announce } from './announce.js';
//   announce('Copied');                         // polite
//   announce('Time is almost up', { assertive: true });

const regions = {};
let last = { text: '', at: 0 };

function region(kind) {
  if (regions[kind]?.isConnected) return regions[kind];
  const el = document.createElement('div');
  el.className = 'fidel-announcer';
  el.setAttribute('aria-live', kind);
  el.setAttribute('aria-atomic', 'true');
  // Visually hidden but read by screen readers (no global CSS needed).
  Object.assign(el.style, {
    position: 'absolute', width: '1px', height: '1px', margin: '-1px', padding: '0',
    overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap', border: '0',
  });
  document.body.append(el);
  regions[kind] = el;
  return el;
}

export function announce(text, { assertive = false } = {}) {
  if (!text) return;
  const now = Date.now();
  if (text === last.text && now - last.at < 2000) return;
  last = { text, at: now };
  const el = region(assertive ? 'assertive' : 'polite');
  el.textContent = '';
  // Next frame: screen readers notice a change from empty to the new text.
  setTimeout(() => { el.textContent = text; }, 50);
}
