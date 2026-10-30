import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import ffmpeg from 'ffmpeg-static';
import {prepareProduction} from '../lib/production.mjs';
import {neutralScene} from '../lib/geometry.mjs';
import {browserPath, execute, inspectEncoded, json, write, exists} from './reel.mjs';
import {publicDir, render, digest} from './regional.mjs';
import {withRenderBrowser} from './render-runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'outputs', 'render-benchmark');
await fs.mkdir(out, {recursive: true});
const spec = await json(path.join(root, 'examples', 'move-zeroes.json'));
const scene = neutralScene(prepareProduction(spec, {format: 'portrait'}).scenes.find((s) => s.swap && s.r !== s.w));
const browser = await browserPath();
const serveUrl = await bundle({entryPoint: path.join(root, 'src', 'neutral-index.jsx'), publicDir,
  outDir: path.join(root, '.cache', 'benchmark-bundle')});
const stillsOnly = process.argv.includes('--stills');
const results = stillsOnly ? (await json(path.join(out, 'verification.json'))).results : [];
if (!stillsOnly) {
  for (const workers of [2, 4]) {
    process.env.REEL_RENDER_CONCURRENCY = String(workers);
    const file = path.join(out, `${workers}-workers.mp4`);
    const started = performance.now();
    await render('NeutralScene', {scene}, serveUrl, browser, file, scene.durationInFrames);
    const seconds = (performance.now() - started) / 1000;
    const checks = inspectEncoded(file, scene.durationInFrames / 30, false, scene.layout);
    const decoded = execute(ffmpeg, ['-v', 'error', '-i', file, '-map', '0:v:0', '-f', 'hash', '-hash', 'sha256', '-']).stdout.trim();
    results.push({workers, seconds, checks, decodedHash: decoded});
  }
}
if (results[0].decodedHash !== results[1].decodedHash) throw new Error('Worker count changed decoded pixels.');
const stillBatches = [];
for (const reuse of [false, true]) {
  const started = performance.now();
  const run = async (puppeteerInstance) => {
    const options = {serveUrl, inputProps: {scene}, browserExecutable: browser, puppeteerInstance, logLevel: 'error'};
    const composition = await selectComposition({...options, id: 'NeutralScene'});
    const hashes = [];
    for (const frame of [0, 72, 84, 138]) {
      const output = path.join(out, `still-${reuse ? 'shared' : 'fresh'}-${frame}.png`);
      await renderStill({...options, composition, frame, output});
      hashes.push(await digest(output));
    }
    return hashes;
  };
  const hashes = reuse ? await withRenderBrowser(browser, run) : await run(undefined);
  stillBatches.push({reuse, seconds: (performance.now() - started) / 1000, hashes});
}
if (JSON.stringify(stillBatches[0].hashes) !== JSON.stringify(stillBatches[1].hashes)) {
  throw new Error('Browser reuse changed screenshot pixels.');
}
const evidence = {scope: 'One 8-second portrait neutral swap and four stills; not a full-build speedup claim', results, stillBatches};
if (await exists(path.join(out, 'verification.json'))) await fs.appendFile(path.join(out, 'history.jsonl'),
  JSON.stringify(await json(path.join(out, 'verification.json'))) + '\n');
await write(path.join(out, 'verification.json'), evidence);
console.log(JSON.stringify(evidence, null, 2));
