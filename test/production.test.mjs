import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {compile, motion, FPS} from '../lib/core.mjs';
import {localize, neutralScene, geometry, resolveLocale, validateLocale} from '../lib/regional.mjs';
import {FORMATS, validateProduction, prepareProduction, shiftedCaptions, diagramTransform, previewSamples, previewFrame, assertSilenceBudget} from '../lib/production.mjs';
import {renderConcurrency} from '../scripts/render-runtime.mjs';

const config = JSON.parse(await fs.readFile(new URL('../examples/production.json', import.meta.url)));
const spec = JSON.parse(await fs.readFile(new URL('../examples/move-zeroes.json', import.meta.url)));
const packs = JSON.parse(await fs.readFile(new URL('../examples/move-zeroes.locales.json', import.meta.url)));

test('lesson review rejects excessive silence instead of only reporting it', () => {
  assert.doesNotThrow(() => assertSilenceBudget(0.932104, 1.5));
  assert.throws(() => assertSilenceBudget(5.887, 1.5), /silence/);
  assert.throws(() => assertSilenceBudget(NaN, 1.5), /silence/);
  assert.throws(() => assertSilenceBudget(0.9, undefined), /policy/);
});

test('validation evidence is portable but rejects source changes, altered reports and failed runs', async () => {
  const {validationFingerprint, requireValidation, bytesHash} = await import('../scripts/validation-state.mjs');
  const roots = ['first', 'relocated'].map((name) => fileURLToPath(new URL(`../.cache/studio-tests/validation/${name}/`, import.meta.url)));
  for (const root of roots) {
    for (const dir of ['lib', 'scripts', 'src', 'test', 'examples', 'assets/interviewreel', 'outputs']) {
      await fs.mkdir(path.join(root, dir), {recursive: true});
    }
    for (const name of ['package.json', 'package-lock.json', 'assets/interviewreel/voice.json',
      'assets/interviewreel/voice-reference.wav', 'src/example.jsx']) await fs.writeFile(path.join(root, name), name);
    await fs.writeFile(path.join(root, 'outputs', 'validation-tests.xml'), 'passed fixture');
  }
  const fingerprint = await validationFingerprint(roots[0]);
  assert.equal(await validationFingerprint(roots[1]), fingerprint);
  const state = {stage: 'passed', sourceSha256: fingerprint, reportSha256: bytesHash('passed fixture')};
  const file = path.join(roots[0], 'outputs', 'validation.json');
  await fs.writeFile(file, JSON.stringify(state));
  await requireValidation(roots[0]);
  await fs.writeFile(path.join(roots[0], 'src', 'example.jsx'), 'changed');
  await assert.rejects(() => requireValidation(roots[0]), /validate/);
  await fs.writeFile(path.join(roots[0], 'src', 'example.jsx'), 'src/example.jsx');
  await fs.writeFile(path.join(roots[0], 'outputs', 'validation-tests.xml'), 'changed report');
  await assert.rejects(() => requireValidation(roots[0]), /validate/);
  await fs.writeFile(path.join(roots[0], 'outputs', 'validation-tests.xml'), 'passed fixture');
  await fs.writeFile(file, JSON.stringify({...state, stage: 'failed'}));
  await assert.rejects(() => requireValidation(roots[0]), /validate/);
});

test('render worker policy respects CPU and free-memory budgets and rejects invalid overrides', () => {
  assert.equal(renderConcurrency(null, 16, 8 * 1024 ** 3), 2);
  assert.equal(renderConcurrency(null, 16, 3 * 1024 ** 3), 1);
  assert.equal(renderConcurrency(null, 2, 8 * 1024 ** 3), 1);
  assert.equal(renderConcurrency('6', 16, 8 * 1024 ** 3), 6);
  for (const value of ['0', '17', '2.5', 'bad']) assert.throws(() => renderConcurrency(value, 16));
  assert.throws(() => renderConcurrency('4', 2));
});

test('new lesson packs resolve return-length contracts and retain the selected voice', async () => {
  for (const name of ['remove-element', 'remove-duplicates']) {
    const lesson = JSON.parse(await fs.readFile(new URL(`../examples/${name}.json`, import.meta.url)));
    const locales = JSON.parse(await fs.readFile(new URL(`../examples/${name}.locales.json`, import.meta.url)));
    const production = JSON.parse(await fs.readFile(new URL(`../examples/${name}.production.json`, import.meta.url)));
    validateProduction(production);
    for (const output of production.outputs) {
      const pack = resolveLocale(locales, output.locale);
      const p = localize(prepareProduction(lesson, output), pack);
      assert.equal(pack.voice, 'af_heart');
      assert.equal(p.speechDelivery.mode, 'connected');
      assert.match(p.ui.output, new RegExp(String(p.resultLength)));
      assert.match(p.ui.problem, /ignore the tail/i);
      assert.doesNotMatch(JSON.stringify(p.scenes.map((s) => [s.title, s.instruction, s.phrases])), /\{(?:target|length|value|r|w)\}/);
    }
  }
});

test('production rejects ambiguous outputs, invalid brands, unsafe profiles and unsupported schema', () => {
  assert.equal(validateProduction(config), config);
  for (const change of [
    (c) => { c.schemaVersion = 2; },
    (c) => { c.outputs.push(c.outputs[0]); },
    (c) => { c.outputs[0].format = 'arbitrary'; },
    (c) => { c.outputs[0].format = '__proto__'; },
    (c) => { c.outputs[0].safe = {top: -1}; },
    (c) => { c.brand.watermark.opacity = 0; },
    (c) => { c.brand.watermark.type = 'image'; c.brand.watermark.file = 'logo.svg'; },
    (c) => { c.brand.introSeconds = 0.01; },
    (c) => { c.brand.outroSeconds = 10; },
    (c) => { c.launch.title = 'x'.repeat(101); },
    (c) => { c.launch.bio = ''; },
  ]) {
    const invalid = structuredClone(config); change(invalid);
    assert.throws(() => validateProduction(invalid));
  }
});

test('global English reuses translations without relabelling regional packs or permitting mismatched voices', () => {
  const en = resolveLocale(packs, 'en');
  assert.equal(en.locale, 'en');
  assert.equal(packs['en-IN'].locale, 'en-IN');
  assert.deepEqual(en.scenes, packs['en-IN'].scenes);
  assert.deepEqual(en.terms, packs['en-IN'].terms);
  assert.notEqual(en.accent, packs['en-IN'].accent);
  assert.equal(localize(prepareProduction(spec, {format: 'portrait'}), en).locale, 'en');
  assert.throws(() => validateLocale({...en, voice: 'hf_alpha'}), /Voice/);
  assert.throws(() => resolveLocale({en: packs['en-IN']}, 'en'), /must match/);
  assert.throws(() => resolveLocale({}, 'en'), /Unsupported/);
});

test('new openings precede steps without changing canonical algorithm actions', () => {
  const original = compile(spec);
  for (const format of Object.keys(FORMATS)) {
    const p = prepareProduction(spec, {format, locale: 'en-IN'});
    assert.equal(p.scenes[0].kind, 'hook');
    assert.equal(p.scenes[1].kind, 'setup');
    assert.ok(p.scenes[1].durationInFrames >= 10 * FPS);
    let start = 0;
    for (const scene of p.scenes) {
      assert.equal(scene.startFrame, start);
      start += scene.durationInFrames;
      if (scene.kind === 'step') {
        const old = original.scenes.find((s) => s.id === scene.id);
        for (const frame of [0, 60, 72, 84, 138]) assert.deepEqual(motion(scene, frame), motion(old, frame));
      }
    }
    assert.equal(start, p.durationInFrames);
  }
});

test('terminology, problem and initial variable definitions are present in both locales', () => {
  for (const [locale, pack] of Object.entries(packs)) {
    const p = localize(prepareProduction(spec, {format: 'portrait', locale}), pack);
    assert.ok(p.ui.scan.includes('r') && p.ui.write.includes('w'));
    assert.match(p.ui.variables, /nums/);
    assert.match(p.ui.variables, /\bn\b/);
    assert.match(p.ui.initial, /r = 0/);
    assert.match(p.ui.initial, /w = 0/);
    assert.ok(p.ui.problem && p.ui.output && p.ui.constraints);
    const text = JSON.stringify(p.scenes.map((s) => ({title: s.title, subtitle: s.subtitle, phrases: s.phrases})));
    assert.doesNotMatch(text, /blue|gold|scan pointer|नीला|सुनहरा|जाँच वाला संकेतक/i);
    assert.doesNotMatch(text, /\{(?:readPointer|writePointer)\}/);
    assert.ok(p.scenes[1].phrases.some((s) => s.includes(pack.terms.read.spoken)));
    assert.ok(p.scenes[1].phrases.some((s) => s.includes(pack.terms.write.spoken)));
  }
});

test('layouts conserve identities and keep token bodies inside each canvas through swaps', () => {
  for (const format of Object.keys(FORMATS)) {
    const p = prepareProduction({...spec, input: [0, -999, 0, 999, 3, 0], targetDurationSeconds: undefined},
      {format, locale: 'en-IN'});
    for (const scene of p.scenes.filter((s) => s.kind === 'step')) {
      const t = diagramTransform(p.layout, scene.kind);
      for (let frame = 0; frame < scene.durationInFrames; frame++) {
        for (const token of geometry(scene, frame).tokens) {
          assert.ok(t.x + token.x * t.scale >= 0);
          assert.ok(t.x + (token.x + token.width) * t.scale <= p.width);
          assert.ok(t.y + token.y * t.scale >= 0);
          assert.ok(t.y + (token.y + 128) * t.scale <= p.height);
        }
      }
    }
  }
});

test('localized/brand edits do not change neutral inputs; format changes do', () => {
  const p = prepareProduction(spec, {format: 'portrait', locale: 'en-IN'});
  const en = localize(p, packs['en-IN']);
  const hi = localize(p, packs['hi-IN']);
  assert.deepEqual(en.scenes.map(neutralScene), hi.scenes.map(neutralScene));
  const branded = structuredClone(en);
  branded.brand = 'OTHER BRAND';
  branded.brandConfig = {watermark: {enabled: true}};
  assert.deepEqual(branded.scenes.map(neutralScene), en.scenes.map(neutralScene));
  const wide = prepareProduction(spec, {format: 'landscape', locale: 'en-IN'});
  assert.notDeepEqual(wide.scenes.map(neutralScene), p.scenes.map(neutralScene));
});

test('intro offsets preserve exact subtitle frame ownership including disabled intro', () => {
  const captions = [{from: 12, to: 45, start: 0.4, end: 1.5, text: 'Read pointer r'}];
  assert.deepEqual(shiftedCaptions(captions, 0), captions);
  const shifted = shiftedCaptions(captions, 30);
  assert.equal(shifted[0].from, 42);
  assert.equal(shifted[0].to, 75);
  assert.equal(shifted[0].start, 1.4);
  assert.equal(shifted[0].end, 2.5);
  assert.equal(captions[0].from, 12);
});

test('diagnostic frame mapping reaches late scenes rather than clamping to preview duration', () => {
  const project = {...prepareProduction(spec, {format: 'portrait'}), brandConfig: config.brand, captions: []};
  const samples = previewSamples(project);
  const previewDuration = (samples.length + 3) * FPS;
  const challenge = samples.findIndex((s) => s.label === 'challenge');
  const sourceFrame = previewFrame(project, 30 + challenge * FPS + 15);
  assert.ok(sourceFrame > previewDuration);
  assert.equal(sourceFrame, samples[challenge].frame + 15);
  assert.equal(previewFrame(project, 0), null);
});

test('invalid translation clears earlier production approval before neural setup or rendering', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const directory = path.join(root, '.cache', 'studio-tests', 'failure');
  await fs.mkdir(directory, {recursive: true});
  const bad = structuredClone(packs);
  delete bad['en-IN'].ui.variables;
  await fs.writeFile(path.join(directory, 'locales.json'), JSON.stringify(bad));
  await fs.writeFile(path.join(directory, 'problem.json'), JSON.stringify({...spec, id: 'studio-failure-fixture'}));
  const fixture = path.join(directory, 'production.json');
  await fs.writeFile(fixture, JSON.stringify({...config, problem: 'problem.json', locales: 'locales.json', outputs: [config.outputs[0]]}));
  const delivery = path.join(root, 'outputs', 'studio-failure-fixture', 'studio', 'portrait', config.outputs[0].locale, 'delivery');
  await fs.mkdir(delivery, {recursive: true});
  await fs.writeFile(path.join(delivery, 'lifecycle.json'), JSON.stringify({stage: 'approved', review: {publishable: true}}));
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'studio.mjs'), 'build', fixture], {encoding: 'utf8'});
  assert.equal(result.status, 1);
  const record = JSON.parse(await fs.readFile(path.join(delivery, 'lifecycle.json')));
  assert.equal(record.stage, 'failed');
  assert.equal(record.review.publishable, false);
  assert.match(record.failure, /variables/);
});

test('launch packaging rejects stale branding, changed video bytes and unfinished deliveries', async () => {
  const {assertDelivery} = await import('../scripts/studio.mjs');
  const pack = resolveLocale(packs, 'en');
  const record = {stage: 'awaiting-human-review', review: {automated: 'passed', publishable: false},
    output: config.outputs[0], configuration: structuredClone(config), checks: {hasAudio: true},
    brief: structuredClone(spec), localePack: structuredClone(pack), render: {sha256: 'verified-video'}};
  assert.doesNotThrow(() => assertDelivery(record, config, config.outputs[0], 'verified-video', spec, pack));
  assert.throws(() => assertDelivery(record, config, config.outputs[0], 'modified-video', spec, pack), /stale/);
  for (const mutate of [
    (r) => { r.configuration.brand.name = 'Old brand'; },
    (r) => { r.stage = 'failed'; },
    (r) => { r.review.automated = 'pending'; },
    (r) => { r.output = {...r.output, locale: 'hi-IN'}; },
    (r) => { r.brief.input = [9, 0]; },
    (r) => { r.localePack.productionPhrases.hook = ['Changed script.']; },
  ]) {
    const invalid = structuredClone(record); mutate(invalid);
    assert.throws(() => assertDelivery(invalid, config, config.outputs[0], 'verified-video', spec, pack), /stale/);
  }
});

test('voice auditions reject unsafe IDs and missing flag values before producing audio', () => {
  const cli = fileURLToPath(new URL('../scripts/studio.mjs', import.meta.url));
  for (const args of [['--voice'], ['--voice', '../other']]) {
    const result = spawnSync(process.execPath, [cli, 'voice-sample', ...args], {encoding: 'utf8'});
    assert.equal(result.status, 1);
    assert.match(result.stderr, /--voice needs|audition voice ID/);
  }
});

test('review fails instead of merely reporting status when delivery evidence is missing', async () => {
  const dir = fileURLToPath(new URL('../.cache/studio-tests/review/', import.meta.url));
  await fs.mkdir(dir, {recursive: true});
  const id = `review-incomplete-${process.pid}`;
  const file = path.join(dir, 'production.json');
  await fs.writeFile(path.join(dir, 'problem.json'), JSON.stringify({...spec, id}));
  await fs.writeFile(path.join(dir, 'locales.json'), JSON.stringify(packs));
  await fs.writeFile(file, JSON.stringify({...config, problem: './problem.json', locales: './locales.json'}));
  const cli = fileURLToPath(new URL('../scripts/studio.mjs', import.meta.url));
  const audit = fileURLToPath(new URL(`../outputs/${id}/studio/delivery-verification.json`, import.meta.url));
  await fs.mkdir(path.dirname(audit), {recursive: true});
  await fs.writeFile(audit, JSON.stringify({stage: 'awaiting-human-review', oldSuccessfulResult: true}));
  const missing = spawnSync(process.execPath, [cli, 'review', file], {encoding: 'utf8'});
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /manifest.json/);
  const failure = JSON.parse(await fs.readFile(audit));
  assert.equal(failure.stage, 'failed');
  assert.equal(failure.oldSuccessfulResult, undefined);
  const launch = fileURLToPath(new URL(`../outputs/${id}/launch/`, import.meta.url));
  await fs.mkdir(launch, {recursive: true});
  await fs.writeFile(path.join(launch, 'manifest.json'), JSON.stringify({stage: 'awaiting-human-review',
    publishable: false, outputs: config.outputs, files: []}));
  const incomplete = spawnSync(process.execPath, [cli, 'review', file], {encoding: 'utf8'});
  assert.notEqual(incomplete.status, 0);
  assert.match(incomplete.stderr, /Incomplete launch manifest inventory/);
  await fs.writeFile(audit, JSON.stringify({stage: 'awaiting-human-review', oldSuccessfulResult: true}));
  const invalid = structuredClone(packs);
  delete invalid['en-IN'].ui.variables;
  await fs.writeFile(path.join(dir, 'locales.json'), JSON.stringify(invalid));
  const preflight = spawnSync(process.execPath, [cli, 'review', file], {encoding: 'utf8'});
  assert.notEqual(preflight.status, 0);
  assert.match(preflight.stderr, /variables/);
  const preflightFailure = JSON.parse(await fs.readFile(audit));
  assert.equal(preflightFailure.stage, 'failed');
  assert.equal(preflightFailure.oldSuccessfulResult, undefined);
});

test('newly generated media is staged into an existing render bundle before playback', async () => {
  const {stageReferencedMedia} = await import('../scripts/studio.mjs');
  const dir = fileURLToPath(new URL('../.cache/studio-tests/staging/', import.meta.url));
  const source = path.join(dir, 'source');
  const destination = path.join(dir, 'bundle', 'public');
  await fs.mkdir(source, {recursive: true});
  for (const file of ['clip.mp4', 'endpoint.png', 'voice.wav']) await fs.writeFile(path.join(source, file), file);
  const p = {scenes: [{base: {file: 'clip.mp4', endpoint: 'endpoint.png'}, audio: 'voice.wav'}]};
  await stageReferencedMedia(p, source, destination);
  assert.equal(await fs.readFile(path.join(destination, 'clip.mp4'), 'utf8'), 'clip.mp4');
  assert.equal(await fs.readFile(path.join(destination, 'voice.wav'), 'utf8'), 'voice.wav');
  p.scenes[0].audio = '../outside.wav';
  await assert.rejects(() => stageReferencedMedia(p, source, destination), /inside/);
  p.scenes[0].audio = 'absent.wav';
  await assert.rejects(() => stageReferencedMedia(p, source, destination), /ENOENT/);
});

test('lesson cache binds actual clips but ignores reuse bookkeeping and intro/outro-only edits', async () => {
  const {lessonFingerprint} = await import('../scripts/studio.mjs');
  const project = {...localize(prepareProduction(spec, {format: 'portrait'}), packs['en-IN']), brandConfig: structuredClone(config.brand)};
  assert.throws(() => lessonFingerprint(project, {}), /Resolve/);
  for (const scene of project.scenes) scene.base = {file: `${scene.id}.mp4`, endpoint: `${scene.id}.png`,
    sha256: 'original', endpointSha256: 'endpoint', reused: false};
  const initial = lessonFingerprint(project, {source: 'renderer'});
  project.brandConfig.introSeconds = 2;
  project.brandConfig.outroSeconds = 3;
  project.ui.outro = 'Different ending';
  project.scenes[0].base.reused = true;
  assert.equal(lessonFingerprint(project, {source: 'renderer'}), initial);
  project.scenes[0].base.sha256 = 'replacement-clip';
  assert.notEqual(lessonFingerprint(project, {source: 'renderer'}), initial);
  project.scenes[0].base.sha256 = 'original';
  project.scenes[0].base.endpointSha256 = 'replacement-hold';
  assert.notEqual(lessonFingerprint(project, {source: 'renderer'}), initial);
  assert.notEqual(lessonFingerprint(project, {source: 'changed-renderer'}), initial);
});

test('real assembly preserves frames, silent branding and narration with branding disabled or enabled',
  {skip: process.env.REEL_MEDIA_TESTS !== '1'}, async () => {
    const {default: ffmpeg} = await import('ffmpeg-static');
    const {assemble} = await import('../scripts/studio.mjs');
    const {execute} = await import('../scripts/reel.mjs');
    const dir = fileURLToPath(new URL('../.cache/studio-tests/', import.meta.url));
    await fs.mkdir(dir, {recursive: true});
    const intro = path.join(dir, 'intro.mp4');
    const lesson = path.join(dir, 'lesson.mp4');
    execute(ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=blue:s=160x90:r=30:d=0.2',
      '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', intro]);
    execute(ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=green:s=160x90:r=30:d=0.4',
      '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=0.4',
      '-c:v', 'libx264', '-c:a', 'aac', '-pix_fmt', 'yuv420p', lesson]);
    const parts = [{file: intro, frames: 6, audio: false}, {file: lesson, frames: 12, audio: true},
      {file: intro, frames: 6, audio: false}];
    const final = path.join(dir, 'assembled.mp4');
    const checks = await assemble(parts, final, {width: 160, height: 90});
    assert.equal(checks.frames, 24);
    assert.equal(checks.hasAudio, true);
    const raw = spawnSync(ffmpeg, ['-v', 'error', '-i', final, '-vn', '-ac', '1', '-ar', '48000', '-f', 's16le', '-'],
      {maxBuffer: 1024 * 1024});
    assert.equal(raw.status, 0);
    const rms = (start, end) => {
      let sum = 0, count = 0;
      for (let i = Math.floor(start * 48000); i < Math.floor(end * 48000); i++) {
        sum += (raw.stdout.readInt16LE(i * 2) / 32768) ** 2; count++;
      }
      return Math.sqrt(sum / count);
    };
    assert.ok(rms(0.02, 0.15) < 0.001);
    assert.ok(rms(0.3, 0.5) > 0.01);
    assert.ok(rms(0.67, 0.77) < 0.001);
    assert.equal((await assemble([parts[1]], path.join(dir, 'without-brand.mp4'),
      {width: 160, height: 90})).frames, 12);
  });

test('Chromium checks watermarks, multiline outros, channel artwork and text overflow',
  {skip: process.env.REEL_RENDER_TESTS !== '1'}, async () => {
    const {default: ffmpeg} = await import('ffmpeg-static');
    const {bundle} = await import('@remotion/bundler');
    const {renderStill, selectComposition} = await import('@remotion/renderer');
    const {execute, browserPath} = await import('../scripts/reel.mjs');
    const root = fileURLToPath(new URL('../', import.meta.url));
    const publicDir = path.join(root, '.cache', 'regional', 'public');
    const directory = path.join(root, '.cache', 'studio-tests', 'watermark');
    await fs.mkdir(directory, {recursive: true});
    await fs.mkdir(path.join(publicDir, 'brand'), {recursive: true});
    execute(ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=yellow:s=240x44',
      '-frames:v', '1', path.join(publicDir, 'brand', 'watermark-fixture.png')]);
    const browser = await browserPath();
    const serveUrl = await bundle({entryPoint: path.join(root, 'src', 'studio-index.jsx'), publicDir,
      outDir: path.join(root, '.cache', 'watermark-check-bundle')});
    const project = prepareProduction(spec, {format: 'square'});
    const brand = structuredClone(config.brand);
    brand.watermark = {...brand.watermark, type: 'image', asset: 'brand/watermark-fixture.png', opacity: 1};
    const props = {layout: project.layout, brand, font: 'fonts/noto-devanagari.ttf', frames: 30, text: brand.name};
    const capture = async (name) => {
      const composition = await selectComposition({serveUrl, id: 'BrandClip', inputProps: props,
        browserExecutable: browser, logLevel: 'error'});
      const file = path.join(directory, `${name}.png`);
      await renderStill({composition, serveUrl, inputProps: props, browserExecutable: browser, frame: 15,
        output: file, logLevel: 'error'});
      const result = spawnSync(ffmpeg, ['-v', 'error', '-i', file, '-vf', 'crop=10:10:850:40', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
        {maxBuffer: 1024 * 1024});
      assert.equal(result.status, 0);
      return [...result.stdout.subarray(0, 3)];
    };
    const marked = await capture('image');
    assert.ok(marked[0] > 230 && marked[1] > 230 && marked[2] < 30);
    props.brand.watermark.enabled = false;
    const unmarked = await capture('disabled');
    assert.ok(unmarked[0] < 40 && unmarked[1] < 40);
    props.brand.watermark = {...config.brand.watermark, width: 100, text: 'W'.repeat(28)};
    await assert.rejects(() => capture('overflow'), /overflow/);
    props.brand = structuredClone(config.brand);
    props.frames = 150;
    for (const locale of Object.keys(packs)) {
      props.text = packs[locale].ui.outro;
      for (const format of Object.keys(FORMATS)) {
        props.layout = prepareProduction(spec, {format}).layout;
        await capture(`outro-${format}-${locale}`);
      }
    }
    for (const [kind, width, height] of [
      ['avatar', 800, 800], ['banner', 2560, 1440], ['cover', 1080, 1920], ['cover', 1280, 720],
    ]) {
      const inputProps = {kind, width, height, brand: config.brand.name, title: spec.title,
        tagline: config.launch.tagline, pattern: packs['en-IN'].ui.pattern, font: props.font};
      const composition = await selectComposition({serveUrl, id: 'ChannelArt', inputProps,
        browserExecutable: browser, logLevel: 'error'});
      await renderStill({composition, serveUrl, inputProps, browserExecutable: browser, frame: 0,
        output: path.join(directory, `art-${kind}-${width}.png`), logLevel: 'error'});
    }
    const duplicateSpec = JSON.parse(await fs.readFile(new URL('../examples/remove-duplicates.json', import.meta.url)));
    const duplicatePacks = JSON.parse(await fs.readFile(new URL('../examples/remove-duplicates.locales.json', import.meta.url)));
    const inputProps = {project: {...localize(prepareProduction(duplicateSpec, {format: 'landscape'}), duplicatePacks.en),
      preview: true, font: props.font, brandConfig: config.brand}};
    const composition = await selectComposition({serveUrl, id: 'RegionalReel', inputProps,
      browserExecutable: browser, logLevel: 'error'});
    await renderStill({composition, serveUrl, inputProps, browserExecutable: browser, frame: 0,
      output: path.join(directory, 'cold-font-first-frame.png'), logLevel: 'error'});
  });
