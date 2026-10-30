import {FPS} from './core.mjs';
import {heatmapSceneKinds} from './heatmap.mjs';

const kinds = ['hook', 'brand', 'dsa', 'roadmap', 'cta'];
export function validateStory(config) {
  if (config?.schemaVersion !== 1 || config.brand !== 'InterviewReel' ||
      !['intro', 'heatmap'].includes(config.kind) ||
      config.id !== (config.kind === 'intro' ? 'channel-intro' : 'driver-heatmap') ||
      !Array.isArray(config.formats) || !config.formats.length ||
      config.formats.some((f) => !['portrait', 'landscape'].includes(f)) ||
      new Set(config.formats).size !== config.formats.length ||
      !Number.isFinite(config.maxDurationSeconds) || config.maxDurationSeconds < 15 ||
      config.maxDurationSeconds > 120 || config.outroSeconds !== 5) {
    throw new Error('Invalid story configuration.');
  }
  const expected = config.kind === 'intro' ? kinds : heatmapSceneKinds;
  if (!Array.isArray(config.scenes) || config.scenes.length !== expected.length) throw new Error('Missing story scenes.');
  config.scenes.forEach((scene, i) => {
    if (scene.kind !== expected[i]) throw new Error('Keep the declared scene order.');
    for (const key of ['eyebrow', 'title', 'detail']) {
      if (typeof scene[key] !== 'string' || !scene[key].trim() || scene[key].length > 100) {
        throw new Error(`Invalid intro ${key}.`);
      }
    }
    if (!Array.isArray(scene.phrases) || !scene.phrases.length ||
        scene.phrases.some((p) => typeof p !== 'string' || !p.trim() || [...p].length > 65)) {
      throw new Error('Intro phrases must contain 1-65 characters.');
    }
  });
  for (const key of ['title', 'description', 'socialCaption', 'pinnedComment']) {
    if (typeof config.upload?.[key] !== 'string' || !config.upload[key].trim() ||
        config.upload[key].length > (key === 'title' ? 100 : 2000)) throw new Error(`Invalid upload ${key}.`);
  }
  return config;
}

export function storyTimeline(config, speech) {
  validateStory(config);
  const phrases = config.scenes.flatMap((s) => s.phrases);
  if (!Number.isFinite(speech?.duration) || speech.duration <= 0 ||
      speech.alignment !== 'model-phoneme-sample-boundaries' ||
      !Array.isArray(speech.cues) || speech.cues.length !== phrases.length) {
    throw new Error('Missing measured intro speech alignment.');
  }
  const audioStartFrames = 6;
  const offset = audioStartFrames / FPS;
  let end = 0;
  const captions = speech.cues.map((cue, i) => {
    if (cue.text !== phrases[i] || !Number.isFinite(cue.start) || !Number.isFinite(cue.end) ||
        cue.start < end || cue.end > speech.duration || cue.end - cue.start < 0.8 ||
        [...cue.text].length / (cue.end - cue.start) > 24) {
      throw new Error(`Invalid measured caption or reading budget: ${phrases[i]}`);
    }
    end = cue.end;
    return {text: cue.text, start: offset + cue.start, end: offset + cue.end,
      from: Math.round((offset + cue.start) * FPS), to: Math.round((offset + cue.end) * FPS)};
  });
  const bodyFrames = Math.ceil((offset + speech.duration + 0.2) * FPS);
  const durationInFrames = bodyFrames + config.outroSeconds * FPS;
  if (durationInFrames / FPS > config.maxDurationSeconds) throw new Error('Intro exceeds its duration cap; shorten the script.');
  let cursor = 0;
  const scenes = config.scenes.map((scene, i) => {
    const startFrame = i === 0 ? 0 : captions[cursor].from;
    cursor += scene.phrases.length;
    const endFrame = captions[cursor]?.from ?? bodyFrames;
    return {...scene, startFrame, endFrame};
  });
  return {kind: config.kind, brand: config.brand, scenes, captions, audioStartFrames, bodyFrames, durationInFrames,
    audio: speech.file, font: 'fonts/noto-devanagari.ttf', avatar: 'brand/intro-avatar.png'};
}
