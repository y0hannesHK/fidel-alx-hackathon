// Events that Fidel components send to the page they are embedded in
// ("settings in, events out"). A host page listens like this:
//
//   document.querySelector('fidel-player').addEventListener('fidel-ended', (e) => {
//     console.log('Lesson watched to the end', e.detail);
//   });
//
// Events bubble, so one listener on document catches them from every player.
// They carry no personal data.

export const VERSION = '1.0.0';

export function emit(element, name, detail = {}) {
  element.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
}
