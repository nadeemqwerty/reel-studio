# Reel Studio

**An agent-directed production skill and working deterministic video renderer.**
Make educational reels whose visual logic remains correct and understandable
without sound, with narration and readable subtitles as separate layers.

The first implemented example is a 60-second **Move Zeroes** interview refresh.
The repository is not yet a general-purpose video editor or a library of every
DSA pattern. It does not submit paid generations or publish videos automatically.

## What works

- A standard Copilot project skill in `.github/skills/reel-studio`.
- An executable algorithm trace with persistent object identities.
- Smooth, code-controlled value swaps and pointer movements: no generative video needed.
- Reusable hook, pointer explanation, complexity and closing components.
- Local neural English/Hindi narration for regional exports; Windows demo narration for the legacy path.
- Imported aligned narration for other platforms/providers.
- Burned-in subtitles plus SRT and WebVTT sidecars.
- Saved keyframes, lifecycle manifest, encoded review sheets, narrated and silent MP4s.
- Narration and final-video caching; explicit failure reporting and resumable rebuilds.
- Logical tests, every-frame motion checks, output metadata and full decode checks.
- Text/audio-free neutral scene clips reused by English-India and Hindi-India overlays.

**Zero OpenArt generation credits are needed for the example.** Local compute and
agent use are not free in an economic sense. External TTS may cost money if you
choose it; no TTS account or API key is required for the Windows demonstration.

## Regional production

For configurable formats, consistent terminology, watermarks and reusable
intro/outro assembly, use the [portable production workflow](docs/production-workflow.md):

```powershell
npm run studio -- doctor
npm run studio -- plan examples\production.json
npm run studio -- smoke examples\production.json
npm run studio -- build examples\production.json --only portrait:en-IN,landscape:hi-IN
npm run studio -- review examples\production.json
npm run studio -- package
```

The configuration supports portrait, landscape, square and 4:5 feed layouts,
both pilot locales, optional text/PNG watermarks and optional cached brand clips.
Without `--only`, build renders **all configured outputs**. The silent smoke
previews are diagnostics, not publishable lessons. Setup on a fresh machine:
`npm ci`, then `npm run studio -- setup --download-browser`. See the linked guide
for prerequisites, source-bundle migration, verification scope and limitations.

Use this path for the reusable multilingual workflow. The original English
workflow below remains available without Python.

```powershell
npm run setup
npm run regional:setup
npm run regional:build -- examples\move-zeroes.json examples\move-zeroes.locales.json
```

`regional:setup` explicitly installs the optional Python 3.10+ neural runtime into
`.cache/narration-env`, downloads approximately 354 MB of pinned model/voice
assets plus dependencies, and downloads a pinned OFL Devanagari font. It does not
modify system Python. Builds do not download models or send scripts to a service.
The current runtime was exercised with Python 3.13.

| Output under `outputs/<id>/regional/` | Meaning |
| --- | --- |
| `base/style.png` | Reusable neutral visual image, with no text, numbers or logos |
| `base/visual-master.mp4` | Canonical, text-free and audio-free motion master |
| `base/lifecycle.json` | Individual reusable clip references, hashes and checks |
| `en-IN/final.mp4`, `hi-IN/final.mp4` | Localized teaching overlays, neural narration and burned captions |
| `<locale>/silent.mp4` | Localized, readable video without an audio stream; NOT the neutral base |
| `<locale>/timeline.json` | Stable token states, source-clip references, caption timing and hold mapping |
| `<locale>/subtitles.srt`, `.vtt` | Actual phrase-aligned captions |
| `<locale>/review/` | Decoded swaps, scene/hold boundaries and full-frame evidence |
| `lifecycle.json`, `<locale>/lifecycle.json` | Current stage, failures, voice/model/font/dependency hashes, cost and review gates |

Local audio and neutral clips are content-addressed in `.cache/regional/public`.
Keep that cache to rebuild efficiently. A matching rebuild reuses verified clip,
speech and final-export bytes; verification/evidence still runs. Generated media,
timelines and history stay out of Git.

Only `en-IN` and `hi-IN` are implemented. To render one locale, append `en-IN` or
`hi-IN` to the regional build command. Both use Latin numerals and standard
`w`/`r`/Big-O notation. All other teaching text comes from the locale pack.
The shared brand is a proper name, not an automatic translation.

**Narration is a candidate, not an automatic studio-quality guarantee.** English
uses Kokoro `af_heart` (US accent, explicitly not an Indian accent); Hindi uses
`hf_alpha`, whose publisher reports more limited training data. Both run locally,
without API keys or generation credits. There is no silent fallback to the
robotic Windows voice. Native-language listening and phone review remain required.

Complete short utterances are synthesized separately. Caption times come from
their actual sample boundaries, not estimated word timings. No word highlighting
or forced alignment is claimed. Speech is not sped up to fit. Step narration
describes completed actions and starts after pointer movement; longer speech
extends only the decoded endpoint hold, at most 6 seconds per scene and 90 seconds
for the complete pilot. The original 60-second target describes the **canonical
motion**, not every regional delivery. Captions are limited to two lines and
checked for timing, reading budget and rendered overflow.

The neutral layer includes moving graphical token bodies and pointer markers.
Numerals use the same coordinates in a separate overlay. This is real reuse of
rendered clips, not a request for a video model to reconstruct algorithm logic.
Long videos have no generative clip-length limit.
Covered index/pointer annotations briefly hide behind moving tiles; their
positions do not change until the algorithm advances the pointer.

`npm test` does not require the optional Python runtime. After neural setup,
also exercise its missing-glyph integration check:

```powershell
$env:REEL_NEURAL_TESTS = '1'
npm test
```

See [the plan and independent-critic decisions](docs/regional-production-plan.md).
Instagram account integration, scheduling, uploading and publication are deferred.

## Legacy English quick start

Requirements: Node.js 20+, npm, a supported Chromium browser. On Windows the sample
also uses Windows PowerShell and an installed System.Speech voice.

```powershell
git clone https://github.com/nadeemqwerty/reel-studio.git
Set-Location reel-studio
npm ci
npm run setup
npm test
npm run check
npm run plan -- examples/move-zeroes.json
npm run build -- examples/move-zeroes.json
```

Setup detects common Chrome/Edge locations and verifies the project-local FFmpeg
binary installed by npm. It does not modify system Python, log in to services,
or change global Git settings.

For a custom browser:

```powershell
npm run setup -- --browser "C:\path\to\chrome.exe"
```

If you want Remotion to download its supported browser explicitly:

```powershell
npm run setup -- --download-browser
```

The full sample render is more expensive than unit tests; run it intentionally.
The default uses two rendering workers to bound local resource use.

### Use the skill

Open Copilot in this checkout and ask:

> Use the reel-studio skill to plan, produce and critically review the Move Zeroes example.

If added during an existing CLI session, use `/skills reload`, then
`/skills info reel-studio`. The skill is repository-local; this project does not
silently install global instructions or pre-approve shell permissions.

## Outputs and review

Everything generated is under `outputs/<project-id>/` and excluded from Git:

| Artifact | Purpose |
|---|---|
| `lifecycle.json` | Brief, algorithm checks, provider, keyframe hashes, cost and current review status |
| `history.jsonl` | Previous lifecycle snapshots retained before each new plan/build |
| `timeline.json` | Exact scenes, state trace, motion timing, audio hashes and caption timing |
| `narration.txt` | Scene-by-scene spoken script |
| `assets/audio/` | Cached WAV files and actual word timestamps |
| `keyframes/` | Before/mid/settled/pointer-complete images |
| `subtitles.srt`, `subtitles.vtt` | Aligned sidecar captions |
| `final.mp4` | Narrated 1080x1920, 30 fps, H.264/AAC video |
| `silent.mp4` | Same video without an audio track |
| `review/overview.png` | Sampled full-frame overview of the encoded export |
| `review/step-*-swap.png` | All 25 frames covering each 0.8-second swap and its boundary |
| `render-cache.json` | Source/configuration fingerprint and output hash |

```powershell
npm run review -- move-zeroes
```

**Passing automated checks is not publication approval.** Inspect the actual
export, watch the silent version, listen to narration, and check captions on a
phone. Record timestamps and findings under `review` in the lifecycle manifest.
Only mark it publishable after those reviews; generated outputs initially say
`awaiting-human-review`. A rebuild invalidates prior manual acceptance.

The motion sheet is exhaustive for swap windows, not every frame of the entire
video. Pure-code invariants check every algorithm-animation frame. Neither is
equivalent to independent human review of the final film.

## Narration options

### Windows offline demo

```powershell
npm run build -- examples/move-zeroes.json --voice "Microsoft David Desktop"
```

The voice is a practical offline demonstration, **not studio-quality TTS**.
The implementation records actual System.Speech word-start events; it does not
invent subtitle timings by dividing the narration duration by word count.
Punctuation/prosody and caption phrasing still need editorial review.

### Recorded or external TTS

```powershell
npm run build -- examples/move-zeroes.json --narration-dir "C:\my-narration"
```

Supply one `<scene-id>.wav` and `<scene-id>.words.json` per planned scene.
The WAV should be uncompressed PCM. Word timestamps are relative to that WAV:

```json
[{"text":"Move","start":0.1},{"text":"zeroes","start":0.45}]
```

Provide real provider timestamps or forced alignment against the script.
The build rejects missing, invalid or oversized narration instead of squeezing
speech into the scene. It places speech 0.4 seconds after each scene starts.
Provider-specific TTS adapters and automatic forced alignment are not implemented.
For imported timestamp files, retain punctuation in each word's text. The Windows
adapter restores it from the original script using speech-event character positions.

For a deliberately silent draft:

```powershell
npm run build -- examples/move-zeroes.json --silent
```

This is not a substitute for the narrated deliverable.

## Production design

```text
Brief -> verified trace -> timeline -> exact keyframes
                                      |
                  narration + captions + deterministic motion
                                      |
                        encoded export -> critic evidence
                                      |
                       human acceptance -> manual publishing
```

Cells are stationary. Values are identity-bearing objects. A swap changes their
positions along opposite arcs without changing their text. Pointers advance only
after the value operation. Reusing templates avoids regenerating brand elements.

The visual template supports **1-6 displayed integers between -999 and 999**.
Those are layout limits, not algorithm constraints. The underlying algorithm
handles empty arrays and larger inputs; the educational practice constraints are
separate. Change the template and tests before showing larger values or arrays.

The target duration is checked exactly. With a different input, scene count and
duration can change; omit `targetDurationSeconds` to accept the computed length.
Long code-rendered videos do not require a video-generation model or inherit its
clip-length limits.

Repeated builds reuse matching narration and an unchanged final render. Cache keys
include narration text/settings, audio hashes, source code, dependencies and input
properties. Keyframe generation and encoding checks still run. This is bounded
cache reuse, not a complete content-addressed production farm.

## Optional OpenArt use

Use OpenArt for reusable backgrounds, illustrations or footage that truly benefits
from generative media, not exact algorithm operations. No OpenArt SDK or account
configuration is embedded here. A connected agent can use its available MCP tools.

Before any paid trial: inspect live schemas, verify reference inputs, quote the
configuration, obtain approval, submit once, and save the job ID. Correct first
and last images do not guarantee correct intermediate motion.

Store external prompt/settings/source hashes/job/cost/verdict in the local lifecycle
record. Never publish signed upload URLs or account data. Critique a single trial
before approving a batch. A failed trial is evidence, not permission to auto-retry.

## Reviews and limitations

The skill requires logical, motion, teaching, silent-comprehension, narration,
subtitle and export/continuity review. It does not pretend that an agent switching
roles is an independent critic. Independent review is an explicit bounded activity.

This release does not implement automatic semantic video understanding, visual
approval, arbitrary generated-clip stitching, commercial studio TTS providers,
languages beyond the two regional pilots, or every DSA pattern. The deterministic renderer handles the implemented
timeline continuously; generative clip assembly remains a documented workflow,
not an implemented automatic feature.

## Licence and dependencies

Original source and skill: MIT. Dependencies keep their own licences.
[Remotion](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md) has a
special free/company licence; check your eligibility. FFmpeg binaries distributed
by `ffmpeg-static` have their own licensing obligations. They are installed as
dependencies, not vendored into this repository.

The optional Kokoro-ONNX wrapper is MIT; Kokoro weights are Apache-2.0.
Its transitive phonemizer/eSpeak components retain their own licences, including
GPL obligations if redistributed. Noto Sans Devanagari is SIL OFL 1.1:
[font licence](https://github.com/google/fonts/blob/2bc5d431b584d89e646214bf6cfa75494e76ceea/ofl/notosansdevanagari/OFL.txt).
Consult the [model card and its notices](https://huggingface.co/hexgrad/Kokoro-82M)
before redistributing speech tooling/models. No Windows font is redistributed.

No account credentials, previous private trial records, or generated videos are
included in the public source.
