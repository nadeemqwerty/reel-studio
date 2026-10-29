import {compile, FPS} from './core.mjs';

export const FORMATS = {
  portrait: {width: 1080, height: 1920, safe: {top: 100, right: 120, bottom: 180, left: 60}},
  landscape: {width: 1920, height: 1080, safe: {top: 50, right: 70, bottom: 60, left: 70}},
  square: {width: 1080, height: 1080, safe: {top: 30, right: 50, bottom: 40, left: 50}},
  feed: {width: 1080, height: 1350, safe: {top: 50, right: 70, bottom: 80, left: 50}},
};

const fail = (message) => { throw new Error(message); };
const finite = (n, min, max) => Number.isFinite(n) && n >= min && n <= max;
export function validateProduction(config) {
  if (config?.schemaVersion !== 1) fail('Production schemaVersion must be 1.');
  for (const key of ['problem', 'locales']) if (typeof config[key] !== 'string' || !config[key].trim()) fail(`Missing ${key} path.`);
  if (!Array.isArray(config.outputs) || !config.outputs.length) fail('No output profiles.');
  const keys = new Set();
  for (const output of config.outputs) {
    if (!Object.hasOwn(FORMATS, output.format) || !['en-IN', 'hi-IN'].includes(output.locale)) fail('Unsupported format/locale.');
    const key = `${output.format}:${output.locale}`;
    if (keys.has(key)) fail(`Duplicate output ${key}.`);
    keys.add(key);
    if (output.safe) {
      for (const edge of ['top', 'right', 'bottom', 'left']) {
        if (!finite(output.safe[edge], 0, FORMATS[output.format].width / 5)) fail(`Invalid safe margin ${edge}.`);
      }
    }
  }
  const b = config.brand;
  if (!b || typeof b.name !== 'string' || !b.name.trim() || b.name.length > 28) fail('Brand name must be 1-28 characters.');
  for (const key of ['introSeconds', 'outroSeconds']) {
    if (!finite(b[key], 0, 5) || !Number.isInteger(b[key] * FPS)) fail(`${key} must be 0-5 seconds, aligned to frames.`);
  }
  const w = b.watermark;
  if (!w || typeof w.enabled !== 'boolean' || !['text', 'image'].includes(w.type) ||
      !['top-right', 'top-left'].includes(w.position) || !finite(w.opacity, 0.1, 1) ||
      !finite(w.width, 100, 260)) fail('Invalid watermark configuration.');
  if (w.type === 'text' && (typeof w.text !== 'string' || !w.text.trim() || w.text.length > 28)) fail('Invalid watermark text.');
  if (w.type === 'image' && (typeof w.file !== 'string' || !/\.png$/i.test(w.file))) fail('Image watermark requires a local PNG.');
  if (!finite(config.maxDurationSeconds, 30, 600)) fail('Invalid total duration cap.');
  return config;
}

export function layoutFor(format, safe) {
  const definition = Object.hasOwn(FORMATS, format) ? FORMATS[format] : fail('Unknown format.');
  const layout = {format, ...structuredClone(definition), safe: safe ?? definition.safe};
  const {left, right, top, bottom} = layout.safe;
  const wide = format === 'landscape';
  const compact = format === 'square';
  const feed = format === 'feed';
  layout.header = {x: left, y: top + 60, width: layout.width - left - right, height: 45, size: 24};
  layout.title = {x: left, y: top + 115, width: wide ? 680 : layout.width - left - right, height: 90, size: compact ? 46 : 58};
  layout.subtitle = {...layout.title, y: top + 205, height: 90, size: compact ? 30 : 36};
  layout.explanation = {...layout.title, y: top + 305, height: wide ? 260 : 100, size: wide ? 32 : 28};
  layout.caption = {x: left, y: layout.height - bottom - (wide || compact ? 100 : 150),
    width: layout.width - left - right, height: wide || compact ? 90 : 120, size: wide || compact ? 30 : 36};
  layout.info = {x: left, y: wide ? 590 : compact ? 780 : feed ? 950 : 1190,
    width: wide ? 680 : layout.width - left - right, height: wide ? 250 : compact ? 140 : 200,
    size: compact ? 24 : 30};
  return layout;
}

export function diagramTransform(layout, kind) {
  if (!layout) return {x: 0, y: 0, scale: 1};
  const {format} = layout;
  const hook = kind === 'hook';
  const scale = format === 'landscape' ? 0.92 : format === 'square' ? (hook ? 0.65 : 0.76)
    : format === 'feed' ? (hook ? 0.73 : 0.9) : 1;
  const x = format === 'landscape' ? 800 : layout.safe.left +
    (layout.width - layout.safe.left - layout.safe.right - 1010 * scale) / 2;
  const firstY = format === 'landscape' ? (hook ? 300 : 540)
    : format === 'square' ? (hook ? 480 : 500) : format === 'feed' ? (hook ? 520 : 650) : (hook ? 720 : 840);
  return {x, y: firstY - (hook ? 610 : 820) * scale, scale};
}

export function prepareProduction(spec, output) {
  const project = compile(spec);
  const layout = layoutFor(output.format, output.safe);
  let start = 0;
  for (const scene of project.scenes) {
    if (scene.kind === 'hook') scene.seconds = 8;
    if (scene.kind === 'setup') scene.seconds = 10;
    scene.durationInFrames = scene.seconds * FPS;
    scene.startFrame = start;
    scene.layout = layout;
    start += scene.durationInFrames;
  }
  return {...project, production: true, layout, width: layout.width, height: layout.height, durationInFrames: start};
}

export function shiftedCaptions(captions, introFrames) {
  return captions.map((cue) => ({...cue, from: cue.from + introFrames, to: cue.to + introFrames,
    start: (cue.from + introFrames) / FPS, end: (cue.to + introFrames) / FPS}));
}

export function previewSamples(project) {
  const samples = project.scenes.map((scene) => ({
    frame: scene.startFrame + (scene.kind === 'step' ? (scene.swap ? 60 : 40) : 30),
    label: scene.id,
  }));
  const longest = project.captions.toSorted((a, b) => b.text.length - a.text.length)[0];
  if (longest) samples.push({frame: Math.min(longest.from, project.durationInFrames - FPS), label: 'caption'});
  return samples;
}

export function previewFrame(project, frame) {
  const intro = Math.round(project.brandConfig.introSeconds * FPS);
  const samples = previewSamples(project);
  const offset = frame - intro;
  if (offset < 0 || offset >= samples.length * FPS) return null;
  return samples[Math.floor(offset / FPS)].frame + offset % FPS;
}
