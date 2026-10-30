import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {uploadFileNames, uploadTextFiles} from '../lib/upload.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const segment = (value) => assert.match(value, /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/, 'Unsafe upload path segment');

export async function writeUploadHandoff({sourceDir, destinationDir, manifest, review, outputs}) {
  assert.equal(manifest.stage, 'awaiting-human-review', 'Incomplete upload package');
  assert.equal(review.stage, 'awaiting-human-review', 'Missing successful delivery review');
  if (Object.hasOwn(review, 'automated')) assert.equal(review.automated, 'passed');
  const hashes = new Map(manifest.files.map((entry) => [entry.file, entry.sha256]));
  assert.equal(hashes.size, manifest.files.length, 'Duplicate manifest entries');
  assert.ok(outputs.length, 'No upload outputs selected');
  const prepared = [];
  const destinations = new Set();
  for (const {format, locale, subdir} of outputs) {
    for (const value of [format, locale, subdir]) segment(value);
    const directory = path.join(destinationDir, locale, format);
    assert.ok(!destinations.has(directory), 'Duplicate upload destination');
    destinations.add(directory);
    const names = uploadFileNames(format);
    const bytes = new Map();
    for (const name of [...names, 'upload.json']) {
      const file = `${subdir}/${name}`;
      const data = await fs.readFile(path.join(sourceDir, subdir, name));
      assert.equal(digest(data), hashes.get(file), `Changed upload source: ${file}`);
      bytes.set(name, data);
    }
    const checked = review.deliveries.find((item) => item.format === format &&
      (item.locale ?? 'en') === locale);
    assert.equal(digest(bytes.get('final.mp4')), checked?.sha256, 'Video does not match delivery review');
    const metadata = JSON.parse(bytes.get('upload.json'));
    assert.equal(metadata.format, format);
    assert.equal(metadata.language, locale);
    const text = uploadTextFiles(metadata);
    for (const name of ['title.txt', 'description.txt', 'caption.txt']) {
      assert.equal(bytes.get(name).toString('utf8'), text[name], `Stale upload text: ${name}`);
    }
    assert.match(text['caption.txt'], /#[A-Za-z0-9_]+/, 'Social caption needs topic hashtags');
    assert.match(text['description.txt'], /#[A-Za-z0-9_]+/, 'Description needs topic hashtags');
    const existing = await fs.readdir(directory, {withFileTypes: true}).catch((error) => {
      if (error.code === 'ENOENT') return [];
      throw error;
    });
    for (const entry of existing) {
      assert.ok(entry.isFile() && names.includes(entry.name), `Unexpected upload file: ${path.join(directory, entry.name)}`);
    }
    prepared.push({directory, names, bytes});
  }
  // Validate every source and destination before replacing any existing upload assets.
  for (const {directory, names, bytes} of prepared) {
    await fs.mkdir(directory, {recursive: true});
    for (const name of [...names.filter((name) => name !== 'final.mp4'), 'final.mp4']) {
      const file = path.join(directory, name);
      await fs.writeFile(file, bytes.get(name));
      assert.equal(digest(await fs.readFile(file)), digest(bytes.get(name)), `Changed upload copy: ${file}`);
    }
    assert.deepEqual((await fs.readdir(directory)).sort(), [...names].sort(), 'Unexpected upload inventory');
  }
  return {directories: prepared.map((item) => item.directory),
    filesVerified: prepared.reduce((count, item) => count + item.names.length, 0)};
}
