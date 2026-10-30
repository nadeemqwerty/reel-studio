import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {compile, motion, validateProject} from '../lib/core.mjs';
import {localize, applyTiming, neutralScene, geometry, canonicalFrame, validateLocale, resolveLocale} from '../lib/regional.mjs';
import {prepareProduction} from '../lib/production.mjs';
import {validCache} from '../scripts/regional.mjs';
import {hash} from '../scripts/reel.mjs';

const spec = JSON.parse(await fs.readFile(new URL('../examples/move-zeroes.json', import.meta.url)));
const packs = JSON.parse(await fs.readFile(new URL('../examples/move-zeroes.locales.json', import.meta.url)));
const canonical = compile(spec);
function audio(project, seconds = 4.5) {
  return Object.fromEntries(project.scenes.map((scene) => [scene.id, {
    duration: seconds, file: 'audio/test.wav', sha256: 'test',
    cues: scene.phrases.map((text, i) => ({text, start: i * seconds / scene.phrases.length,
      end: (i + 1) * seconds / scene.phrases.length})),
  }]));
}

test('locales preserve canonical tokens and do not leak into base cache input', () => {
  const en = localize(canonical, packs['en-IN']);
  const hi = localize(canonical, packs['hi-IN']);
  for (let i = 0; i < en.scenes.length; i++) {
    assert.deepEqual(neutralScene(en.scenes[i]), neutralScene(hi.scenes[i]));
    assert.deepEqual(en.scenes[i].before, canonical.scenes[i].before);
  }
  const changed = structuredClone(packs['en-IN']);
  changed.scenes.hook.phrases = ['A different original introduction.'];
  assert.deepEqual(neutralScene(localize(canonical, changed).scenes[0]), neutralScene(en.scenes[0]));
  assert.notDeepEqual(neutralScene({...en.scenes[2], before: [{id: 'other', value: 2}]}), neutralScene(en.scenes[2]));
  assert.equal(canonical.scenes[0].title, 'MOVE ZEROES.');
});

test('reject missing translation, malformed placeholders and mismatched voice locale', () => {
  for (const mutate of [
    (p) => { delete p.ui.goal; },
    (p) => { p.locale = 'fr-FR'; },
    (p) => { p.language = 'hi'; },
    (p) => { p.scenes.swap.title = 'Found {unrecognized}'; },
    (p) => { p.scenes.swap.title = 'Found {value'; },
    (p) => { p.scenes.setup.phrases = []; },
  ]) {
    const p = structuredClone(packs['en-IN']); mutate(p);
    assert.throws(() => validateLocale(p));
  }
  const p = structuredClone(packs['en-IN']);
  p.scenes.hook.phrases = ['Found {value}.'];
  assert.throws(() => localize(canonical, p), /invalid/);
});

test('holds map only to the canonical endpoint; every action frame is unchanged', () => {
  const project = localize(canonical, packs['en-IN']);
  const measured = audio(project);
  measured['step-2'].duration = 6;
  measured['step-2'].cues[0].end = 6;
  const result = applyTiming(project, measured);
  const scene = result.scenes.find((s) => s.id === 'step-2');
  assert.ok(scene.holdFrames > 0);
  assert.equal(canonicalFrame(scene, scene.baseFrames), scene.baseFrames - 1);
  assert.equal(canonicalFrame(scene, scene.durationInFrames - 1), scene.baseFrames - 1);
  assert.equal(validateProject(result).status, 'passed');
  let next = 0;
  for (const s of result.scenes) {
    assert.equal(s.startFrame, next); next += s.durationInFrames;
    assert.ok(s.audioStart + s.audioDuration + 0.2 <= s.seconds + 1e-9);
    for (let frame = 0; frame < s.baseFrames; frame++) {
      assert.deepEqual(motion(s, canonicalFrame(s, frame)), motion(s, frame));
    }
  }
  assert.equal(next, result.durationInFrames);
});

test('timing fails closed on early narration, oversized holds and final-scene truncation', () => {
  const p = localize(canonical, packs['en-IN']);
  const badStart = structuredClone(p);
  badStart.scenes[2].audioStart = 0.4;
  assert.throws(() => applyTiming(badStart, audio(p)), /precedes/);
  assert.throws(() => applyTiming(p, audio(p), {maxDurationSeconds: 1}), /duration/);
  assert.throws(() => applyTiming(p, audio(p), {exactSeconds: 1}), /duration/);
  const long = audio(p);
  long.challenge.duration = 20;
  long.challenge.cues[0].end = 20;
  assert.throws(() => applyTiming(p, long), /hold cap/);
  const final = audio(p);
  final.challenge.duration = 7;
  final.challenge.cues[0].end = 7;
  const result = applyTiming(p, final);
  assert.ok(result.scenes.at(-1).seconds >= 7.6);
});

test('guided production removes idle tails without cutting speech or any action frame', () => {
  const p = localize(prepareProduction(spec, {format: 'portrait', locale: 'en'}), resolveLocale(packs, 'en'));
  const measured = audio(p, 8);
  for (const item of Object.values(measured)) item.alignment = 'model-phoneme-sample-boundaries';
  for (const [id, seconds] of [['hook', 6.4], ['setup', 9.2], ['step-1', 4.2], ['step-2', 4.4]]) {
    measured[id] = {...audio(p, seconds)[id], alignment: 'model-phoneme-sample-boundaries'};
  }
  const result = applyTiming(p, measured, {maxExtraHoldSeconds: 8, maxDurationSeconds: 120});
  assert.ok(result.scenes[0].durationInFrames < p.scenes[0].durationInFrames);
  assert.ok(result.scenes[1].durationInFrames < p.scenes[1].durationInFrames);
  for (const scene of result.scenes) {
    assert.ok(scene.holdFrames >= 0);
    assert.ok(scene.audioStart + scene.audioDuration + 0.2 <= scene.seconds + 1e-9);
    if (scene.kind === 'step') {
      const original = p.scenes.find((s) => s.id === scene.id);
      const end = Math.ceil((scene.swap ? 4.6 : 2.1) * 30);
      assert.ok(scene.durationInFrames > end);
      for (let frame = 0; frame <= end; frame++) assert.deepEqual(motion(scene, frame), motion(original, frame));
    }
  }
  assert.equal(validateProject(result).status, 'passed');
  const unaligned = structuredClone(measured);
  delete unaligned.hook.alignment;
  assert.throws(() => applyTiming(p, unaligned), /model-aligned/);
  const bad = structuredClone(packs['en-IN']);
  bad.productionPhrases.swap = ['We moved {value} already.'];
  assert.throws(() => validateLocale(bad), /already completed/);
  assert.equal(localize(canonical, packs['en-IN']).scenes[2].audioStart, 2.1);
  assert.equal(localize(prepareProduction(spec, {format: 'portrait'}), packs['hi-IN']).scenes[2].audioStart, 2.1);
});

test('phrase boundaries are honest, non-overlapping and share frame ownership with sidecars', () => {
  const p = localize(canonical, packs['en-IN']);
  const measured = audio(p, 4.54);
  const result = applyTiming(p, measured);
  for (const cue of result.captions) {
    assert.ok(Math.abs(cue.start * 30 - cue.from) < 1e-9);
    assert.ok(Math.abs(cue.end * 30 - cue.to) < 1e-9);
  }
  for (let i = 1; i < result.captions.length; i++) assert.ok(result.captions[i].from >= result.captions[i - 1].to);
  measured.hook.cues[0].text = 'Not what was synthesized.';
  assert.throws(() => applyTiming(p, measured), /alignment|phrase/);
  const tooFast = audio(p);
  tooFast.hook.cues[0].end = 0.4;
  assert.throws(() => applyTiming(p, tooFast), /reading/);
});

test('graphical geometry preserves fractional highlights, stable IDs, negatives and self-swaps', () => {
  for (const input of [[0, 1, 0, 3, 12], [-1, 0, -1], [1], [0, 0]]) {
    const p = compile({...spec, input, targetDurationSeconds: undefined});
    for (const scene of p.scenes.filter((s) => s.kind === 'step')) {
      for (let frame = 0; frame < scene.durationInFrames; frame++) {
        const g = geometry(scene, frame);
        assert.equal(new Set(g.tokens.map((t) => t.id)).size, input.length);
        assert.deepEqual(g.tokens.map((t) => t.value), scene.before.map((t) => t.value));
        assert.ok(g.tokens.every((t) => Number.isFinite(t.x) && Number.isFinite(t.y)));
      }
    }
  }
  const step = canonical.scenes.find((s) => s.id === 'step-2');
  assert.equal(geometry(step, 120).cells[0].complete, false);
  assert.equal(geometry(step, 121).cells[0].complete, true);
  const last = canonical.scenes.find((s) => s.id === 'step-5');
  assert.ok(!geometry(last, 239).pointers.some((p) => p.id === 'r'));
});

test('moving bodies occlude fixed annotations without moving their logical positions', () => {
  const scene = canonical.scenes.find((s) => s.id === 'step-2');
  const before = geometry(scene, 0);
  const crossing = geometry(scene, 67);
  const settled = geometry(scene, 84);
  assert.equal(crossing.cells[0].indexVisible, false);
  assert.equal(crossing.pointers.find((p) => p.id === 'r').occluded, true);
  assert.deepEqual(crossing.cells.map((c) => c.x), before.cells.map((c) => c.x));
  assert.deepEqual(crossing.pointers.map((p) => p.x), before.pointers.map((p) => p.x));
  assert.ok(before.cells.every((c) => c.indexVisible) && settled.cells.every((c) => c.indexVisible));
  assert.ok(settled.pointers.every((p) => !p.occluded));
});

test('cache rejects missing, corrupt or differently fingerprinted media', async () => {
  const dir = new URL('../.cache/regional-tests/', import.meta.url);
  await fs.mkdir(dir, {recursive: true});
  const file = new URL('cache-fixture.bin', dir);
  const filename = (await import('node:url')).fileURLToPath(file);
  await fs.writeFile(file, 'original fixture');
  await fs.writeFile(`${filename}.cache.json`, JSON.stringify({fingerprint: 'a', sha256: hash('original fixture')}));
  assert.equal(await validCache(filename, 'a'), true);
  assert.equal(await validCache(filename, 'b'), false);
  await fs.writeFile(file, 'corrupted fixture');
  assert.equal(await validCache(filename, 'a'), false);
  await fs.writeFile(`${filename}.cache.json`, '{interrupted');
  assert.equal(await validCache(filename, 'a'), false);
});

test('failed regional validation invalidates previous acceptance without touching legacy outputs', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const id = 'regional-failure-fixture';
  const directory = path.join(root, 'outputs', id, 'regional');
  const fixture = path.join(root, '.cache', 'regional-tests', 'failure-spec.json');
  await fs.mkdir(path.dirname(fixture), {recursive: true});
  await fs.mkdir(path.join(directory, 'en-IN'), {recursive: true});
  await fs.writeFile(fixture, JSON.stringify({...spec, id, language: 'unsupported'}));
  const prior = {stage: 'approved', review: {publishable: true}, render: {sha256: 'old-output'}};
  for (const file of [path.join(directory, 'lifecycle.json'), path.join(directory, 'en-IN', 'lifecycle.json')]) {
    await fs.writeFile(file, JSON.stringify(prior));
  }
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'regional.mjs'), 'build', fixture,
    path.join(root, 'examples', 'move-zeroes.locales.json'), 'en-IN'], {encoding: 'utf8'});
  assert.equal(result.status, 1);
  for (const file of [path.join(directory, 'lifecycle.json'), path.join(directory, 'en-IN', 'lifecycle.json')]) {
    const record = JSON.parse(await fs.readFile(file));
    assert.equal(record.stage, 'failed');
    assert.equal(record.review.publishable, false);
    assert.equal(record.render, undefined);
  }
  assert.match(await fs.readFile(path.join(directory, 'history.jsonl'), 'utf8'), /old-output/);
});

test('neural preflight rejects absent glyphs rather than accepting silent font fallback',
  {skip: process.env.REEL_NEURAL_TESTS !== '1'}, async () => {
    const root = fileURLToPath(new URL('../', import.meta.url));
    const python = path.join(root, '.cache', 'narration-env', process.platform === 'win32' ? 'Scripts' : 'bin',
      process.platform === 'win32' ? 'python.exe' : 'python');
    const request = path.join(root, '.cache', 'regional-tests', 'font-request.json');
    await fs.writeFile(request, JSON.stringify({command: 'fontcheck',
      font: path.join(root, '.cache', 'regional', 'models', 'noto-devanagari.ttf'), text: '\u{1f984}'}));
    const result = spawnSync(python, [path.join(root, 'scripts', 'narrate-neural.py'), request], {encoding: 'utf8'});
    assert.equal(result.status, 1);
    assert.match(result.stderr, /missing glyphs/);
  });

test('connected narration uses provider phrase boundaries and rejects missing or truncated timings',
  {skip: process.env.REEL_NEURAL_TESTS !== '1'}, async () => {
    const {python} = await import('../scripts/regional.mjs');
    const provider = fileURLToPath(new URL('../scripts/narrate-neural.py', import.meta.url));
    const result = spawnSync(python, ['-c', `
import importlib.util, sys
from types import SimpleNamespace
spec = importlib.util.spec_from_file_location("narrator", sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
class Engine:
    has_timings = True
    truncate = False
    samples = 2000
    tokenizer = SimpleNamespace(known=lambda text: text, phonemize=lambda text, lang: text)
    def create_timed(self, text, **kwargs):
        assert kwargs["continuous"] and kwargs["is_phonemes"]
        spans = [SimpleNamespace(phoneme=c, start=i / 10, end=(i + 1) / 10) for i, c in enumerate(text)]
        return [0.1] * self.samples, 1000, spans[:-1] if self.truncate else spans
engine = Engine()
job = {"phrases": ["Hi.", "Okay."], "voice": "af_heart", "language": "en-us",
       "speed": 0.96, "sentencePause": 0.14, "clausePause": 0.06}
samples, rate, cues = module.connected_speech(engine, job)
assert cues == [{"text": "Hi.", "start": 0.0, "end": 0.3},
                {"text": "Okay.", "start": 0.4, "end": 0.9}]
engine.samples = 899
assert module.connected_speech(engine, job)[2][-1]["end"] == 0.899
engine.samples = 898
try:
    module.connected_speech(engine, job)
except ValueError:
    pass
else:
    raise AssertionError("More than one missing audio sample was accepted")
engine.samples = 2000
for no_timings, truncated in [(True, False), (False, True)]:
    engine.has_timings, engine.truncate = not no_timings, truncated
    try:
        module.connected_speech(engine, job)
    except ValueError:
        pass
    else:
        raise AssertionError("Invalid provider timings were accepted")
`, provider], {encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr);
  });
