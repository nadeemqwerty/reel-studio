import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import {bundle} from '@remotion/bundler';
import {renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import {renderConcurrency, withRenderBrowser} from './render-runtime.mjs';
import {compile, validateProject, subtitleText, wavDuration, FPS} from '../lib/core.mjs';
import {LOCALES, localize, applyTiming, neutralScene, geometry, resolveLocale} from '../lib/regional.mjs';
import {diagramTransform} from '../lib/production.mjs';
import {browserPath, execute, inspectEncoded, evidence, hash, json, write, exists} from './reel.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = path.join(root, '.cache', 'regional');
const publicDir = path.join(cache, 'public');
const python = path.join(root, '.cache', 'narration-env', process.platform === 'win32' ? 'Scripts' : 'bin',
  process.platform === 'win32' ? 'python.exe' : 'python');
const modelBase = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1';
const assets = [
  {name: 'kokoro-v1.0.onnx', url: `${modelBase}/kokoro-v1.0.onnx`,
    sha256: 'beb0d1848dee9a49da392cc3df26958d46cfa35d321edf434f52949153f0df3a'},
  {name: 'voices-v1.0.bin', url: `${modelBase}/voices-v1.0.bin`,
    sha256: 'bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d'},
  {name: 'noto-devanagari.ttf',
    url: 'https://raw.githubusercontent.com/google/fonts/2bc5d431b584d89e646214bf6cfa75494e76ceea/ofl/notosansdevanagari/NotoSansDevanagari%5Bwdth,wght%5D.ttf',
    sha256: '14ec4af41f27482216d1c2229f417ff9b1425e1babb014e57d1d40d03229853e'},
];
const assetPath = (asset) => path.join(cache, 'models', asset.name);
const neuralScript = path.join(root, 'scripts', 'narrate-neural.py');
const digest = async (file) => hash(await fs.readFile(file));
const rel = (file) => path.relative(publicDir, file).split(path.sep).join('/');

async function setup() {
  if (!await exists(python)) execute(findPython(), ['-m', 'venv', path.join(root, '.cache', 'narration-env')]);
  execute(python, ['-m', 'pip', 'install', '--quiet', '--disable-pip-version-check',
    '-r', path.join(root, 'scripts', 'requirements-narration.txt')]);
  await fs.mkdir(path.join(cache, 'models'), {recursive: true});
  for (const asset of assets) {
    const file = assetPath(asset);
    if (await exists(file) && await digest(file) === asset.sha256) continue;
    console.log(`Downloading ${asset.name} (explicit setup only).`);
    execute('curl', ['--fail', '--location', '--silent', '--show-error', '--retry', '2', '--output', file, asset.url]);
    if (await digest(file) !== asset.sha256) throw new Error(`Download hash mismatch: ${asset.name}`);
  }
  await fs.mkdir(path.join(publicDir, 'fonts'), {recursive: true});
  await fs.copyFile(assetPath(assets[2]), path.join(publicDir, 'fonts', assets[2].name));
  await write(path.join(cache, 'setup.json'), {assets, dependencies: dependencies(),
    externalGenerationCredits: 0, setupAt: new Date().toISOString()});
  console.log('Local neural narration and open font ready. No speech was uploaded or generated remotely.');
}

function findPython() {
  for (const candidate of [process.env.REEL_PYTHON, 'python', 'python3', 'py'].filter(Boolean)) {
    const result = spawnSync(candidate, ['-c', 'import sys; assert (3,10) <= sys.version_info[:2] < (3,14); print(sys.executable)'],
      {encoding: 'utf8', windowsHide: true});
    if (result.status === 0) return result.stdout.trim();
  }
  throw new Error('Install Python 3.10-3.13 or set REEL_PYTHON to its executable. Python 3.13 was tested.');
}

function dependencies() {
  return JSON.parse(execute(python, ['-m', 'pip', 'list', '--format=json', '--disable-pip-version-check']).stdout)
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function preflight() {
  if (!await exists(python)) throw new Error('Run npm run regional:setup explicitly. No implicit installation.');
  for (const asset of assets) {
    if (!await exists(assetPath(asset)) || await digest(assetPath(asset)) !== asset.sha256) {
      throw new Error(`Missing or corrupted ${asset.name}; run regional:setup explicitly.`);
    }
  }
  const inventory = dependencies();
  for (const [name, version] of [['kokoro-onnx', '0.6.1'], ['fonttools', '4.67.0']]) {
    if (!inventory.some((p) => p.name.toLowerCase() === name && p.version === version)) throw new Error(`Required ${name}==${version}.`);
  }
  const font = path.join(publicDir, 'fonts', assets[2].name);
  if (!await exists(font) || await digest(font) !== assets[2].sha256) throw new Error('Missing or corrupt render font.');
  return inventory;
}

export async function validCache(file, fingerprint) {
  const record = await json(`${file}.cache.json`).catch(() => null);
  return record?.fingerprint === fingerprint && await exists(file) && record.sha256 === await digest(file);
}

async function seal(file, fingerprint) {
  await write(`${file}.cache.json`, {fingerprint, sha256: await digest(file)});
}

async function beginRecord(dir, initial) {
  await fs.mkdir(dir, {recursive: true});
  const old = await json(path.join(dir, 'lifecycle.json')).catch(() => null);
  if (old) await fs.appendFile(path.join(dir, 'history.jsonl'), `${JSON.stringify(old)}\n`);
  const record = {...initial, updatedAt: new Date().toISOString(), stage: 'preflight',
    externalGenerations: [], externalGenerationCredits: 0, prompts: [],
    review: {publishable: false, nativeListening: 'pending', phoneReview: 'pending'}};
  await write(path.join(dir, 'lifecycle.json'), record);
  return record;
}
const saveRecord = (dir, record) => write(path.join(dir, 'lifecycle.json'), record);

async function narrate(projects, packs, inventory, out) {
  const settings = {engine: 'kokoro-onnx', model: assets[0], voices: assets[1], dependencies: inventory,
    providerSha256: await digest(neuralScript), peakLimit: 0.9};
  const deliveries = Object.fromEntries(projects.map((project) => [project.locale,
    project.speechDelivery ?? {mode: 'phrases', speed: 1, gapSeconds: 0.15,
      alignment: 'synthesized-phrase-sample-boundaries'}]));
  const jobs = new Map();
  const speech = {};
  for (const project of projects) {
    speech[project.locale] = {};
    for (const scene of project.scenes) {
      const pack = packs[project.locale];
      const delivery = deliveries[project.locale];
      const fingerprint = hash(JSON.stringify({settings, delivery, phrases: scene.phrases, voice: pack.voice, language: pack.language}));
      const wav = path.join(publicDir, 'audio', `${fingerprint}.wav`);
      const metadata = path.join(publicDir, 'audio', `${fingerprint}.json`);
      if (!(await validCache(wav, fingerprint) && await validCache(metadata, fingerprint))) {
        jobs.set(fingerprint, {...delivery, id: `${project.locale}/${scene.id}`, phrases: scene.phrases,
          voice: pack.voice, language: pack.language, wav, metadata, fingerprint});
      }
      speech[project.locale][scene.id] = {wav, metadata, fingerprint};
    }
  }
  if (jobs.size) {
    const request = path.join(out, 'neural-jobs.json');
    await write(request, {command: 'synthesize', model: assetPath(assets[0]), voices: assetPath(assets[1]), jobs: [...jobs.values()]});
    console.log(`Synthesizing ${jobs.size} unique scene scripts locally; duplicate scripts share audio.`);
    const result = execute(python, [neuralScript, request]);
    console.log(result.stdout.trim());
    for (const job of jobs.values()) {
      await seal(job.wav, job.fingerprint);
      await seal(job.metadata, job.fingerprint);
    }
  }
  for (const records of Object.values(speech)) {
    for (const [id, item] of Object.entries(records)) {
      const metadata = await json(item.metadata);
      const duration = wavDuration(await fs.readFile(item.wav));
      if (Math.abs(duration - metadata.duration) > 1 / metadata.sampleRate) throw new Error(`Audio/timing mismatch: ${id}`);
      records[id] = {...metadata, duration, file: rel(item.wav), sha256: await digest(item.wav),
        fingerprint: item.fingerprint, reused: !jobs.has(item.fingerprint)};
    }
  }
  return {speech, settings: {...settings, deliveries}};
}

async function render(id, inputProps, serveUrl, browser, output, duration) {
  const composition = await selectComposition({serveUrl, id, inputProps, browserExecutable: browser, logLevel: 'error'});
  if (composition.durationInFrames !== duration) throw new Error('Composition duration drift.');
  let last = -1;
  await renderMedia({composition, serveUrl, inputProps, browserExecutable: browser, codec: 'h264',
    audioCodec: 'aac', pixelFormat: 'yuv420p', crf: 18, concurrency: renderConcurrency(),
    outputLocation: output, logLevel: 'error',
    onProgress: ({progress}) => {
      const quarter = Math.floor(progress * 4);
      if (quarter > last) { last = quarter; console.log(`${id}: ${Math.round(progress * 100)}%`); }
    }});
  return composition;
}

async function localizedKeyframes(project, dir, serveUrl, browser, fingerprint, instance) {
  if (!instance) return withRenderBrowser(browser, (opened) => localizedKeyframes(project, dir, serveUrl, browser, fingerprint, opened));
  const composition = await selectComposition({serveUrl, id: 'RegionalReel', inputProps: {project},
    browserExecutable: browser, puppeteerInstance: instance, logLevel: 'error'});
  const frames = new Set(project.scenes.map((s) => s.startFrame));
  for (const scene of project.scenes.filter((s) => s.kind === 'step' && s.swap)) frames.add(scene.startFrame + 72);
  for (const cue of project.captions) frames.add(Math.floor((cue.from + cue.to) / 2));
  await fs.mkdir(path.join(dir, 'keyframes'), {recursive: true});
  const result = [];
  for (const frame of [...frames].sort((a, b) => a - b)) {
    const file = path.join(dir, 'keyframes', `${frame}.png`);
    if (!await validCache(file, `${fingerprint}-${frame}`)) {
      await renderStill({composition, serveUrl, inputProps: {project}, browserExecutable: browser, puppeteerInstance: instance,
        frame, output: file, logLevel: 'error'});
      await seal(file, `${fingerprint}-${frame}`);
    }
    result.push({frame, file: `keyframes/${frame}.png`, sha256: await digest(file)});
  }
  return result;
}

async function bases(canonical, out, renderer, instance) {
  if (!instance) return withRenderBrowser(renderer.browser, (opened) => bases(canonical, out, renderer, opened));
  const dir = path.join(out, 'base');
  const record = await beginRecord(dir, {schemaVersion: 2, brief: canonical.spec, kind: 'neutral-visuals'});
  try {
    const serveUrl = await bundle({entryPoint: renderer.neutralEntryPoint ?? renderer.entryPoint ?? path.join(root, 'src', 'regional-index.jsx'), publicDir,
      outDir: path.join(cache, 'base-bundle')});
    await fs.mkdir(path.join(publicDir, 'base'), {recursive: true});
    await fs.mkdir(path.join(dir, 'keyframes'), {recursive: true});
    const result = {};
    record.scenes = [];
    record.keyframes = [];
    for (const source of canonical.scenes) {
      const scene = neutralScene(source);
      const fingerprint = hash(JSON.stringify({scene, renderer: {...renderer, sourceSha256: renderer.baseSourceSha256}}));
      const file = path.join(publicDir, 'base', `${fingerprint}.mp4`);
      const endpoint = path.join(publicDir, 'base', `${fingerprint}.png`);
      const reused = await validCache(file, fingerprint) && await validCache(endpoint, fingerprint);
      const frames = scene.kind === 'step' ? (scene.swap ? [0, 72, 84, 138] : [0, 63]) : [0];
      const composition = await selectComposition({serveUrl, id: 'NeutralScene', inputProps: {scene},
        browserExecutable: renderer.browser, puppeteerInstance: instance, logLevel: 'error'});
      for (const frame of frames) {
        const still = path.join(dir, 'keyframes', `${source.id}-${frame}.png`);
        if (!await validCache(still, `${fingerprint}-${frame}`)) {
          await renderStill({composition, serveUrl, inputProps: {scene}, browserExecutable: renderer.browser, puppeteerInstance: instance,
            frame, output: still, logLevel: 'error'});
          await seal(still, `${fingerprint}-${frame}`);
        }
        record.keyframes.push({scene: source.id, frame, file: `keyframes/${source.id}-${frame}.png`, sha256: await digest(still)});
        if (source.id === 'hook' && frame === 0) await fs.copyFile(still, path.join(dir, 'style.png'));
      }
      if (!reused) {
        console.log(`Rendering neutral ${source.id}.`);
        await render('NeutralScene', {scene}, serveUrl, renderer.browser, file, scene.durationInFrames);
        execute(ffmpeg, ['-v', 'error', '-y', '-i', file,
          '-vf', `select=eq(n\\,${scene.durationInFrames - 1})`, '-frames:v', '1', endpoint]);
        await seal(file, fingerprint);
        await seal(endpoint, fingerprint);
      }
      const check = inspectEncoded(file, scene.durationInFrames / FPS, false, scene.layout);
      result[source.id] = {file: rel(file), endpoint: rel(endpoint), sha256: await digest(file),
        endpointSha256: await digest(endpoint), fingerprint, reused, checks: check};
      record.scenes.push({id: source.id, ...result[source.id]});
      await saveRecord(dir, record);
    }
    const list = path.join(dir, 'concat.txt');
    await fs.writeFile(list, Object.values(result).map((b) =>
      `file '${path.join(publicDir, b.file).split(path.sep).join('/').replaceAll("'", "'\\''")}'`).join('\n'));
    const base = path.join(dir, 'visual-master.mp4');
    execute(ffmpeg, ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-map', '0:v:0', '-c', 'copy', '-an', base]);
    record.encodedChecks = inspectEncoded(base, canonical.durationInFrames / FPS, false, canonical.layout);
    record.styleSha256 = await digest(path.join(dir, 'style.png'));
    record.evidence = await evidence(canonical, dir, base);
    record.sha256 = await digest(base);
    record.renderer = renderer;
    record.stage = 'awaiting-human-review';
    record.review.neutralTextNodes = 'checked-during-render';
    await saveRecord(dir, record);
    return result;
  } catch (error) {
    record.failure = error.message; record.stage = 'failed';
    await saveRecord(dir, record);
    throw error;
  }
}

function decodeFrame(video, frame, dimensions = {width: 1080, height: 1920}) {
  const result = spawnSync(ffmpeg, ['-v', 'error', '-ss', String(frame / FPS), '-i', video,
    '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], {maxBuffer: 8 * 1024 * 1024, windowsHide: true});
  if (result.status !== 0 || result.stdout?.length !== dimensions.width * dimensions.height * 3) throw new Error('Frame decoding failed.');
  return result.stdout;
}

export function compareBodyPixels(base, localized, scene, frame) {
  const g = geometry(scene, frame);
  const transform = diagramTransform(scene.layout, scene.kind);
  let difference = 0, count = 0;
  for (const token of g.tokens) {
    for (let dy = 14; dy < 21; dy++) for (let dx = 18; dx < 26; dx++) {
      const x = Math.round(transform.x + (token.x + dx) * transform.scale);
      const y = Math.round(transform.y + (token.y + dy) * transform.scale);
      const index = (y * (scene.layout?.width ?? 1080) + x) * 3;
      for (let c = 0; c < 3; c++) { difference += Math.abs(base[index + c] - localized[index + c]); count++; }
    }
  }
  const meanAbsoluteError = difference / count;
  if (!Number.isFinite(meanAbsoluteError) || meanAbsoluteError > 12) throw new Error(`Shared-base pixel mismatch: ${meanAbsoluteError}`);
  return meanAbsoluteError;
}

async function seamEvidence(project, out, video, offsetFrames = 0) {
  const checks = [];
  const directory = path.join(out, 'review');
  for (const scene of project.scenes) {
    const frames = new Set([0, scene.baseFrames - 1, scene.durationInFrames - 1]);
    if (scene.holdFrames) frames.add(scene.baseFrames);
    if (scene.kind === 'step') for (const frame of scene.swap ? [60, 72, 84, 120, 138] : [45, 63]) frames.add(frame);
    for (const local of [...frames].sort((a, b) => a - b)) {
      const globalFrame = offsetFrames + scene.startFrame + local;
      const canonical = Math.min(local, scene.baseFrames - 1);
      const filename = `${scene.id}-${local}.png`;
      execute(ffmpeg, ['-v', 'error', '-y', '-ss', String(globalFrame / FPS), '-i', video,
        '-frames:v', '1', path.join(directory, filename)]);
      const base = decodeFrame(path.join(publicDir, scene.base.file), canonical, project.layout);
      const localized = decodeFrame(video, globalFrame, project.layout);
      // Hook has a different two-row layout; its boundaries are saved for visual review.
      const mae = scene.kind === 'hook' ? null : compareBodyPixels(base, localized, scene, canonical);
      checks.push({scene: scene.id, localFrame: local, globalFrame, canonicalFrame: canonical,
        meanBodyPixelError: mae, file: `review/${filename}`});
    }
  }
  return checks;
}

export {setup, findPython, preflight, narrate, render, bases, localizedKeyframes, seamEvidence,
  beginRecord, seal, publicDir, assets, assetPath, neuralScript, python, digest};

async function build(specFile, packFile, requested = ['en-IN', 'hi-IN']) {
  const started = Date.now();
  const spec = await json(path.resolve(specFile));
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(spec.id ?? '')) throw new Error('Invalid project id.');
  const out = path.join(root, 'outputs', spec.id, 'regional');
  const record = await beginRecord(out, {schemaVersion: 2, brief: spec, requestedLocales: requested});
  const localeRecords = new Map();
  try {
    if (!requested.length || new Set(requested).size !== requested.length || requested.some((l) => !LOCALES.includes(l))) {
      throw new Error('Choose distinct supported locales.');
    }
    // Invalidate each requested locale's old approval before any fallible preflight.
    for (const locale of requested) {
      localeRecords.set(locale, await beginRecord(path.join(out, locale), {schemaVersion: 2, brief: spec, locale}));
    }
    const canonical = compile(spec);
    record.algorithmChecks = validateProject(canonical);
    const packs = await json(path.resolve(packFile));
    for (const locale of requested) packs[locale] = resolveLocale(packs, locale);
    const projects = requested.map((locale) => localize(canonical, packs[locale]));
    for (const locale of requested) localeRecords.get(locale).localePack = packs[locale];
    const inventory = await preflight();
    const fontRequest = path.join(out, 'font-check.json');
    await write(fontRequest, {command: 'fontcheck', font: assetPath(assets[2]),
      text: projects.map((p) => JSON.stringify({ui: p.ui, scenes: p.scenes, brand: p.brand})).join('\n')});
    execute(python, [neuralScript, fontRequest]);
    const browser = await browserPath();
    const baseSources = ['src/regional-index.jsx', 'src/neutral.jsx', 'lib/core.mjs', 'lib/regional.mjs',
      'lib/geometry.mjs', 'lib/production.mjs', 'scripts/render-runtime.mjs', 'package-lock.json'];
    const baseSource = Buffer.concat(await Promise.all(baseSources.map((file) => fs.readFile(path.join(root, file)))));
    const renderer = {sourceSha256: hash(Buffer.concat([baseSource, await fs.readFile(path.join(root, 'src', 'regional.jsx'))])),
      baseSourceSha256: hash(baseSource),
      browser, browserSha256: await digest(browser), ffmpegSha256: await digest(ffmpeg),
      encoding: {codec: 'h264', pixelFormat: 'yuv420p', crf: 18, fps: 30, width: 1080, height: 1920}};
    record.stage = 'narration'; await saveRecord(out, record);
    const {speech, settings} = await narrate(projects, packs, inventory, out);
    const timed = projects.map((p) => applyTiming(p, speech[p.locale]));
    record.stage = 'neutral-render'; await saveRecord(out, record);
    const shared = await bases(canonical, out, renderer);
    for (const project of timed) {
      project.font = 'fonts/noto-devanagari.ttf';
      for (const scene of project.scenes) scene.base = shared[scene.id];
    }
    const serveUrl = await bundle({entryPoint: path.join(root, 'src', 'regional-index.jsx'), publicDir,
      outDir: path.join(cache, 'localized-bundle')});
    for (const project of timed) {
      const dir = path.join(out, project.locale);
      const localRecord = localeRecords.get(project.locale);
      localRecord.stage = 'rendering'; await saveRecord(dir, localRecord);
      await write(path.join(dir, 'timeline.json'), project);
      await fs.writeFile(path.join(dir, 'subtitles.srt'), subtitleText(project.captions));
      await fs.writeFile(path.join(dir, 'subtitles.vtt'), subtitleText(project.captions, true));
      const fingerprint = hash(JSON.stringify({project: {...project, scenes: project.scenes.map((s) =>
        ({...s, base: {...s.base, reused: undefined}}))}, renderer, font: assets[2], pipelineSha256: await digest(fileURLToPath(import.meta.url))}));
      localRecord.keyframes = await localizedKeyframes(project, dir, serveUrl, browser, fingerprint);
      await saveRecord(dir, localRecord);
      const video = path.join(dir, 'final.mp4');
      const reused = await validCache(video, fingerprint);
      if (!reused) {
        console.log(`Rendering ${project.locale}: ${(project.durationInFrames / FPS).toFixed(2)}s.`);
        await render('RegionalReel', {project}, serveUrl, browser, video, project.durationInFrames);
        await seal(video, fingerprint);
      } else console.log(`Reusing ${project.locale} export.`);
      localRecord.stage = 'encoded-review'; await saveRecord(dir, localRecord);
      localRecord.encodedChecks = inspectEncoded(video, project.durationInFrames / FPS, true);
      execute(ffmpeg, ['-v', 'error', '-y', '-i', video, '-map', '0:v:0', '-c:v', 'copy', '-an', path.join(dir, 'silent.mp4')]);
      inspectEncoded(path.join(dir, 'silent.mp4'), project.durationInFrames / FPS, false);
      localRecord.evidence = await evidence(project, dir, video);
      localRecord.seams = await seamEvidence(project, dir, video);
      const levels = execute(ffmpeg, ['-hide_banner', '-i', video, '-vn', '-af', 'volumedetect', '-f', 'null', '-']).stderr;
      const peak = Number(/max_volume: ([-\d.]+) dB/.exec(levels)?.[1]);
      if (!Number.isFinite(peak) || peak > -0.5) throw new Error('Encoded audio peak exceeds headroom limit.');
      localRecord.audioPeakDb = peak;
      localRecord.narration = {settings, voice: packs[project.locale].voice, accent: packs[project.locale].accent,
        quality: 'neural-candidate-pending-listening', scenes: speech[project.locale]};
      localRecord.render = {fingerprint, sha256: await digest(video), reused, renderer, font: assets[2]};
      localRecord.timeline = project.scenes.map((s) => ({id: s.id, startFrame: s.startFrame,
        baseFrames: s.baseFrames, durationInFrames: s.durationInFrames, holdFrames: s.holdFrames, baseSha256: s.base.sha256}));
      localRecord.review.automated = 'logic-timing-layout-encoded-streams-base-pixels-passed';
      localRecord.stage = 'awaiting-human-review';
      await saveRecord(dir, localRecord);
    }
    record.stage = 'awaiting-human-review';
    record.elapsedSeconds = (Date.now() - started) / 1000;
    record.baseReusedScenes = Object.values(shared).filter((s) => s.reused).length;
    record.locales = [...localeRecords].map(([locale, r]) => ({locale, render: r.render, stage: r.stage}));
    await saveRecord(out, record);
    console.log(`Regional outputs saved: ${out}. ${record.elapsedSeconds.toFixed(1)}s; zero external generation credits.`);
  } catch (error) {
    record.failure = {stage: record.stage, message: error.message}; record.stage = 'failed';
    await saveRecord(out, record);
    for (const [locale, r] of localeRecords) {
      r.failure = {stage: r.stage, message: error.message}; r.stage = 'failed';
      await saveRecord(path.join(out, locale), r);
    }
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  try {
    if (args[0] === 'setup') await setup();
    else if (args[0] === 'build' && args[1] && args[2]) await build(args[1], args[2], args[3]?.split(','));
    else throw new Error('Use setup, or build <problem.json> <locales.json> [en,en-IN,hi-IN].');
  } catch (error) { console.error(error.stack); process.exitCode = 1; }
}
