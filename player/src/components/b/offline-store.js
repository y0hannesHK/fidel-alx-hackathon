// Package B: what is saved on this phone, shared by <fidel-offline-status>
// and <fidel-download-later>.
//
// It uses the SAME cache as the player's "Save for offline" button
// (player/src/save-offline.js and the service worker /fidel-sw.js):
// 'fidel-saved-lessons-v1'. One-page lessons (/api/v1/lessons/<id>/offline.html)
// are saved through the service worker, exactly like that button, so they
// open with no internet. Other same-site files are put in the cache directly.
//
// localStorage (each read and write in try/catch, never fatal):
//   fidel-download-queue   [{ href, label, size, wifiOnly }]  waiting downloads
//   fidel-saved-titles     { url: label }  names for the "Saved lessons" list
import { canSaveOffline, saveOffline, savedPageUrl } from '../../save-offline.js';
import { dequeue, enqueue, parseQueue, readyToDownload } from './logic.js';

export const CACHE = 'fidel-saved-lessons-v1';
const QUEUE_KEY = 'fidel-download-queue';
const TITLES_KEY = 'fidel-saved-titles';
const isLessonPage = (url) => /\/api\/v1\/lessons\/[a-f0-9]{12}\/offline\.html/.test(url);

/** Changes inside this page: 'queue' (queue changed), 'state' (downloading/ready/failed). */
export const changes = new EventTarget();

export const hasCache = () => typeof window !== 'undefined' && 'caches' in window && window.isSecureContext;

/** The address under which a file is kept in the cache. */
export function cacheUrl(href) {
  return isLessonPage(new URL(href, location.href).href) ? savedPageUrl(href) : new URL(href, location.href).href;
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: the queue is kept only until the page closes.
  }
}

let memoryQueue = null;
export function loadQueue() {
  try {
    return parseQueue(localStorage.getItem(QUEUE_KEY));
  } catch {
    return memoryQueue || [];
  }
}
function saveQueue(queue) {
  memoryQueue = queue;
  writeJson(QUEUE_KEY, queue);
  changes.dispatchEvent(new Event('queue'));
}

export function titles() {
  const value = readJson(TITLES_KEY, {});
  return value && typeof value === 'object' ? value : {};
}

/** Saved files: [{ url, title }], or null when it cannot be known. */
export async function savedItems() {
  if (!hasCache()) return null;
  try {
    if (!(await caches.has(CACHE))) return [];
    const keys = await (await caches.open(CACHE)).keys();
    const names = titles();
    return keys.map((request) => ({ url: request.url, title: names[request.url] || null }));
  } catch {
    return null;
  }
}

export async function isCached(href) {
  if (!hasCache()) return false;
  try {
    return Boolean(await (await caches.open(CACHE)).match(cacheUrl(href)));
  } catch {
    return false;
  }
}

export function addToQueue(item) {
  saveQueue(enqueue(loadQueue(), item));
  processQueue();
}

export function removeFromQueue(href) {
  saveQueue(dequeue(loadQueue(), href));
}

export const state = new Map(); // href -> 'downloading' | 'failed'

function connection() {
  const c = navigator.connection;
  return { online: navigator.onLine, type: c && 'type' in c ? c.type : undefined };
}

async function download(href) {
  const url = cacheUrl(href);
  if (isLessonPage(url) && canSaveOffline(href)) return saveOffline(href);
  const cache = await caches.open(CACHE);
  await cache.add(url);
  return true;
}

let running = false;
/** Download every queued item that may download now (one at a time). */
export async function processQueue() {
  if (running || !hasCache()) return;
  running = true;
  try {
    for (const item of readyToDownload(loadQueue(), connection())) {
      if (!loadQueue().some((q) => q.href === item.href)) continue; // removed meanwhile
      state.set(item.href, 'downloading');
      changes.dispatchEvent(new CustomEvent('state', { detail: { href: item.href, label: item.label } }));
      let ok = false;
      try {
        ok = await download(item.href);
      } catch {
        ok = false;
      }
      if (ok) {
        state.delete(item.href);
        writeJson(TITLES_KEY, { ...titles(), [cacheUrl(item.href)]: item.label });
        saveQueue(dequeue(loadQueue(), item.href));
        changes.dispatchEvent(new CustomEvent('ready', { detail: { href: item.href, label: item.label } }));
      } else {
        state.set(item.href, 'failed');
        changes.dispatchEvent(new CustomEvent('state', { detail: { href: item.href, label: item.label } }));
      }
    }
  } finally {
    running = false;
  }
}

let listening = false;
/** Start downloading whenever the phone comes online (once per page). */
export function watchConnection() {
  if (listening) return;
  listening = true;
  window.addEventListener('online', () => processQueue());
  navigator.connection?.addEventListener?.('change', () => processQueue());
  processQueue();
}
