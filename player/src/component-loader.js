// Which tags are in fidel.js itself; every other <fidel-...> tag is in
// fidel-components.js. Pure functions, unit-tested.

export const CORE_TAGS = new Set(['fidel-player', 'fidel-job-card', 'fidel-session-viewer', 'fidel-certificate']);

const isComponentTag = (name) => name.startsWith('fidel-') && !CORE_TAGS.has(name);

/** True if this element, or anything inside it, is a component-library tag. */
export function needsComponents(root) {
  if (isComponentTag(root.localName || '')) return true;
  for (const el of root.getElementsByTagName('*')) {
    if (isComponentTag(el.localName)) return true;
  }
  return false;
}

/** ".../embed/v1/fidel.js?x" -> the components' script and stylesheet next to it. */
export function componentFileUrls(scriptUrl) {
  const url = new URL(scriptUrl);
  url.search = '';
  url.hash = '';
  const folder = url.href.replace(/[^/]*$/, '');
  return { script: `${folder}fidel-components.js`, style: `${folder}fidel-components.css` };
}
