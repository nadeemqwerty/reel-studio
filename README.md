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
- Windows offline narration with actual speech-event word timestamps.
- Imported aligned narration for other platforms/providers.
- Burned-in subtitles plus SRT and WebVTT sidecars.
- Saved keyframes, lifecycle manifest, encoded review sheets, narrated and silent MP4s.
- Narration and final-video caching; explicit failure reporting and resumable rebuilds.
- Logical tests, every-frame motion checks, output metadata and full decode checks.

**Zero OpenArt generation credits are needed for the example.** Local compute and
agent use are not free in an economic sense. External TTS may cost money if you
choose it; no TTS account or API key is required for the Windows demonstration.

## Quick start

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
approval, generated-clip stitching, studio TTS providers, multi-language layouts,
or every DSA pattern. The deterministic renderer handles the implemented
timeline continuously; generative clip assembly remains a documented workflow,
not an implemented automatic feature.

## Licence and dependencies

Original source and skill: MIT. Dependencies keep their own licences.
[Remotion](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md) has a
special free/company licence; check your eligibility. FFmpeg binaries distributed
by `ffmpeg-static` have their own licensing obligations. They are installed as
dependencies, not vendored into this repository.

No account credentials, previous private trial records, or generated videos are
included in the public source.
