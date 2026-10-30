import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {compile, traceMoveZeroes, traceRemoveElement, traceRemoveDuplicates, motion, validateProject, captionsFromWords, restorePunctuation, subtitleText, wavDuration} from '../lib/core.mjs';
const spec = JSON.parse(fs.readFileSync(new URL('../examples/move-zeroes.json', import.meta.url)));

test('stable in-place trace covers zeros, duplicates, negatives and empty arrays', () => {
  for (const input of [[], [0], [1], [0, 0], [-1, 0, -1, 2], [0, 1, 0, 3, 12]]) {
    const copy = [...input];
    const {result, steps} = traceMoveZeroes(input);
    assert.deepEqual(result.map((t) => t.value), [...input.filter(Boolean), ...input.filter((v) => v === 0)]);
    assert.deepEqual(input, copy);
    for (let i = 1; i < steps.length; i++) assert.deepEqual(steps[i - 1].after, steps[i].before);
  }
});

test('every frame conserves token identity; swapped glyphs follow opposite arcs', () => {
  const project = compile(spec);
  assert.equal(project.durationInFrames, 1800);
  assert.equal(validateProject(project).status, 'passed');
  const scene = project.scenes.find((s) => s.id === 'step-2');
  const middle = motion(scene, 72);
  assert.deepEqual(middle.tokens.map((t) => t.value), [0, 1, 0, 3, 12]);
  assert.equal(middle.tokens[0].position, 0.5);
  assert.equal(middle.tokens[1].position, 0.5);
  assert.ok(middle.tokens[0].dy > 180 && middle.tokens[1].dy < -180);
  assert.equal(middle.w, 0);
  assert.equal(middle.r, 1);
  const end = motion(scene, 239);
  assert.equal(end.w, 1);
  assert.equal(end.r, 2);
});

test('zeros advance only scan, and no-zero input safely self-swaps', () => {
  const project = compile(spec);
  const zero = project.scenes.find((s) => s.id === 'step-1');
  assert.equal(motion(zero, 149).w, 0);
  assert.equal(motion(zero, 149).r, 1);
  const other = compile({...spec, input: [1], targetDurationSeconds: 34});
  const scene = other.scenes.find((s) => s.kind === 'step');
  assert.equal(motion(scene, 72).tokens[0].dy, 0);
  assert.equal(validateProject(other).status, 'passed');
});

test('reject unsupported templates, unsafe ids, oversized values and mismatched duration', () => {
  for (const update of [{id: '../escape'}, {input: [1000]}, {input: []},
    {algorithm: 'unimplemented'}, {targetDurationSeconds: 5}]) {
    assert.throws(() => compile({...spec, ...update}));
  }
});

test('word-aligned captions have real boundaries and SRT/VTT time rollover', () => {
  const captions = captionsFromWords([{text: 'Move', start: 0}, {text: 'zeroes', start: 0.5}], 1.5, 59.5);
  assert.deepEqual(captions, [{start: 59.5, end: 61, text: 'Move zeroes'}]);
  assert.match(subtitleText(captions), /00:00:59,500 --> 00:01:01,000/);
  assert.match(subtitleText(captions, true), /^WEBVTT/);
  assert.throws(() => captionsFromWords([], 1, 0));
  assert.throws(() => captionsFromWords([{text: 'bad', start: 2}], 1, 0));
});

test('captions preserve script punctuation and break at sentence boundaries', () => {
  const words = restorePunctuation([
    {text: 'Found', start: 0, position: 0},
    {text: '1', start: 0.3, position: 6},
    {text: 'Swap', start: 0.7, position: 9},
    {text: 'it', start: 1.0, position: 14},
  ], 'Found 1. Swap it.');
  assert.deepEqual(captionsFromWords(words, 1.4, 0).map((c) => c.text), ['Found 1.', 'Swap it.']);
  assert.throws(() => restorePunctuation([{text: 'Bad', start: 0, position: -1}], 'Bad'));
});

test('WAV parser measures PCM duration and rejects truncated files', () => {
  const wav = Buffer.alloc(44 + 32000);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVE', 8);
  wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt32LE(32000, 28);
  wav.write('data', 36); wav.writeUInt32LE(32000, 40);
  assert.equal(wavDuration(wav), 1);
  assert.throws(() => wavDuration(wav.subarray(0, 50)));
});

test('skill has supported frontmatter and no blanket tool permission', () => {
  const skill = fs.readFileSync(new URL('../.github/skills/reel-studio/SKILL.md', import.meta.url), 'utf8');
  assert.match(skill, /^---\r?\nname: reel-studio\r?\n/);
  assert.match(skill, /\ndescription: /);
  assert.doesNotMatch(skill, /allowed-tools:/);
});

test('removal traces preserve the valid prefix and unread suffix across exhaustive small inputs', () => {
  const arrays = [[]];
  for (let length = 1; length <= 5; length++) {
    arrays.push(...arrays.filter((a) => a.length === length - 1).flatMap((a) => [-1, 0, 1].map((v) => [...a, v])));
  }
  for (const input of arrays) {
    for (const target of [-1, 0, 1, 2]) {
      const trace = traceRemoveElement(input, target);
      const expected = input.filter((v) => v !== target);
      assert.equal(trace.keptLength, expected.length);
      assert.deepEqual(trace.result.slice(0, trace.keptLength).map((t) => t.value), expected);
      for (const s of trace.steps) {
        assert.deepEqual(s.after.slice(0, s.nextW).map((t) => t.value), input.slice(0, s.nextR).filter((v) => v !== target));
        assert.deepEqual(s.after.slice(s.nextR).map((t) => t.value), input.slice(s.nextR));
      }
    }
    const sorted = input.toSorted((a, b) => a - b);
    const trace = traceRemoveDuplicates(sorted);
    assert.equal(trace.keptLength, new Set(sorted).size);
    assert.deepEqual(trace.result.slice(0, trace.keptLength).map((t) => t.value), [...new Set(sorted)]);
    for (const s of trace.steps) {
      assert.deepEqual(s.after.slice(0, s.nextW).map((t) => t.value), [...new Set(sorted.slice(0, s.nextR))]);
      assert.deepEqual(s.after.slice(s.nextR).map((t) => t.value), sorted.slice(s.nextR));
    }
  }
  assert.throws(() => traceRemoveDuplicates([2, 1]), /sorted/);
  assert.throws(() => traceRemoveElement([1], undefined), /target/);
});

test('new lessons conserve animated tokens and reject invalid contracts or returned lengths', () => {
  for (const name of ['remove-element', 'remove-duplicates']) {
    const input = JSON.parse(fs.readFileSync(new URL(`../examples/${name}.json`, import.meta.url)));
    const project = compile(input);
    assert.equal(validateProject(project).status, 'passed');
    const corrupt = structuredClone(project);
    corrupt.scenes.find((s) => s.kind === 'summary').w++;
    assert.throws(() => validateProject(corrupt), /returned length/);
    if (name === 'remove-element') assert.throws(() => compile({...input, target: 1.5}), /target/);
    else assert.throws(() => compile({...input, challenge: [2, 1]}), /sorted/);
  }
});
