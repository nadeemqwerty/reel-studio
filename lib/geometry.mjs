import {motion} from './core.mjs';

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

export function neutralScene(scene) {
  const keys = ['kind', 'durationInFrames', 'before', 'after', 'w', 'r', 'nextW', 'nextR', 'swap', 'layout'];
  return Object.fromEntries(keys.filter((key) => scene[key] !== undefined).map((key) => [key, scene[key]]));
}
