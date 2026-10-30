import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {uploadFileNames, uploadTextFiles} from '../lib/upload.mjs';
import {writeUploadHandoff} from '../scripts/upload-handoff.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function fixture(t) {
  const cache = new URL('../.cache/', import.meta.url);
  await fs.mkdir(cache, {recursive: true});
  const directory = await fs.mkdtemp(new URL('upload-test-', cache));
  t.after(() => fs.rm(directory, {recursive: true, force: true}));
  const sourceDir = path.join(directory, 'source');
  const destinationDir = path.join(directory, 'handoff');
  const outputs = [{format: 'portrait', locale: 'en', subdir: 'portrait-en'},
    {format: 'landscape', locale: 'hi-IN', subdir: 'landscape-hi-IN'}];
  const manifest = {stage: 'awaiting-human-review', files: []};
  const review = {stage: 'awaiting-human-review', deliveries: []};
  for (const output of outputs) {
    const metadata = {title: 'Visual interviews', description: 'Explain the idea.',
      socialCaption: 'Try the challenge. #DSA #InterviewReel', pinnedComment: 'Your answer?',
      language: output.locale, format: output.format};
    const text = uploadTextFiles(metadata);
    await fs.mkdir(path.join(sourceDir, output.subdir), {recursive: true});
    for (const name of [...uploadFileNames(output.format), 'upload.json']) {
      const data = name === 'upload.json' ? JSON.stringify(metadata) : text[name] ?? `${output.subdir}/${name} fixture bytes`;
      await fs.writeFile(path.join(sourceDir, output.subdir, name), data);
      manifest.files.push({file: `${output.subdir}/${name}`, sha256: digest(data)});
    }
    review.deliveries.push({...output, sha256: manifest.files.find((f) => f.file === `${output.subdir}/final.mp4`).sha256});
  }
  return {sourceDir, destinationDir, outputs, manifest, review};
}

test('upload descriptions inherit missing caption hashtags once without losing content', () => {
  const metadata = {description: 'Read this. #DSA', socialCaption: 'Try it. #DSA #InterviewReel #InterviewReel'};
  const first = uploadTextFiles(metadata)['description.txt'];
  assert.equal(first, 'Read this. #DSA\n\n#InterviewReel\n');
  assert.equal(uploadTextFiles({...metadata, description: first.trimEnd()})['description.txt'], first);
});

test('reviewed upload handoff isolates formats/locales and exports only upload essentials', async (t) => {
  const input = await fixture(t);
  for (let run = 0; run < 2; run++) {
    assert.equal((await writeUploadHandoff(input)).filesVerified, 11);
    for (const output of input.outputs) {
      const directory = path.join(input.destinationDir, output.locale, output.format);
      assert.deepEqual((await fs.readdir(directory)).sort(), uploadFileNames(output.format).sort());
      for (const name of uploadFileNames(output.format)) {
        assert.deepEqual(await fs.readFile(path.join(directory, name)),
          await fs.readFile(path.join(input.sourceDir, output.subdir, name)));
      }
    }
  }
});

test('handoff rejects failed reviews, changed assets and stale copy before replacing existing videos', async (t) => {
  const input = await fixture(t);
  await writeUploadHandoff(input);
  const final = path.join(input.destinationDir, 'en', 'portrait', 'final.mp4');
  const previous = await fs.readFile(final);
  await assert.rejects(() => writeUploadHandoff({...input, review: {...input.review, stage: 'failed'}}), /successful delivery review/);
  const cover = path.join(input.sourceDir, 'landscape-hi-IN', 'cover.png');
  const original = await fs.readFile(cover);
  await fs.writeFile(cover, 'changed cover');
  await assert.rejects(() => writeUploadHandoff(input), /Changed upload source/);
  await fs.writeFile(cover, original);
  const stale = 'Description without required hashtags\n';
  await fs.writeFile(path.join(input.sourceDir, 'portrait-en', 'description.txt'), stale);
  input.manifest.files.find((f) => f.file === 'portrait-en/description.txt').sha256 = digest(stale);
  await assert.rejects(() => writeUploadHandoff(input), /Stale upload text/);
  assert.deepEqual(await fs.readFile(final), previous);
});

test('handoff rejects traversal and unexpected output clutter without deleting user files', async (t) => {
  const input = await fixture(t);
  await assert.rejects(() => writeUploadHandoff({...input,
    outputs: [{...input.outputs[0], locale: '../outside'}]}), /Unsafe upload path/);
  await writeUploadHandoff(input);
  const extra = path.join(input.destinationDir, 'en', 'portrait', 'notes.txt');
  await fs.writeFile(extra, 'Keep this user file');
  await assert.rejects(() => writeUploadHandoff(input), /Unexpected upload file/);
  assert.equal(await fs.readFile(extra, 'utf8'), 'Keep this user file');
});
