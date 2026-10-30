# InterviewReel / Reel Studio

**An agent-directed production skill and working deterministic video renderer.**
Make educational reels whose visual logic remains correct and understandable
without sound, with narration and readable subtitles as separate layers.

Implemented lessons are **Move Zeroes**, **Remove Element**, and
**Remove Duplicates from Sorted Array**.
The configured launch targets global English under **InterviewReel**, with
portrait and landscape videos, a reusable intro and a five-second closing.
The original baseline is 60 seconds; production adds definitions, measured
narration holds and branding. The app is deferred until the video launch.
The repository is not yet a general-purpose video editor or a library of every
DSA pattern. It does not submit paid generations or publish videos automatically.

## Channel profiles

The channel is **SWE interview preparation**, covering DSA and system design.
The first system-design story is an illustrative driver heatmap, not a
general-purpose system-design renderer or a claim about Uber's internal stack.
The profile tagline is **SWE interview prep, made visual.**

The reusable [profile picture](assets/interviewreel/avatar.png) and
[Instagram profile details](assets/interviewreel/instagram.json) are persisted
under `assets/interviewreel/`, independently of any problem or generated output.
The JSON owns the display name, copy-ready bio, recommended Creator/Education
settings and planned highlights. Confirm the existing account's exact handle
before filling its username/URL; no live profile changes are performed.
Use these canonical profile assets for account setup, rather than older
lesson-launch snapshots of channel artwork and copy.

The matching [YouTube profile](assets/interviewreel/youtube.json) owns the channel
description, preferred handle, upload-default recommendations and planned home
sections. It uses the same avatar and a [2560 x 1440 banner](assets/interviewreel/youtube-banner.png).
The handle is unconfirmed; channel creation and uploads remain manual.
All profile assets are included by `npm run studio -- package`.
The selected global-English narrator and delivery are recorded in
`assets/interviewreel/voice.json`, with the approved `voice-reference.wav`.
Use the same voice across platforms; audition overrides do not change it.

## Introduction, heatmap and upload assets

The channel introduction and original driver-heatmap story have independent
portrait/landscape layouts, the selected narrator, measured captions and a
five-second thanks/like/subscribe/comment closing:

```powershell
npm run validate
npm run story -- build examples\channel-intro.json
npm run story -- build examples\driver-heatmap.json
npm run story -- review examples\channel-intro.json
npm run story -- review examples\driver-heatmap.json
node scripts\upload-index.mjs
```

Run builds sequentially because speech staging is shared. These story builds
require current full-validation evidence, like lesson builds. Every delivered
format includes `cover.png`, `title.txt`, `description.txt`, `caption.txt`,
`pinned-comment.txt` and `upload-instructions.txt`; landscape also includes a
1280 x 720 `thumbnail.png`. Copy is not hidden only in `upload.json`.
Select a cover and paste the text in the platform's upload editor: neither is
automatically applied by uploading the MP4.

Open `outputs/UPLOAD-READY.html` for a local index after all five video packages
have passed review. Existing lessons remain under `outputs/<problem>/launch/`;
the new stories are under `outputs/channel-intro/` and `outputs/driver-heatmap/`.
For uploading, use **`studio_output/<topic>/<locale>/<orientation>/`**, such as
`studio_output/move-zeroes/en/portrait/`. Each folder contains only `final.mp4`,
`cover.png`, `title.txt`, `description.txt` and `caption.txt`; landscape also has
`thumbnail.png`. Both description and social caption include topic hashtags.
Use `caption.txt` for Instagram; use `title.txt`, `description.txt` and the
thumbnail for YouTube. Select the cover separately in the platform editor.
Successful `studio review` and `story build`/`story review` commands automatically
refresh these handoff folders after checking source hashes and review evidence.
Text generation adds any missing caption hashtags to descriptions without
duplicating existing tags. The exporter rejects stale text, changed source
assets and unexpected destination files before replacing the current handoff.
`node scripts/upload-index.mjs` also refreshes the five reviewed handoffs and
links directly to them. No manual copying is required. Logs, manifests, previews,
silent videos and optional sidecars remain outside this handoff.
No upload, account change or publication is automated.

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
- Text/audio-free neutral scene clips reused by global English and regional overlays.
- Channel avatar/banner, video covers, upload metadata and a hash-listed delivery folder.

**Zero OpenArt generation credits are needed for the example.** Local compute and
agent use are not free in an economic sense. External TTS may cost money if you
choose it; no TTS account or API key is required for the Windows demonstration.

## Regional production

For configurable formats, consistent terminology, watermarks and reusable
intro/outro assembly, use the [portable production workflow](docs/production-workflow.md):

```powershell
npm run studio -- doctor
npm run studio -- plan examples\production.json
npm run validate
npm run studio -- smoke examples\production.json
npm run studio -- build examples\production.json
npm run studio -- deliver examples\production.json
npm run studio -- review examples\production.json
npm run verify:delivery -- examples\production.json
npm run studio -- package
```

The configuration supports portrait, landscape, square and 4:5 feed layouts,
global English (`en`), both pilot locales, optional text/PNG watermarks and cached brand clips.
The default configuration selects only English portrait and landscape; add other
supported format/locale pairs explicitly when a regional launch is approved.
Without `--only`, build renders **all configured outputs**. The silent smoke
previews are diagnostics, not publishable lessons. Setup on a fresh machine:
`npm ci`, then `npm run studio -- setup --download-browser`. See the linked guide
for prerequisites, source-bundle migration, verification scope and limitations.
`validate` runs syntax and all neural/media/browser integration tests without
skips and fingerprints the current source/configuration. `smoke`, `build` and
`deliver` reject missing, failed or stale validation; rerun it after source/config
changes. `review` executes the delivery audit; `status` is the lightweight status
command. `verify:delivery` is an alias for `review`, not a separate bypass.
`deliver` creates `outputs/move-zeroes/launch/` with videos, captions, reusable
intro/outro clips, artwork and copy. It does not upload anything or approve publishing.

Additional lessons use the same commands with
`examples\remove-element.production.json` or
`examples\remove-duplicates.production.json`. Their launch directories are
`outputs\remove-element\launch` and `outputs\remove-duplicates\launch`.
Both use swap-based in-place compaction, return the valid prefix length, and
explicitly ignore the remaining slots. Duplicate removal requires sorted input.
The new lessons currently have global-English packs only.

Rendering reuses browsers between screenshots; Remotion owns video-render
browsers to avoid shared-browser cleanup races. Worker count
is bounded by CPU/free memory, defaults to at most 2, and can be overridden with
`$env:REEL_RENDER_CONCURRENCY = '4'`. Benchmark before increasing it:
`node scripts\benchmark-render.mjs`. More workers are not necessarily faster.

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

Global English `en`, `en-IN` and `hi-IN` are supported. Global English reuses the
English teaching pack without duplicating it; the voice remains US-accented.
To render one locale, append its code to the regional build command. The legacy
regional command still defaults to `en-IN` and `hi-IN`. All use Latin numerals and standard
`w`/`r`/Big-O notation. All other teaching text comes from the locale pack.
The shared brand is a proper name, not an automatic translation.

**The global-English reference delivery is selected, not blanket approval of every export.**
English production uses Kokoro `af_heart` (US accent) with connected synthesis
at speed 0.96 and model-aligned phrase captions. Hindi uses
`hf_alpha`, whose publisher reports more limited training data. Both run locally,
without API keys or generation credits. There is no silent fallback to the
robotic Windows voice. Native-language listening and phone review remain required.

In the legacy regional path, complete short utterances are synthesized separately. Caption times come from
their actual sample boundaries, not estimated word timings. No word highlighting
or forced alignment is claimed. Speech is not sped up to fit. Step narration
describes completed actions and starts after pointer movement; longer speech
extends only the decoded endpoint hold, at most 6 seconds per scene and 90 seconds
for the complete pilot. Configured English production instead narrates
instructions during motion and trims only idle tails; see the production guide.
The original 60-second target describes the **canonical
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

To reproduce the voice comparison, run:

```powershell
npm run studio -- voice-sample examples\move-zeroes.voice-sample.json
```

Compare `A-current.wav` and `B-connected.wav` under
`outputs/move-zeroes/voice-review/`. This uses the existing delivery as the
reference and preserves it. The user selected the female `af_heart` connected
delivery, now used by configured English production. The approved original
reference is retained under `assets/interviewreel/`; it is not overwritten by
new auditions. Full videos still need their own listening and visual review.

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
languages beyond English and Hindi, or every DSA pattern. The deterministic renderer handles the implemented
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
