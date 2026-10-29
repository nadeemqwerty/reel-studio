# Regional production revision

Status: implementation and automated E2E validation complete; listening and phone acceptance pending.

## Scope and decisions

Keep the existing English Move Zeroes command working. Add an opt-in regional
pipeline for the same canonical problem, initially `en-IN` and `hi-IN`. No
Instagram credentials, account integration, publishing, paid generation, or
uploads are part of this revision.

| Layer | Decision |
| --- | --- |
| Algorithm | Existing identity-bearing trace and deterministic motion remain the single source of truth. |
| Neutral style image | Render locally from the same visual component; no text, numerals, logos, captions or audio. No OpenArt call. |
| Shared motion | Cache one text/audio-free video segment per canonical scene, plus endpoint PNGs. Moving token bodies and pointer shapes are graphics, not generated logic. |
| Locale overlay | All numerals, indices, pointer letters, explanations, brand, CTA, captions and narration are locale-layer assets. Numerals follow the exact same token coordinates as the base. |
| Long narration | Keep every motion frame at original speed. Extend only the final static hold of a scene and record the canonical-to-locale frame mapping. No time stretching or truncation. |
| Narration | Optional isolated Python Kokoro-ONNX runtime, downloaded model with pinned hashes, entirely local synthesis. No old Windows demo voice fallback in the regional path. |
| Voice choices | `af_heart` for English, explicitly US-accented despite India distribution; `hf_alpha` for Hindi. Both require listening review. Hindi is an audition candidate, not certified studio-quality speech. |
| Captions | Generate complete short sentence/phrase audio units; record their actual sample boundaries. These are phrase-aligned captions, NOT fabricated word timestamps. |
| Font | Explicit Devanagari-capable font, checked before render; missing font fails rather than silently rendering tofu. Do not redistribute Windows fonts. |
| Reuse | Locale/voice/text changes must not invalidate shared visual segments; changes to geometry, trace, motion, renderer or encoding must invalidate them. |
| Output | `outputs/<problem>/regional/base` and independent locale directories, each with lifecycle/history, inputs, prompts (none for deterministic layers), versions, hashes and review status. |

## Flow

```text
problem brief -> canonical trace -> all-frame logic checks
                                   |
                         text-free style image
                                   |
                      cached neutral scene clips
                                   |
locale pack -> local neural speech -> measured phrase timing
                                   |
                    scene duration + final-hold map
                                   |
             shared clips + exact-coordinate text overlays
                                   |
               voice + burned captions + SRT/VTT
                                   |
         encoded checks + critic evidence + human-review gate
```

Use real cached base clips in localized renders, not merely a repeated
background drawing. Store one last-frame PNG for clean extension holds. Verify
that overlays and base use the same frame and coordinate functions, including
mid-swap and the first/last frame of holds.

This is not arbitrary AI-clip stitching. Canonical scene boundaries already have
matching algorithm states. Deliberate teaching cards can change at a cut; token
teleportation, duplicated frames at a moving boundary and audio discontinuities
are defects. Long translated scenes are supported by endpoint holds, not by
asking a video model to exceed its duration limit.

## Plan and acceptance matrix

| Step | Work | Acceptance evidence |
| --- | --- | --- |
| 1 | Independent plan critic; reconcile findings here | Findings, decisions and deferred items recorded before implementation |
| 2 | Separate neutral drawing and regional text | DOM/render-level no-text assertion; base has no audio; inspect encoded base |
| 3 | Locale packs and timeline mapping | Reject missing/unsupported translations; input/challenge not changed; stable IDs and exact motion frame parity |
| 4 | Local neural narration adapter | Verify dependency/model hashes, English and Hindi WAVs, non-silent finite audio, real phrase timestamps and no silent fallback |
| 5 | Shared cache and lifecycle | Same base hashes reused across locales; voice/text changes affect only correct outputs; corrupt cache rejected; failures cannot leave a publishable record |
| 6 | Two full regional exports | 1080x1920/30fps, expected duration, audio and burned captions; SRT/VTT; frame evidence around every swap and extension seam |
| 7 | Regression and critic reconciliation | Legacy tests/command still work; timing/overflow/font/locale/cache negative tests; final findings tracked |

Automation can verify structure, timing, hashes and decoded media. It cannot
certify Hindi pronunciation, naturalness, teaching clarity or phone readability.
Publication remains blocked pending native-language listening and phone review.

## Narration research and costs

- [Kokoro model card](https://huggingface.co/hexgrad/Kokoro-82M):
  Apache-2.0 weights; preserve the model card's notices.
- [Voice inventory](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md):
  English `af_heart` is graded A; Hindi voices are graded C by the publisher.
  These are publisher estimates, not our listening results.
- [Kokoro-ONNX](https://github.com/thewh1teagle/kokoro-onnx):
  MIT runtime wrapper, Python 3.13 supported.
- Use release `model-files-v1.1`, model `kokoro-v1.0.onnx` (325,505,369 bytes,
  SHA256 `beb0d1848dee9a49da392cc3df26958d46cfa35d321edf434f52949153f0df3a`)
  and `voices-v1.0.bin` (28,214,398 bytes,
  SHA256 `bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d`).
- Downloads are explicit setup, never a hidden build side effect. Runtime is
  isolated in `.cache`; do not modify the system Python environment.
- One-time model download: approximately 354 MB, plus Python dependencies.
  Disk/render time depends on machine; report measured E2E time, not a promise.
- External generation credits: zero. No OpenArt assets are needed.
- Rejected first Piper Hindi candidate: the pratham model card cites a
  CC-BY-NC-SA dataset, unsuitable as the default for this monetized project.

## Critic and implementation tracking

Independent GPT critic reviewed this plan and the existing implementation before
implementation. All seven findings were accepted:

| Finding | Resolution / required check |
| --- | --- |
| 1. Speech/action mismatch | Step narration is retrospective and starts only after pointer completion: 2.1s for zero, 4.6s for non-zero. Non-step speech starts at 0.4s. Reject an earlier semantic start. |
| 2. Removing text removes motion | Add moving token bodies and graphical pointer markers. Shared geometry supplies both bodies and numerals; preserve fractional-pointer prefix-highlight behavior. Test every frame, duplicates, self-swaps and negatives. |
| 3. Unbounded holds / 60s ambiguity | The existing target remains canonical duration. Regional delivery may extend each scene by at most 6s and the complete pilot to at most 90s. Exact delivery targets, if supplied, must match after measurement. Last-scene audio gets the same 0.2s tail guard. |
| 4. Incomplete localization / readability | Closed, validated locale packs contain every teaching string. Explicit Latin digits and `w`/`r`/Big-O notation in both locales; brand remains a proper name. Download pinned OFL Noto Sans Devanagari, check cmap coverage and Chromium text overflow; maximum two caption lines, 65 graphemes, 24 graphemes/s, 0.8s minimum cue. Native shaping still gets visual review. |
| 5. Incomplete cache keys | Separate neutral, speech and composite fingerprints. Include renderer/motion/style, ordered IDs/values, encoding/browser versions; speech includes actual dependency inventory, provider code, model/voice hashes and settings; localized output includes font, text, timing and every referenced media hash. Verify cached artifact hashes before reuse. |
| 6. Weak encoded checks | Reject any base audio stream; assert the neutral component has no text nodes. Use the decoded last base frame for holds. Save encoded action/hold/cut endpoint evidence; compare base and localized unobscured pixels and hold seams with encoding tolerance. |
| 7. Failure / compatibility gaps | New lifecycle starts unapproved; record failure stage and retain history. Record exact reviewed hashes. Regional commands remain opt-in; old English build has no Python dependency. All generated assets and model files stay ignored. |

Full neural samples and final film remain unapproved until native listening and
phone checks. The critic did not claim to perform those checks.

## Implementation evidence and corrections

The independent critic reviewed the plan. Implementation reconciliation and
encoded-frame inspection are performed by the implementing agent; they are not
misrepresented as another independent review.

| Finding / check | Current evidence |
| --- | --- |
| Canonical versus localized motion | Same identity-bearing trace, coordinates and canonical-frame mapping; frame-conservation and extended-hold tests pass |
| Speech synchronization | All 16 unique English/Hindi scripts synthesized locally; duplicate zero scenes share one WAV per voice; actual sample durations drive holds |
| Reading limits | Cue identity/order, minimum duration, reading budget, tail and duration-cap tests pass |
| Font failures | Real Python cmap check rejects an unsupported glyph; full pilot strings pass the pinned font check |
| Browser layout | An early audit saw a zero-width canvas; explicit 1080x1920 sizing fixed it. A normal title passes and an intentionally oversized title is rejected in Chromium |
| Motion presentation | Encoded swap sheets exposed fixed annotations drawing over moving tiles. Shared geometry now temporarily occludes covered labels/markers without moving their logical positions; a regression test covers the crossing and restoration |
| Cache separation | Neutral renderer source is separate from localized typography; neutral clips, speech and final exports have separate fingerprints |
| Corruption / failure | Corrupt cache bytes and interrupted cache manifests are rejected; failure-after-approved-lifecycle test clears acceptance and retains history |
| Legacy path | Original narrated and silent English build completed successfully without depending on the optional neural pipeline |
| Automated suite | 18 tests pass with `REEL_NEURAL_TESTS=1`, including the installed-font integration check; default CI skips only that optional runtime check |
| Final encoded media / repeat reuse | Both complete exports pass; 47 decoded boundary checks per locale; repeat build reuses all nine neutral clips, all speech and both final MP4s |
| Longer-video overview | Review sampling now spans the actual duration, rather than omitting the Hindi closing card after 60 seconds |

No certificate checks were disabled during setup. The installer respects the
machine's configured package feed rather than hardcoding a private or public
registry. The dependency manifest and model/font hashes remain public-safe.

## Delivered pilot and measured resources

| Asset | Duration | Audio | Text |
| --- | --- | --- | --- |
| Neutral master | 60.00s | None | None, including no numerals or pointer letters |
| English-India | 61.20s | Local Kokoro `af_heart`, US accent | English teaching layer and captions |
| Hindi-India | 64.77s | Local Kokoro `hf_alpha`, provisional quality | Hindi teaching layer and captions |

- Corrected visual build: **1,126.3 seconds (18.8 minutes)** on this machine,
  using two rendering workers and already-cached speech. This includes nine
  neutral clips, both localized renders, keyframes and encoded review evidence.
- Repeat build: **134.8 seconds (2.25 minutes)**. All nine shared clips, narration
  and both final videos were reused; evidence generation and checks still ran.
- Sixteen unique local audio clips serve eighteen scene instances across the
  two locales. Phrase-boundary amplitude was at most about -70.3 dBFS.
- Encoded audio peaks: English -4.2 dBFS; Hindi -6.7 dBFS. These checks do not
  establish perceived naturalness or native-language pronunciation.
- Each locale passed 47 encoded boundary/reference checks. Maximum sampled
  neutral-body pixel error was about 1.12 on an 8-bit channel scale, below the
  encoding-tolerance threshold of 12.
- Downloaded model/voices: approximately 354 MB, plus optional Python
  dependencies and the open font. CPU synthesis requires no GPU.
- OpenArt/TTS API credits consumed for this revision: **zero**. Local compute
  and agent use are not represented as free.

The local `outputs/<id>/regional/verification.json` contains exact final hashes
and reuse results. Locale lifecycle records retain the brief, scripts, model and
dependency inventory, font and media hashes, timing map, evidence and review
status. Sampled agent visual review covered the neutral overview, English swap,
Hindi overview/swap and final challenge; it is not native listening or a phone
test. Both locale exports remain `publishable: false`.

No Instagram account integration or publishing was performed. Source changes
remain local until a separate commit/push is authorized.
