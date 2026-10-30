# Portable production workflow

The configured brand is **InterviewReel**, launching in global English.
Listening and physical-device acceptance remain required before publication.
This extends the regional pilot with Move Zeroes, Remove Element and Remove
Duplicates from Sorted Array. No uploads, publishing, account connections or app
backend are included.

## Contract and execution

`examples/production.json` is the production entry point. Its paths are relative
to that file, not to the current shell directory. It references the problem and
locale packs, selects output profiles and defines branding and total duration.
The repository skill invokes executable stages; conversation history is not an
input. `schemaVersion: 1` is required; unknown schema versions fail.

```powershell
npm run studio -- doctor
npm run studio -- plan examples\production.json
npm run validate
npm run studio -- smoke examples\production.json
npm run studio -- build examples\production.json
npm run studio -- deliver examples\production.json
npm run studio -- review examples\production.json
npm run studio -- package
```

`plan` reads and validates without rendering or downloads. `build` with no
`--only` renders every declared output; inspect that matrix before running it.
`smoke` renders short, silent diagnostic samples of the opening, variable
definitions, steps, conclusion, challenge and a caption. It is not a shortened
publishable lesson and deliberately samples rather than narrates the full story.

`validate` is the executable production-validation gate. It syntax-checks every
MJS source/test and runs neural, media and browser integrations with no skips.
Its report and portable source/config fingerprint are persisted under
`outputs/validation-tests.xml` and `outputs/validation.json`. `smoke`, `build`
and `deliver` reject missing, failed, modified-report or stale-source evidence.
A source change during validation also fails. Documentation-only changes do not
invalidate runtime validation. Run it after setup and meaningful source changes,
not blindly before every unchanged stage.

`review` now runs the delivery audit rather than merely printing status.
`verify:delivery` is an alias; `studio status <configuration>` preserves the
lightweight status-only operation. Review requires a completed launch package.
On failure its current report becomes failed, never an old passing result;
previous audit records remain in `studio/review-history.jsonl`.

### Check coverage and honest limits

| Check | Executable enforcement | Human work still needed |
|---|---|---|
| Algorithm, sorted-input contract, returned prefix, edge cases | `validate`; every-frame `validateProject` in build; review replays expected trace | Teaching clarity and explanation |
| Fixed r/w terminology, variable introduction, translations | Locale validation, regression tests, rendered text audit | Comprehension by the intended audience |
| Motion, token identity, swap endpoints and pointer timing | Frame checks, encoded/reference body comparisons; review verifies complete evidence coverage and hashes | Inspect recorded swap/pointer windows and opening |
| Model/voice identity and selected reference | Pinned preflight assets; review matches voice settings/reference hash | Tone and pronunciation in the complete new lesson |
| Sample-aligned captions, reading budget, holds and branding offsets | Native timing checks, `applyTiming`, browser overflow audit; review replays timing and sidecars | Natural pacing and on-device subtitle readability |
| Pauses and audio | Fresh decode/headroom audit; English silence ceiling 1.5s at -40 dB, excluding brand cuts | Listen for robotic prosody, awkward breaths or truncation |
| Layout, watermarks and intro/outro | Real-browser tests, per-frame safe bounds; encoded join hashes; PNG dimensions | Phone and landscape-display inspection |
| Delivery freshness and completeness | Exact brief/locale/config/video matching, complete manifest inventory and hashes | Correct real account/profile and upload settings |
| Regression evidence freshness | Source/config and test-report hashes; no skipped integration checks | None substitutes for running it on the target host |
| Portability | Packaged source/assets, setup/doctor, relative entry points; relocation checks | A distinct physical machine/OS needs its own run |
| Publication | Always disabled in generated metadata | Explicit approval and manual upload; no automatic account access |

The review reuses hash-bound build motion/layout evidence rather than rerendering
every frame. It freshly checks algorithms/timing, decodes the final streams and
measures audio. Neither the skill nor a green executable result is a claim of
human listening or independent visual acceptance.

The gap audit corrected stale brief/locale acceptance, old success surviving a
failed review (including locale preflight), unenforced long silences, and
validation reports not bound to current source. Browser coverage also includes
a cold first-frame custom-font regression while retaining true-overflow rejection.
The approved voice-reference WAV is explicitly exempt from the generated-audio
Git ignore rule, so both source archives and future Git checkouts can contain it.

Full lesson order:

```text
cached brand intro -> problem and input/output -> variable definitions
 -> verified walkthrough -> explanation/complexity -> practice challenge
 -> cached localized outro -> encoded checks -> human acceptance
```

The intro/outro are optional, 0-5 seconds each, and must align to 30 fps.
Launch defaults are 1 and 5 seconds. They are locally animated, not paid generations.
They have no music or narration. Assembly supplies silence around the narrated
lesson, normalizes audio to 48 kHz stereo, shifts sidecar captions by the exact
intro frame count and checks the total encoded frame count. Only static scene
tails may extend or shorten for narration; algorithm motion is not sped up or slowed down.
Production allows at most eight additional hold seconds per scene, within the
configured total cap including branding (120 seconds in the example).

## InterviewReel launch

The default matrix is **portrait:en** and **landscape:en**. `en` means a global
English audience, not an Indian-accent voice. It resolves the existing English
teaching source with separate locale/accent metadata; `en-IN` and `hi-IN` remain
supported. A dedicated `en` pack can override that fallback. Locale keys must
match their declared locale, and voice/language mismatches fail.

The reusable, silent five-second closing reads:

```text
InterviewReel
Thanks for watching!
Like and subscribe.
Comment your answer.
```

Explicit short lines prevent narrow-format wrapping. A real-browser test covers
all four layouts, including PNG/disabled watermarks and deliberate overflow.
The lesson retains local Kokoro neural narration; the brand clips have no
speech or music. The female reference delivery has been selected; each complete
video still needs its own listening and visual review.

### Voice continuity and pacing

Use one consistent narrator for every global-English InterviewReel video across
Instagram, YouTube and aspect ratios. The selected delivery is local
Kokoro-ONNX `af_heart`, `en-us`, at speed 0.96 with the pinned model/voice assets,
connected synthesis, a 0.14-second sentence pause and a 0.06-second clause pause.
English locale validation already rejects another voice/language pairing.
Do not switch narrator identity or introduce a provider/model fallback without
the user's approval. Future language channels need their own consistent,
language-appropriate voice; this is not a claim of multilingual voice cloning.

The earlier delivery received feedback that both tone and pauses were robotic.
It synthesized sentences independently and appended 0.15 seconds after each.
Retrospective narration started 2.1 or 4.6 seconds into action scenes, leaving
approximately 4.8-5.35 seconds between several clips. The user subsequently
selected `voice-review/B-connected.wav` as good and workable after a male audition.
`assets/interviewreel/voice.json` records that decision and the exact reference
hash; adjacent `voice-reference.wav` preserves the approved sound.

Configured English production now uses `productionPhrases` from the locale pack:
conversational instructions or present-tense explanations accompany motion,
starting 0.2 seconds into each scene. Retrospective completed-action statements
are rejected in those step scripts. Only idle tails can be shortened: every swap
and pointer-motion frame remains, with at least 0.15 seconds of settled state.
The problem opening has a five-second minimum, setup eight seconds, and
summary/challenge four seconds; actual speech extends these as necessary.
Caption boundaries come from model phoneme timing, not guessed word durations.
Legacy regional production and Hindi keep their previous retrospective timing.
Do not merely speed up narration, remove every pause or mask gaps with music.

Generate the bounded same-voice comparison without a video render:

```powershell
npm run studio -- voice-sample examples\move-zeroes.voice-sample.json
```

This requires the existing delivery and installed neural assets. It extracts
`A-current.wav` from the first four delivered lesson scenes and creates
`B-connected.wav` under `outputs/move-zeroes/voice-review/`. The candidate uses
conversational wording, speed 0.96, connected model synthesis, 0.14-second
sentence pauses and 0.06-second clause pauses, with the same `af_heart` identity.
Phoneme durations supplied by the pinned model define the phrase cues. Missing
or incomplete timing fails; no guessed word alignment or silent fallback is used.

The selected reference is 18.845 seconds. At a -40 dB threshold, the longest
detected silence of at least 0.4 seconds was 0.494 seconds, compared with
5.887 seconds in the 33-second current-video excerpt. This compares a rewritten,
unconstrained audio sample with scheduled video narration, not an equivalent
motion-synchronized export. It demonstrates a reduced-gap candidate, not proof
that every full video is approved. The user has now selected this reference's
voice and delivery; subsequent renders retain their own review gate.
The command preserves current videos, records hashes/settings/timings and keeps
publication disabled. Auditioning alone never changes the production voice.

The user found the connected female sample better and requested a male audition.
Compare the same script, speed and pause settings without changing the channel voice:

```powershell
npm run studio -- voice-sample examples\move-zeroes.voice-sample.json --voice am_michael
```

An audition override writes to `voice-review/am_michael/`; the original female
`voice-review/B-connected.wav` remains untouched. `am_michael` is present in the
pinned local American-English male voice inventory. The provider rejects unknown
IDs rather than falling back. This override is for auditioning only; it does not
alter English locale validation, production voice selection or existing videos.
The chosen narrator is the original female `af_heart`, not the male audition.

`launch` in the production configuration owns the tagline, bio, video title,
description, social caption and pinned comment. After the full build, `deliver`
validates its configuration and final-video hashes against successful lifecycles.
Stale branding, changed problem/locale content, incomplete builds and changed
video bytes are rejected before packaging.

| Under `outputs/<problem>/launch/` | Use |
|---|---|
| `avatar.png` | Original 800 x 800 IR monogram, suitable for a circular crop |
| `channel-banner.png` | 2560 x 1440 banner, central text within a 1500 x 423 area |
| `channel.json` | Brand, tagline and bio; platform/profile remain unset |
| `<format>-<locale>/final.mp4`, `silent.mp4` | Narrated lesson and readable silent export |
| `<format>-<locale>/intro.mp4`, `outro.mp4` | Reusable, silent brand clips when enabled |
| `<format>-<locale>/subtitles.srt`, `.vtt` | Sidecar captions; final video already has burned captions |
| `<format>-<locale>/cover.png` | Native-aspect cover image |
| `landscape-<locale>/thumbnail.png` | 1280 x 720 thumbnail |
| `<format>-<locale>/upload.json` | Editable upload copy, language, dimensions and duration |
| `<format>-<locale>/title.txt`, `description.txt`, `caption.txt`, `pinned-comment.txt` | Copy-ready text for manual upload; descriptions are not embedded into the MP4 |
| `<format>-<locale>/upload-instructions.txt` | Cover selection, caption and publishing instructions |
| `manifest.json` | Relative file names, SHA256 hashes and pending human-review gate |

Packaging does not authorize publishing. Use only the files listed in the latest
successful manifest; it is marked building/failed during an incomplete attempt.
Never select a video by the name `final.mp4` alone. Historical regional and
intermediate renders have the same basename. The upload handoff directory is
`studio_output/<topic>/<locale>/<orientation>/`, for example
`studio_output/move-zeroes/en/portrait/`. After a successful review, assemble only
the following upload essentials in each folder:

| File | Upload use |
|---|---|
| `final.mp4` | Current reviewed narrated video |
| `cover.png` | Separately selected cover image |
| `title.txt` | YouTube/video title |
| `description.txt` | Full description, including topic hashtags |
| `caption.txt` | Instagram/social caption, including topic hashtags |
| `thumbnail.png` | Landscape only: 1280 x 720 YouTube thumbnail |

`lib/upload.mjs` adds missing social-caption hashtags to generated descriptions,
without duplicating tags already present. Both source packages and the handoff
therefore contain the same copy-ready text.
`scripts/upload-handoff.mjs` verifies each source file against its manifest and
the video against the successful review's SHA256. It also checks the title,
description and caption against their upload metadata, requires hashtags, and
rejects unsafe path segments and unexpected destination files. It preflights
all selected sources/destinations before replacing assets, then verifies each
copy and the exact five-file portrait/six-file landscape inventory.

Never export stale or failed packages, silent copies, neutral clips or auditions.
Do not include logs, manifests, review images, optional subtitle sidecars,
instructions or pinned-comment files in this minimal upload folder. Remove
superseded loose `<orientation>.mp4` copies only after verifying their replacement
and confirming they match the expected old copy. Only configured, reviewed
locales belong here; do not copy old regional trials to fill gaps.
Successful `studio review` runs this exporter automatically after the full
delivery audit. `story build` invokes `story review`, which also exports
automatically. A packaging failure prevents a successful review record.
`node scripts/upload-index.mjs` refreshes all five verified packages through the
same exporter and links directly to the clean handoff, including its covers and
hashtags. The HTML index stays outside the upload folders. No manual copy step
is needed. Publishing and human media acceptance remain separate.
Manual platform uploads are outside the executable gate: a passing review does
not prevent someone selecting an older file in a platform file picker.
The posted Move Zeroes reel `DfIAPC_IK5R` matched the historical regional visuals
and wording (61.31 seconds after platform encoding; longest detected silence
5.28494 seconds), not the reviewed 69.833-second branded portrait. The local
legacy source was 61.21 seconds with a 5.30042-second detected silence.
Current lesson silence is 0.932104 seconds excluding brand cuts. Initially the
historical files were labelled with DO-NOT-UPLOAD notes. At the user's explicit
request, the obsolete Move Zeroes regional tree and original-baseline outputs
were subsequently removed. Current launch/studio evidence and voice auditions
were preserved; both current Move Zeroes launch video hashes were unchanged.
Rebuilding or repackaging never grants human acceptance. Local lifecycle files,
account secrets and host paths are not copied into the upload package.
`studio package` is a separate **source** archive for moving the workflow to
another machine; it does not include generated videos or model downloads.

Manual launch finish line: inspect/listen to both complete videos, check phone
and landscape readability, then select the real platform/profile and explicitly
approve its upload. Attach the appropriate cover, copy and optional sidecars
using that platform's current controls; Shorts/Reels thumbnail controls differ.
The workflow does not log in, connect accounts, upload or schedule posts.
App development remains outside this launch.

Instagram account setup is separate from per-video upload copy. Its canonical
profile draft is `assets/interviewreel/instagram.json`, with the adjacent
800 x 800 `avatar.png`. It contains the bio, display name, suggested account
settings and planned highlight names. The exact handle/URL remains unconfirmed.
The profile is positioned as SWE interview preparation: DSA and system design.
The IR avatar remains topic-neutral; the current tagline is
"SWE interview prep, made visual." Use these canonical profile assets rather
than older per-lesson launch snapshots for current account setup.
Both files travel in the source archive; editing this profile does not require
rerendering lessons. Apply it manually to the existing account, and leave the
website empty until a real destination is available.

The matching YouTube draft is `assets/interviewreel/youtube.json`. It shares
`avatar.png` and uses `youtube-banner.png` for the channel banner. The draft owns
the description, suggested handle, keywords, planned home sections and private
upload-default recommendation. Education is an upload category, not an
Instagram-style channel account category. Confirm the actual handle/channel URL
and links before applying the profile. No channel creation or upload is automated.
The landscape launch folder contains the video and 1280 x 720 thumbnail; the
portrait folder contains the vertical version. These are alternative formats of
the same lesson, not two distinct topics. Profile assets travel in the source archive.

### First branded launch acceptance (before selected-voice integration)

| English output | Pixels | Duration / frames | Audio peak |
|---|---|---|---|
| Portrait | 1080 x 1920 | 77.2 seconds / 2316 | -3.8 dBFS |
| Landscape | 1920 x 1080 | 77.2 seconds / 2316 | -3.8 dBFS |

The full Windows build completed in 1504.7 seconds (25.1 minutes). Both
16-second diagnostic previews passed before the full build. The 32-test suite
passed with neural/media/browser integrations enabled; the extended browser
case also checked the retained Hindi closing in all four layouts.

Both full outputs passed decode, timing, headroom and encoded-boundary checks.
All 20 launch-file hashes matched the delivery manifest. The silent copies
contain exactly the same encoded video packets as the narrated exports.
Sidecars match the assembly's shifted cues; artwork dimensions were checked.
The opening, example states, challenge-to-outro join and channel artwork received
sampled implementing-agent visual inspection. Listening, physical-device review
and publication approval remain pending.

The first long closing line wrapped in portrait and failed the browser overflow
gate. It was shortened into three explicit lines before full production.
Multiline diagnostics now retain the entire text and box dimensions in errors.

This revision used no OpenArt/TTS generation credits and installed no new
dependencies. No new cross-OS or fresh-machine E2E run is claimed; previous
relocation evidence remains below. Build, deliver and source packaging do not
commit or push source changes.

### Selected-voice delivery acceptance

Both English formats now use the selected female connected delivery. Each final
video is 2095 frames / 69.833 seconds, including the unchanged silent brand cuts.
The Windows build took 1512.3 seconds. Both audio peaks are -3.9 dBFS.
The longest detected lesson silence is 0.932 seconds at -40 dB / minimum 0.4
seconds, excluding the brand cuts. This is a full-video measurement, unlike the
earlier audition comparison. The 35-test integration suite passed without skips.

All 20 launch-file hashes, artwork dimensions, caption sidecars and identical
narrated/silent video packets passed. Encoded overviews, a swap window and the
outro received sampled visual inspection. Full-video listening and device review
remain pending; the reference selection does not grant publication approval.

Repeat the delivery audit without rerendering:

```powershell
npm run verify:delivery -- examples\production.json
```

Its machine-readable evidence is `studio/delivery-verification.json` under the
problem's output directory. Historical evidence is retained separately.

### Completed three-lesson delivery

Each lesson has a 1080 x 1920 portrait and a 1920 x 1080 landscape export,
using the selected `af_heart` delivery and the same intro/outro.

| Lesson | Duration / frames per format | Audio peak | Longest lesson silence |
|---|---|---|---|
| Move Zeroes | 69.833 seconds / 2095 | -3.9 dBFS | 0.932104 seconds |
| Remove Element | 57.967 seconds / 1739 | -4.2 dBFS | 0.922833 seconds |
| Remove Duplicates from Sorted Array | 71.467 seconds / 2144 | -3.8 dBFS | 0.922146 seconds |

All three launch packages passed the final executable review: 20 manifest files
each, fresh final-stream decoding, selected voice/reference, captions, identical
narrated/silent video packets, and complete hash-bound motion/join evidence.
Their launch folders are `outputs/<problem>/launch`; exact media hashes are in
each manifest and `studio/delivery-verification.json`.

Remove Element's two-format build took 1027.2 seconds. After the font-readiness
fix, Remove Duplicates landscape recovered from verified cached neutral clips
in 427.7 seconds; the completed portrait was preserved. These timings exclude
failed attempts and are not a total project-production estimate. Encoded
overviews and swap windows received sampled implementing-agent inspection.
Complete listening, physical-device acceptance and publication remain pending.

## Teaching and localization

### Channel introduction and driver heatmap

The `story` command builds/reviews `examples/channel-intro.json` and
`examples/driver-heatmap.json`. These are standalone narrated stories, not new
array-compaction algorithms. They reuse the selected connected voice, native
phrase timings, full-decode checks, narration-silence ceiling and font-readiness
audit. Full source-bound validation is required before building. Review fails
on changed source/configuration/media, verifies copy-ready text and cover sizes,
rebuilds timing and measures audio again. Full listening/device acceptance is
still manual. Run the two builds sequentially.

The intro demonstrates a swap using the existing tested Move Zeroes trace and
motion function, rather than inventing a second animation algorithm.

The heatmap uses an original planar hex-grid illustration and a deterministic
state machine. It is not a real H3 projection or a claim about Uber's current
architecture. The provider source is https://www.uber.com/blog/h3/ and general
H3 documentation is https://h3geo.org/docs/. The social reference is inspiration
for visual explanation only; its footage, script and artwork are not reused.

The example tracks each driver's last sequence, active cell and expiry time.
Counts are independently checked against active drivers. Movement preserves the
total; repeated reports do not inflate it; stale/duplicate events and outdated
expiry tasks cannot override newer state. An expiry worker explicitly decrements
the cell count: a cache TTL alone does not maintain aggregates. The illustrative
timeout is 30 seconds. Atomic ownership, cross-region handoff, reconciliation
and demand signals need fuller production designs; the description states these
limits. Kafka is an example stream technology, not a verified Uber component.

Both stories include original cover artwork and copy-ready upload text beside
the video. `node scripts/upload-index.mjs` verifies the indexed file hashes
against reviewed manifests and generates `outputs/UPLOAD-READY.html`.

The initial story batch passed all 49 full-validation cases with no failures
or skips. Both orientations passed full-decode, timing, voice, audio-gap and
delivery checks:

| Story | Duration per orientation | Peak | Longest body silence |
|---|---|---|---|
| Channel intro | 28.27 seconds | -4.4 dBFS | 0.716750 seconds |
| Driver heatmap | 68.05 seconds | -4.7 dBFS | 0.701604 seconds |

Decoded overviews, covers and heatmap movement/repeat/expiry/closing frames
received sampled implementing-agent inspection, not independent review.
The three existing lesson packages now contain 30 manifest files each; their
six final-video hashes are unchanged. The source upload index has ten cards
and originally had 85 verified source-package links. The integrated index now
links to the upload essentials in the clean handoff. That handoff contains ten packages
(five topics, English, two orientations), comprising 55 upload-essential files.
Full listening, physical-device review and publication approval remain pending.
The integrated flow adds four upload regressions (53 full-validation cases):
hashtag preservation/deduplication, format/locale isolation and reruns, rejection
of failed reviews/changed assets/stale copy, and safe handling of unexpected
files and path traversal. These checks do not replace listening or device review.

### Additional question contracts

| Entry point under `examples` | Example | Required result |
|---|---|---|
| `remove-element.production.json` | `[3,2,2,3]`, target `3` | `k = 2`, prefix `[2,2]`; tail ignored |
| `remove-duplicates.production.json` | sorted `[1,1,2,2,3]` | `k = 3`, prefix `[1,2,3]`; tail ignored |

Both use the existing deterministic swap animation and selected English voice.
The physical array length does not change. These are valid swap-based solutions,
not animations of assignment-based implementations. Remove Element preserves
kept order even though its basic contract does not require it. Remove Duplicates
compares `nums[r]` with `nums[w - 1]`, with a separate `w == 0` case. Comparing
with `nums[r - 1]` after swaps would be incorrect. Sorted input is required.
The advertised O(1) extra space describes the in-place interview algorithm.
The production trace deliberately retains snapshots for animation and therefore
uses additional memory; it is not the submission implementation.

The trace tests independently check filtered/unique prefixes, returned lengths,
untouched unread suffixes and token conservation, including empty/all-kept/
all-skipped/all-duplicate cases. Empty arrays are supported by the algorithm,
not by the 1-6-value animation template. Each practice problem specifies up to
100000 integers and a 1-second target; example rendering limits are separate.

Use `plan`, `smoke`, `build`, `deliver`, `review` and `verify:delivery` with each
entry point. Do not run separate studio builds concurrently: bundle/staging
directories are shared. New question packs are English-only; the older Hindi
and en-IN teaching packs remain specific to Move Zeroes.

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
Use original/licensed artwork; the current text brand is InterviewReel.
Store reusable artwork under `assets` if it should travel with the source bundle.
The neutral master never contains branding, numerals, teaching text or audio.

## Reuse, provenance and failures

Frame workers default to at most 2, reduced further on low CPU/free memory.
`REEL_RENDER_CONCURRENCY` explicitly overrides this within 1-16 available CPU
threads; raising it still requires monitoring available memory. Browsers are
reused for neutral/localized screenshot batches, then closed in
`finally`, including failures. Formats remain sequential to protect shared
bundle/public staging.
Video renders use Remotion-owned browsers. One landscape keyframe failure was
initially obscured by a shared-browser cleanup error. Isolating the first frame
exposed the actual fault: the text audit ran before the custom font loaded,
and the fallback font falsely wrapped a valid title. Per-frame checks now wait
for font readiness, with a cold first-frame browser regression. Recovery reuses
verified neutral clips and preserves the completed portrait; the failed attempts
are not counted as successful builds.

`node scripts\benchmark-render.mjs` measures a neutral swap at 2 and 4 workers
and four screenshots with fresh versus shared browsers. On this Windows host,
the final ownership-policy trial took 23.81s versus 27.23s, so 2 remains the
default. Browser reuse took 3.69s versus 9.54s for the screenshots. The earlier
20.80s/24.33s and 3.83s/9.94s trial is retained in benchmark history.
Decoded video pixels and PNG hashes
matched. These are bounded measurements, not a claimed whole-build speedup.
Evidence is under `outputs/render-benchmark/verification.json`.

Neutral geometry now has its own module and composition entry point, so English
wording/delivery changes do not invalidate neutral animation caches. Geometry,
motion, layout, renderer identity and dependency changes still invalidate them.
Connected timing tolerates only the native model's one-sample final trimming
roundoff; larger timing overruns remain errors.

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

Obtain a checkout containing this workflow revision, or use the portable source
bundle; an older GitHub revision may not contain local changes.
`studio package` creates `outputs/bundles/reel-studio-source.tar.gz` and
its SHA256 manifest. It includes source, configuration, docs, skill and npm lock;
it excludes outputs, models, environments, credentials and Git history.
Extract into a new directory, then:

```powershell
npm ci
npm run studio -- setup --download-browser
npm run studio -- doctor
npm run check
npm test
npm run validate
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
The source archive deliberately excludes previous validation reports: run
`validate` on the destination. To review an old render, retain its complete
output/evidence tree and referenced media cache; a launch-only folder is for
manual uploading, not a substitute for reproducible source/build evidence.

Windows is the local validation host. macOS/Linux paths are supported in the
implementation, but those platforms are not claimed E2E-verified without runs.
The CI unit-test matrix covers Windows, Linux and macOS when the changes are
pushed; configuring those jobs is not evidence that they have run.
Model licensing, speech quality and fonts still require the documented checks.
Do not publish local lifecycle files containing machine paths as source.

The final runtime revision passed all 42 integration tests without skips in
both the main checkout and the existing isolated Windows relocation checkout.
Their source/config fingerprints matched. The relocated checkout resolved its
own renderer dependency and used its own Python/model environment; doctor
passed, followed by a fresh Remove Duplicates landscape diagnostic in 86.4
seconds with one frame worker. This covers the cold-font fix and final review
guards. It is not a new physical-machine or cross-OS test.

## Earlier regional pilot evidence (historical)

The measurements below describe the earlier en-IN/hi-IN production, before
InterviewReel branding and the English-only launch matrix. They are retained as
history, not claimed as measurements of the current launch exports.

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
