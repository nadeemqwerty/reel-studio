# Portable production workflow

Status: implementation, automated delivery, cache reuse and Windows relocation
validation complete. Listening and physical-device acceptance remain pending.
This extends the regional pilot, not its algorithm scope: only Move Zeroes is
implemented. No uploads, publishing, Instagram accounts or app backend are included.

## Contract and execution

`examples/production.json` is the production entry point. Its paths are relative
to that file, not to the current shell directory. It references the problem and
locale packs, selects output profiles and defines branding and total duration.
The repository skill invokes executable stages; conversation history is not an
input. `schemaVersion: 1` is required; unknown schema versions fail.

```powershell
npm run studio -- doctor
npm run studio -- plan examples\production.json
npm run studio -- smoke examples\production.json
npm run studio -- build examples\production.json --only portrait:en-IN,landscape:hi-IN
npm run studio -- review examples\production.json
npm run studio -- package
```

`plan` reads and validates without rendering or downloads. `build` with no
`--only` renders every declared output; inspect that matrix before running it.
`smoke` renders short, silent diagnostic samples of the opening, variable
definitions, steps, conclusion, challenge and a caption. It is not a shortened
publishable lesson and deliberately samples rather than narrates the full story.

Full lesson order:

```text
cached brand intro -> problem and input/output -> variable definitions
 -> verified walkthrough -> explanation/complexity -> practice challenge
 -> cached localized outro -> encoded checks -> human acceptance
```

The intro/outro are optional, 0-5 seconds each, and must align to 30 fps.
Defaults are 1 and 2 seconds. They are locally animated, not paid generations.
They have no music or narration. Assembly supplies silence around the narrated
lesson, normalizes audio to 48 kHz stereo, shifts sidecar captions by the exact
intro frame count and checks the total encoded frame count. Only static scene
holds may extend for narration; algorithm motion is not sped up or slowed down.
Production allows at most eight additional hold seconds per scene, within the
configured total cap including branding (120 seconds in the example).

## Teaching and localization

The locale's `terms` map owns the identity, displayed name and spoken form of
each pointer. Use **read pointer r** and **write pointer w** consistently.
Hindi uses fixed equivalents and spoken letter names. Colour is supplementary,
never a substitute name. Numerals and identifiers remain Latin.

The opening defines order preservation, in-place mutation and expected output.
The setup defines `nums`, `n`, zero-based indices and initial `r = w = 0`.
Practice constraints are distinct from the renderer's 1-6-value example limit.
Do not silently substitute another problem or translate executable identifiers.

## Layout and brand profiles

| Profile | Pixels | Intended use |
|---|---|---|
| portrait | 1080 x 1920 | Reels / Shorts |
| landscape | 1920 x 1080 | Standard YouTube / app landscape |
| square | 1080 x 1080 | Square feed / app |
| feed | 1080 x 1350 | Portrait feed |

These are local layout presets, not a claim of current platform upload approval.
Safe margins can be overridden per output; actual rendered text must fit.
Landscape uses side-by-side teaching/diagram regions. Other formats rearrange
vertical regions; no portrait crop or stretched film is used.

Watermarks can be disabled or use text / a local PNG. Configure opacity, width,
and top-left/top-right placement. The dedicated header strip keeps them away
from diagrams and subtitles. Image files must be <=2 MB and <=4096px.
Use original/licensed artwork; replace the placeholder brand when ready.
Store reusable artwork under `assets` if it should travel with the source bundle.
The neutral master never contains branding, numerals, teaching text or audio.

## Reuse, provenance and failures

One deterministic algorithm trace feeds all outputs. Speech is shared across
sizes for the same locale/voice/script. Neutral rendered clips are shared across
locales with the same layout; different layouts need separate clips.
Brand clips are cached independently of the problem's values.
Hash checks reject missing/corrupted cache files. Config/source changes invalidate
dependent media; source changes may conservatively invalidate additional caches.

Outputs are under `outputs/<problem>/studio/<format>/<locale>/`:

- `smoke`: diagnostic MP4, decoded overview, lifecycle.
- `delivery`: complete `final.mp4`, localized `silent.mp4`, intermediate
  `lesson.mp4`, timeline, SRT/VTT, keyframes, decoded swap/join evidence, lifecycle.
- Shared neutral masters are under the format's layout-hash directory.

Lifecycles retain configurations, translations, speech settings, dependency and
media hashes, costs, results and failure status. Prior records go to history.
An invoked output loses prior publication approval before production preflight.
Never reuse old acceptance for new bytes. `publishable` remains false until
listening and real device review are actually completed.

## Fresh machine

Install Node.js >=20 (the current checkout was tested on 20), Python 3.10-3.13
(tested on 3.13), Chrome/Chromium, curl and tar. Respect the licences in the README.
No OpenArt account, TTS key, private feed or corporate agent access is required.
Use current supported Node/Python releases compatible with these ranges.

Obtain the **updated source** from GitHub `main`, or use the portable source
bundle. `studio package` creates `outputs/bundles/reel-studio-source.tar.gz` and
its SHA256 manifest. It includes source, configuration, docs, skill and npm lock;
it excludes outputs, models, environments, credentials and Git history.
Extract into a new directory, then:

```powershell
npm ci
npm run studio -- setup --download-browser
npm run studio -- doctor
npm run check
npm test
npm run studio -- plan examples\production.json
```

Use `--browser "C:\path\to\chrome.exe"` instead of `--download-browser` for an
installed browser. Setup is the only downloading/installing stage. It creates an
isolated Python environment, verifies pinned models/fonts and records installed
dependency versions. `REEL_PYTHON` can point to Python; discovery also tries
`python`, `python3`, and `py`. Normal builds never silently install dependencies.
On macOS/Linux use the equivalent host path separators in command arguments.

Recreate `node_modules`, the Python environment and browser settings on the new
machine; do not copy them. Optional media/model caches are an optimization, not
a prerequisite; browser/renderer differences can intentionally invalidate them.
Keep generated evidence separately if retaining a production history.

Windows is the local validation host. macOS/Linux paths are supported in the
implementation, but those platforms are not claimed E2E-verified without runs.
The CI unit-test matrix covers Windows, Linux and macOS when the changes are
pushed; configuring those jobs is not evidence that they have run.
Model licensing, speech quality and fonts still require the documented checks.
Do not publish local lifecycle files containing machine paths as source.

## Requirement-to-evidence tracking

| Requirement | Acceptance |
|---|---|
| Naming and definitions | Passed locale/term tests; 40 opening/setup/action/summary/challenge stills across both languages and four layouts |
| Four formats | Eight 13-second encoded diagnostic previews passed; bounds/overflow checks passed |
| Reusable neutral video | Nine clips per delivered layout; 47 portrait and 49 landscape decoded boundary/reference checks passed |
| Watermark | Text delivery plus actual Chromium PNG/disabled-mode and overflow-negative tests passed |
| Intro/outro | Both full deliveries have cached pre/post clips; disabled-brand assembly test and exact frame-count/audio checks passed |
| Subtitles/audio | Exact offset tests, full decode and audio headroom checks passed; listening remains pending |
| Portable workflow | Fresh-path Node/Python/model setup, all then-current 28 integration tests and real generated preview passed; subsequent staging/cache regression tests passed in the updated relocated copy |
| Regression/failure safety | Final 30-test suite passed with no skips, including legacy, missing translation, corrupt cache, staging and exact clip-cache binding |
| Human quality | Pending listening and device review; never inferred from automated success |

### Delivered outputs and measured execution

| Delivery | Dimensions | Duration / frames | Audio peak |
|---|---|---|---|
| English portrait | 1080 x 1920 | 74.20 seconds / 2226 | -3.8 dBFS |
| Hindi landscape | 1920 x 1080 | 76.50 seconds / 2295 | -6.7 dBFS |

Both use 30 fps H.264/AAC and include the 1-second intro and 2-second outro.
Localized silent copies and shifted SRT/VTT files are included. Other layout/
locale combinations have validated diagnostic previews, not full delivery claims.

- Eight-format/locale preview matrix: 292.7 seconds.
- Successful final two-delivery build: 2002.1 seconds (33.4 minutes), excluding
  earlier failed/interrupted development attempts.
- Verified cached repeat: 181.5 seconds (3.0 minutes). All 18 neutral clips,
  narration, four brand clips, both lesson renders and both final MP4s were reused.
  Hashes remained unchanged; decoding and evidence checks still ran.
- Maximum sampled base/body pixel error: 1.53 portrait, 2.01 landscape, below
  the tolerance of 12. Joins and overviews received sampled implementing-agent
  visual inspection, not a claimed independent or native-listening review.
- Fresh-path preview generated successfully in 56.3 seconds after explicit setup.
  This verifies relocation on Windows, not another physical machine or OS.
- External OpenArt/TTS generation credits: zero. Local compute, setup downloads
  and agent work are not represented as free.

Persistent evidence: `outputs/studio-tests.xml`,
`outputs/move-zeroes/studio/verification.json`, and each output's lifecycle/history.
The transferable source archive and its SHA256 manifest are in `outputs/bundles`.
These measurements were recorded locally before source publication. Refer to
GitHub for the published commit and current CI status.

### Corrections found during implementation

- The neutral-text assertion now inspects its own component rather than the
  surrounding localized preview.
- Diagram centering accounts for asymmetric safe margins; a five-pixel overflow
  in the first portrait candidate was rejected.
- Preview samples use explicit source-frame mapping. A nested Remotion freeze
  clamped later sample frames to the short preview's duration, repeating setup
  instead of showing the walkthrough; this was found in the encoded overview
  and corrected before acceptance.
- The new teaching root explicitly sets numeral foreground colour.
- The watermark integration test resolves composition props again after changing
  settings; reusing resolved old props was a fixture error, not disabled branding.
- Test discovery is scoped to `test/`, so a relocated verification checkout under
  `.cache` is not accidentally discovered and run a second time.
- Full delivery exposed a public-asset staging order issue: Remotion snapshots
  the public directory during bundling. Newly generated neutral clips and their
  referenced endpoint/audio files are now explicitly staged before playback;
  a regression test covers late-created and missing assets.
- Lesson fingerprints are computed only after neutral clips are resolved, and
  include their exact clip/endpoint hashes. Reuse bookkeeping and intro/outro-only
  edits do not invalidate a lesson. Neutral cache inputs include the composition
  entry source as well as geometry, drawing code and dependencies.

Logical tests, real FFmpeg assembly (including disabled intro/outro), and browser
PNG/disabled-watermark and overflow-rejection tests are executable:

```powershell
$env:REEL_NEURAL_TESTS = '1'
$env:REEL_MEDIA_TESTS = '1'
$env:REEL_RENDER_TESTS = '1'
npm test
```

Default unit tests skip optional installed-runtime/media/browser integration.
Do not treat those skips as platform end-to-end coverage.
