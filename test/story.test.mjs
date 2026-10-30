import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {storyTimeline as introTimeline, validateStory as validateIntro} from '../lib/story.mjs';

const config = JSON.parse(await fs.readFile(new URL('../examples/channel-intro.json', import.meta.url)));
const phrases = config.scenes.flatMap((s) => s.phrases);
const speech = {duration: phrases.length * 3, alignment: 'model-phoneme-sample-boundaries',
  file: 'audio/fixture.wav', cues: phrases.map((text, i) => ({text, start: i * 3, end: i * 3 + 2.8}))};

test('intro uses native captions and contiguous scenes, preserving five-second closing', () => {
  const timeline = introTimeline(config, speech);
  assert.equal(timeline.scenes[0].startFrame, 0);
  assert.equal(timeline.captions[0].start, 0.2);
  assert.equal(timeline.durationInFrames - timeline.bodyFrames, 150);
  for (let i = 0; i < timeline.scenes.length - 1; i++) {
    assert.equal(timeline.scenes[i].endFrame, timeline.scenes[i + 1].startFrame);
  }
  assert.equal(timeline.scenes.at(-1).endFrame, timeline.bodyFrames);
  assert.equal(timeline.captions.at(-1).end, speech.cues.at(-1).end + 0.2);
});

test('intro rejects mismatched, overlapping, out-of-range and unreadable measured cues', () => {
  for (const change of [
    (s) => { s.cues[0].text = 'Unrelated narration.'; },
    (s) => { s.cues[1].start = s.cues[0].end - 0.1; },
    (s) => { s.cues.at(-1).end = s.duration + 1; },
    (s) => { s.cues[0].end = 0.5; },
    (s) => { s.cues[0].end = 1; },
    (s) => { s.cues[0].start = NaN; },
    (s) => { s.cues.pop(); },
    (s) => { s.alignment = 'guessed'; },
  ]) {
    const changed = structuredClone(speech);
    change(changed);
    assert.throws(() => introTimeline(config, changed), /measured|alignment|reading budget/);
  }
});

test('intro enforces duration and rejects unsupported or duplicate formats and scene order', () => {
  assert.throws(() => introTimeline({...config, maxDurationSeconds: 15}, speech), /duration cap/);
  assert.throws(() => validateIntro({...config, formats: ['square']}), /configuration/);
  assert.throws(() => validateIntro({...config, formats: ['portrait', 'portrait']}), /configuration/);
  assert.throws(() => validateIntro({...config, scenes: [...config.scenes].reverse()}), /scene order/);
});

test('real browser checks story hooks, algorithm preview, heatmap and overflow in both formats',
  {skip: process.env.REEL_RENDER_TESTS !== '1'}, async () => {
    const {bundle} = await import('@remotion/bundler');
    const {renderStill, selectComposition} = await import('@remotion/renderer');
    const {browserPath} = await import('../scripts/reel.mjs');
    const root = fileURLToPath(new URL('../', import.meta.url));
    const directory = path.join(root, '.cache', 'story-tests');
    await fs.mkdir(directory, {recursive: true});
    const brandDirectory = path.join(root, '.cache', 'regional', 'public', 'brand');
    await fs.mkdir(brandDirectory, {recursive: true});
    await fs.copyFile(path.join(root, 'assets', 'interviewreel', 'avatar.png'), path.join(brandDirectory, 'intro-avatar.png'));
    const serveUrl = await bundle({entryPoint: path.join(root, 'src', 'stories-index.jsx'),
      publicDir: path.join(root, '.cache', 'regional', 'public'),
      outDir: path.join(root, '.cache', 'story-test-bundle')});
    const browserExecutable = await browserPath();
    for (const name of ['channel-intro', 'driver-heatmap']) {
      const input = JSON.parse(await fs.readFile(path.join(root, 'examples', `${name}.json`)));
      const phrases = input.scenes.flatMap((s) => s.phrases);
      const project = introTimeline(input, {duration: phrases.length * 3, alignment: speech.alignment,
        cues: phrases.map((text, i) => ({text, start: i * 3, end: i * 3 + 2.8}))});
      for (const format of ['portrait', 'landscape']) {
        const inputProps = {project, format};
        const composition = await selectComposition({serveUrl, id: 'ChannelIntro', inputProps, browserExecutable, logLevel: 'error'});
        for (const frame of [0, project.scenes[name === 'channel-intro' ? 2 : 3].startFrame + 60,
          project.bodyFrames]) {
          await renderStill({composition, serveUrl, inputProps, browserExecutable, frame,
            output: path.join(directory, `${name}-${format}-${frame}.png`), logLevel: 'error'});
        }
        const tooLarge = structuredClone(project);
        tooLarge.scenes[0].title = 'W'.repeat(100);
        const negativeProps = {project: tooLarge, format};
        const negativeComposition = await selectComposition({serveUrl, id: 'ChannelIntro',
          inputProps: negativeProps, browserExecutable, logLevel: 'error'});
        await assert.rejects(() => renderStill({composition: negativeComposition, serveUrl, inputProps: negativeProps,
          browserExecutable, frame: 0, output: path.join(directory, 'overflow.png'), logLevel: 'error'}), /overflow/);
      }
    }
  });
