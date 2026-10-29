export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

export function traceMoveZeroes(input) {
  const tokens = input.map((value, index) => ({id: `token-${index}`, value}));
  const steps = [];
  let w = 0;
  for (let r = 0; r < tokens.length; r++) {
    const before = tokens.map((t) => ({...t}));
    const swap = tokens[r].value !== 0;
    const beforeW = w;
    if (swap) {
      [tokens[w], tokens[r]] = [tokens[r], tokens[w]];
      w++;
    }
    steps.push({
      before, after: tokens.map((t) => ({...t})), w: beforeW, r,
      nextW: w, nextR: r + 1, swap,
    });
  }
  return {steps, result: tokens};
}

export function compile(spec) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(spec.id ?? '')) {
    throw new Error('Use a lowercase hyphenated project id, not a path.');
  }
  if (spec.algorithm !== 'move-zeroes') throw new Error('Only move-zeroes is implemented.');
  if (spec.language !== 'en') throw new Error('This template currently supports English only.');
  for (const key of ['input', 'challenge']) {
    if (!Array.isArray(spec[key]) || spec[key].length < 1 || spec[key].length > 6 ||
        spec[key].some((v) => !Number.isInteger(v) || Math.abs(v) > 999)) {
      throw new Error(`${key}: this visual template supports 1-6 integers in [-999,999].`);
    }
  }
  for (const key of ['title', 'brand', 'objective', 'audience', 'callToAction', 'constraints']) {
    if (typeof spec[key] !== 'string' || !spec[key].trim()) throw new Error(`Missing ${key}.`);
  }
  if (spec.title.length > 36 || spec.brand.length > 28 || spec.callToAction.length > 64) {
    throw new Error('Title, brand or call to action exceeds this template layout.');
  }
  for (const key of ['hook', 'setup', 'zero', 'swap', 'summary', 'challenge']) {
    if (typeof spec.narration?.[key] !== 'string' || !spec.narration[key].trim()) {
      throw new Error(`Missing narration.${key}.`);
    }
  }
  const {steps, result} = traceMoveZeroes(spec.input);
  const initial = steps[0].before;
  const scenes = [
    {id: 'hook', kind: 'hook', seconds: 5, title: 'MOVE ZEROES.', subtitle: 'KEEP THE ORDER.',
      speech: spec.narration.hook, before: initial, after: result},
    {id: 'setup', kind: 'setup', seconds: 6, title: 'TWO POINTERS.', subtitle: 'TWO JOBS.',
      speech: spec.narration.setup, before: initial, w: 0, r: 0},
    ...steps.map((step, index) => ({
      ...step, id: `step-${index + 1}`, kind: 'step', seconds: step.swap ? 8 : 5,
      title: step.swap ? `FOUND ${step.before[step.r].value}.` : 'SEE A ZERO?',
      subtitle: step.swap ? 'SWAP IT FORWARD.' : 'MOVE ONLY THE SCAN POINTER.',
      speech: step.swap
        ? spec.narration.swap.replaceAll('{value}', String(step.before[step.r].value))
        : spec.narration.zero,
    })),
    {id: 'summary', kind: 'summary', seconds: 9, title: 'WHY IT WORKS.', subtitle: 'ONE PASS.',
      speech: spec.narration.summary, before: result, w: result.filter((t) => t.value !== 0).length},
    {id: 'challenge', kind: 'challenge', seconds: 6, title: 'YOUR TURN.', subtitle: 'WHAT CHANGES?',
      speech: spec.narration.challenge,
      before: spec.challenge.map((value, index) => ({id: `challenge-${index}`, value}))},
  ];
  let start = 0;
  for (const scene of scenes) {
    scene.startFrame = start;
    scene.durationInFrames = scene.seconds * FPS;
    start += scene.durationInFrames;
  }
  if (spec.targetDurationSeconds !== undefined && start !== spec.targetDurationSeconds * FPS) {
    throw new Error(`Timeline is ${start / FPS}s, not requested ${spec.targetDurationSeconds}s. Adjust scope, not playback speed.`);
  }
  return {spec, scenes, durationInFrames: start, fps: FPS, width: WIDTH, height: HEIGHT, captions: []};
}

const smooth = (t) => {
  const p = Math.max(0, Math.min(1, t));
  return p * p * (3 - 2 * p);
};

export function motion(scene, frame) {
  const before = scene.before;
  if (scene.kind !== 'step') {
    return {tokens: before.map((t, index) => ({...t, position: index, dy: 0})), w: scene.w, r: scene.r};
  }
  const swapProgress = scene.swap ? smooth((frame - 2 * FPS) / (0.8 * FPS)) : 0;
  const pointerStart = (scene.swap ? 4 : 1.5) * FPS;
  const pointerProgress = smooth((frame - pointerStart) / (0.6 * FPS));
  const tokens = before.map((token, index) => {
    let target = index;
    let sign = 0;
    if (scene.swap && scene.w !== scene.r) {
      if (index === scene.r) { target = scene.w; sign = -1; }
      if (index === scene.w) { target = scene.r; sign = 1; }
    }
    return {...token, position: index + (target - index) * swapProgress,
      dy: sign * Math.sin(Math.PI * swapProgress) * 190};
  });
  return {
    tokens,
    w: scene.w + (scene.nextW - scene.w) * pointerProgress,
    r: scene.r + pointerProgress,
    done: scene.nextR === before.length && pointerProgress === 1,
  };
}

export function validateProject(project) {
  const failures = [];
  const expected = [...project.spec.input.filter((v) => v !== 0), ...project.spec.input.filter((v) => v === 0)];
  const summary = project.scenes.find((s) => s.kind === 'summary');
  if (JSON.stringify(summary.before.map((t) => t.value)) !== JSON.stringify(expected)) failures.push('Incorrect final result');
  let checkedFrames = 0;
  for (const scene of project.scenes.filter((s) => s.kind === 'step')) {
    for (let frame = 0; frame < scene.durationInFrames; frame++) {
      const state = motion(scene, frame);
      checkedFrames++;
      if (new Set(state.tokens.map((t) => t.id)).size !== scene.before.length) failures.push(`${scene.id}: token identity`);
      for (const token of state.tokens) {
        const source = scene.before.find((t) => t.id === token.id);
        if (source.value !== token.value) failures.push(`${scene.id}: token changed value`);
        if (!Number.isFinite(token.position) || !Number.isFinite(token.dy)) failures.push(`${scene.id}: non-finite motion`);
      }
      const frozenUntil = (scene.swap ? 4 : 1.5) * FPS;
      if (frame < frozenUntil && (state.w !== scene.w || state.r !== scene.r)) failures.push(`${scene.id}: early pointer movement`);
    }
    const end = motion(scene, scene.durationInFrames - 1);
    const actual = end.tokens.toSorted((a, b) => a.position - b.position).map((t) => t.id);
    if (JSON.stringify(actual) !== JSON.stringify(scene.after.map((t) => t.id))) failures.push(`${scene.id}: endpoint mismatch`);
    if (end.w !== scene.nextW || end.r !== scene.nextR) failures.push(`${scene.id}: pointer endpoint mismatch`);
  }
  if (failures.length) throw new Error([...new Set(failures)].join('; '));
  return {status: 'passed', checkedMotionFrames: checkedFrames, independentOracle: 'stable-filter', totalFrames: project.durationInFrames};
}

export function restorePunctuation(words, script) {
  return words.map((word, index) => {
    const end = words[index + 1]?.position ?? script.length;
    if (!Number.isInteger(word.position) || word.position < 0 || end <= word.position || end > script.length) {
      throw new Error('Invalid speech character positions.');
    }
    return {...word, text: script.slice(word.position, end).trim()};
  });
}

export function captionsFromWords(words, duration, offsetSeconds) {
  if (!words.length) throw new Error('Narration has no word timestamps; do not fabricate subtitle alignment.');
  let previous = -1;
  for (const word of words) {
    if (!Number.isFinite(word.start) || word.start < previous || word.start < 0 || word.start >= duration) {
      throw new Error('Invalid or unordered word timestamps.');
    }
    if (!word.text?.trim()) throw new Error('Empty subtitle word.');
    previous = word.start;
  }
  const captions = [];
  for (let i = 0; i < words.length;) {
    let j = i + 1;
    while (j < words.length && j - i < 10 && !/[.!?]$/.test(words[j - 1].text)
      && words.slice(i, j + 1).map((w) => w.text).join(' ').length <= 65) j++;
    const start = offsetSeconds + words[i].start;
    const end = offsetSeconds + (words[j]?.start ?? duration);
    if (end > start) captions.push({start, end, text: words.slice(i, j).map((w) => w.text).join(' ')});
    i = j;
  }
  return captions;
}

export function subtitleText(captions, vtt = false) {
  const time = (seconds) => {
    const ms = Math.round(seconds * 1000);
    return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}${vtt ? '.' : ','}${String(ms % 1000).padStart(3, '0')}`;
  };
  return (vtt ? 'WEBVTT\n\n' : '') + captions.map((c, i) =>
    `${vtt ? '' : `${i + 1}\n`}${time(c.start)} --> ${time(c.end)}\n${c.text}\n`).join('\n');
}

export function wavDuration(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Not a WAV file');
  let byteRate = 0;
  let dataLength = 0;
  for (let i = 12; i + 8 <= buffer.length;) {
    const tag = buffer.toString('ascii', i, i + 4);
    const size = buffer.readUInt32LE(i + 4);
    if (i + 8 + size > buffer.length) throw new Error('Truncated WAV');
    if (tag === 'fmt ' && size >= 16) byteRate = buffer.readUInt32LE(i + 16);
    if (tag === 'data') dataLength += size;
    i += 8 + size + (size % 2);
  }
  if (!byteRate || !dataLength) throw new Error('WAV has no playable PCM data');
  return dataLength / byteRate;
}
