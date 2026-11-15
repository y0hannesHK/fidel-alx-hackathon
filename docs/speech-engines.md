# Optional Amharic speech engines: how they were tested

Fidel can run two optional engines next to the server (see README,
"Optional Amharic speech engines"). This page records how they were chosen and
measured, on CPU only, on 14 Nov 2026.

**Test machine:** Intel Core i5-12500H laptop, Windows 11, Docker Desktop
(Linux VM with 16 threads and 8 GB RAM). No GPU.

## Results

| | ToucanTTS (Amharic voice) | Omnilingual ASR CTC 300M v2 (speech to text) |
|---|---|---|
| Runs on CPU | Yes | Yes, with fairseq2's CPU build of `fairseq2n` |
| Docker image | 1.8 GB | 1.75 GB |
| Model download | 0.33 GB (`ToucanTTS.pt` + `Vocoder.pt`) | 1.3 GB |
| Peak RAM | 1.4 GB | 2.9 GB |
| Model load | 4.5 s | 11.5 s |
| Speed (seconds of work per second of audio) | 0.81 | 0.22 (float32) |
| Quality | Must be judged by Amharic speakers | English check: about 8% character error rate. Amharic: no reference text yet |

## Speech to text: Omnilingual ASR

### English sanity check

The audio was the first 30 seconds of the demo lesson. The model was not told
the language.

| | Text |
|---|---|
| Reference (hand-corrected captions) | That we see where we have been more reachable, and we have been more accessible when it comes to the demography that currently are directly accessing our programs. One thing to understand is we need also to increase participants from other demographics. This includes people with disability |
| Omnilingual | that we see we have been more reachavel and we have been more accessible when it comes to the demographies that currently are directly accessing our programmes but one thing we understand is we need also to increase participant from other demographies thise includes peoples with disability |

- **Character error rate:** 8.4%.
- **No punctuation or capitals:** the model writes neither.
- **Spelling:** a few words are spelled by sound ("reachavel", "thise").

### Amharic clip

The clip is 20 seconds long. The output is all in Ethiopic script, with no
other language mixed in.

- **Numbers:** one number came out half-converted: "በ2አ5ት".
- **Accuracy:** an Amharic-speaking team member watched the clip with these
  captions (15 Nov 2026) and found them good. A measured error rate still
  needs a reviewed transcript (see BACKLOG).

### Points that matter for Fidel

- **Use float32 on CPU.** The library's default, bfloat16, gave the same text
  but was **20× slower** (RTF 4–5). The engine always uses float32.
- **Audio length.** The model accepts at most 40 s of audio. The engine cuts
  longer audio into pieces of up to 25 s, at the quietest moment between
  words.
- **Word timings.** Word times come from the model's own frames: it writes one
  letter-piece per 20 ms. Fidel builds caption cues from those words, as it
  does for Whisper. Because there is no punctuation, a pause of 0.6 s or more
  also ends a cue.
- **Installation problems found and solved:**
  - kenlm must be compiled. The image builds it in a separate stage, so the
    compiler is not in the final image.
  - The `fairseq2n` on PyPI only works with CUDA, so fairseq2's CPU build is
    used instead.

## Voice: ToucanTTS

**Test lines:** five lines from the demo's Amharic captions: a short one, a
long one, two medium ones, and one with "ALX" in it.

**Recordings for listening:** in `data/model-tests/outputs/toucan/`. They are
git-ignored, so they are on the computer that ran the test only.

**Things for Amharic speakers to judge:**
- **Ejectives.** espeak-ng writes ejectives (ጵ ቀ ጥ ጠ ቅ) as `k\``, and
  Toucan drops the backtick. By default, ejectives are therefore read as plain
  p/k/t. `TOUCAN_EJECTIVE_MARK=1` passes the IPA ejective mark instead.
  Compare `amh_*.wav` with `amh_*_ejectivefix.wav`.
- **"ALX".** It is read with English sounds ("alks").

**What is loaded:** only the two Flux9665/ToucanTTS files. Two other models
are deliberately not used:
- Toucan's speaker-matching model (speechbrain, another publisher) is replaced
  by a stub.
- **Somali is not offered.** It would need Transphone, a model from another
  publisher.

## Afaan Oromo

- **Voice.** Toucan reads Afaan Oromo (`gaz`, West Central Oromo) with
  espeak-ng's Oromo rules, so Transphone is not needed. Afaan Oromo is not in
  Toucan's training recordings, so the voice is a best guess from similar
  languages. Samples are in `data/model-tests/outputs/toucan-oromo/`.
- **Speech to text.** Omnilingual ASR lists `orm_Latn`, so Afaan Oromo lessons
  are sent to it (`FIDEL_OMNIASR_LANGUAGES=am,om`). This is untested: there
  is no Oromo test clip yet.

## Why the Amharic voice is not clear, and what would fix it

A team member listened (15 Nov 2026): the accent is not clear and some words
are swallowed. Speaking more slowly helps a little
(`TOUCAN_DURATION_SCALE`). The main cause is the step that turns letters into
sounds (espeak-ng):
- **The ɨ vowel.** It adds ɨ after almost every sixth-order letter (ስ, ት, ክ),
  where speakers often say no vowel. For example, ካስታጠቅህ becomes
  "kasɨtat'ək'ɨx".
- **Doubled consonants.** It cannot know gemination, because Amharic writing
  does not mark it.

Real fixes, best first:
1. **Recordings by people.** Fidel already supports them, and they always
   replace the machine voice.
2. **Better rules for letters to sounds.** Write Amharic rules for when ɨ is
   said, checked by a speaker. Toucan accepts sounds directly.
3. **Fine-tune Toucan.** Train it on a few hours of one clear Amharic voice
   (needs a GPU and recordings with permission).
4. **Another engine.** Meta's MMS Amharic voice is CC-BY-NC, which Fidel does
   not allow. Cloud voices would be opt-in only, because the text leaves the
   server.

## Licences

All code and models are Apache-2.0. Two parts need attention:
- **The voice engine's image contains GPL-3.0 programs** (eSpeak NG,
  phonemizer, Parselmouth). That is why it is a separate, optional container.
  See [LICENSES.md](../LICENSES.md).
- **Omnilingual ASR's install pulls in KenLM (LGPL)**, which is not used for
  our transcription.

## End-to-end check in Fidel

Both engines and a Fidel server were run on a private Docker network, and the
20-second Amharic clip was uploaded as a lesson with spoken language Amharic.

1. **Pipeline.** It produced `captions-am.vtt` with 3 timed cues (draft).
2. **Voice.** An Amharic description was saved, and "Make machine-read
   recording" was pressed. It made `desc-am-1000.opus` and the
   `desc-am-1000.machine` marker, and Studio showed "Machine-read recording
   attached".

Tests: `server/tests/test_speech_engines.py`, which uses fake engines, so it
runs without the models.
