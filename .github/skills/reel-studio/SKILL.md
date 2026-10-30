---
name: reel-studio
description: Produce and review silent-first educational reels with deterministic animation, narration, subtitles, reusable templates, cost controls, and durable lifecycle evidence. Use for DSA/interview reels, storyboard-to-video production, or motion correctness reviews.
license: MIT
---

# Reel Studio

Act as the director, engineer and editor. Delegate only explicitly bounded work
that needs independent context. Do not launch a custom controller or an agent swarm.
OpenArt is an optional asset supplier, never the algorithm or motion authority.

## Scope and prerequisite gate

1. Read the repository README and the user's problem specification.
2. Confirm audience, learning objective, examples, duration, language, branding,
   narration source and publication destination. State any assumptions.
3. Supported algorithms are Move Zeroes, Remove Element and Remove Duplicates
   from Sorted Array. The latter two return a valid prefix length and ignore the
   tail; their lessons use swaps, not physical deletion or copy animation.
   Do not label another algorithm supported without its trace and focused tests.
4. Ask before edits, installations, paid calls, uploads, commits or publication
   unless the current user has already approved that exact scope.
5. Run commands from the repository root. If this skill was linked/copied elsewhere,
   locate the checkout before running scripts; do not assume the current directory.

## Workflow

### Configured production (preferred)

Read `docs/production-workflow.md` and `examples/production.json`. Use
`npm run studio -- doctor` for prerequisites, and `plan <configuration>` for a
validated output matrix before rendering. Setup/installations stay explicit.
Run `npm run validate` after setup or source/configuration changes. It must pass
all integrations with no skips. Build and deliver verify its source/report
fingerprints; a previous passing report is not enough.
Use `smoke <configuration>` for short diagnostics of the configured outputs.
The InterviewReel launch defaults to `portrait:en` and `landscape:en`.
Use `build <configuration> --only portrait:en` for a selected full output;
omitting `--only` builds every configured output.
After packaging, run `review <configuration>` and the requirement-to-evidence
checklist. `review` executes checks; use `status <configuration>` only for status.
Use `deliver <configuration>` after a successful build for upload-ready videos,
captions, reusable brand clips, avatar/banner/covers and upload metadata. This
rejects stale configurations or changed final-video hashes and never uploads.
The equivalent alias is `npm run verify:delivery -- <configuration>`. It verifies launch-file
hashes, caption sidecars, silent/narrated video equality and lesson audio gaps.
It also replays measured timing, verifies voice/reference and media hashes,
checks motion-evidence coverage, and freshly decodes both final streams.
Failed reviews overwrite current success with failure while retaining history.
Packaging rejects a changed problem or locale pack even if the video hash matches.
The persisted English voice profile limits lesson silence to 1.5 seconds at
-40 dB (minimum detection 0.4 seconds), excluding silent intro/outro. Fix scripts
or timing when it fails; do not silently relax the limit.
Read the coverage table in the production guide. Do not mark listening,
pronunciation, physical-device readability or publication approval as automated.
The additional entry points are `examples/remove-element.production.json` and
`examples/remove-duplicates.production.json`; both currently support English.
The silent five-second outro thanks viewers and asks for likes, subscriptions
and comments. Keep the app deferred until the video launch is delivered.
Maintain the selected narrator across global-English videos and platforms:
Kokoro `af_heart` / `en-us`, connected synthesis at speed 0.96, sentence pause
0.14 seconds and clause pause 0.06 seconds. The approved reference and decision
are in `assets/interviewreel/voice-reference.wav` and `voice.json`.
English production uses guided `productionPhrases`, speaks during the action,
and removes idle tails without cutting any motion frame. Preserve truthful
instructions and model-aligned captions. A selected voice is not approval of
every final video; review the actual complete export.
Use `voice-sample examples/move-zeroes.voice-sample.json` to reproduce a local
A/B comparison. This audio-only command never changes production settings or
overwrites the approved reference asset.
For an explicitly requested voice audition, add `--voice am_michael`. Overrides
write to a voice-specific comparison folder and never change the production
voice. Keep script and pacing identical when comparing narrator identities.

The locale `terms` map owns the displayed/spoken read pointer r and write
pointer w names. Do not invent colour or scan-pointer aliases. Introduce the
problem, expected result and variables before the walkthrough. Preserve
identities and identical geometry between neutral clips and text overlays.
Reflow format-specific layouts rather than cropping a portrait export.
Watermarks must stay in the reserved header strip and never enter neutral media.
Keep generic brand clips separate from problem-specific opening explanations.

`npm run studio -- package` creates the transferable source archive. Document
fresh installation and verified host platforms; never copy virtualenvs or
machine-specific browser settings as a portable installation. Do not claim
macOS/Linux E2E verification from a Windows run. Configuration, commands and
the skill must suffice without conversation history.

Use bounded frame parallelism, not simultaneous independent studio processes:
bundles/public staging are shared. Browser reuse avoids per-screenshot startup.
Benchmark `REEL_RENDER_CONCURRENCY` before increasing it; the local 2-versus-4
trial favoured 2. Source-cache dependencies separate neutral geometry from
narration and localization logic. Never remove correctness checks for speed.
Text audits must wait for the custom font to load. Keep the cold first-frame
landscape regression and genuine-overflow rejection; a warmed-up preview alone
does not cover font startup. If shared-browser cleanup masks a render error,
reproduce that exact frame with a Remotion-owned browser before changing layout.

### Narrated stories and final handoff

For the standalone channel intro and original driver heatmap, use
`npm run story -- build examples/channel-intro.json` or
`npm run story -- build examples/driver-heatmap.json`, then the corresponding
`story -- review` command. Both require current `npm run validate` evidence.
Keep builds sequential. Do not equate illustrative hexagons with real H3 cells
or present the example stream/cache design as Uber's verified internal stack.
Every format must include its cover and copy-ready title/description/caption/
pinned-comment text. Run `node scripts/upload-index.mjs` after all five packages
pass review. The index is local; cover selection and publishing remain manual.
For upload handoff, provide the exact reviewed path and hash, not a generic
`final.mp4` search. Historical regional outputs can retain obsolete terminology
and long pauses despite newer launch files passing review. Never infer that a
manually posted reel is the reviewed version; inspect the actual posted media
when the user reports a discrepancy.

Successful lesson/story reviews automatically refresh
`studio_output/<topic>/<locale>/<orientation>/`. They include only `final.mp4`,
`cover.png`, `title.txt`, `description.txt`, `caption.txt` and, for landscape,
`thumbnail.png`. Verify sources against their manifest, and the final video
against its successful review. Both descriptions and social captions must have
topic hashtags. `uploadTextFiles` adds missing caption hashtags during source
packaging; `writeUploadHandoff` verifies source hashes, metadata/text agreement,
reviewed-video identity and exact destination inventories before completion.
Exclude silent copies, previews, logs, manifests, optional subtitles, instructions
and pinned-comment files. After verifying replacements, remove superseded loose
orientation MP4s only when their hashes match the expected old handoff copies.
Do not copy unreviewed legacy locales just to fill the locale matrix.
Do not manually copy files into this handoff. Run `studio deliver` followed by
`studio review` for lessons, or `story build` for stories. A successful review
records the automatic handoff. The upload-index command can rebuild the five
reviewed handoffs and links directly to their upload essentials.
Remove legacy generated media only with explicit user authorization, using
exact inspected paths and preserving current source, caches and review evidence.

### Legacy single-format workflow

1. **Brief:** create or edit an example JSON following `examples/move-zeroes.json`.
   Use original/licensed content. Separate teaching labels, narration and subtitles.
2. **Plan:** `npm run plan -- examples/move-zeroes.json`.
   Inspect the scene durations and generated narration text. Reject overloaded
   scenes instead of silently speeding up speech.
3. **Verify:** `npm test` and `npm run check`. Review the independent expected result,
   edge cases and state trace. A trace generated by code is not proof the code is right.
4. **Setup:** with installation permission, `npm ci` then `npm run setup`.
   Reuse installed prerequisites; ask before browser downloads. Setup supports
   `--browser <path>` or explicit `--download-browser`.
5. **Produce:** `npm run build -- examples/move-zeroes.json`.
   Windows uses local System.Speech for an offline demo voice. For polished speech,
   use approved recorded/TTS WAV files and word timestamps with `--narration-dir`.
   Never misrepresent the demo voice as professional studio narration.
6. **Review:** inspect the actual `outputs/<id>/final.mp4`, silent version,
   keyframes, subtitle files and encoded-motion review sheets.
   Run `npm run review -- move-zeroes` for the lifecycle record.
7. **Correct:** patch only the failed stage. Rerun the same build to reuse matching
   narration and final-render caches. Never reuse an approval after its asset changes.
8. **Deliver:** report output path, duration, narration provider, actual external
   costs, review scope and unresolved issues. No automatic upload or publishing.

### Regional workflow

Prefer this opt-in path when the user wants natural-voice candidates or reusable
regional assets. Read `docs/regional-production-plan.md` and retain its critic
acceptance matrix. Plan, obtain any requested independent critique, then track
implementation and E2E evidence; do not claim a role-switch is independent review.

1. Keep the canonical brief unchanged; edit `examples/move-zeroes.locales.json`
   for regional teaching strings and spoken phrases. Global English `en` reuses
   the English pack; `en-IN` and `hi-IN` remain supported. The legacy regional
   command defaults to the two pilot locales. All visible strings, including
   numerals, are overlay content.
2. With installation approval, run `npm run regional:setup`. This creates an
   isolated optional Python runtime and verifies downloaded model/font hashes.
   Never install or download silently during a build.
3. Run `npm run regional:build -- examples/move-zeroes.json examples/move-zeroes.locales.json`.
   Append a single locale if needed. Rendered neutral clips, not generative video,
   supply the motion under exact-coordinate text overlays.
4. Review `outputs/<id>/regional/base/style.png`, `visual-master.mp4` and both
   locale directories. Neutral means **no text, numerals, logos or audio**;
   localized `silent.mp4` intentionally retains readable teaching text.
5. Preserve actual phrase sample timestamps. Retrospective step narration starts
   after the action; extend only the final hold, never slow motion or rush speech.
   Inspect swaps, pointer movement, hold entry/exit and the final audio tail.
   Index/pointer annotations may be occluded by a passing tile, but must not
   change logical position early or appear as duplicate token values.
6. Record reuse, failures, versions, hashes and actual costs in lifecycle/history.
   English Kokoro `af_heart` is US-accented despite India distribution; Hindi
   `hf_alpha` needs native listening. Do not call either voice approved without
   listening. There is no fallback to the old Windows demo voice.
7. Keep Instagram accounts, credentials and publishing outside this workflow
   until the user explicitly requests and approves that integration.

The command examples use relative paths; adapt separators for the host OS.
`outputs/` is private and ignored by Git. Do not stage account data, tokens,
signed URLs, uploaded-media URLs, local machine paths, or private trial records.

## Mandatory critic passes

- **Logical:** independent expected output, stable order, edge cases, correct
  complexity, and no false explanations. Review all important state transitions.
- **Motion:** token identity and count conserved; no morphing or teleportation;
  cell indices fixed; pointer movement follows the operation. Inspect encoded
  frames, not just source keyframes. Intermediate visual states are not necessarily
  committed algorithm states; keep that distinction explicit.
- **Teaching and silent use:** the problem, pointer roles, insight and conclusion
  must be understandable muted without relying on subtitle narration alone.
- **Narration and subtitles:** listen for pronunciation, pacing, truncation and
  audio levels. Check subtitle wording, alignment, wrapping and platform-safe placement.
- **Continuity and export:** review joins, beginning/end, duration, frame rate,
  decoding, audio streams and safe regions on a phone.

Automated checks do not prove rendered-image correctness or listening quality.
The same agent doing another pass is not independent review. Use one bounded
independent critic only when useful and authorised. Store findings with
timestamps/frame references in the lifecycle review record. Keep
`publishable: false` until all required reviews are actually complete.

## Generative media gate

Prefer deterministic motion for exact diagrams. Reuse brand templates, backgrounds,
sound assets and previously approved footage. The opening's question changes;
the reusable opening treatment does not require regeneration.

If generative footage materially helps:
1. Inspect live model forms; verify endpoint/reference capabilities and duration limits.
2. Prepare, visually review and hash start/end images plus intermediate path references.
3. Quote the exact settings and obtain explicit upload/spend approval.
4. Submit one representative trial; store the job ID immediately and resume that job.
5. Inspect the motion throughout. Correct endpoints do not imply correct motion.
6. Record prompt, model/mode, settings, input hashes, output hash, job ID, quoted
   and actual costs, critic findings and acceptance. Never auto-retry paid jobs.

Do not assume a midpoint image is supported as a timed model input.
Long generated sequences must be split at meaningful boundaries within supported
durations. Match boundary states and normalize media settings before assembly.
Do not hide incompatible algorithm states behind a crossfade. Script-rendered
timelines do not inherit generative model duration limits.

## Persistence and honest status

The current brief, trace/timeline, narration, aligned captions, keyframes, media
hashes and review evidence belong in the project's durable output folder.
Keep failure evidence and document changes; do not create uncontrolled versioned
copies or delete user files. This implementation does not automatically approve
videos, perform independent visual criticism, call OpenArt, or publish content.
