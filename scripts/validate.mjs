import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {validationFingerprint, bytesHash} from './validation-state.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stateFile = path.join(root, 'outputs', 'validation.json');
async function main() {
  await fs.mkdir(path.join(root, 'outputs'), {recursive: true});
  await fs.writeFile(stateFile, JSON.stringify({stage: 'running', startedAt: new Date().toISOString()}));
  const sourceSha256 = await validationFingerprint(root);
  for (const dir of ['lib', 'scripts', 'test']) {
    for (const name of await fs.readdir(path.join(root, dir))) {
      if (!name.endsWith('.mjs')) continue;
      const check = spawnSync(process.execPath, ['--check', path.join(root, dir, name)], {stdio: 'inherit', windowsHide: true});
      if (check.status !== 0) throw new Error(`Syntax check failed: ${dir}/${name}`);
    }
  }
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=junit', 'test'], {cwd: root,
    env: {...process.env, REEL_NEURAL_TESTS: '1', REEL_MEDIA_TESTS: '1', REEL_RENDER_TESTS: '1'},
    encoding: 'utf8', windowsHide: true, maxBuffer: 10 * 1024 ** 2});
  await fs.writeFile(path.join(root, 'outputs', 'validation-tests.xml'), result.stdout ?? '');
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || String(result.error));
  if (/<skipped\b|<!-- skipped [1-9]/.test(result.stdout)) throw new Error('Production validation must not skip integration checks.');
  if (sourceSha256 !== await validationFingerprint(root)) throw new Error('Source changed during validation; rerun it.');
  await fs.writeFile(stateFile, JSON.stringify({stage: 'passed', verifiedAt: new Date().toISOString(),
    sourceSha256, reportSha256: bytesHash(result.stdout)}));
  console.log('All syntax, neural, media and browser integration checks passed. Evidence: outputs/validation-tests.xml');
}
main().catch(async (error) => {
  await fs.writeFile(stateFile, JSON.stringify({stage: 'failed', failedAt: new Date().toISOString(), failure: error.message})).catch(() => {});
  console.error(error.message);
  process.exitCode = 1;
});
