import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

export async function validationFingerprint(root) {
  const files = ['package.json', 'package-lock.json', 'assets/interviewreel/voice.json', 'assets/interviewreel/voice-reference.wav'];
  const walk = async (relative) => {
    for (const entry of await fs.readdir(path.join(root, relative), {withFileTypes: true})) {
      if (entry.name === '__pycache__') continue;
      const name = path.join(relative, entry.name);
      if (entry.isDirectory()) await walk(name);
      else if (entry.isFile()) files.push(name);
    }
  };
  for (const dir of ['lib', 'scripts', 'src', 'test', 'examples']) await walk(dir);
  const hash = createHash('sha256');
  for (const file of files.map((name) => name.split(path.sep).join('/')).sort()) hash.update(file).update('\0')
    .update(await fs.readFile(path.join(root, file))).update('\0');
  return hash.digest('hex');
}

export const bytesHash = (bytes) => createHash('sha256').update(bytes).digest('hex');

export async function requireValidation(root) {
  try {
    const state = JSON.parse(await fs.readFile(path.join(root, 'outputs', 'validation.json')));
    const report = await fs.readFile(path.join(root, 'outputs', 'validation-tests.xml'));
    if (state.stage !== 'passed' || state.sourceSha256 !== await validationFingerprint(root) ||
        state.reportSha256 !== bytesHash(report)) throw new Error('Stale validation evidence.');
    return state;
  } catch (error) {
    throw new Error(`Run npm run validate after setup or source/config changes. ${error.message}`);
  }
}
