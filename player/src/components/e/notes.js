// <fidel-notes for="lesson-player" lesson-id="html-basics" heading-level="3" ui-lang="en|am">
//
// E5. Timestamped notes, saved ONLY in this browser (localStorage
// "fidel-notes:<lesson-id>"); nothing is sent anywhere.
//  - "Add a note at 1:23": the current video time is filled in (and can be
//    changed, minutes:seconds), then the note text, then Save.
//  - Each note is a button "Play from 1:23: …" that plays the video from
//    there, with Edit and Delete. Delete has Undo (no confirm dialog).
//  - "Download my notes (.txt)".
// Event: fidel-notes-change { count } (never the text of the notes).
import { h, uid } from '../../dom.js';
import { announce } from '../../announce.js';
import { emit, findPlayer, mediaOf, playFrom, translator, uiLang } from './common.js';
import { clock, loadNotes, makeNote, noteLabel, notesToText, parseMmss, saveNotes, sortNotes } from './logic.js';

export class FidelNotes extends HTMLElement {
  connectedCallback() {
    if (this.built) return;
    this.built = true;
    this.lang = uiLang(this);
    this.tt = translator(this.lang, 'notes');
    this.lessonId = this.getAttribute('lesson-id') || location.pathname;
    this.level = Math.min(5, Math.max(2, Number(this.getAttribute('heading-level')) || 3));
    this.notes = loadNotes(this.lessonId);
    this.base = uid('fidel-notes');
    const headingId = `${this.base}-heading`;
    this.addButton = h('button', { type: 'button', class: 'fidel-e-button fidel-e-primary', onclick: () => this.showAddForm() });
    this.formSlot = h('div', { class: 'fidel-notes-form-slot' });
    this.list = h('ul', { class: 'fidel-notes-list' });
    this.empty = h('p', { class: 'fidel-notes-empty' }, this.tt('empty'));
    this.status = h('div', { class: 'fidel-notes-status' });
    this.exportButton = h('button', { type: 'button', class: 'fidel-e-button', onclick: () => this.exportText() }, this.tt('export'));
    this.replaceChildren(h('section', { class: 'fidel-notes', lang: this.lang, 'aria-labelledby': headingId },
      h(`h${this.level}`, { id: headingId, class: 'fidel-notes-heading' }, this.tt('heading')),
      h('p', { class: 'fidel-e-hint' }, this.tt('private')),
      this.addButton, this.formSlot, this.status, this.empty, this.list,
      h('div', { class: 'fidel-e-actions' }, this.exportButton)));
    this.updateAddLabel();
    this.render();
    this.follow();
  }

  disconnectedCallback() {
    this.media?.removeEventListener('timeupdate', this.onTime);
    this.built = false;
  }

  /** Keep "Add a note at 1:23" in step with the video (not while it has focus). */
  follow() {
    this.onTime = () => {
      if (document.activeElement !== this.addButton) this.updateAddLabel();
    };
    const attach = () => {
      const media = mediaOf(findPlayer(this));
      if (media === this.media) return;
      this.media?.removeEventListener('timeupdate', this.onTime);
      this.media = media;
      media?.addEventListener('timeupdate', this.onTime);
    };
    attach();
    document.addEventListener('fidel-ready', attach);
  }

  currentTime() {
    return Math.floor(mediaOf(findPlayer(this))?.currentTime || 0);
  }

  updateAddLabel() {
    const label = this.tt('add', { time: clock(this.currentTime()) });
    if (this.addButton.textContent !== label) this.addButton.textContent = label;
  }

  changed() {
    saveNotes(this.lessonId, this.notes);
    emit(this, 'fidel-notes-change', { count: this.notes.length });
  }

  /** A form for a new note (note = null) or to edit one. */
  noteForm(note, { onSave, onCancel }) {
    const id = uid('fidel-note');
    const timeField = h('fidel-input', {
      id: `${id}-time`, label: this.tt('time'), hint: this.tt('timeHint'), format: 'mmss', required: true,
      inputmode: 'numeric', 'ui-lang': this.lang, value: clock(note ? note.time : this.currentTime()),
    });
    const textField = h('fidel-textarea', {
      id: `${id}-text`, label: this.tt('text'), required: true, rows: 3, maxlength: 1000, 'ui-lang': this.lang,
    });
    if (note) textField.setAttribute('value', note.text);
    const form = h('form', { class: 'fidel-notes-form', novalidate: true },
      timeField, textField,
      h('div', { class: 'fidel-e-actions' },
        h('button', { type: 'submit', class: 'fidel-e-button fidel-e-primary' }, this.tt('save')),
        h('button', { type: 'button', class: 'fidel-e-button', onclick: onCancel }, this.tt('cancel'))));
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!timeField.checkValidity()) return timeField.focus();
      if (!textField.checkValidity()) return textField.focus();
      onSave(parseMmss(timeField.value), textField.value);
    });
    form.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    });
    return { form, focus: () => textField.focus() };
  }

  showAddForm() {
    const { form, focus } = this.noteForm(null, {
      onSave: (time, words) => {
        const note = makeNote(time, words);
        this.notes = sortNotes([...this.notes, note]);
        this.changed();
        this.formSlot.replaceChildren();
        this.addButton.hidden = false;
        this.render();
        this.say(this.tt('added', { time: clock(note.time) }));
        this.list.querySelector(`[data-note="${note.id}"] .fidel-notes-play`)?.focus();
      },
      onCancel: () => {
        this.formSlot.replaceChildren();
        this.addButton.hidden = false;
        this.addButton.focus();
      },
    });
    this.addButton.hidden = true;
    this.formSlot.replaceChildren(form);
    focus();
  }

  say(message, undo = null) {
    const parts = [h('p', { class: 'fidel-notes-said' }, message)];
    if (undo) parts.push(h('button', { type: 'button', class: 'fidel-e-button fidel-notes-undo', onclick: undo }, this.tt('undo')));
    this.status.replaceChildren(...parts);
    announce(message);
  }

  render() {
    this.empty.hidden = this.notes.length > 0;
    this.list.hidden = this.notes.length === 0;
    this.exportButton.disabled = this.notes.length === 0;
    this.list.replaceChildren(...this.notes.map((note) => this.item(note)));
  }

  item(note) {
    const at = clock(note.time);
    const textId = `${this.base}-${note.id}`;
    return h('li', { class: 'fidel-notes-item', 'data-note': note.id },
      h('button', {
        type: 'button', class: 'fidel-notes-play', id: textId,
        onclick: () => {
          if (!playFrom(findPlayer(this), note.time)) this.say(this.tt('noPlayer'));
        },
      }, noteLabel(note, this.tt('play'))),
      h('div', { class: 'fidel-notes-actions' },
        h('button', { type: 'button', class: 'fidel-e-button fidel-e-small', onclick: () => this.edit(note) },
          this.tt('edit'), h('span', { class: 'fidel-e-sr' }, ` ${this.tt('noteAt', { time: at })}`)),
        h('button', { type: 'button', class: 'fidel-e-button fidel-e-small', onclick: () => this.remove(note) },
          this.tt('delete'), h('span', { class: 'fidel-e-sr' }, ` ${this.tt('noteAt', { time: at })}`))));
  }

  edit(note) {
    const item = this.list.querySelector(`[data-note="${note.id}"]`);
    const back = () => {
      this.render();
      this.list.querySelector(`[data-note="${note.id}"] .fidel-notes-play`)?.focus();
    };
    const { form, focus } = this.noteForm(note, {
      onSave: (time, words) => {
        note.time = Math.round(time);
        note.text = words.trim().slice(0, 1000);
        this.notes = sortNotes(this.notes);
        this.changed();
        this.say(this.tt('saved'));
        back();
      },
      onCancel: back,
    });
    item.replaceChildren(form);
    focus();
  }

  remove(note) {
    this.notes = this.notes.filter((n) => n !== note);
    this.changed();
    this.render();
    this.say(this.tt('deleted', { time: clock(note.time) }), () => {
      this.notes = sortNotes([...this.notes, note]);
      this.changed();
      this.render();
      this.say(this.tt('restored'));
      this.list.querySelector(`[data-note="${note.id}"] .fidel-notes-play`)?.focus();
    });
    // Focus: the Undo button (the deleted note's place is gone).
    this.status.querySelector('.fidel-notes-undo')?.focus();
  }

  exportText() {
    const title = this.getAttribute('title-text') || this.tt('fileTitle');
    const blob = new Blob([notesToText(this.notes, title)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = h('a', { href: url, download: `notes-${String(this.lessonId).replace(/[^\w-]+/g, '-')}.txt`, hidden: true });
    this.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.say(this.tt('exported'));
  }
}
