// <fidel-table sortable="true" ui-lang="en|am">
//   <table>
//     <caption>Lesson times</caption>
//     <thead><tr><th>Lesson</th><th>Length</th></tr></thead>
//     <tbody><tr><th>HTML basics</th><td>12:30</td></tr> …</tbody>
//   </table>
// </fidel-table>
//
// E4. Wraps a real <table>:
//  - A <caption> is required: without one, a warning goes to the browser
//    console and, with show-warnings, a visible note for authors.
//  - Every <th> gets a scope (col in the header, row in the body).
//  - Each body cell gets data-label="Header text". When the table is narrow
//    (a phone, or 400 % zoom) each row is shown as a card of "Header: value"
//    pairs instead of scrolling sideways (CSS container query). Explicit
//    table roles keep the table a table for screen readers in both layouts.
//  - sortable="true": each column header becomes a button; aria-sort says the
//    order, and "Sorted by Length, ascending" is announced.
// Event: fidel-table-sort { column, direction }.
import { h } from '../../dom.js';
import { announce } from '../../announce.js';
import { emit, translator, uiLang } from './common.js';
import { columnLabels, sortedOrder } from './logic.js';

export class FidelTable extends HTMLElement {
  connectedCallback() {
    if (this.built) return;
    const table = this.querySelector('table');
    if (!table) return;
    this.built = true;
    this.table = table;
    this.lang = uiLang(this);
    this.tt = translator(this.lang, 'table');
    table.classList.add('fidel-table-table');
    if (!table.caption || !table.caption.textContent.trim()) {
      console.warn('<fidel-table>: add a <caption> to the table: it names the table for screen-reader users.', table);
      if (this.hasAttribute('show-warnings')) {
        this.prepend(h('p', { class: 'fidel-table-warning', lang: this.lang }, this.tt('noCaption')));
      }
    }
    const headerRows = this.headerRows();
    const bodyRows = this.bodyRows(headerRows);
    this.markRoles(headerRows, bodyRows);
    this.labels = columnLabels(headerRows.map((row) => [...row.cells].map((cell) => ({ text: cell.textContent, span: cell.colSpan }))));
    for (const row of bodyRows) {
      let col = 0;
      for (const cell of row.cells) {
        const label = this.labels[col];
        if (label && !cell.hasAttribute('data-label')) cell.setAttribute('data-label', label);
        col += cell.colSpan || 1;
      }
    }
    if (this.getAttribute('sortable') === 'true' && headerRows.length) this.makeSortable(headerRows.at(-1));
  }

  headerRows() {
    const table = this.table;
    if (table.tHead?.rows.length) return [...table.tHead.rows];
    const first = table.rows[0];
    return first && [...first.cells].every((c) => c.localName === 'th') ? [first] : [];
  }

  bodyRows(headerRows) {
    return [...this.table.rows].filter((row) => !headerRows.includes(row) && row.parentElement.localName !== 'tfoot');
  }

  /** scope on every th, and explicit roles (CSS display changes can drop table semantics). */
  markRoles(headerRows, bodyRows) {
    const table = this.table;
    table.setAttribute('role', 'table');
    for (const group of [table.tHead, ...table.tBodies, table.tFoot]) group?.setAttribute('role', 'rowgroup');
    for (const row of headerRows) {
      row.setAttribute('role', 'row');
      for (const cell of row.cells) {
        if (!cell.hasAttribute('scope')) cell.setAttribute('scope', cell.colSpan > 1 ? 'colgroup' : 'col');
        cell.setAttribute('role', 'columnheader');
      }
    }
    for (const row of [...bodyRows, ...(table.tFoot?.rows || [])]) {
      row.setAttribute('role', 'row');
      for (const cell of row.cells) {
        if (cell.localName === 'th') {
          if (!cell.hasAttribute('scope')) cell.setAttribute('scope', 'row');
          cell.setAttribute('role', 'rowheader');
        } else {
          cell.setAttribute('role', 'cell');
        }
      }
    }
  }

  makeSortable(row) {
    this.sortState = { column: -1, direction: 'none' };
    this.sortButtons = [];
    [...row.cells].forEach((cell, column) => {
      if (cell.colSpan > 1) return;
      const name = cell.textContent.trim();
      const arrow = h('span', { class: 'fidel-table-arrow', 'aria-hidden': 'true' }, '↕');
      const button = h('button', { type: 'button', class: 'fidel-table-sort', onclick: () => this.sort(column, name) },
        h('span', {}, ...cell.childNodes), arrow);
      button.arrow = arrow;
      cell.replaceChildren(button);
      this.sortButtons[column] = button;
    });
  }

  sort(column, name) {
    const { column: was, direction } = this.sortState;
    const next = was === column && direction === 'ascending' ? 'descending' : 'ascending';
    this.sortState = { column, direction: next };
    const body = this.table.tBodies[0];
    if (!body) return;
    const rows = [...body.rows];
    const order = sortedOrder(rows.map((r) => [...r.cells].map((c) => c.textContent)), column, next);
    body.append(...order.map((i) => rows[i]));
    const headerRow = this.sortButtons.find(Boolean)?.closest('tr');
    [...(headerRow?.cells || [])].forEach((cell, i) => {
      if (i === column) cell.setAttribute('aria-sort', next);
      else cell.removeAttribute('aria-sort');
      const button = this.sortButtons[i];
      if (button) button.arrow.textContent = i === column ? (next === 'ascending' ? '▲' : '▼') : '↕';
    });
    announce(this.tt('sorted', { name, direction: this.tt(next) }));
    emit(this, 'fidel-table-sort', { column, direction: next });
  }
}
