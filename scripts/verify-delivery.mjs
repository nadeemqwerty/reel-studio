import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import ffmpeg from 'ffmpeg-static';
import {fileURLToPath} from 'node:url';
import {subtitleText, validateProject} from '../lib/core.mjs';
import {uploadTextFiles} from '../lib/upload.mjs';
import {localize, applyTiming} from '../lib/regional.mjs';
import {prepareProduction, shiftedCaptions, assertSilenceBudget} from '../lib/production.mjs';
import {loadProduction, assertDelivery} from './studio.mjs';
import {digest, publicDir, assets} from './regional.mjs';
import {execute, json, write, inspectEncoded} from './reel.mjs';
import {writeUploadHandoff} from './upload-handoff.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const selection = process.argv.indexOf('--only');
if (selection >= 0 && !process.argv[selection + 1]) throw new Error('--only needs format:locale selections.');
const loaded = await loadProduction(process.argv[2] ?? path.join(root, 'examples', 'production.json'),
  selection < 0 ? undefined : process.argv[selection + 1]);
const {spec, config, outputs} = loaded;
const studio = path.join(root, 'outputs', spec.id, 'studio');
const launch = path.join(root, 'outputs', spec.id, 'launch');
const manifest = await json(path.join(launch, 'manifest.json'));
assert.equal(manifest.stage, 'awaiting-human-review');
assert.equal(manifest.publishable, false);
assert.deepEqual(manifest.outputs, outputs);
const required = ['avatar.png', 'channel-banner.png', 'channel.json'];
for (const output of outputs) {
  const prefix = `${output.format}-${output.locale}/`;
  for (const name of ['final.mp4', 'silent.mp4', 'subtitles.srt', 'subtitles.vtt', 'cover.png', 'upload.json',
    ...Object.keys(uploadTextFiles(config.launch))]) required.push(prefix + name);
  if (config.brand.introSeconds) required.push(prefix + 'intro.mp4');
  if (config.brand.outroSeconds) required.push(prefix + 'outro.mp4');
  if (output.format === 'landscape') required.push(prefix + 'thumbnail.png');
}
assert.deepEqual(manifest.files.map((f) => f.file).sort(), required.sort(), 'Incomplete launch manifest inventory');
for (const output of outputs) {
  const prefix = `${output.format}-${output.locale}`;
  for (const [name, text] of Object.entries(uploadTextFiles(config.launch))) {
    assert.equal(await fs.readFile(path.join(launch, prefix, name), 'utf8'), text, `Changed ${prefix}/${name}`);
  }
}
for (const entry of manifest.files) {
  const file = path.resolve(launch, entry.file);
  assert.ok(file.startsWith(launch + path.sep), 'Manifest path escaped launch folder');
  assert.equal(await digest(file), entry.sha256, entry.file);
  if (file.endsWith('.png')) {
    const bytes = await fs.readFile(file);
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    const name = path.basename(file);
    const format = outputs.find((o) => entry.file.startsWith(`${o.format}-${o.locale}/`))?.format;
    const expected = name === 'avatar.png' ? [800, 800] : name === 'channel-banner.png' ? [2560, 1440]
      : name === 'thumbnail.png' ? [1280, 720]
        : format === 'portrait' ? [1080, 1920] : format === 'landscape' ? [1920, 1080]
          : format === 'square' ? [1080, 1080] : [1080, 1350];
    assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], expected);
  }
}
const deliveries = [];
for (const output of outputs) {
  const dir = path.join(studio, output.format, output.locale, 'delivery');
  const target = path.join(launch, `${output.format}-${output.locale}`);
  const record = await json(path.join(dir, 'lifecycle.json'));
  assertDelivery(record, config, output, await digest(path.join(target, 'final.mp4')), spec, loaded.packs[output.locale]);
  assert.deepEqual(record.localePack, loaded.packs[output.locale], 'Locale pack changed since render');
  assert.deepEqual(record.brief, spec, 'Problem changed since render');
  const timeline = await json(path.join(dir, 'timeline.json'));
  const expected = applyTiming(localize(prepareProduction(spec, output), record.localePack), record.narration.scenes,
    {maxExtraHoldSeconds: 8, maxDurationSeconds: config.maxDurationSeconds - config.brand.introSeconds - config.brand.outroSeconds});
  const algorithm = validateProject(expected);
  assert.deepEqual(timeline.captions, expected.captions);
  assert.deepEqual(record.assembly.captions, shiftedCaptions(expected.captions, record.assembly.introFrames));
  assert.equal(record.assembly.totalFrames, expected.durationInFrames +
    Math.round((config.brand.introSeconds + config.brand.outroSeconds) * 30));
  assert.equal(record.narration.settings.model.sha256, assets[0].sha256);
  assert.equal(record.narration.settings.voices.sha256, assets[1].sha256);
  if (output.locale === 'en') {
    const voice = await json(path.join(root, 'assets', 'interviewreel', 'voice.json'));
    assert.equal(record.localePack.voice, voice.voice);
    assert.equal(record.localePack.language, voice.language);
    assert.equal(record.narration.settings.engine, voice.engine);
    assert.deepEqual(record.narration.settings.deliveries.en, voice.delivery);
    assert.equal(await digest(path.join(root, 'assets', 'interviewreel', voice.reference.file)), voice.reference.sha256);
  }
  for (const scene of expected.scenes) {
    const saved = timeline.scenes.find((s) => s.id === scene.id);
    for (const key of ['before', 'after', 'w', 'r', 'nextW', 'nextR', 'swap', 'startFrame',
      'durationInFrames', 'baseFrames', 'holdFrames', 'audioStart', 'phrases']) assert.deepEqual(saved[key], scene[key], `${scene.id}.${key}`);
    assert.equal(await digest(path.join(publicDir, saved.audio)), saved.audioSha256);
    assert.equal(saved.audioSha256, record.narration.scenes[scene.id].sha256);
    assert.equal(await digest(path.join(publicDir, saved.base.file)), saved.base.sha256);
    assert.equal(await digest(path.join(publicDir, saved.base.endpoint)), saved.base.endpointSha256);
    const frames = new Set([0, scene.baseFrames - 1, scene.durationInFrames - 1]);
    if (scene.holdFrames) frames.add(scene.baseFrames);
    if (scene.kind === 'step') for (const frame of scene.swap ? [60, 72, 84, 120, 138] : [45, 63]) frames.add(frame);
    for (const frame of frames) {
      const seam = record.seams?.find((s) => s.scene === scene.id && s.localFrame === frame);
      assert.ok(seam, `Missing encoded motion evidence: ${scene.id}/${frame}`);
      assert.equal(seam.globalFrame, scene.startFrame + frame + record.assembly.introFrames);
      if (scene.kind !== 'hook') assert.ok(Number.isFinite(seam.meanBodyPixelError) && seam.meanBodyPixelError <= 12);
      await fs.access(path.join(dir, seam.file));
    }
  }
  assert.ok(record.keyframes?.length && record.joins?.frames?.length);
  for (const item of [...record.keyframes, ...record.joins.frames]) assert.equal(await digest(path.join(dir, item.file)), item.sha256);
  const upload = await json(path.join(target, 'upload.json'));
  assert.equal(upload.frames, record.assembly.totalFrames);
  assert.equal(upload.durationSeconds, record.assembly.totalFrames / 30);
  for (const [name, vtt] of [['subtitles.srt', false], ['subtitles.vtt', true]]) {
    assert.equal(await fs.readFile(path.join(target, name), 'utf8'), subtitleText(record.assembly.captions, vtt));
  }
  const packets = (name) => execute(ffmpeg, ['-v', 'error', '-i', path.join(target, name),
    '-map', '0:v:0', '-c:v', 'copy', '-f', 'hash', '-hash', 'sha256', '-']).stdout.trim();
  assert.equal(packets('final.mp4'), packets('silent.mp4'));
  const checked = inspectEncoded(path.join(target, 'final.mp4'), upload.durationSeconds, true, timeline.layout);
  inspectEncoded(path.join(target, 'silent.mp4'), upload.durationSeconds, false, timeline.layout);
  const peakLog = execute(ffmpeg, ['-hide_banner', '-i', path.join(target, 'final.mp4'), '-vn',
    '-af', 'volumedetect', '-f', 'null', '-']).stderr;
  const peak = Number(/max_volume: ([-\d.]+) dB/.exec(peakLog)?.[1]);
  assert.ok(Number.isFinite(peak) && peak <= -0.5, 'Audio headroom exceeded');
  const lessonSeconds = record.assembly.parts.find((p) => p.kind === 'lesson').frames / 30;
  const log = execute(ffmpeg, ['-hide_banner', '-ss', String(record.assembly.introFrames / 30),
    '-t', String(lessonSeconds), '-i', path.join(target, 'final.mp4'), '-vn',
    '-af', 'silencedetect=noise=-40dB:d=0.4', '-f', 'null', '-']).stderr;
  const silences = [...log.matchAll(/silence_duration: ([\d.]+)/g)].map((m) => Number(m[1]));
  const longestSilence = Math.max(0, ...silences);
  if (output.locale === 'en') {
    const voice = await json(path.join(root, 'assets', 'interviewreel', 'voice.json'));
    assertSilenceBudget(longestSilence, voice.reviewPolicy.maxLessonSilenceSeconds);
  }
  deliveries.push({...output, checks: checked, algorithm, durationSeconds: upload.durationSeconds,
    sha256: record.render.sha256, audioPeakDb: peak,
    timingRebuiltFromMeasuredCues: true, voiceAndReferenceVerified: output.locale === 'en',
    encodedMotionEvidenceVerified: true, keyframeAndJoinHashesVerified: true,
    longestLessonSilenceSeconds: longestSilence, detectedSilences: silences.length,
    silentVideoPacketsMatch: true, sidecarsMatchAssembly: true});
}
const result = {stage: 'awaiting-human-review', verifiedAt: new Date().toISOString(), problem: spec.id, launchFilesVerified: manifest.files.length,
  artworkDimensionsPassed: true, silenceDetector: {thresholdDb: -40, minimumSeconds: 0.4, excludesBrandCuts: true},
  deliveries, humanReview: 'pending', publishable: false,
  humanChecklist: ['Listen to both full exports: tone, pronunciation, pauses and truncation',
    'Inspect opening definitions, each swap/pointer window, challenge and final outro',
    'Watch portrait on a phone and landscape on a wide display: readability and safe margins',
    'Confirm actual account/profile and explicitly approve publication'],
  scope: 'Fresh algorithm/timing/audio/stream audit plus hash-bound build motion/layout evidence; not a human quality approval'};
result.uploadHandoff = await writeUploadHandoff({sourceDir: launch,
  destinationDir: path.join(root, 'studio_output', spec.id), manifest, review: result,
  outputs: outputs.map((output) => ({...output, subdir: `${output.format}-${output.locale}`}))});
await write(path.join(studio, 'delivery-verification.json'), result);
console.log(JSON.stringify(result, null, 2));
