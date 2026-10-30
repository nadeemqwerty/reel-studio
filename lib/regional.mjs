import {FPS} from './core.mjs';
import {formatValue} from './geometry.mjs';
export {formatValue, geometry, neutralScene} from './geometry.mjs';

export const LOCALES = ['en', 'en-IN', 'hi-IN'];
export const CONNECTED_ENGLISH = {mode: 'connected', speed: 0.96, sentencePause: 0.14,
  clausePause: 0.06, alignment: 'model-phoneme-sample-boundaries'};
export const speechStart = (scene) => scene.narrationStyle === 'guided' ? 0.2
  : scene.kind === 'step' ? (scene.swap ? 4.6 : 2.1) : 0.4;
export const canonicalFrame = (scene, frame) => Math.min(frame, scene.baseFrames - 1);
const uiKeys = ['pattern', 'input', 'goal', 'scan', 'write', 'swap', 'stay', 'swapRule', 'zeroRule',
  'prefix', 'order', 'complexity', 'rule', 'challenge', 'cta', 'complete', 'problem', 'variables',
  'initial', 'output', 'constraints', 'outro'];
const sceneKeys = ['hook', 'setup', 'zero', 'swap', 'self', 'summary', 'challenge'];
export function validateLocale(pack) {
  if (!LOCALES.includes(pack?.locale)) throw new Error('Unsupported locale.');
  if (!pack.brand?.trim() || pack.brand.length > 28) throw new Error('Invalid localized brand.');
  if ((pack.locale.startsWith('en') && (pack.voice !== 'af_heart' || pack.language !== 'en-us')) ||
      (pack.locale === 'hi-IN' && (pack.voice !== 'hf_alpha' || pack.language !== 'hi'))) {
    throw new Error('Voice/language must match the declared pilot locale; no silent fallback.');
  }
  for (const key of uiKeys) if (!pack.ui?.[key]?.trim()) throw new Error(`Missing translation: ui.${key}`);
  if (pack.terms?.read?.id !== 'r' || pack.terms?.write?.id !== 'w') throw new Error('Define canonical pointer IDs r and w.');
  for (const term of Object.values(pack.terms)) {
    if (!term.label?.includes(term.id) || !term.spoken?.trim()) throw new Error('Pointer labels must include their canonical identifier.');
  }
  const teaching = JSON.stringify({ui: pack.ui, scenes: pack.scenes, productionPhrases: pack.productionPhrases});
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
  if (pack.productionPhrases) {
    if (!pack.locale.startsWith('en')) throw new Error('Guided connected narration is currently English-only.');
    for (const key of sceneKeys) {
      const phrases = pack.productionPhrases[key];
      if (!Array.isArray(phrases) || !phrases.length || phrases.some((p) => typeof p !== 'string' || !p.trim())) {
        throw new Error(`Missing guided narration: ${key}.`);
      }
    }
    for (const pointer of ['{readPointer}', '{writePointer}']) {
      if (!pack.productionPhrases.setup.some((p) => p.includes(pointer))) throw new Error('Guided setup must introduce both pointers.');
    }
    if (/\b(moved|advanced|stayed)\b/i.test(JSON.stringify(
      ['zero', 'swap', 'self'].map((key) => pack.productionPhrases[key])))) {
      throw new Error('Guided steps must not describe an action as already completed.');
    }
  }
  // Validate placeholders in strings, not JSON object delimiters.
  const strings = (v) => typeof v === 'string' ? [v] : Object.values(v ?? {}).flatMap(strings);
  for (const text of strings(pack)) {
    for (const match of text.matchAll(/\{([^{}]*)\}/g)) {
      if (!['value', 'r', 'w', 'length', 'target', 'readPointer', 'writePointer'].includes(match[1])) throw new Error(`Unknown placeholder: ${match[0]}`);
    }
    if (/[{}]/.test(text.replaceAll(/\{(?:value|r|w|length|target|readPointer|writePointer)\}/g, ''))) throw new Error('Malformed placeholder.');
  }
  return pack;
}

export function resolveLocale(packs, locale) {
  // Global English shares the English teaching source, not a duplicated translation.
  const pack = packs[locale] ?? (locale === 'en' && packs['en-IN'] ? {
    ...structuredClone(packs['en-IN']), locale: 'en',
    accent: 'American English; global English audience',
  } : undefined);
  validateLocale(pack);
  if (pack.locale !== locale) throw new Error('Locale pack key and declared locale must match.');
  return pack;
}

export function localize(project, pack) {
  validateLocale(pack);
  const guided = project.production && Boolean(pack.productionPhrases);
  const replace = (text, scene, spoken = false, preserveScene = false) => text.replaceAll(/\{(value|r|w|length|target|readPointer|writePointer)\}/g, (_, key) => {
    if (key === 'readPointer' || key === 'writePointer') {
      return pack.terms[key === 'readPointer' ? 'read' : 'write'][spoken ? 'spoken' : 'label'];
    }
    if (preserveScene && ['value', 'r', 'w'].includes(key)) return `{${key}}`;
    const value = key === 'length' ? project.resultLength : key === 'target' ? project.spec.target
      : key === 'value' ? scene.before[scene.r]?.value : scene[key];
    if (!Number.isInteger(value)) throw new Error(`Placeholder ${key} is invalid in ${scene.id}.`);
    return formatValue(value, pack.locale);
  });
  return {
    ...structuredClone(project), locale: pack.locale, brand: pack.brand,
    speechDelivery: guided ? {...CONNECTED_ENGLISH} : undefined,
    ui: Object.fromEntries(Object.entries(pack.ui).map(([key, text]) => [key,
      replace(text, {}, false, true)])),
    captions: [], scenes: project.scenes.map((scene) => {
      const key = scene.kind === 'step' ? (!scene.swap ? 'zero' : scene.r === scene.w ? 'self' : 'swap') : scene.kind;
      const text = pack.scenes[key];
      const narrationStyle = guided ? 'guided' : 'retrospective';
      return {...structuredClone(scene), baseFrames: scene.durationInFrames, narrationStyle,
        title: replace(text.title, scene), subtitle: replace(text.subtitle, scene),
        instruction: replace(scene.swap ? pack.ui.swap : pack.ui.stay, scene),
        phrases: (guided ? pack.productionPhrases[key] : text.phrases).map((s) => replace(s, scene, true)),
        audioStart: speechStart({...scene, narrationStyle})};
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
    const guided = scene.narrationStyle === 'guided';
    if (guided && (!result.production || result.speechDelivery?.mode !== 'connected' ||
        item?.alignment !== CONNECTED_ENGLISH.alignment)) throw new Error('Guided narration requires connected model-aligned speech.');
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
    // Guided speech accompanies instructions; remove only idle tails, never action frames.
    const minimum = !guided ? scene.baseFrames : scene.kind === 'step'
      ? Math.ceil(((scene.swap ? 4.6 : 2.1) + 0.15) * FPS)
      : ({hook: 5, setup: 8, summary: 4, challenge: 4}[scene.kind] * FPS);
    scene.durationInFrames = Math.max(minimum, Math.ceil((scene.audioStart + item.duration + 0.2) * FPS));
    if (scene.durationInFrames - scene.baseFrames > maxExtraHoldSeconds * FPS) throw new Error(`${scene.id}: hold cap exceeded.`);
    if (guided) {
      scene.sourceBaseFrames = scene.baseFrames;
      scene.baseFrames = Math.min(scene.baseFrames, scene.durationInFrames);
    }
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
