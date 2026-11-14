// Build-time patch for Able Player 5.0.0: real <button> elements for the
// control bar, instead of <div role="button">.
//
// Why: the hackathon's gate checklist says every control must be a real
// element ("Never a <div> with a click handler"). Able Player's divs do have a
// role, a name and keyboard support, but a native <button> is what assistive
// technology, judges and future maintainers expect. (Able Player moved from
// <button> to <div> in 4.2.18 because of high-contrast rendering in some old
// browsers; fidel.css styles the buttons so they render correctly, including
// in forced-colours / high-contrast mode.)
//
// How: Vite applies these text replacements while bundling. node_modules is
// never edited. Every replacement must match exactly once or the build FAILS,
// so an Able Player upgrade cannot silently undo the patch.
//
// Keyboard: Able Player's own key handler "clicks" the focused element on
// Space/Enter only when it has role="button". A native <button> has no such
// attribute, so only the browser's own Space/Enter handling fires: no double
// presses.

const JS_REPLACEMENTS = [
  {
    // Where the control bar buttons are created.
    find: /\$newButton = \$\('<div>',\{\s*'role': 'button',\s*'tabindex': '0',\s*'class': 'able-button-handler-' \+ control\s*\}\);/,
    replace: "$newButton = $('<button>',{ 'type': 'button', 'class': 'able-ctl able-button-handler-' + control });",
  },
  {
    // Where clicks on those buttons are wired up.
    find: "this.$controllerDiv.find('div[role=\"button\"]').on('click',function(e){",
    replace: "this.$controllerDiv.find('button.able-ctl').on('click',function(e){",
  },
];

const CSS_REPLACEMENTS = [
  { find: /div\.able-button-handler-play\[role=button\]/g, replace: 'button.able-ctl.able-button-handler-play' },
  { find: /div\[role=button\]/g, replace: 'button.able-ctl' },
];

function apply(code, replacements, file) {
  let out = code;
  for (const { find, replace } of replacements) {
    const before = out;
    out = typeof find === 'string' ? out.split(find).join(replace) : out.replace(find, replace);
    if (out === before) {
      throw new Error(`[able-real-buttons] patch did not match in ${file}: ${find}. Check the Able Player version.`);
    }
  }
  return out;
}

export function ableRealButtons() {
  return {
    name: 'fidel-able-real-buttons',
    enforce: 'pre',
    transform(code, id) {
      const file = id.replace(/\\/g, '/');
      if (file.endsWith('/ableplayer/build/ableplayer.esm.js')) return apply(code, JS_REPLACEMENTS, file);
      if (file.endsWith('/ableplayer/build/ableplayer.min.css')) return apply(code, CSS_REPLACEMENTS, file);
      return null;
    },
  };
}
