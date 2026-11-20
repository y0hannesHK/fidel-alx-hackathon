const status = document.getElementById('status');
const params = new URLSearchParams(location.search);
let parentOrigin;
let currentCue = null;
let currentSiGML = null;
let currentRequest = 0;
let planning = false;
let pendingPlanController = null;
let playbackRate = 1;
let playing = false;
let captionLanguage = 'en';
let unavailableCaptionMessage = '';
let avatarAnimating = false;
let animationPending = false;
let stopPending = false;
let stopAfterStart = false;
let resumeAfterStop = false;
let replacementPending = false;
let requestedSiGML = null;
let planStats = { fingerspelled: 0, omitted: 0 };
let signs = new Map();
let alphabet = new Map();
let baseGloss = new Map();
let rejectedSigns = 0;

function setStatus(message, state = 'status') {
  status.textContent = message;
  status.setAttribute('role', state === 'error' ? 'alert' : 'status');
  if (parentOrigin) {
    window.parent.postMessage({
      channel: 'fidel-kozha',
      type: 'kozha-state',
      state,
      message,
    }, parentOrigin);
  }
}

function glossBase(gloss) {
  return String(gloss)
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/#\d+$/g, '')
    .replace(/\d+[a-z]?\^?$/g, '')
    .replace(/^_num-/g, '')
    .replace(/[^a-z0-9\u00c0-\u024f]+/g, ' ')
    .trim();
}

async function loadSigML(url, target, normalize) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load the BSL sign data (${response.status}).`);
  const xml = new DOMParser().parseFromString(await response.text(), 'application/xml');
  if (xml.querySelector('parsererror')) throw new Error('The BSL sign data is invalid XML.');
  for (const sign of xml.querySelectorAll('hns_sign')) {
    const gloss = (sign.getAttribute('gloss') || '').trim();
    const key = normalize(gloss);
    if (!key) continue;
    const validation = window.SigmlValidator.validateHnsSignXml(sign.outerHTML);
    if (validation.valid) target.set(key, sign.outerHTML);
    else rejectedSigns += 1;
  }
}

async function loadDictionaries() {
  if (typeof window.SigmlValidator?.validateHnsSignXml !== 'function') {
    throw new Error('The SiGML validator did not load.');
  }
  await Promise.all([
    loadSigML('/data/hamnosys_bsl_version1.sigml', signs, (value) => value.toLowerCase()),
    loadSigML('/data/bsl_alphabet_sigml.sigml', alphabet, (value) => value.toUpperCase()),
  ]);
  for (const [gloss, sigml] of signs) {
    const base = glossBase(gloss);
    if (base && !baseGloss.has(base)) baseGloss.set(base, sigml);
  }
  if (signs.size === 0 || alphabet.size === 0) {
    throw new Error('The self-hosted BSL sign dictionary or alphabet is empty.');
  }
}

function fingerspell(word) {
  const blocks = [];
  for (const letter of String(word).toUpperCase()) {
    const sign = alphabet.get(letter);
    if (sign) blocks.push(sign);
  }
  return blocks;
}

function buildSiGML(plan) {
  const tokens = String(plan.final || '')
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/^[^a-z0-9_#^]+|[^a-z0-9_#^]+$/g, ''))
    .filter(Boolean);
  if (!Array.isArray(plan.per_token_review) || plan.per_token_review.length !== tokens.length) {
    throw new Error('Kozha did not return review metadata for every BSL gloss; playback was stopped.');
  }
  const reviews = plan.per_token_review;
  const blocks = [];
  let fingerspelled = 0;
  let omitted = 0;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const review = reviews[index];
    const exact = review && review.force_fingerspell ? null : signs.get(token);
    const matched = exact || (!review?.force_fingerspell && baseGloss.get(glossBase(token)));
    if (matched) {
      blocks.push(matched);
      continue;
    }
    const letters = fingerspell(token);
    if (letters.length) {
      blocks.push(...letters);
      fingerspelled += 1;
    } else {
      omitted += 1;
    }
  }
  const sigml = blocks.length
    ? `<?xml version="1.0" encoding="utf-8"?><sigml>${blocks.join('')}</sigml>`
    : '';
  if (sigml && window.SigmlValidator.sigmlHasObjectLiteral(sigml)) {
    throw new Error('Kozha generated invalid SiGML; playback was stopped.');
  }
  return { sigml, fingerspelled, omitted };
}

function stopAvatar() {
  if (typeof window.CWASA?.stopSiGML !== 'function') {
    setStatus('The BSL avatar could not be stopped safely.', 'error');
    return false;
  }
  if (stopPending) return true;
  if (replacementPending) {
    stopAfterStart = true;
    return true;
  }
  if (animationPending) stopAfterStart = true;
  if (!avatarAnimating) return true;
  try {
    stopPending = true;
    window.CWASA.stopSiGML(0);
    return true;
  } catch (error) {
    stopPending = false;
    setStatus(`The BSL avatar could not be stopped: ${error.message}`, 'error');
    return false;
  }
}

function playingStatus() {
  const fallback = [];
  if (planStats.fingerspelled) fallback.push(`${planStats.fingerspelled} word(s) fingerspelled`);
  if (planStats.omitted) fallback.push(`${planStats.omitted} word(s) omitted`);
  const details = fallback.length ? ` ${fallback.join('; ')}.` : '';
  setStatus(`Experimental BSL avatar playing at video speed ${playbackRate}×. Timing may differ.${details}`);
}

function showUnsupportedCaptionStatus() {
  const fallback = captionLanguage === 'off'
    ? 'Turn on English captions to use the BSL avatar.'
    : 'The experimental BSL avatar supports English captions only.';
  setStatus(unavailableCaptionMessage || fallback);
}

function playAvatar() {
  if (!currentSiGML) {
    setStatus('No playable BSL signs were found for this English caption.');
    return;
  }
  if (!playing) {
    setStatus('Experimental BSL is ready. Press Play to animate this caption.');
    return;
  }
  if (stopPending) {
    resumeAfterStop = true;
    return;
  }
  stopAfterStart = false;
  if (requestedSiGML === currentSiGML && (animationPending || avatarAnimating)) return;
  if (typeof window.CWASA?.playSiGMLText !== 'function') {
    setStatus('The BSL avatar is not ready to play.', 'error');
    return;
  }
  try {
    if (avatarAnimating) replacementPending = true;
    animationPending = true;
    requestedSiGML = currentSiGML;
    window.CWASA.playSiGMLText(currentSiGML, 0);
    setStatus('Preparing experimental BSL animation…');
  } catch (error) {
    animationPending = false;
    requestedSiGML = null;
    setStatus(`The BSL avatar could not play this caption: ${error.message}`, 'error');
  }
}

async function planCue(cue) {
  const requestId = ++currentRequest;
  pendingPlanController?.abort();
  pendingPlanController = null;
  currentCue = cue;
  currentSiGML = null;
  planning = true;
  if (!cue.text.trim()) {
    planning = false;
    resumeAfterStop = false;
    stopAvatar();
    setStatus('No English caption at the current video time.');
    return;
  }

  setStatus('Preparing experimental BSL for the current English caption…');
  const controller = new AbortController();
  pendingPlanController = controller;
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: cue.text,
        language: 'en',
        sign_language: 'bsl',
        reviewed_only: true,
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Kozha planning failed (HTTP ${response.status}).`);
    const plan = await response.json();
    if (requestId !== currentRequest) return;
    if (plan.error) throw new Error(String(plan.error));
    const output = buildSiGML(plan);
    currentSiGML = output.sigml;
    planStats = { fingerspelled: output.fingerspelled, omitted: output.omitted };
    if (!currentSiGML) {
      const omitted = planStats.omitted ? ` ${planStats.omitted} word(s) were omitted.` : '';
      setStatus(`Kozha found no playable BSL signs for this English caption.${omitted}`);
      return;
    }
    if (playing) playAvatar();
    else setStatus('Experimental BSL is ready. Press Play to animate this caption.');
  } catch (error) {
    if (requestId !== currentRequest) return;
    stopAvatar();
    setStatus(error.name === 'AbortError'
      ? 'Kozha took too long to prepare this BSL caption.'
      : error.message, 'error');
  } finally {
    clearTimeout(timeout);
    if (requestId === currentRequest) {
      pendingPlanController = null;
      planning = false;
    }
  }
}

function handleMessage(event) {
  if (!parentOrigin || event.origin !== parentOrigin || event.source !== window.parent) return;
  const message = event.data;
  if (message?.channel !== 'fidel-kozha') return;

  if (message.type === 'init') {
    captionLanguage = String(message.language || 'en');
    unavailableCaptionMessage = String(message.unavailableMessage || '');
    if (captionLanguage !== 'en') {
      currentRequest += 1;
      pendingPlanController?.abort();
      pendingPlanController = null;
      currentCue = null;
      currentSiGML = null;
      playing = false;
      resumeAfterStop = false;
      stopAvatar();
      showUnsupportedCaptionStatus();
      return;
    }
    if (!Number.isInteger(message.cueCount) || message.cueCount === 0) {
      setStatus('No English captions are available for BSL output.');
    }
    return;
  }
  if (message.type === 'cue') {
    captionLanguage = String(message.language || captionLanguage);
    if (captionLanguage !== 'en') {
      currentRequest += 1;
      pendingPlanController?.abort();
      pendingPlanController = null;
      currentCue = null;
      currentSiGML = null;
      playing = Boolean(message.playing);
      resumeAfterStop = false;
      stopAvatar();
      showUnsupportedCaptionStatus();
      return;
    }
    playbackRate = Number(message.playbackRate) || 1;
    playing = Boolean(message.playing);
    const cue = { index: message.index, text: String(message.text || '') };
    if (currentCue?.index === cue.index && currentCue.text === cue.text && currentSiGML) {
      if (playing) playAvatar();
      else if (stopAvatar()) setStatus('Experimental BSL is ready. Press Play to animate this caption.');
    } else {
      planCue(cue);
    }
    return;
  }
  if (message.type === 'play') {
    if (captionLanguage !== 'en') {
      showUnsupportedCaptionStatus();
      return;
    }
    playing = true;
    if (currentSiGML) playAvatar();
    else if (currentCue && !planning) planCue(currentCue);
    return;
  }
  if (message.type === 'pause') {
    playing = false;
    resumeAfterStop = false;
    if (stopAvatar()) {
      if (captionLanguage === 'en') setStatus('Video paused. BSL output resumes with the video.');
      else showUnsupportedCaptionStatus();
    }
    return;
  }
  if (message.type === 'rate') {
    playbackRate = Number(message.playbackRate) || 1;
    if (currentSiGML && playing) {
      setStatus(`Video speed is ${playbackRate}×; avatar speed is approximate.`);
    }
    return;
  }
  if (message.type === 'ended') {
    playing = false;
    resumeAfterStop = false;
    if (stopAvatar()) {
      if (captionLanguage === 'en') setStatus('Video ended.');
      else showUnsupportedCaptionStatus();
    }
  }
}

function handleAvatarActive() {
  animationPending = false;
  avatarAnimating = true;
  if (stopAfterStart || !playing) {
    stopAfterStart = false;
    stopAvatar();
    return;
  }
  playingStatus();
}

function handleAvatarIdle() {
  avatarAnimating = false;
  if (stopPending) {
    stopPending = false;
    animationPending = false;
    requestedSiGML = null;
  }
  if (replacementPending) {
    replacementPending = false;
    return;
  }
  if (resumeAfterStop && playing && currentSiGML) {
    resumeAfterStop = false;
    playAvatar();
  }
}

async function start() {
  try {
    const requestedParent = params.get('parent');
    if (!requestedParent) throw new Error('The Fidel player origin was not provided.');
    parentOrigin = new URL(requestedParent).origin;
    window.addEventListener('message', handleMessage);
    // Tell the player the service answered (the avatar itself may take longer).
    // A separate message type, so it never replaces the player's own notices.
    window.parent.postMessage({ channel: 'fidel-kozha', type: 'kozha-alive' }, parentOrigin);

    if (!window.CWASA || typeof window.CWASA.addHook !== 'function') {
      throw new Error('The Kozha avatar engine did not load.');
    }
    window.CWASA.addHook('animactive', handleAvatarActive, 0);
    window.CWASA.addHook('animidle', handleAvatarIdle, 0);
    window.addEventListener('error', (event) => {
      if (!event.filename?.includes('/cwa/')) return;
      animationPending = false;
      avatarAnimating = false;
      stopPending = false;
      stopAfterStart = false;
      resumeAfterStop = false;
      replacementPending = false;
      requestedSiGML = null;
      setStatus(`The Kozha avatar encountered an animation error: ${event.message}`, 'error');
    });

    const avatarReady = new Promise((resolve, reject) => {
      // CWASA reports 'avatarready' after it first draws the avatar. Browsers
      // do not draw a cross-origin frame that is off screen (for example while
      // the learner reads further down the page), so a slow start is normal:
      // keep waiting instead of failing for good.
      const timeout = setTimeout(() => {
        setStatus('The avatar is still loading. It starts when the sign window is on screen.');
      }, 45000);
      window.CWASA.addHook('avatarready', () => {
        clearTimeout(timeout);
        resolve();
      }, 0);
      window.CWASA.init({
        useClientConfig: false,
        useCwaConfig: true,
        jasBase: new URL('/cwa/', location.origin).href,
        cwaBase: new URL('/cwa/', location.origin).href,
        avSettings: [{
          width: 640,
          height: 480,
          avList: 'avs',
          initAv: 'luna',
          ambIdle: true,
          allowFrameSteps: false,
          allowSiGMLText: false,
        }],
      });
      window.CWASA.ready?.catch((error) => {
        clearTimeout(timeout);
        reject(new Error(`CWASA initialization failed: ${error.message}`));
      });
    });
    await avatarReady;
    await loadDictionaries();
    const skipped = rejectedSigns ? ` ${rejectedSigns} invalid dictionary entries were skipped.` : '';
    setStatus(`Experimental BSL avatar ready. Sign accuracy and timing are not human-verified.${skipped}`);
    window.parent.postMessage({ channel: 'fidel-kozha', type: 'kozha-ready' }, parentOrigin);
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

start();
