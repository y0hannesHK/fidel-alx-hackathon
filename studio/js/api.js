// Talks to the Fidel API with the staff token.
//
// The token is kept in sessionStorage: it is forgotten when the browser tab
// is closed, and never sent anywhere except this Fidel server.

const KEY = 'fidel-staff-token';

export const token = {
  get: () => sessionStorage.getItem(KEY) || '',
  set: (value) => sessionStorage.setItem(KEY, value),
  clear: () => sessionStorage.removeItem(KEY),
};

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Turn FastAPI error bodies into one readable sentence. */
function describe(body, status) {
  if (typeof body?.detail === 'string') return body.detail;
  if (Array.isArray(body?.detail)) {
    return body.detail.map((d) => d.msg.replace(/^Value error, /, '')).join(' ');
  }
  return `The server answered with error ${status}.`;
}

export async function api(path, { method = 'GET', json, form } = {}) {
  const headers = { Authorization: `Bearer ${token.get()}` };
  let body;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (form) {
    body = form;
  }
  let response;
  try {
    response = await fetch(path, { method, headers, body });
  } catch {
    throw new ApiError(0, 'Could not reach the Fidel server. Check the connection.');
  }
  const isJson = response.headers.get('content-type')?.includes('json');
  const data = isJson ? await response.json() : await response.text();
  if (!response.ok) throw new ApiError(response.status, describe(data, response.status));
  return data;
}

/** Upload with a progress callback (fetch cannot report upload progress). */
export function uploadWithProgress(path, form, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', path);
    xhr.setRequestHeader('Authorization', `Bearer ${token.get()}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let data = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* not JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new ApiError(xhr.status, describe(data, xhr.status)));
    };
    xhr.onerror = () => reject(new ApiError(0, 'The upload failed. Check the connection and try again.'));
    xhr.send(form);
  });
}

/**
 * Languages the optional voice engine can read right now (running, model
 * downloaded), e.g. Set {'am'}. Empty when there is no voice engine, so Studio
 * shows no "machine-read" buttons that could not work. Asked once per page.
 */
let voice;
export function voiceLanguages() {
  voice ??= api('/api/v1/engines')
    .then((engines) => new Set(engines.text_to_speech
      .filter((e) => e.running && e.model_downloaded)
      .flatMap((e) => e.languages)))
    .catch(() => new Set());
  return voice;
}
