// h('button', { type: 'button', onclick: fn }, 'Label') -> <button>
// Builds DOM elements safely: children that are strings become text nodes,
// so user or caption text can never inject HTML.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    if (name.startsWith('on') && typeof value === 'function') {
      el.addEventListener(name.slice(2), value);
    } else if (name === 'class') {
      el.className = value;
    } else if (name === 'style' && typeof value === 'object') {
      Object.assign(el.style, value);
    } else {
      el.setAttribute(name, value === true ? '' : value);
    }
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

let idCounter = 0;
/** A unique id for label/field pairs. */
export function uid(prefix) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/**
 * A group of radio buttons inside a <fieldset> with a visible <legend>.
 * options: [{ value, label, lang? }]
 */
export function radioGroup({ legend, name, options, checked, onChange }) {
  return h(
    'fieldset',
    { class: 'fidel-radios' },
    h('legend', {}, legend),
    options.map((option) => {
      const id = uid(name);
      return h(
        'div',
        { class: 'fidel-radio' },
        h('input', {
          type: 'radio',
          id,
          name,
          value: option.value,
          checked: option.value === checked,
          onchange: () => onChange(option.value),
        }),
        h('label', { for: id, lang: option.lang }, option.label)
      );
    })
  );
}
