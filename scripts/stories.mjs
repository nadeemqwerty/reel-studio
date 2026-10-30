import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import ffmpeg from 'ffmpeg-static';
import {storyTimeline as introTimeline, validateStory as validateIntro} from '../lib/story.mjs';
import {uploadTextFiles} from '../lib/upload.mjs';
import {validateHeatmapTrace} from '../lib/heatmap.mjs';
import {FORMATS, assertSilenceBudget} from '../lib/production.mjs';
import {CONNECTED_ENGLISH} from '../lib/regional.mjs';
import {subtitleText} from '../lib/core.mjs';
import {browserPath, execute, inspectEncoded, json, write} from './reel.mjs';
import {preflight, narrate, render, publicDir, digest, beginRecord} from './regional.mjs';
import {validationFingerprint, requireValidation} from './validation-state.mjs';
import {writeUploadHandoff} from './upload-handoff.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetDir = path.join(root, 'assets', 'interviewreel');
const file = path.resolve(process.argv[3] ?? path.join(root, 'examples', 'channel-intro.json'));
const id = path.basename(file, '.json');
assert.ok(['channel-intro', 'driver-heatmap'].includes(id), 'Use a supported story configuration filename.');
const out = path.join(root, 'outputs', id);
const outputNames = ['final.mp4', 'silent.mp4', 'subtitles.srt', 'subtitles.vtt', 'cover.png', 'upload.json',
  ...Object.keys(uploadTextFiles({}))];
const packetHash = (video) => execute(ffmpeg, ['-v', 'error', '-i', video, '-map', '0:v:0',
  '-c:v', 'copy', '-f', 'hash', '-hash', 'sha256', '-']).stdout.trim();
const reviewFrames = (timeline) => [...new Set([0,
  ...timeline.scenes.map((s) => Math.min(s.endFrame - 1, s.startFrame + 30)),
  timeline.bodyFrames, timeline.durationInFrames - 1])];

async function selectedVoice() {
  const voice = await json(path.join(assetDir, 'voice.json'));
  assert.equal(voice.voice, 'af_heart');
  assert.equal(voice.language, 'en-us');
  assert.equal(voice.engine, 'kokoro-onnx');
  assert.deepEqual(voice.delivery, CONNECTED_ENGLISH);
  assert.equal(await digest(path.join(assetDir, 'voice-reference.wav')), voice.reference.sha256);
  return voice;
}

async function review() {
  const reportFile = path.join(out, 'review.json');
  const previous = await json(reportFile).catch(() => null);
  if (previous) await fs.appendFile(path.join(out, 'review-history.jsonl'), JSON.stringify(previous) + '\n');
  await write(reportFile, {stage: 'verifying', publishable: false});
  try {
    const config = validateIntro(await json(file));
    const manifest = await json(path.join(out, 'manifest.json'));
    assert.equal(manifest.stage, 'awaiting-human-review', 'Incomplete intro build.');
    assert.equal(manifest.sourceSha256, await validationFingerprint(root), 'Stale intro source.');
    assert.deepEqual(manifest.configuration, config, 'Changed intro configuration.');
    const voice = await selectedVoice();
    assert.equal(manifest.voiceSha256, await digest(path.join(assetDir, 'voice.json')));
    assert.equal(manifest.avatarSha256, await digest(path.join(assetDir, 'avatar.png')));
    assert.equal(manifest.tests.sha256, await digest(path.join(out, 'validation-tests.xml')));
    assert.equal(manifest.validation.stage, 'passed');
    assert.equal(manifest.validation.sourceSha256, manifest.sourceSha256);
    assert.equal(manifest.validation.reportSha256, manifest.tests.sha256);
    if (config.kind === 'heatmap') assert.deepEqual(manifest.algorithm, validateHeatmapTrace());
    assert.equal(manifest.speech.sha256, await digest(path.join(publicDir, manifest.speech.file)));
    const timeline = introTimeline(config, manifest.speech);
    assert.deepEqual(await json(path.join(out, 'timeline.json')), timeline);
    assert.deepEqual(manifest.keyframes, reviewFrames(timeline), 'Incomplete keyframe evidence.');
    const names = new Set(manifest.files.map((entry) => entry.file));
    assert.equal(names.size, manifest.files.length);
    for (const name of ['timeline.json', 'validation-tests.xml', ...config.formats.flatMap((format) =>
      [...outputNames, 'review/overview.png', ...manifest.keyframes.map((frame) => `review/frame-${frame}.png`)]
        .map((file) => `${format}/${file}`))]) assert.ok(names.has(name), `Missing ${name}.`);
    if (config.formats.includes('landscape')) assert.ok(names.has('landscape/thumbnail.png'));
    for (const entry of manifest.files) {
      assert.ok(!path.isAbsolute(entry.file) && !entry.file.split(/[\\/]/).includes('..'));
      assert.equal(await digest(path.join(out, entry.file)), entry.sha256, `Changed ${entry.file}.`);
    }
    const deliveries = [];
    for (const format of config.formats) {
      const directory = path.join(out, format);
      const final = path.join(directory, 'final.mp4');
      const duration = timeline.durationInFrames / 30;
      const checks = inspectEncoded(final, duration, true, FORMATS[format]);
      inspectEncoded(path.join(directory, 'silent.mp4'), duration, false, FORMATS[format]);
      assert.equal(packetHash(final), packetHash(path.join(directory, 'silent.mp4')));
      for (const [name, vtt] of [['subtitles.srt', false], ['subtitles.vtt', true]]) {
        assert.equal(await fs.readFile(path.join(directory, name), 'utf8'), subtitleText(timeline.captions, vtt));
      }
      for (const [name, text] of Object.entries(uploadTextFiles(config.upload))) {
        assert.equal(await fs.readFile(path.join(directory, name), 'utf8'), text);
      }
      const png = await fs.readFile(path.join(directory, 'cover.png'));
      assert.equal(png.readUInt32BE(16), FORMATS[format].width);
      assert.equal(png.readUInt32BE(20), FORMATS[format].height);
      if (format === 'landscape') {
        const thumbnail = await fs.readFile(path.join(directory, 'thumbnail.png'));
        assert.equal(thumbnail.readUInt32BE(16), 1280);
        assert.equal(thumbnail.readUInt32BE(20), 720);
      }
      const peakLog = execute(ffmpeg, ['-hide_banner', '-i', final, '-vn', '-af', 'volumedetect', '-f', 'null', '-']).stderr;
      const peak = Number(/max_volume: ([-\d.]+) dB/.exec(peakLog)?.[1]);
      assert.ok(Number.isFinite(peak) && peak <= -0.5 && peak > -30, 'Invalid audio headroom.');
      const silenceLog = execute(ffmpeg, ['-hide_banner', '-i', final, '-t', String(timeline.bodyFrames / 30),
        '-vn', '-af', 'silencedetect=noise=-40dB:d=0.4', '-f', 'null', '-']).stderr;
      const longestSilence = Math.max(0, ...[...silenceLog.matchAll(/silence_duration: ([\d.]+)/g)].map((m) => Number(m[1])));
      assertSilenceBudget(longestSilence, voice.reviewPolicy.maxLessonSilenceSeconds);
      deliveries.push({format, ...checks, sha256: await digest(final), audioPeakDb: peak,
        longestNarrationSilenceSeconds: longestSilence, sidecarsMatch: true, silentVideoPacketsMatch: true});
    }
    const report = {stage: 'awaiting-human-review', automated: 'passed', verifiedAt: new Date().toISOString(),
      publishable: false, deliveries, selectedVoiceAndReference: 'verified', measuredTimingRebuilt: true,
      keyframeHashesVerified: true, humanReview: ['Full listening', 'Phone and landscape viewing', 'Publication approval'],
      validationScope: 'Source-bound full production validation, focused story tests and real-browser full renders'};
    report.uploadHandoff = await writeUploadHandoff({sourceDir: out,
      destinationDir: path.join(root, 'studio_output', id), manifest, review: report,
      outputs: config.formats.map((format) => ({format, locale: 'en', subdir: format}))});
    await write(reportFile, report);
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    await write(reportFile, {stage: 'failed', publishable: false, failure: error.message});
    throw error;
  }
}

async function build() {
  const record = await beginRecord(out, {kind: id});
  const manifest = {schemaVersion: 1, stage: 'building', publishable: false, files: []};
  await write(path.join(out, 'manifest.json'), manifest);
  await write(path.join(out, 'review.json'), {stage: 'stale', publishable: false});
  try {
    const config = validateIntro(await json(file));
    assert.equal(config.id, id);
    manifest.configuration = config;
    manifest.validation = await requireValidation(root);
    if (config.kind === 'heatmap') manifest.algorithm = validateHeatmapTrace();
    manifest.sourceSha256 = await validationFingerprint(root);
    await fs.copyFile(path.join(root, 'outputs', 'validation-tests.xml'), path.join(out, 'validation-tests.xml'));
    manifest.tests = {scope: 'full-production', sha256: await digest(path.join(out, 'validation-tests.xml'))};
    const voice = await selectedVoice();
    manifest.voiceSha256 = await digest(path.join(assetDir, 'voice.json'));
    manifest.avatarSha256 = await digest(path.join(assetDir, 'avatar.png'));
    const inventory = await preflight();
    const narration = await narrate([{locale: 'en', speechDelivery: voice.delivery,
      scenes: [{id: 'intro', phrases: config.scenes.flatMap((s) => s.phrases)}]}],
    {en: {voice: voice.voice, language: voice.language}}, inventory, out);
    manifest.speech = narration.speech.en.intro;
    manifest.narrationSettings = narration.settings;
    const timeline = introTimeline(config, manifest.speech);
    await write(path.join(out, 'timeline.json'), timeline);
    await fs.mkdir(path.join(publicDir, 'brand'), {recursive: true});
    await fs.copyFile(path.join(assetDir, 'avatar.png'), path.join(publicDir, timeline.avatar));
    const serveUrl = await bundle({entryPoint: path.join(root, 'src', 'stories-index.jsx'),
      publicDir, outDir: path.join(root, '.cache', 'intro-bundle')});
    const browser = await browserPath();
    manifest.browserSha256 = await digest(browser);
    const keyframes = reviewFrames(timeline);
    manifest.keyframes = keyframes;
    const track = async (relative) => manifest.files.push({file: relative,
      sha256: await digest(path.join(out, relative))});
    await track('timeline.json');
    await track('validation-tests.xml');
    for (const format of config.formats) {
      const directory = path.join(out, format);
      await fs.mkdir(path.join(directory, 'review'), {recursive: true});
      const inputProps = {project: timeline, format};
      const composition = await selectComposition({serveUrl, id: 'ChannelIntro', inputProps, browserExecutable: browser, logLevel: 'error'});
      for (const frame of keyframes) {
        await renderStill({composition, serveUrl, inputProps, browserExecutable: browser, frame,
          output: path.join(directory, 'review', `frame-${frame}.png`), logLevel: 'error'});
        await track(`${format}/review/frame-${frame}.png`);
      }
      const coverProps = {...inputProps, cover: true};
      const coverComposition = await selectComposition({serveUrl, id: 'ChannelIntro', inputProps: coverProps,
        browserExecutable: browser, logLevel: 'error'});
      await renderStill({composition: coverComposition, serveUrl, inputProps: coverProps, browserExecutable: browser,
        frame: config.kind === 'intro' ? timeline.scenes[1].startFrame + 12 : 12,
        output: path.join(directory, 'cover.png'), logLevel: 'error'});
      const final = path.join(directory, 'final.mp4');
      console.log(`Rendering channel introduction: ${format}`);
      await render('ChannelIntro', inputProps, serveUrl, browser, final, timeline.durationInFrames);
      execute(ffmpeg, ['-v', 'error', '-y', '-i', final, '-map', '0:v:0', '-c:v', 'copy', '-an',
        '-movflags', '+faststart', path.join(directory, 'silent.mp4')]);
      for (const [name, vtt] of [['subtitles.srt', false], ['subtitles.vtt', true]]) {
        await fs.writeFile(path.join(directory, name), subtitleText(timeline.captions, vtt));
      }
      await write(path.join(directory, 'upload.json'), {...config.upload, language: 'en', format,
        width: FORMATS[format].width, height: FORMATS[format].height, durationSeconds: timeline.durationInFrames / 30,
        captionsAlreadyBurnedIn: true, narration: 'Selected af_heart / en-us connected voice', outroAudio: 'silent',
        suggestedUse: format === 'portrait' ? ['Instagram Reels', 'YouTube Shorts', 'Other vertical feeds'] : ['YouTube channel trailer', 'Other landscape players'],
        publishable: false, accountConnected: false, humanReview: 'pending'});
      for (const [name, text] of Object.entries(uploadTextFiles(config.upload))) {
        await fs.writeFile(path.join(directory, name), text);
      }
      execute(ffmpeg, ['-v', 'error', '-y', '-i', final, '-vf',
        `fps=6/${timeline.durationInFrames / 30},scale=360:-2,tile=3x2`, '-frames:v', '1',
        path.join(directory, 'review', 'overview.png')]);
      for (const name of [...outputNames, 'review/overview.png']) await track(`${format}/${name}`);
      if (format === 'landscape') {
        execute(ffmpeg, ['-v', 'error', '-y', '-i', path.join(directory, 'cover.png'),
          '-vf', 'scale=1280:720', '-frames:v', '1', path.join(directory, 'thumbnail.png')]);
        await track(`${format}/thumbnail.png`);
      }
    }
    assert.equal(manifest.sourceSha256, await validationFingerprint(root), 'Source changed during intro build.');
    manifest.stage = 'awaiting-human-review';
    await write(path.join(out, 'manifest.json'), manifest);
    await review();
    record.stage = 'awaiting-human-review';
    record.review.automated = 'passed';
    await write(path.join(out, 'lifecycle.json'), record);
  } catch (error) {
    record.stage = manifest.stage = 'failed';
    record.failure = manifest.failure = error.message;
    await write(path.join(out, 'lifecycle.json'), record);
    await write(path.join(out, 'manifest.json'), manifest);
    await write(path.join(out, 'review.json'), {stage: 'failed', publishable: false, failure: error.message});
    throw error;
  }
}

if (process.argv[2] === 'build') await build();
else if (process.argv[2] === 'review') await review();
else throw new Error('Use intro build|review [examples/channel-intro.json]. No implicit installs or publishing.');
