import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {json} from './reel.mjs';
import {digest} from './regional.mjs';
import {uploadFileNames, uploadTextFiles} from '../lib/upload.mjs';
import {writeUploadHandoff} from './upload-handoff.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'outputs');
const escape = (text) => String(text).replace(/[&<>"']/g, (c) =>
  ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const cards = [];
for (const id of ['move-zeroes', 'remove-element', 'remove-duplicates', 'channel-intro', 'driver-heatmap']) {
  const story = ['channel-intro', 'driver-heatmap'].includes(id);
  const base = path.join(root, id, ...(story ? [] : ['launch']));
  const manifest = await json(path.join(base, 'manifest.json'));
  const review = await json(path.join(root, id, ...(story ? ['review.json'] : ['studio', 'delivery-verification.json'])));
  assert.equal(manifest.stage, 'awaiting-human-review', `${id}: incomplete package`);
  assert.equal(review.stage, 'awaiting-human-review', `${id}: missing current review`);
  const destinationDir = path.resolve(root, '..', 'studio_output', id);
  await writeUploadHandoff({sourceDir: base, destinationDir, manifest, review,
    outputs: ['portrait', 'landscape'].map((format) => ({
      format, locale: 'en', subdir: story ? format : `${format}-en`}))});
  const hashes = new Map(manifest.files.map((entry) => [entry.file, entry.sha256]));
  for (const format of ['portrait', 'landscape']) {
    const subdir = story ? format : `${format}-en`;
    const files = uploadFileNames(format);
    for (const name of files) assert.equal(await digest(path.join(base, subdir, name)), hashes.get(`${subdir}/${name}`), `${id}/${subdir}/${name}`);
    const metadata = await json(path.join(base, subdir, 'upload.json'));
    const text = uploadTextFiles(metadata);
    const url = (name) => path.relative(root, path.join(destinationDir, 'en', format, name)).split(path.sep).map(encodeURIComponent).join('/');
    cards.push(`<article><img src="${url('cover.png')}" alt="${escape(metadata.title)} cover">
      <h2>${escape(metadata.title)}</h2><p>${format} / ${metadata.durationSeconds.toFixed(2)} seconds</p>
      <nav>${files.map((name) => `<a href="${url(name)}">${escape(name)}</a>`).join('')}</nav>
      <details><summary>Copy-ready description</summary><pre>${escape(text['description.txt'].trimEnd())}</pre></details>
      <details><summary>Instagram / social caption</summary><pre>${escape(metadata.socialCaption)}</pre></details></article>`);
  }
}
const file = path.join(root, 'UPLOAD-READY.html');
await fs.writeFile(file, `<!doctype html><html lang="en"><meta charset="utf-8"><title>InterviewReel upload desk</title>
<meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{background:#0b1322;color:#f3f6ff;font:16px system-ui;margin:32px auto;max-width:1250px;padding:0 20px}
h1,a{color:#56d5ff}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px}
article{background:#13213a;border-radius:16px;padding:20px}img{width:100%;height:280px;object-fit:contain}
h2{font-size:20px}nav{display:flex;gap:12px;flex-wrap:wrap}pre{white-space:pre-wrap;font:inherit;line-height:1.6}
details{margin-top:20px}p{line-height:1.6}</style><h1>InterviewReel upload desk</h1>
<p>Five videos, each in portrait and landscape. Covers and descriptions are separate files:
select the cover in the platform's upload editor and paste the appropriate text. MP4 files do not apply them automatically.
All files are local. Listening, device review and publication approval remain pending.</p><main>${cards.join('\n')}</main></html>`);
console.log(`Upload index: ${file}`);
