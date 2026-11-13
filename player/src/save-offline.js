// "Save for offline": keep the one-page lesson in this browser, using the
// Fidel service worker (/fidel-sw.js). Browsers only allow a service worker
// for pages on its own site, so this works only when the player is on a page
// served by the Fidel server itself. Elsewhere, the download links are used.

/** The address of the saved page (shown in the browser, not downloaded). */
export function savedPageUrl(offlinePage) {
  const url = new URL(offlinePage, location.href);
  url.searchParams.set('inline', 'true');
  return url.href;
}

/** Can this page use "Save for offline"? */
export function canSaveOffline(offlinePage) {
  if (!offlinePage || !('serviceWorker' in navigator) || !window.isSecureContext || !window.caches) return false;
  return new URL(offlinePage, location.href).origin === location.origin;
}

export async function isSaved(offlinePage) {
  try {
    return Boolean(await caches.match(savedPageUrl(offlinePage)));
  } catch {
    return false;
  }
}

/** Save the lesson. Resolves true when saved. */
export async function saveOffline(offlinePage) {
  const registration = await navigator.serviceWorker.register('/fidel-sw.js');
  await navigator.serviceWorker.ready;
  const worker = registration.active || navigator.serviceWorker.controller;
  const url = savedPageUrl(offlinePage);
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = (event) => resolve(Boolean(event.data?.ok));
    worker.postMessage({ type: 'save', url }, [channel.port2]);
    setTimeout(() => resolve(false), 120_000); // never wait forever on a bad connection
  });
}
