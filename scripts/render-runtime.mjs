import os from 'node:os';
import {openBrowser} from '@remotion/renderer';

export function renderConcurrency(value = process.env.REEL_RENDER_CONCURRENCY,
  cores = os.availableParallelism(), freeBytes = os.freemem()) {
  if (value !== undefined && value !== null) {
    const count = Number(value);
    if (!Number.isInteger(count) || count < 1 || count > Math.min(16, cores)) {
      throw new Error('REEL_RENDER_CONCURRENCY must be an integer from 1 to min(16, available CPU threads).');
    }
    return count;
  }
  return Math.max(1, Math.min(2, cores - 2, Math.floor(freeBytes / 1024 ** 3) - 2));
}

export async function withRenderBrowser(browserExecutable, run) {
  const puppeteerInstance = await openBrowser('chrome', {browserExecutable, logLevel: 'error'});
  try { return await run(puppeteerInstance); }
  finally { await puppeteerInstance.close({silent: true}); }
}
