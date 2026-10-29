import {FPS, motion} from './core.mjs';

export const LOCALES = ['en-IN', 'hi-IN'];
export const speechStart = (scene) => scene.kind === 'step' ? (scene.swap ? 4.6 : 2.1) : 0.4;
export const canonicalFrame = (scene, frame) => Math.min(frame, scene.baseFrames - 1);
export const formatValue = (value, locale) =>
  new Intl.NumberFormat(locale, {useGrouping: false, numberingSystem: 'latn'}).format(value);

export function geometry(scene, frame, tokens = scene.before, y = 820, state = motion(scene, frame)) {
  const width = Math.min(150, (850 - 16 * (tokens.length - 1)) / tokens.length);
  const x = (position) => 80 + position * (width + 16);
  const placed = (state?.tokens ?? tokens.map((t, position) => ({...t, position, dy: 0})))
    .map((t) => ({...t, x: x(t.position), y: y + t.dy, width}));
  const obscured = (left, top, w, h) => placed.some((t) => Math.abs(t.dy) > 0.01 &&
    left < t.x + width - 8 && left + w > t.x + 8 && top < t.y + 120 && top + h > t.y + 8);
  return {
    cells: tokens.map((_, index) => ({index, x: x(index), y, width, complete: index < (state?.w ?? 0),
      indexVisible: !obscured(x(index) + width / 2 - 12, y + 146, 24, 42)})),
    tokens: placed,
    pointers: [
      {id: 'w', position: state?.w, y: y - 140},
      {id: 'r', position: state?.done ? undefined : state?.r, y: y - 85},
    ].filter((p) => p.position !== undefined && p.position < tokens.length)
      .map((p) => {
        const half = p.id === 'w' ? 18 : 12;
        return {...p, x: x(p.position), width,
          occluded: obscured(x(p.position) + width / 2 - half, p.y, half * 2, 50)};
      }),
    done: state?.done ?? false,
  };
}

const uiKeys = ['pattern', 'input', 'goal', 'scan', 'write', 'swap', 'stay', 'swapRule', 'zeroRule',
  'prefix', 'order', 'complexity', 'rule', 'challenge', 'cta', 'complete', 'problem', 'variables',
  'initial', 'output', 'constraints', 'outro'];
const sceneKeys = ['hook', 'setup', 'zero', 'swap', 'self', 'summary', 'challenge'];
export function validateLocale(pack) {
  if (!LOCALES.includes(pack?.locale)) throw new Error('Unsupported locale.');
  if (!pack.brand?.trim() || pack.brand.length > 28) throw new Error('Invalid localized brand.');
  if ((pack.locale === 'en-IN' && (pack.voice !== 'af_heart' || pack.language !== 'en-us')) ||
      (pack.locale === 'hi-IN' && (pack.voice !== 'hf_alpha' || pack.language !== 'hi'))) {
    throw new Error('Voice/language must match the declared pilot locale; no silent fallback.');
  }
  for (const key of uiKeys) if (!pack.ui?.[key]?.trim()) throw new Error(`Missing translation: ui.${key}`);
  if (pack.terms?.read?.id !== 'r' || pack.terms?.write?.id !== 'w') throw new Error('Define canonical pointer IDs r and w.');
  for (const term of Object.values(pack.terms)) {
    if (!term.label?.includes(term.id) || !term.spoken?.trim()) throw new Error('Pointer labels must include their canonical identifier.');
  }
  const teaching = JSON.stringify({ui: pack.ui, scenes: pack.scenes});
  if (/blue|gold|scan pointer|नीला|सुनहरा|जाँच वाला संकेतक/i.test(teaching)) {
    throw new Error('Use canonical pointer terminology, not colour aliases or scan pointer.');
  }
  if (!pack.scenes?.setup?.phrases?.some((s) => s.includes('{readPointer}')) ||
      !pack.scenes?.setup?.phrases?.some((s) => s.includes('{writePointer}'))) {
    throw new Error('Setup must introduce both canonical pointers.');
  }
  for (const key of sceneKeys) {
    for (const field of ['title', 'subtitle']) {
      if (!pack.scenes?.[key]?.[field]?.trim()) throw new Error(`Missing translation: ${key}.${field}`);
    }
    const phrases = pack.scenes[key].phrases;
    if (!Array.isArray(phrases) || !phrases.length || phrases.some((s) => typeof s !== 'string' || !s.trim())) {
      throw new Error(`Missing narration: ${key}.phrases`);
    }
  }
  // Validate placeholders in strings, not JSON object delimiters.
  const strings = (v) => typeof v === 'string' ? [v] : Object.values(v ?? {}).flatMap(strings);
  for (const text of strings(pack)) {
    for (const match of text.matchAll(/\{([^{}]*)\}/g)) {
      if (!['value', 'r', 'w', 'readPointer', 'writePointer'].includes(match[1])) throw new Error(`Unknown placeholder: ${match[0]}`);
    }
    if (/[{}]/.test(text.replaceAll(/\{(?:value|r|w|readPointer|writePointer)\}/g, ''))) throw new Error('Malformed placeholder.');
  }
  return pack;
}

export function localize(project, pack) {
  validateLocale(pack);
  const replace = (text, scene, spoken = false) => text.replaceAll(/\{(value|r|w|readPointer|writePointer)\}/g, (_, key) => {
    if (key === 'readPointer' || key === 'writePointer') {
      return pack.terms[key === 'readPointer' ? 'read' : 'write'][spoken ? 'spoken' : 'label'];
    }
    const value = key === 'value' ? scene.before[scene.r]?.value : scene[key];
    if (!Number.isInteger(value)) throw new Error(`Placeholder ${key} is invalid in ${scene.id}.`);
    return formatValue(value, pack.locale);
  });
  return {
    ...structuredClone(project), locale: pack.locale, brand: pack.brand,
    ui: Object.fromEntries(Object.entries(pack.ui).map(([key, text]) => [key,
      text.replaceAll('{readPointer}', pack.terms.read.label).replaceAll('{writePointer}', pack.terms.write.label)])),
    captions: [], scenes: project.scenes.map((scene) => {
      const key = scene.kind === 'step' ? (!scene.swap ? 'zero' : scene.r === scene.w ? 'self' : 'swap') : scene.kind;
      const text = pack.scenes[key];
      return {...structuredClone(scene), baseFrames: scene.durationInFrames,
        title: replace(text.title, scene), subtitle: replace(text.subtitle, scene),
        instruction: replace(scene.swap ? pack.ui.swap : pack.ui.stay, scene),
        phrases: text.phrases.map((s) => replace(s, scene, true)), audioStart: speechStart(scene)};
    }),
  };
}

export const graphemes = (text) => [...new Intl.Segmenter('und', {granularity: 'grapheme'}).segment(text)].length;
export function applyTiming(project, audio, {maxExtraHoldSeconds = 6, maxDurationSeconds = 90, exactSeconds} = {}) {
  const result = structuredClone(project);
  result.captions = [];
  let start = 0;
  for (const scene of result.scenes) {
    const item = audio[scene.id];
    if (!item || !Number.isFinite(item.duration) || item.duration <= 0) throw new Error(`Missing audio: ${scene.id}`);
    if (scene.audioStart < speechStart(scene)) throw new Error(`${scene.id}: narration precedes completed action.`);
    if (!Array.isArray(item.cues) || item.cues.length !== scene.phrases.length) throw new Error('Incomplete phrase alignment.');
    let previousEnd = 0;
    item.cues.forEach((cue, index) => {
      if (cue.text !== scene.phrases[index] || !Number.isFinite(cue.start) || !Number.isFinite(cue.end) ||
          cue.start < previousEnd || cue.end <= cue.start || cue.end > item.duration + 0.00001) {
        throw new Error(`${scene.id}: invalid sample-aligned phrase.`);
      }
      const duration = cue.end - cue.start;
      if (duration < 0.8 || graphemes(cue.text) > 65 || graphemes(cue.text) / duration > 24) {
        throw new Error(`${scene.id}: caption reading budget exceeded; revise the phrase.`);
      }
      previousEnd = cue.end;
    });
    scene.durationInFrames = Math.max(scene.baseFrames, Math.ceil((scene.audioStart + item.duration + 0.2) * FPS));
    if (scene.durationInFrames - scene.baseFrames > maxExtraHoldSeconds * FPS) throw new Error(`${scene.id}: hold cap exceeded.`);
    scene.holdFrames = scene.durationInFrames - scene.baseFrames;
    scene.startFrame = start;
    scene.seconds = scene.durationInFrames / FPS;
    scene.audio = item.file;
    scene.audioSha256 = item.sha256;
    scene.audioDuration = item.duration;
    for (const cue of item.cues) {
      // Quantize both ends identically; adjacent cues cannot own the same frame.
      const offset = start / FPS + scene.audioStart;
      const from = Math.round((offset + cue.start) * FPS);
      const to = Math.round((offset + cue.end) * FPS);
      result.captions.push({start: from / FPS, end: to / FPS, from, to, text: cue.text});
    }
    start += scene.durationInFrames;
  }
  if (start > maxDurationSeconds * FPS || (exactSeconds !== undefined && start !== exactSeconds * FPS)) {
    throw new Error('Regional delivery duration exceeds its cap or exact target.');
  }
  result.durationInFrames = start;
  return result;
}

export function neutralScene(scene) {
  // Deliberately omit all localized strings, speech and metadata from this cache input.
  const keys = ['kind', 'durationInFrames', 'before', 'after', 'w', 'r', 'nextW', 'nextR', 'swap', 'layout'];
  return Object.fromEntries(keys.filter((key) => scene[key] !== undefined).map((key) => [key, scene[key]]));
}
