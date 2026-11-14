// Zoom chat export ("Save chat" / recording chat .txt) -> messages.
//
// Each message starts with  HH:MM:SS<TAB>Name:<TAB>text  and may continue on
// the following lines (replies, long messages). Emoji reactions
// ("Reacted to ... with 👍") are skipped: they are noise when read aloud.

const START = /^(\d{1,2}):(\d{2}):(\d{2})\t([^\t]+?):\t(.*)$/;

/** Returns [{ time (seconds), name, text }] in time order. */
export function parseZoomChat(source) {
  const messages = [];
  for (const line of source.replace(/\r\n?/g, '\n').split('\n')) {
    const match = line.match(START);
    if (match) {
      const [, h, m, s, name, text] = match;
      messages.push({ time: Number(h) * 3600 + Number(m) * 60 + Number(s), name: name.trim(), text });
    } else if (messages.length) {
      messages[messages.length - 1].text += `\n${line}`; // continuation of the previous message
    }
  }
  return messages
    .map((m) => ({ ...m, text: m.text.replace(/\n{2,}/g, '\n').trim() }))
    .filter((m) => m.text && !/^Reacted to ".*" with /.test(m.text))
    .sort((a, b) => a.time - b.time);
}

/**
 * Replace people's names with "Participant 1", "Participant 2", ... (same
 * person, same number). Use it when you do not have everyone's consent to
 * show their name.
 */
export function anonymize(messages, label = 'Participant') {
  const numbers = new Map();
  return messages.map((m) => {
    if (!numbers.has(m.name)) numbers.set(m.name, numbers.size + 1);
    return { ...m, name: `${label} ${numbers.get(m.name)}` };
  });
}
