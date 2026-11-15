// Small helpers shared by the Studio pages.

/** h('button', { type: 'button', onclick }, 'Label'): builds DOM safely
 *  (strings become text, never HTML). */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    if (name === 'value') continue; // set below, as a property (see there)
    if (name.startsWith('on') && typeof value === 'function') el.addEventListener(name.slice(2), value);
    else if (name === 'class') el.className = value;
    else if (name in el && typeof value !== 'string') el[name] = value; // e.g. checked, value
    else el.setAttribute(name, value === true ? '' : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  // value as a property, after the children: a <textarea> ignores a value
  // attribute (the caption boxes showed empty), and a <select> needs its
  // <option>s before its value can be chosen.
  if (attrs.value !== undefined && attrs.value !== null && attrs.value !== false) {
    if ('defaultValue' in el) el.defaultValue = attrs.value; // what form.reset() returns to
    if ('value' in el) el.value = attrs.value;
    else el.setAttribute('value', attrs.value);
  }
  return el;
}

let counter = 0;
export const uid = (prefix) => `${prefix}-${++counter}`;

/** 93.4 -> "1:33.4" (tenths shown so staff can be precise) */
export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = (seconds - m * 60).toFixed(1).padStart(4, '0');
  return `${m}:${s}`;
}

/** "1:33", "1:33.5", "93" -> seconds; NaN if not a time. */
export function parseTime(text) {
  const parts = String(text).trim().split(':');
  if (parts.length > 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return NaN;
  return parts.reduce((total, p) => total * 60 + parseFloat(p), 0);
}

/** Announce a message in a status region (screen readers read it politely). */
export function say(region, message) {
  region.textContent = '';
  // A tiny delay makes screen readers notice repeated identical messages.
  setTimeout(() => (region.textContent = message), 50);
}
