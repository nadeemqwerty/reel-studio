import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import ffmpeg from 'ffmpeg-static';
import {FPS, subtitleText, validateProject} from '../lib/core.mjs';
import {applyTiming, localize, validateLocale} from '../lib/regional.mjs';
import {FORMATS, prepareProduction, previewSamples, shiftedCaptions, validateProduction} from '../lib/production.mjs';
import {browserPath, execute, inspectEncoded, evidence, hash, json, write, exists} from './reel.mjs';
import {setup, findPython, preflight, narrate, render, bases, localizedKeyframes, seamEvidence,
  beginRecord, seal, validCache, publicDir, assets, assetPath, neuralScript, digest} from './regional.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entryPoint = path.join(root, 'src', 'studio-index.jsx');
const sourceFiles = ['src/studio-index.jsx', 'src/studio.jsx', 'src/neutral.jsx', 'src/regional.jsx',
  'lib/core.mjs', 'lib/regional.mjs', 'lib/production.mjs', 'scripts/regional.mjs', 'scripts/studio.mjs', 'package-lock.json'];
const sourceHash = async (files) => hash(Buffer.concat(await Promise.all(files.map((file) => fs.readFile(path.join(root, file))))));

export function lessonFingerprint(project, renderer) {
  const {brandConfig: brand} = project;
  const inputs = {...project, brandConfig: {name: brand.name, watermark: brand.watermark},
    ui: {...project.ui, outro: undefined}, scenes: project.scenes.map((s) => {
      if (!s.base?.sha256 || !s.base?.endpointSha256) throw new Error('Resolve and verify neutral assets before fingerprinting a lesson.');
      return {...s, base: {file: s.base.file, endpoint: s.base.endpoint,
        sha256: s.base.sha256, endpointSha256: s.base.endpointSha256}};
    })};
  return hash(JSON.stringify({project: inputs, renderer}));
}

export async function loadProduction(file, only) {
  const configPath = path.resolve(file);
  const config = validateProduction(await json(configPath));
  const spec = await json(path.resolve(path.dirname(configPath), config.problem));
  const packs = await json(path.resolve(path.dirname(configPath), config.locales));
  const requested = only?.split(',');
  if (requested?.some((key) => !config.outputs.some((o) => `${o.format}:${o.locale}` === key))) {
    throw new Error('Selection contains an output not declared in the production configuration.');
  }
  const outputs = config.outputs.filter((o) => !requested || requested.includes(`${o.format}:${o.locale}`));
  for (const output of outputs) {
    validateProject(prepareProduction(spec, output));
    validateLocale(packs[output.locale]);
  }
  return {configPath, config, spec, packs, outputs};
}

async function brandAssets(config, configPath) {
  const brand = structuredClone(config.brand);
  const mark = brand.watermark;
  if (mark.enabled && mark.type === 'image') {
    const bytes = await fs.readFile(path.resolve(path.dirname(configPath), mark.file));
    if (bytes.length < 24 || bytes.length > 2 * 1024 * 1024 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
        bytes.readUInt32BE(16) > 4096 || bytes.readUInt32BE(20) > 4096) throw new Error('Watermark must be a PNG <=2 MB and <=4096px.');
    mark.asset = `brand/${hash(bytes)}.png`;
    mark.sha256 = hash(bytes);
    await fs.mkdir(path.join(publicDir, 'brand'), {recursive: true});
    await fs.writeFile(path.join(publicDir, mark.asset), bytes);
    delete mark.file;
  }
  return brand;
}

export async function stageReferencedMedia(project, source, destination) {
  const files = new Set(project.scenes.flatMap((s) => [s.base.file, s.base.endpoint, s.audio]));
  for (const file of files) {
    if (typeof file !== 'string' || path.isAbsolute(file) || file.split(/[\\/]/).includes('..')) {
      throw new Error('Media references must stay inside the public asset directory.');
    }
    const target = path.join(destination, file);
    await fs.mkdir(path.dirname(target), {recursive: true});
    await fs.copyFile(path.join(source, file), target);
  }
}

export async function assemble(parts, output, layout) {
  const args = ['-v', 'error', '-y'];
  for (const part of parts) {
    args.push('-i', part.file);
    if (!part.audio) args.push('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo');
  }
  let input = 0;
  const filters = [];
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index];
    const video = input++;
    const audio = part.audio ? video : input++;
    filters.push(`[${video}:v]trim=end_frame=${part.frames},setpts=PTS-STARTPTS,setsar=1[v${index}]`);
    filters.push(`[${audio}:a]aresample=48000,aformat=channel_layouts=stereo,apad,atrim=duration=${part.frames / FPS},asetpts=PTS-STARTPTS[a${index}]`);
  }
  filters.push(parts.map((_, i) => `[v${i}][a${i}]`).join('') + `concat=n=${parts.length}:v=1:a=1[v][a]`);
  const frames = parts.reduce((n, p) => n + p.frames, 0);
  execute(ffmpeg, [...args, '-filter_complex', filters.join(';'), '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-frames:v', String(frames), '-c:a', 'aac', '-ar', '48000', '-ac', '2', '-threads', '2',
    '-movflags', '+faststart', output]);
  return inspectEncoded(output, frames / FPS, true, layout);
}

async function brandClip(project, kind, renderer, serveUrl) {
  const frames = Math.round(project.brandConfig[`${kind}Seconds`] * FPS);
  if (!frames) return null;
  const props = {layout: project.layout, brand: project.brandConfig, font: project.font, frames,
    text: kind === 'intro' ? project.brand : project.ui.outro};
  const fingerprint = hash(JSON.stringify({props, source: renderer.sourceSha256,
    browser: renderer.browserSha256, ffmpeg: renderer.ffmpegSha256, font: assets[2].sha256}));
  const file = path.join(publicDir, 'brand', `${fingerprint}.mp4`);
  await fs.mkdir(path.dirname(file), {recursive: true});
  const reused = await validCache(file, fingerprint);
  if (!reused) {
    await render('BrandClip', props, serveUrl, renderer.browser, file, frames);
    await seal(file, fingerprint);
  }
  return {kind, file, frames, audio: false, sha256: await digest(file), reused,
    checks: inspectEncoded(file, frames / FPS, false, project.layout)};
}

async function joins(parts, out, video, layout) {
  const frames = new Set([0, parts.reduce((n, p) => n + p.frames, 0) - 1]);
  let cursor = 0;
  for (const part of parts.slice(0, -1)) { cursor += part.frames; frames.add(cursor - 1); frames.add(cursor); }
  const result = [];
  for (const frame of frames) {
    const file = path.join(out, 'review', `assembly-${frame}.png`);
    execute(ffmpeg, ['-v', 'error', '-y', '-ss', String(frame / FPS), '-i', video, '-frames:v', '1', file]);
    result.push({frame, file: path.relative(out, file), sha256: await digest(file)});
  }
  return {frames: result, dimensions: {width: layout.width, height: layout.height}};
}

async function produce(loaded, smoke) {
  const {config, configPath, spec, packs, outputs} = loaded;
  const parent = path.join(root, 'outputs', spec.id, 'studio');
  const started = Date.now();
  const record = await beginRecord(parent, {schemaVersion: 3, mode: smoke ? 'smoke' : 'build', configuration: config, outputs});
  const records = new Map();
  try {
    for (const output of outputs) {
      const directory = path.join(parent, output.format, output.locale, smoke ? 'smoke' : 'delivery');
      records.set(output, {directory, record: await beginRecord(directory,
        {schemaVersion: 3, output, mode: smoke ? 'diagnostic-preview' : 'delivery'})});
    }
    const inventory = await preflight();
    const browser = await browserPath();
    const brand = await brandAssets(config, configPath);
    const renderer = {entryPoint, sourceSha256: await sourceHash(sourceFiles),
      baseSourceSha256: await sourceHash(['src/studio-index.jsx', 'src/neutral.jsx', 'lib/core.mjs', 'lib/production.mjs', 'lib/regional.mjs', 'package-lock.json']),
      browser, browserSha256: await digest(browser), ffmpegSha256: await digest(ffmpeg)};
    const unique = [...new Set(outputs.map((o) => o.locale))].map((locale) =>
      localize(prepareProduction(spec, outputs.find((o) => o.locale === locale)), packs[locale]));
    const fontRequest = path.join(parent, 'font-check.json');
    await write(fontRequest, {command: 'fontcheck', font: assetPath(assets[2]), text:
      JSON.stringify(unique.map((p) => ({ui: p.ui, scenes: p.scenes, brand})))});
    const {python} = await import('./regional.mjs');
    execute(python, [neuralScript, fontRequest]);
    const speech = await narrate(unique, packs, inventory, parent);
    const projects = outputs.map((output) => {
      const p = applyTiming(localize(prepareProduction(spec, output), packs[output.locale]), speech.speech[output.locale],
        {maxExtraHoldSeconds: 8, maxDurationSeconds: config.maxDurationSeconds - brand.introSeconds - brand.outroSeconds});
      return {...p, font: 'fonts/noto-devanagari.ttf', brand: brand.name, brandConfig: brand};
    });
    const serveUrl = await bundle({entryPoint, publicDir, outDir: path.join(root, '.cache', 'studio-bundle')});
    const neutral = new Map();
    for (let index = 0; index < outputs.length; index++) {
      const output = outputs[index], project = projects[index];
      const {directory, record: current} = records.get(output);
      console.log(`${smoke ? 'Checking' : 'Building'} ${output.format}:${output.locale}`);
      current.brief = spec;
      current.configuration = config;
      current.terminology = packs[output.locale].terms;
      current.localePack = packs[output.locale];
      current.algorithmChecks = validateProject(project);
      current.narration = {settings: speech.settings, scenes: speech.speech[output.locale], accent: packs[output.locale].accent};
      current.stage = 'rendering';
      await write(path.join(directory, 'lifecycle.json'), current);
      let fingerprint = hash(JSON.stringify({project, source: renderer, mode: 'smoke'}));
      if (smoke) {
        const frames = Math.round((brand.introSeconds + brand.outroSeconds + previewSamples(project).length) * FPS);
        const video = path.join(directory, 'preview.mp4');
        const reused = await validCache(video, fingerprint);
        if (!reused) {
          await render('StudioPreview', {project}, serveUrl, browser, video, frames);
          await seal(video, fingerprint);
        }
        current.render = {sha256: await digest(video), reused, diagnosticOnly: true};
        current.checks = inspectEncoded(video, frames / FPS, false, project.layout);
        current.evidence = await evidence({...project, scenes: [], durationInFrames: frames}, directory, video);
      } else {
        const baseKey = hash(JSON.stringify(project.layout));
        if (!neutral.has(baseKey)) {
          neutral.set(baseKey, await bases(prepareProduction(spec, output),
            path.join(parent, output.format, baseKey.slice(0, 12)), renderer));
        }
        for (const scene of project.scenes) scene.base = neutral.get(baseKey)[scene.id];
        fingerprint = lessonFingerprint(project, renderer);
        // Bundling snapshots public assets; these clips may have been created afterwards.
        await stageReferencedMedia(project, publicDir, path.join(serveUrl, 'public'));
        await write(path.join(directory, 'timeline.json'), project);
        current.keyframes = await localizedKeyframes(project, directory, serveUrl, browser, fingerprint);
        const body = path.join(directory, 'lesson.mp4');
        const bodyReused = await validCache(body, fingerprint);
        if (!bodyReused) {
          await render('RegionalReel', {project}, serveUrl, browser, body, project.durationInFrames);
          await seal(body, fingerprint);
        }
        current.lessonChecks = inspectEncoded(body, project.durationInFrames / FPS, true, project.layout);
        const intro = await brandClip(project, 'intro', renderer, serveUrl);
        const outro = await brandClip(project, 'outro', renderer, serveUrl);
        const parts = [intro, {kind: 'lesson', file: body, frames: project.durationInFrames, audio: true,
          sha256: await digest(body), reused: bodyReused}, outro].filter(Boolean);
        const assemblyFingerprint = hash(JSON.stringify({parts: parts.map(({reused, ...p}) => p), source: renderer.sourceSha256}));
        const video = path.join(directory, 'final.mp4');
        const reused = await validCache(video, assemblyFingerprint);
        const frames = parts.reduce((n, p) => n + p.frames, 0);
        if (!reused) { await assemble(parts, video, project.layout); await seal(video, assemblyFingerprint); }
        current.checks = inspectEncoded(video, frames / FPS, true, project.layout);
        execute(ffmpeg, ['-v', 'error', '-y', '-i', video, '-map', '0:v:0', '-c:v', 'copy', '-an', path.join(directory, 'silent.mp4')]);
        current.silentChecks = inspectEncoded(path.join(directory, 'silent.mp4'), frames / FPS, false, project.layout);
        const introFrames = intro?.frames ?? 0;
        const captions = shiftedCaptions(project.captions, introFrames);
        await fs.writeFile(path.join(directory, 'subtitles.srt'), subtitleText(captions));
        await fs.writeFile(path.join(directory, 'subtitles.vtt'), subtitleText(captions, true));
        current.evidence = await evidence({...project, durationInFrames: frames,
          scenes: project.scenes.map((s) => ({...s, startFrame: s.startFrame + introFrames}))}, directory, video);
        current.seams = await seamEvidence(project, directory, video, introFrames);
        current.joins = await joins(parts, directory, video, project.layout);
        const peakLog = execute(ffmpeg, ['-hide_banner', '-i', video, '-vn', '-af', 'volumedetect', '-f', 'null', '-']).stderr;
        current.audioPeakDb = Number(/max_volume: ([-\d.]+) dB/.exec(peakLog)?.[1]);
        if (!Number.isFinite(current.audioPeakDb) || current.audioPeakDb > -0.5) throw new Error('Encoded audio exceeds headroom limit.');
        current.render = {sha256: await digest(video), reused, source: renderer.sourceSha256};
        current.assembly = {parts, introFrames, totalFrames: frames, captions};
        current.baseReuse = Object.values(neutral.get(baseKey)).map((s) => ({sha256: s.sha256, reused: s.reused}));
      }
      current.stage = 'awaiting-human-review';
      current.review.automated = 'passed';
      await write(path.join(directory, 'lifecycle.json'), current);
    }
    record.stage = 'awaiting-human-review';
    record.elapsedSeconds = (Date.now() - started) / 1000;
    record.results = [...records.values()].map(({directory, record: r}) => ({directory: path.relative(parent, directory), render: r.render, checks: r.checks}));
    await write(path.join(parent, 'lifecycle.json'), record);
    console.log(`Saved ${record.results.length} outputs in ${record.elapsedSeconds.toFixed(1)}s: ${parent}`);
  } catch (error) {
    record.stage = 'failed'; record.failure = error.message;
    await write(path.join(parent, 'lifecycle.json'), record);
    for (const {directory, record: r} of records.values()) {
      r.stage = 'failed'; r.failure = error.message; r.review.publishable = false;
      await write(path.join(directory, 'lifecycle.json'), r);
    }
    throw error;
  }
}

async function doctor() {
  const checks = [];
  for (const [name, check] of [
    ['Node >=20', async () => { if (Number(process.versions.node.split('.')[0]) < 20) throw new Error('Node >=20 required.'); return process.version; }],
    ['browser', browserPath], ['FFmpeg', async () => execute(ffmpeg, ['-version']).stdout.split('\n')[0]],
    ['Python 3.10-3.13', findPython], ['neural assets', async () => { await preflight(); return 'verified'; }],
    ['curl (setup downloads)', async () => execute('curl', ['--version']).stdout.split('\n')[0]],
    ['tar (source packaging)', async () => execute('tar', ['--version']).stdout.split('\n')[0]],
  ]) {
    try { checks.push({name, status: 'ready', detail: await check()}); }
    catch (error) { checks.push({name, status: 'missing', detail: error.message}); }
  }
  console.log(JSON.stringify({platform: process.platform, arch: process.arch, checks}, null, 2));
  if (checks.some((c) => c.status !== 'ready')) process.exitCode = 1;
}

async function packSource() {
  const out = path.join(root, 'outputs', 'bundles');
  await fs.mkdir(out, {recursive: true});
  const file = path.join(out, 'reel-studio-source.tar.gz');
  const entries = ['package.json', 'package-lock.json', '.gitignore', 'LICENSE', 'README.md',
    '.github', 'docs', 'examples', 'lib', 'scripts', 'src', 'test'];
  if (await exists(path.join(root, 'assets'))) entries.push('assets');
  execute('tar', ['-czf', file, '--exclude=__pycache__', '-C', root, ...entries]);
  const listing = execute('tar', ['-tzf', file]).stdout;
  if (/(^|\/)(node_modules|\.cache|outputs|\.git)(\/|$)/m.test(listing)) throw new Error('Forbidden runtime data in source bundle.');
  await write(path.join(out, 'manifest.json'), {file: path.basename(file), sha256: await digest(file),
    entries: listing.trim().split(/\r?\n/), includesModels: false, includesCredentials: false});
  console.log(`Portable source bundle: ${file}`);
}

async function invalidatePrior(file, only, smoke) {
  const configPath = path.resolve(file);
  const config = await json(configPath);
  const spec = await json(path.resolve(path.dirname(configPath), config.problem));
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(spec.id ?? '')) throw new Error('Invalid problem id.');
  const records = [];
  for (const o of Array.isArray(config.outputs) ? config.outputs : []) {
    if (!Object.hasOwn(FORMATS, o.format) || !['en-IN', 'hi-IN'].includes(o.locale) ||
        (only && !only.split(',').includes(`${o.format}:${o.locale}`))) continue;
    const directory = path.join(root, 'outputs', spec.id, 'studio', o.format, o.locale, smoke ? 'smoke' : 'delivery');
    if (await exists(path.join(directory, 'lifecycle.json'))) {
      records.push({directory, record: await beginRecord(directory, {schemaVersion: 3, output: o})});
    }
  }
  return records;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  if (command === 'doctor') return doctor();
  if (command === 'setup') {
    execute(process.execPath, [path.join(root, 'scripts', 'reel.mjs'), 'setup', ...args.slice(1)]);
    try { await preflight(); console.log('Reusing verified local neural environment.'); }
    catch { await setup(); }
    return doctor();
  }
  if (command === 'package') return packSource();
  if (!['plan', 'build', 'smoke', 'review'].includes(command)) {
    throw new Error('Use doctor | setup [--browser PATH | --download-browser] | plan/build/smoke/review <production.json> [--only format:locale,...] | package');
  }
  const selection = args.indexOf('--only');
  if (selection >= 0 && !args[selection + 1]) throw new Error('--only needs format:locale selections.');
  const file = args[1] ?? path.join(root, 'examples', 'production.json');
  const only = selection < 0 ? undefined : args[selection + 1];
  const prior = ['build', 'smoke'].includes(command) ? await invalidatePrior(file, only, command === 'smoke') : [];
  let loaded;
  try { loaded = await loadProduction(file, only); }
  catch (error) {
    for (const {directory, record} of prior) {
      record.stage = 'failed'; record.failure = error.message;
      await write(path.join(directory, 'lifecycle.json'), record);
    }
    throw error;
  }
  if (command === 'plan') {
    console.log(JSON.stringify({schemaVersion: 1, problem: loaded.spec.id, outputs: loaded.outputs.map((o) => ({
      ...o, ...FORMATS[o.format], canonicalLessonSeconds: prepareProduction(loaded.spec, o).durationInFrames / FPS})),
    brand: loaded.config.brand, totalDurationCap: loaded.config.maxDurationSeconds,
    note: 'Speech determines final holds. No downloads or rendering. Build defaults to all configured outputs.'}, null, 2));
  } else if (command === 'review') {
    for (const output of loaded.outputs) {
      const base = path.join(root, 'outputs', loaded.spec.id, 'studio', output.format, output.locale);
      for (const mode of ['delivery', 'smoke']) {
        const file = path.join(base, mode, 'lifecycle.json');
        if (await exists(file)) {
          const r = await json(file);
          console.log(JSON.stringify({output, mode, stage: r.stage, render: r.render, review: r.review}));
        }
      }
    }
  } else await produce(loaded, command === 'smoke');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.stack); process.exitCode = 1; });
}
