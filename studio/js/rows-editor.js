// A simple editable list of timed rows, used for chapters and audio
// descriptions. Each row has time fields and text fields, a "Use current
// video time" button, and a Remove button. Times are typed as m:ss.
import { formatTime, h, parseTime, say, uid } from './util.js';

/**
 * options: {
 *   heading, intro, addLabel, saveLabel,
 *   fields: [{ key, label, kind: 'time' | 'text', lang?, long? , optional? }],
 *   rows: [...initial values],
 *   getVideoTime: () => seconds,
 *   save: async (rows) => message | { message, rows }   // throws on error
 *   extra?: (row, { status, rerender }) => Node   // more controls for one row
 * }
 */
export function rowsEditor(options) {
  const headingId = uid('heading');
  const status = h('p', { class: 'status', role: 'status' });
  const list = h('ol', { class: 'rows' });
  const rows = options.rows.map((r) => ({ ...r }));

  function rowElement(row, index) {
    const legend = `${options.itemName} ${index + 1}`;
    const inputs = options.fields.map((field) => {
      const id = uid(field.key);
      const isTime = field.kind === 'time';
      const input = h(field.long ? 'textarea' : 'input', {
        id,
        lang: field.lang,
        type: field.long ? null : 'text',
        rows: field.long ? 2 : null,
        inputmode: isTime ? 'decimal' : null,
        value: isTime ? (row[field.key] === undefined ? '' : formatTime(row[field.key])) : row[field.key] ?? '',
        oninput: (e) => {
          row[field.key] = isTime ? parseTime(e.target.value) : e.target.value;
        },
      });
      const parts = [h('label', { for: id }, field.label, field.optional ? ' (optional)' : ''), input];
      if (isTime) {
        parts.push(
          h('button', {
            type: 'button',
            class: 'button secondary small',
            onclick: () => {
              row[field.key] = options.getVideoTime();
              input.value = formatTime(row[field.key]);
              say(status, `${field.label} set to ${input.value}.`);
            },
          }, `Use video time for ${field.label.toLowerCase()}`)
        );
      }
      return h('div', { class: isTime ? 'field time' : 'field' }, parts);
    });
    return h('li', {},
      h('fieldset', { class: 'cue' },
        h('legend', {}, legend),
        inputs,
        options.extra?.(row, { status, rerender: render }),
        h('button', {
          type: 'button',
          class: 'button secondary small',
          onclick: () => {
            rows.splice(index, 1);
            render();
            say(status, `${legend} removed.`);
            list.querySelector('input, textarea')?.focus() || addButton.focus();
          },
        }, `Remove ${legend.toLowerCase()}`)
      )
    );
  }

  function render() {
    list.replaceChildren(...rows.map(rowElement));
    if (!rows.length) list.append(h('li', { class: 'empty' }, options.emptyText));
  }

  const addButton = h('button', {
    type: 'button',
    class: 'button secondary',
    onclick: () => {
      rows.push(options.newRow(options.getVideoTime()));
      render();
      list.lastElementChild.querySelector('input, textarea')?.focus();
    },
  }, options.addLabel);

  async function save() {
    for (const [i, row] of rows.entries()) {
      for (const field of options.fields) {
        const value = row[field.key];
        if (field.kind === 'time' && !(value >= 0)) {
          return say(status, `Not saved: ${options.itemName} ${i + 1} has a time that is not valid. Use minutes:seconds, like 1:30.`);
        }
        if (field.kind === 'text' && !field.optional && !String(value ?? '').trim()) {
          return say(status, `Not saved: ${options.itemName} ${i + 1} needs ${field.label.toLowerCase()}.`);
        }
      }
    }
    say(status, 'Saving…');
    try {
      const result = await options.save(rows);
      // save() may return { message, rows } to refresh the list from the server.
      if (result?.rows) {
        rows.splice(0, rows.length, ...result.rows.map((r) => ({ ...r })));
        render();
      }
      say(status, result?.message ?? result);
    } catch (error) {
      say(status, `Not saved: ${error.message}`);
    }
  }

  render();
  return h('section', { class: 'card', 'aria-labelledby': headingId },
    h('h2', { id: headingId }, options.heading),
    options.intro && h('p', {}, options.intro),
    list,
    h('div', { class: 'row' },
      addButton,
      h('button', { type: 'button', class: 'button', onclick: save }, options.saveLabel)),
    status
  );
}
