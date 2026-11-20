/**
 * EthASL (Ethiopian/Amharic Sign Language) Avatar Frame — Kozha Edition
 *
 * Uses the same Kozha CWASA 3D avatar as the BSL frame.
 * Amharic caption text is translated to English glosses first,
 * then sent through Kozha's /api/plan endpoint for SiGML generation.
 *
 * Translation: Amharic words → English equivalents via a word map.
 * Words not in the map are romanised (transliterated) letter-by-letter
 * so the BSL fingerspelling alphabet renders them visually.
 *
 * Dataset attribution: Amharic Sign Language Data Sets (DOI 10.17632/5d3nkyhsrf.1)
 * CC BY 4.0 — Isayas Feyera, Addis Ababa Sci & Tech Univ.
 */

'use strict';

// ---------------------------------------------------------------------------
// Amharic → English word translation table
// Common Amharic words translated to natural English equivalents for BSL planning.
// ---------------------------------------------------------------------------
const AM_TO_EN = {
  // Greetings & basics
  'ሰላም':     'hello',
  'ሰላምታ':   'greeting',
  'አዎ':      'yes',
  'አይ':      'no',
  'አይደለም':  'no',
  'እባክህ':   'please',
  'እባክሽ':   'please',
  'አመሰግናለሁ': 'thank you',
  'ይቅርታ':   'sorry',
  'ደህና':    'fine',
  'ጤና':     'health',

  // Questions
  'ምን':     'what',
  'ማን':     'who',
  'መቼ':     'when',
  'የት':     'where',
  'ለምን':    'why',
  'እንዴት':  'how',
  'እንደምን': 'how',
  'ስንት':    'how many',

  // People & family
  'እኔ':     'i',
  'አንተ':    'you',
  'እሱ':     'he',
  'እሷ':     'she',
  'እኛ':     'we',
  'እነሱ':    'they',
  'ሰው':     'person',
  'ሰዎች':   'people',
  'ልጅ':     'child',
  'ልጆች':   'children',
  'ቤተሰብ':  'family',
  'እናት':   'mother',
  'አባት':   'father',
  'ወንድም':  'brother',
  'እህት':   'sister',
  'ጓደኛ':   'friend',
  'አዋቂ':   'adult',
  'ወጣት':   'young',

  // Education
  'ትምህርት': 'education',
  'ትምህርት ቤት': 'school',
  'ተማሪ':   'student',
  'መምህር':  'teacher',
  'መጽሐፍ':  'book',
  'ትምህርቤት': 'school',
  'ሥራ':    'work',
  'ቴክኖሎጂ': 'technology',
  'ኮምፒውተር': 'computer',
  'ስልክ':   'phone',
  'ኢንተርኔት': 'internet',

  // Places & things
  'ቤት':    'home',
  'ቤቶች':  'houses',
  'ሀገር':   'country',
  'ከተማ':  'city',
  'ሆስፒታል': 'hospital',
  'ገበያ':   'market',
  'ፕሮግራም': 'program',
  'ስብሰባ':  'meeting',

  // Actions
  'መሄድ':   'go',
  'ሄደ':    'went',
  'ሂድ':    'go',
  'መምጣት':  'come',
  'ተቀመጥ':  'sit',
  'ቆም':    'stop',
  'ማየት':   'see',
  'ማድረግ':  'do',
  'ማለት':   'mean',
  'ማወቅ':   'know',
  'ማስተማር': 'teach',
  'መማር':   'learn',
  'ማውራት':  'talk',
  'ማዳመጥ':  'listen',
  'ማንበብ':  'read',
  'መፃፍ':   'write',
  'መረዳት':  'understand',
  'መርዳት':  'help',
  'ጀምር':   'start',
  'ጨርስ':   'finish',
  'ፍጠን':   'fast',
  'ቀስ':    'slow',

  // Descriptors
  'ጥሩ':    'good',
  'ጥሩ ነው': 'good',
  'መጥፎ':   'bad',
  'ትልቅ':   'big',
  'ትንሽ':   'small',
  'አዲስ':   'new',
  'አሮጌ':   'old',
  'ፈጣን':   'fast',
  'ቀርፋፋ': 'slow',
  'ቀላል':   'easy',
  'ከባድ':   'difficult',
  'ሁሉ':    'all',
  'ሁሉም':   'everyone',
  'አሁን':   'now',
  'ዛሬ':    'today',
  'ነገ':    'tomorrow',
  'ትናንት':  'yesterday',
  'ዓመት':  'year',
  'ወር':    'month',
  'ቀን':    'day',
  'ሰዓት':   'time',
  'ቁጥር':   'number',
  'ቋንቋ':   'language',
  'ምልክት':  'sign',
  'ስም':    'name',

  // Common connectors
  'እና':    'and',
  'ወይም':   'or',
  'ስለ':    'about',
  'ወደ':    'to',
  'ከ':     'from',
  'በ':     'in',
  'ላይ':    'on',
  'ውስጥ':   'inside',
  'ጋር':    'with',
  'ያለ':    'without',
  'የ':     'of',
  'ነው':    'is',
  'ናቸው':   'are',
  'ነበር':   'was',
  'ይሆናል':  'will',
  'አለ':    'there is',
  'የለም':   'there is not',
  'ምክንያቱም': 'because',
  'ስለዚህ':  'therefore',

  // ALX / tech specific
  'ተደራሽ':  'accessible',
  'ተደራሽነት': 'accessibility',
  'አካል ጉዳተኛ': 'disability',
  'ዲጂታል': 'digital',
  'ትምህርት ፕሮግራም': 'training program',
  'ሥልጠና':  'training',
  'ዕድል':   'opportunity',
  'ሙያ':    'career',
  'ሥራ ፈጣሪ': 'entrepreneur',
  'ማህበረሰብ': 'community',
  'ፕሮጄክት': 'project',
  'ቡድን':   'team',
  'ቀን ተቀን': 'daily',
  'ምርት':   'product',
  'ፈጠራ':  'innovation',
};

// ---------------------------------------------------------------------------
// Ethiopic script romanisation for fingerspelling fallback
// Maps Ethiopic syllable codepoints → closest Latin letter(s)
// so the BSL fingerspelling alphabet can render them.
// ---------------------------------------------------------------------------
const ETHIOPIC_ROMAN = {
  // ሀ series
  '\u1200':'h','\u1201':'hu','\u1202':'hi','\u1203':'ha','\u1204':'he','\u1205':'h','\u1206':'ho',
  // ለ series
  '\u1208':'l','\u1209':'lu','\u120a':'li','\u120b':'la','\u120c':'le','\u120d':'l','\u120e':'lo',
  // ሐ series
  '\u1210':'h','\u1211':'hu','\u1212':'hi','\u1213':'ha','\u1214':'he','\u1215':'h','\u1216':'ho',
  // መ series
  '\u1218':'m','\u1219':'mu','\u121a':'mi','\u121b':'ma','\u121c':'me','\u121d':'m','\u121e':'mo',
  // ሠ series
  '\u1220':'s','\u1221':'su','\u1222':'si','\u1223':'sa','\u1224':'se','\u1225':'s','\u1226':'so',
  // ረ series
  '\u1228':'r','\u1229':'ru','\u122a':'ri','\u122b':'ra','\u122c':'re','\u122d':'r','\u122e':'ro',
  // ሰ series
  '\u1230':'s','\u1231':'su','\u1232':'si','\u1233':'sa','\u1234':'se','\u1235':'s','\u1236':'so',
  // ሸ series
  '\u1238':'sh','\u1239':'shu','\u123a':'shi','\u123b':'sha','\u123c':'she','\u123d':'sh','\u123e':'sho',
  // ቀ series
  '\u1240':'q','\u1241':'qu','\u1242':'qi','\u1243':'qa','\u1244':'qe','\u1245':'q','\u1246':'qo',
  // በ series
  '\u1260':'b','\u1261':'bu','\u1262':'bi','\u1263':'ba','\u1264':'be','\u1265':'b','\u1266':'bo',
  // ቸ series
  '\u1278':'ch','\u1279':'chu','\u127a':'chi','\u127b':'cha','\u127c':'che','\u127d':'ch','\u127e':'cho',
  // ነ series
  '\u1290':'n','\u1291':'nu','\u1292':'ni','\u1293':'na','\u1294':'ne','\u1295':'n','\u1296':'no',
  // ኘ series
  '\u1298':'ny','\u1299':'nyu','\u129a':'nyi','\u129b':'nya','\u129c':'nye','\u129d':'ny','\u129e':'nyo',
  // አ series
  '\u12a0':'a','\u12a1':'u','\u12a2':'i','\u12a3':'a','\u12a4':'e','\u12a5':'a','\u12a6':'o',
  // ከ series
  '\u12a8':'k','\u12a9':'ku','\u12aa':'ki','\u12ab':'ka','\u12ac':'ke','\u12ad':'k','\u12ae':'ko',
  // ወ series
  '\u12c8':'w','\u12c9':'wu','\u12ca':'wi','\u12cb':'wa','\u12cc':'we','\u12cd':'w','\u12ce':'wo',
  // ዐ series
  '\u12d0':'a','\u12d1':'u','\u12d2':'i','\u12d3':'a','\u12d4':'e','\u12d5':'a','\u12d6':'o',
  // ዘ series
  '\u12d8':'z','\u12d9':'zu','\u12da':'zi','\u12db':'za','\u12dc':'ze','\u12dd':'z','\u12de':'zo',
  // የ series
  '\u12e8':'y','\u12e9':'yu','\u12ea':'yi','\u12eb':'ya','\u12ec':'ye','\u12ed':'y','\u12ee':'yo',
  // ደ series
  '\u12f0':'d','\u12f1':'du','\u12f2':'di','\u12f3':'da','\u12f4':'de','\u12f5':'d','\u12f6':'do',
  // ጀ series
  '\u1300':'j','\u1301':'ju','\u1302':'ji','\u1303':'ja','\u1304':'je','\u1305':'j','\u1306':'jo',
  // ገ series
  '\u1308':'g','\u1309':'gu','\u130a':'gi','\u130b':'ga','\u130c':'ge','\u130d':'g','\u130e':'go',
  // ጠ series
  '\u1320':'t','\u1321':'tu','\u1322':'ti','\u1323':'ta','\u1324':'te','\u1325':'t','\u1326':'to',
  // ጨ series
  '\u1328':'ch','\u1329':'chu','\u132a':'chi','\u132b':'cha','\u132c':'che','\u132d':'ch','\u132e':'cho',
  // ፈ series
  '\u1348':'f','\u1349':'fu','\u134a':'fi','\u134b':'fa','\u134c':'fe','\u134d':'f','\u134e':'fo',
  // ፐ series
  '\u1350':'p','\u1351':'pu','\u1352':'pi','\u1353':'pa','\u1354':'pe','\u1355':'p','\u1356':'po',
};

/**
 * Tokenise Amharic text into words (split on spaces + Ethiopic punctuation).
 */
function tokenizeAmharic(text) {
  return text
    .replace(/[\u1361\u1362\u1363\u1364\u1365\u1366\u1367\u1368]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Romanise a single Amharic word to Latin characters for BSL fingerspelling.
 * Each Ethiopic syllable is mapped to its closest Latin equivalent.
 */
function romaniseWord(word) {
  let roman = '';
  for (const ch of word) {
    const r = ETHIOPIC_ROMAN[ch];
    if (r) roman += r;
    else if (/[a-zA-Z0-9]/.test(ch)) roman += ch;
    // Skip punctuation / unknown chars silently
  }
  return roman;
}

/**
 * Translate Amharic caption text to an English gloss string for Kozha/BSL planning.
 * 1. Look up each word in AM_TO_EN for a natural English equivalent.
 * 2. Fall back to Latin romanisation so BSL fingerspelling covers unknown words.
 */
function translateToEnglish(amharicText) {
  const tokens = tokenizeAmharic(amharicText);
  const english = [];
  for (const token of tokens) {
    // Strip trailing Ethiopic punctuation
    const clean = token.replace(/[\u1361-\u1368.,!?;:]/g, '').trim();
    if (!clean) continue;
    const translated = AM_TO_EN[clean];
    if (translated) {
      english.push(translated);
    } else {
      // Romanise for fingerspelling
      const roman = romaniseWord(clean);
      if (roman) english.push(roman);
    }
  }
  return english.join(' ');
}

// ---------------------------------------------------------------------------
// From here: same state machine as frame.js but adapted for Amharic input
// ---------------------------------------------------------------------------

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
let captionLanguage = 'am';
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
    loadSigML('/data/hamnosys_bsl_version1.sigml', signs, (v) => v.toLowerCase()),
    loadSigML('/data/bsl_alphabet_sigml.sigml', alphabet, (v) => v.toUpperCase()),
  ]);
  for (const [gloss, sigml] of signs) {
    const base = glossBase(gloss);
    if (base && !baseGloss.has(base)) baseGloss.set(base, sigml);
  }
  if (signs.size === 0 || alphabet.size === 0) {
    throw new Error('The BSL sign dictionary or alphabet is empty.');
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
    setStatus('The avatar could not be stopped safely.', 'error');
    return false;
  }
  if (stopPending) return true;
  if (replacementPending) { stopAfterStart = true; return true; }
  if (animationPending) stopAfterStart = true;
  if (!avatarAnimating) return true;
  try {
    stopPending = true;
    window.CWASA.stopSiGML(0);
    return true;
  } catch (error) {
    stopPending = false;
    setStatus(`The avatar could not be stopped: ${error.message}`, 'error');
    return false;
  }
}

function playingStatus() {
  const fallback = [];
  if (planStats.fingerspelled) fallback.push(`${planStats.fingerspelled} word(s) fingerspelled`);
  if (planStats.omitted) fallback.push(`${planStats.omitted} word(s) omitted`);
  const details = fallback.length ? ` ${fallback.join('; ')}.` : '';
  setStatus(`Ethiopian Sign Language avatar playing at video speed ${playbackRate}×.${details}`);
}

function showUnsupportedCaptionStatus() {
  const fallback = captionLanguage === 'off'
    ? 'Turn on Amharic captions to use the Ethiopian Sign Language avatar.'
    : 'The Ethiopian Sign Language avatar supports Amharic captions only.';
  setStatus(unavailableCaptionMessage || fallback);
}

function playAvatar() {
  if (!currentSiGML) {
    setStatus('No playable signs were found for this Amharic caption.');
    return;
  }
  if (!playing) {
    setStatus('Ethiopian Sign Language avatar is ready. Press Play to animate this caption.');
    return;
  }
  if (stopPending) { resumeAfterStop = true; return; }
  stopAfterStart = false;
  if (requestedSiGML === currentSiGML && (animationPending || avatarAnimating)) return;
  if (typeof window.CWASA?.playSiGMLText !== 'function') {
    setStatus('The avatar is not ready to play.', 'error');
    return;
  }
  try {
    if (avatarAnimating) replacementPending = true;
    animationPending = true;
    requestedSiGML = currentSiGML;
    window.CWASA.playSiGMLText(currentSiGML, 0);
    setStatus('Preparing Ethiopian Sign Language animation…');
  } catch (error) {
    animationPending = false;
    requestedSiGML = null;
    setStatus(`The avatar could not play this caption: ${error.message}`, 'error');
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
    setStatus('No Amharic caption at the current video time.');
    return;
  }

  // Translate Amharic → English for Kozha planning
  const englishText = translateToEnglish(cue.text);
  if (!englishText.trim()) {
    planning = false;
    stopAvatar();
    setStatus('Could not translate this Amharic caption to signs.');
    return;
  }

  setStatus('Preparing Ethiopian Sign Language for the current caption…');
  const controller = new AbortController();
  pendingPlanController = controller;
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: englishText,
        language: 'en',
        sign_language: 'bsl',
        reviewed_only: true,
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Sign planning failed (HTTP ${response.status}).`);
    const plan = await response.json();
    if (requestId !== currentRequest) return;
    if (plan.error) throw new Error(String(plan.error));
    const output = buildSiGML(plan);
    currentSiGML = output.sigml;
    planStats = { fingerspelled: output.fingerspelled, omitted: output.omitted };
    if (!currentSiGML) {
      const omitted = planStats.omitted ? ` ${planStats.omitted} word(s) were omitted.` : '';
      setStatus(`No playable signs found for this Amharic caption.${omitted}`);
      return;
    }
    if (playing) playAvatar();
    else setStatus('Ethiopian Sign Language avatar is ready. Press Play to animate this caption.');
  } catch (error) {
    if (requestId !== currentRequest) return;
    stopAvatar();
    setStatus(error.name === 'AbortError'
      ? 'Sign planning took too long for this caption.'
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
    captionLanguage = String(message.language || 'am');
    unavailableCaptionMessage = String(message.unavailableMessage || '');
    if (captionLanguage !== 'am') {
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
      setStatus('No Amharic captions are available for Ethiopian Sign Language output.');
    }
    return;
  }

  if (message.type === 'cue') {
    captionLanguage = String(message.language || captionLanguage);
    if (captionLanguage !== 'am') {
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
      else if (stopAvatar()) setStatus('Ethiopian Sign Language avatar is ready. Press Play to animate this caption.');
    } else {
      planCue(cue);
    }
    return;
  }

  if (message.type === 'play') {
    if (captionLanguage !== 'am') { showUnsupportedCaptionStatus(); return; }
    playing = true;
    if (currentSiGML) playAvatar();
    else if (currentCue && !planning) planCue(currentCue);
    return;
  }

  if (message.type === 'pause') {
    playing = false;
    resumeAfterStop = false;
    if (stopAvatar()) {
      if (captionLanguage === 'am') setStatus('Video paused. EthSL output resumes with the video.');
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
      if (captionLanguage === 'am') setStatus('Video ended.');
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
  if (replacementPending) { replacementPending = false; return; }
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
      setStatus(`The avatar encountered an animation error: ${event.message}`, 'error');
    });

    const avatarReady = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('The avatar did not become ready.')), 45000);
      window.CWASA.addHook('avatarready', () => { clearTimeout(timeout); resolve(); }, 0);
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
    setStatus(`Ethiopian Sign Language avatar ready. Output is not human-verified.${skipped}`);
    window.parent.postMessage({ channel: 'fidel-kozha', type: 'kozha-ready' }, parentOrigin);
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

start();
