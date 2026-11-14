// Player keys and the "Keyboard help" dialog.
//
// Keys work only while focus is INSIDE the player (video and its buttons), so
// they never take keys away from the rest of the page or from a screen
// reader's browse mode:
//   K           play / pause
//   Space       play / pause (on a button, Space presses that button instead)
//   Left/Right  back / forward 5 seconds
// Keys with Alt, Ctrl or Cmd held are left alone (Able Player's own Alt+Ctrl
// shortcuts, browser shortcuts). Text fields, sliders and menus keep their keys.
import { h } from './dom.js';
import { t } from './strings.js';

const SEEK_SECONDS = 5;

function ownsItsKeys(element) {
  return element.closest('input, textarea, select, [contenteditable], [role="slider"], [role="menu"], [role="menuitem"], [role="menuitemradio"], .able-popup');
}

export function setUpPlayerKeys(player) {
  const area = player.$ableWrapper?.[0];
  if (!area || area.fidelKeys) return;
  area.fidelKeys = true; // once per player build
  area.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) return;
    if (ownsItsKeys(event.target)) return;
    const media = player.media;
    const onButton = event.target.closest('button, a');
    if (event.key === 'k' || event.key === 'K' || (event.key === ' ' && !onButton)) {
      event.preventDefault();
      player.handlePlay(); // Able Player toggles play / pause
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const delta = event.key === 'ArrowLeft' ? -SEEK_SECONDS : SEEK_SECONDS;
      player.seekTo(Math.min(Math.max(0, media.currentTime + delta), media.duration || Infinity));
    }
  });
}

/** A native modal <dialog> listing the keys. Focus goes in, Escape closes,
 *  and focus returns to the button that opened it. */
export function openKeyboardHelp(lang, opener) {
  const tr = (key) => t(lang, key);
  const kbd = (...keys) => keys.flatMap((k, i) => (i ? [' / ', h('kbd', {}, k)] : [h('kbd', {}, k)]));
  const titleId = `fidel-keys-title-${Date.now()}`;
  const close = h('button', { type: 'button', class: 'fidel-button', onclick: () => dialog.close() }, tr('close'));
  const dialog = h('dialog', { class: 'fidel-keys-dialog', lang, 'aria-labelledby': titleId },
    h('h2', { id: titleId }, tr('keysTitle')),
    h('p', {}, tr('keysIntro')),
    h('table', {},
      h('tbody', {},
        [[kbd('K', 'Space'), tr('keyPlay')],
          [kbd('←'), tr('keyBack')],
          [kbd('→'), tr('keyForward')],
          [kbd('Tab', 'Shift + Tab'), tr('keyTab')],
          [kbd('Esc'), tr('keyEscape')]]
          .map(([keys, what]) => h('tr', {}, h('th', { scope: 'row' }, keys), h('td', {}, what))))),
    h('p', {}, tr('keyShortcuts')),
    close);
  dialog.addEventListener('close', () => {
    dialog.remove();
    opener?.focus();
  });
  (opener?.closest('fidel-player') || document.body).append(dialog);
  dialog.showModal();
  close.focus();
}
