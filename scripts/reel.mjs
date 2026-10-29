import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import {bundle} from '@remotion/bundler';
import {ensureBrowser, renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import {compile, validateProject, captionsFromWords, restorePunctuation, subtitleText, wavDuration, FPS} from '../lib/core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const command = args[0];
const option = (key) => args.includes(key) ? args[args.indexOf(key) + 1] : undefined;
const hash = (data) => createHash('sha256').update(data).digest('hex');
const json = async (file) => JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
const write = async (file, value) => {
  await fs.mkdir(path.dirname(file), {recursive: true});
  await fs.writeFile(file, JSON.stringify(value, null, 2) + '\n');
};
const exists = async (file) => Boolean(file) && fs.access(file).then(() => true, () => false);
function execute(exe, argv) {
  const result = spawnSync(exe, argv, {encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, windowsHide: true});
  if (result.error || result.status !== 0) throw new Error(result.error?.message ?? result.stderr ?? `Failed: ${exe}`);
  return result;
}

async function browserPath() {
  const settings = await json(path.join(root, '.cache', 'settings.json')).catch(() => ({}));
  const candidates = [
    option('--browser'), process.env.REEL_BROWSER, settings.browser,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  for (const candidate of candidates) if (await exists(candidate)) return candidate;
  if (args.includes('--download-browser')) return (await ensureBrowser()).path;
  throw new Error('No browser found. Run npm run setup -- --browser <path>, or explicitly add --download-browser.');
}

async function setup() {
  if (Number(process.versions.node.split('.')[0]) < 20) throw new Error('Node 20 or later is required.');
  const browser = await browserPath();
  if (!await exists(ffmpeg)) throw new Error('FFmpeg is missing. Run npm install with dependency install scripts enabled.');
  execute(ffmpeg, ['-version']);
  await write(path.join(root, '.cache', 'settings.json'), {browser});
  console.log(`Setup ready: Node ${process.versions.node}, browser found, FFmpeg available.`);
  console.log(process.platform === 'win32'
    ? 'Windows offline narration is available via System.Speech; build will check the selected voice.'
    : 'For narration, supply --narration-dir with aligned WAV + word timestamps, or use --silent for a visual-only draft.');
}

async function addNarration(project, out) {
  if (args.includes('--silent')) {
    await fs.writeFile(path.join(out, 'subtitles.srt'), '');
    await fs.writeFile(path.join(out, 'subtitles.vtt'), 'WEBVTT\n\n');
    return {provider: 'none', status: 'explicit-silent-draft'};
  }
  const voice = option('--voice') ?? 'Microsoft David Desktop';
  const imported = option('--narration-dir');
  if (!imported && process.platform !== 'win32') throw new Error('Use --narration-dir on this platform; offline demo TTS is Windows-only.');
  const providerHash = imported ? 'imported' : hash(await fs.readFile(path.join(root, 'scripts', 'narrate.ps1')));
  const jobs = [];
  for (const scene of project.scenes) {
    const signature = hash(JSON.stringify({text: scene.speech, voice, rate: 0, providerHash})).slice(0, 16);
    const stem = `${scene.id}-${signature}`;
    const dir = path.join(out, 'assets', 'audio');
    await fs.mkdir(dir, {recursive: true});
    scene.audio = `audio/${stem}.wav`;
    scene.wordFile = path.join(dir, `${stem}.words.json`);
    const wav = path.join(dir, `${stem}.wav`);
    if (imported) {
      await fs.copyFile(path.resolve(imported, `${scene.id}.wav`), wav);
      await fs.copyFile(path.resolve(imported, `${scene.id}.words.json`), scene.wordFile);
    } else if (!await exists(wav) || !await exists(scene.wordFile)) {
      jobs.push({text: scene.speech, wav, words: scene.wordFile, voice});
    }
  }
  if (jobs.length) {
    const jobFile = path.join(out, 'narration-jobs.json');
    await write(jobFile, jobs);
    execute('powershell.exe', ['-NoProfile', '-File', path.join(root, 'scripts', 'narrate.ps1'), '-JobFile', jobFile]);
  }
  for (const scene of project.scenes) {
    const file = path.join(out, 'assets', scene.audio);
    const bytes = await fs.readFile(file);
    const duration = wavDuration(bytes);
    if (duration + 0.4 > scene.seconds - 0.2) {
      throw new Error(`${scene.id}: ${duration.toFixed(2)}s speech exceeds its scene budget. Shorten narration or lengthen the scene; do not speed it up silently.`);
    }
    scene.audioDuration = duration;
    scene.audioSha256 = hash(bytes);
    const raw = await json(scene.wordFile);
    const words = Array.isArray(raw) ? raw : [raw];
    const aligned = imported ? words : restorePunctuation(words, scene.speech);
    project.captions.push(...captionsFromWords(aligned, duration, scene.startFrame / FPS + 0.4));
    delete scene.wordFile;
  }
  await fs.writeFile(path.join(out, 'subtitles.srt'), subtitleText(project.captions));
  await fs.writeFile(path.join(out, 'subtitles.vtt'), subtitleText(project.captions, true));
  return {provider: imported ? 'imported-aligned-audio' : 'windows-sapi', voice: imported ? 'external' : voice,
    quality: imported ? 'requires-listening-review' : 'offline-demo-voice-not-studio-quality', externalCredits: 0};
}

function inspectEncoded(video, expectedSeconds, needsAudio) {
  const result = spawnSync(ffmpeg, ['-hide_banner', '-i', video], {encoding: 'utf8', windowsHide: true});
  if (result.error) throw result.error;
  const info = result.stderr;
  const match = /Duration: (\d+):(\d+):([\d.]+)/.exec(info);
  if (!match || !/1080x1920/.test(info) || !/30 fps/.test(info)) throw new Error(`Unexpected media metadata: ${info}`);
  const duration = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  if (Math.abs(duration - expectedSeconds) > 0.1) throw new Error(`Duration mismatch: ${duration}`);
  const hasAudio = /Audio:/.test(info);
  if (needsAudio && !hasAudio) throw new Error('Narrated export has no audio stream.');
  execute(ffmpeg, ['-v', 'error', '-i', video, '-f', 'null', '-']);
  return {duration, width: 1080, height: 1920, fps: 30, hasAudio, fullDecode: 'passed'};
}

async function evidence(project, out, video) {
  const dir = path.join(out, 'review');
  await fs.mkdir(dir, {recursive: true});
  execute(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', video,
    '-vf', 'fps=1/6,scale=270:480,tile=5x2', '-frames:v', '1', path.join(dir, 'overview.png')]);
  const motionSheets = [];
  for (const scene of project.scenes.filter((s) => s.kind === 'step' && s.swap && s.w !== s.r)) {
    const start = scene.startFrame / FPS + 2;
    const filename = `${scene.id}-swap.png`;
    execute(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(start), '-i', video,
      '-vf', 'crop=880:720:60:570,scale=440:360,tile=5x5', '-frames:v', '1', path.join(dir, filename)]);
    motionSheets.push({file: `review/${filename}`, startSeconds: start, decodedFrames: 25, fps: FPS});
  }
  return {overview: 'review/overview.png', motionSheets};
}

async function build() {
  if (!args[1] || args[1].startsWith('--')) throw new Error('Provide a problem JSON path.');
  const spec = await json(path.resolve(args[1]));
  const project = compile(spec);
  const checks = validateProject(project);
  const out = path.join(root, 'outputs', spec.id);
  await fs.mkdir(out, {recursive: true});
  const recordFile = path.join(out, 'lifecycle.json');
  const previous = await json(recordFile).catch(() => null);
  if (previous) await fs.appendFile(path.join(out, 'history.jsonl'), JSON.stringify(previous) + '\n');
  const record = {
    schemaVersion: 1, projectId: spec.id, stage: 'planning', updatedAt: new Date().toISOString(),
    brief: spec, algorithmChecks: checks, externalGenerations: [], externalGenerationCredits: 0,
  };
  await write(recordFile, record);
  try {
    await fs.writeFile(path.join(out, 'narration.txt'), project.scenes.map((s) => `${s.id}\n${s.speech}`).join('\n\n'));
    if (command === 'plan') {
      record.stage = 'planned';
      record.timeline = project;
      await write(recordFile, record);
      console.log(`Plan saved: ${out} (${project.durationInFrames / FPS}s). No media generated.`);
      return;
    }
    record.stage = 'narration';
    await write(recordFile, record);
    record.narration = await addNarration(project, out);
    record.stage = 'keyframes';
    await write(path.join(out, 'timeline.json'), project);
    await write(recordFile, record);
    const browser = await browserPath();
    const rendererSource = Buffer.concat(await Promise.all(
      ['src/index.jsx', 'src/reel.jsx', 'lib/core.mjs', 'package-lock.json'].map((f) => fs.readFile(path.join(root, f)))));
    const fingerprint = hash(Buffer.concat([rendererSource, Buffer.from(JSON.stringify(project))]));
    const serveUrl = await bundle({
      entryPoint: path.join(root, 'src', 'index.jsx'),
      publicDir: path.join(out, 'assets'),
      outDir: path.join(root, '.cache', 'bundles', spec.id),
    });
    const inputProps = {project};
    const composition = await selectComposition({serveUrl, id: 'Reel', inputProps, browserExecutable: browser, logLevel: 'error'});
    const keyframes = [];
    await fs.mkdir(path.join(out, 'keyframes'), {recursive: true});
    for (const scene of project.scenes) {
      const positions = scene.kind === 'step'
        ? (scene.swap ? [0, 2.4 * FPS, 2.8 * FPS, 4.6 * FPS] : [0, 2.1 * FPS]) : [0];
      for (const local of positions) {
        const frame = scene.startFrame + Math.round(local);
        const file = `keyframes/frame-${String(frame).padStart(4, '0')}.png`;
        await renderStill({composition, serveUrl, inputProps, browserExecutable: browser,
          frame, output: path.join(out, file), logLevel: 'error'});
        keyframes.push({frame, scene: scene.id, file, sha256: hash(await fs.readFile(path.join(out, file)))});
      }
    }
    record.keyframes = keyframes;
    record.stage = 'rendering';
    await write(recordFile, record);
    const final = path.join(out, 'final.mp4');
    const cacheFile = path.join(out, 'render-cache.json');
    const cached = await json(cacheFile).catch(() => null);
    const reusable = cached?.fingerprint === fingerprint && await exists(final)
      && hash(await fs.readFile(final)) === cached.sha256;
    if (!reusable) {
      let last = -1;
      await renderMedia({
        composition, serveUrl, inputProps, browserExecutable: browser,
        codec: 'h264', audioCodec: 'aac', pixelFormat: 'yuv420p', crf: 18, concurrency: 2,
        outputLocation: final, logLevel: 'error',
        onProgress: ({progress}) => {
          const bucket = Math.floor(progress * 4);
          if (bucket > last) { last = bucket; console.log(`Rendering ${Math.round(progress * 100)}%`); }
        },
      });
      await write(cacheFile, {fingerprint, sha256: hash(await fs.readFile(final))});
    } else console.log('Reusing matching rendered video.');
    record.stage = 'encoded-review';
    await write(recordFile, record);
    record.encodedChecks = inspectEncoded(final, project.durationInFrames / FPS, !args.includes('--silent'));
    execute(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', final, '-map', '0:v:0', '-c:v', 'copy', '-an', path.join(out, 'silent.mp4')]);
    record.evidence = await evidence(project, out, final);
    record.render = {fingerprint, sha256: hash(await fs.readFile(final)), reused: reusable,
      renderer: 'remotion', output: 'final.mp4', silentOutput: 'silent.mp4'};
    record.stage = 'awaiting-human-review';
    record.review = {logical: 'automated-passed', motion: 'pending-visual-review',
      silentComprehension: 'pending', narration: 'pending-listening-review', subtitles: 'pending',
      publishable: false};
    await write(recordFile, record);
    console.log(`Saved ${out}\\final.mp4 and silent.mp4. Human review is required; no auto-publishing.`);
  } catch (error) {
    record.failure = {stage: record.stage, message: error.message};
    record.stage = 'failed';
    await write(recordFile, record);
    throw error;
  }
}

try {
  if (command === 'setup') await setup();
  else if (command === 'plan' || command === 'build') await build();
  else if (command === 'review') {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(args[1] ?? '')) throw new Error('Provide the project id.');
    console.log(JSON.stringify(await json(path.join(root, 'outputs', args[1], 'lifecycle.json')), null, 2));
  } else throw new Error('Commands: setup, plan <spec.json>, build <spec.json>, review <project-id>.');
} catch (error) {
  console.error(error.stack);
  process.exitCode = 1;
}
