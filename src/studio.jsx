import React from 'react';
import {AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {canonicalFrame} from '../lib/regional.mjs';
import {diagramTransform, previewSamples, previewFrame} from '../lib/production.mjs';
import {Arrays, NeutralScene, color} from './neutral.jsx';
import {Audit} from './regional.jsx';

const Box = ({box, children, tint = color.text, style = {}}) =>
  <div data-reel-text style={{position: 'absolute', left: box.x, top: box.y, width: box.width,
    height: box.height, fontSize: box.size, lineHeight: 1.4, color: tint, ...style}}>{children}</div>;

export function Watermark({brand, layout}) {
  const w = brand.watermark;
  if (!w.enabled) return null;
  const box = {x: w.position === 'top-left' ? layout.safe.left : layout.width - layout.safe.right - w.width,
    y: layout.safe.top, width: w.width, height: 45, size: 20};
  return w.type === 'image'
    ? <Img src={staticFile(w.asset)} style={{position: 'absolute', left: box.x, top: box.y,
      width: box.width, height: box.height, objectFit: 'contain', opacity: w.opacity}}/>
    : <Box box={box} style={{opacity: w.opacity, textAlign: 'center'}}>{w.text}</Box>;
}

function LessonScene({scene, project, frameOverride}) {
  const currentFrame = useCurrentFrame();
  const frame = frameOverride ?? currentFrame;
  const local = canonicalFrame(scene, frame);
  const {ui, layout: l} = project;
  const hook = scene.kind === 'hook';
  const transform = diagramTransform(l, scene.kind);
  const label = (y) => ({x: transform.x + 80 * transform.scale, y: transform.y + y * transform.scale - 48,
    width: 850 * transform.scale, height: 40, size: 24});
  let explanation = scene.kind === 'setup' ? ui.variables : hook ? ui.problem : scene.kind === 'step' ? scene.instruction : '';
  let details = scene.kind === 'setup' ? [ui.scan, ui.write, ui.initial]
    : scene.kind === 'summary' ? [ui.order, ui.complexity, ui.rule]
    : scene.kind === 'challenge' ? [ui.challenge, ui.cta]
    : scene.kind === 'step' ? [scene.swap ? ui.swapRule : ui.zeroRule, ui.prefix] : [];
  return <AbsoluteFill>
    {project.preview ? <NeutralScene scene={scene} frameOverride={local}/>
      : frame < scene.baseFrames ? <OffthreadVideo muted src={staticFile(scene.base.file)}/>
        : <Img src={staticFile(scene.base.endpoint)} style={{width: '100%', height: '100%'}}/>}
    <Box box={l.title} style={{fontWeight: 800}}>{scene.title}</Box>
    <Box box={l.subtitle} tint={color.write} style={{fontWeight: 700}}>{scene.subtitle}</Box>
    <Box box={l.format === 'square' && scene.kind === 'step' ? {...l.explanation, y: 300, height: 45} : l.explanation}>{explanation}</Box>
    <Arrays scene={scene} frame={local} layer="text" locale={project.locale}/>
    {hook && <>
      <Box box={label(610)} tint={color.muted}>{ui.input}</Box>
      <Box box={label(1070)} tint={color.muted}>{ui.output}</Box>
      {l.format === 'landscape' && <Box box={l.info} tint={color.muted}>{ui.constraints}</Box>}
    </>}
    {!hook && <Box box={l.info}>{details.map((text, i) => <div key={i}>{text}</div>)}</Box>}
    {!project.preview && <Sequence from={Math.round(scene.audioStart * 30)}>
      <Audio src={staticFile(scene.audio)}/>
    </Sequence>}
  </AbsoluteFill>;
}

export function StudioLesson({project, frameOverride}) {
  const currentFrame = useCurrentFrame();
  const frame = frameOverride ?? currentFrame;
  const {layout: l} = project;
  const caption = project.captions.find((c) => frame >= c.from && frame < c.to);
  return <AbsoluteFill data-reel-root lang={project.locale}
    style={{width: l.width, height: l.height, background: color.bg, color: color.text, fontFamily: 'ReelRegional, sans-serif'}}>
    {project.preview ? project.scenes.filter((s) => frame >= s.startFrame && frame < s.startFrame + s.durationInFrames)
      .map((scene) => <LessonScene key={scene.id} scene={scene} project={project} frameOverride={frame - scene.startFrame}/>)
      : project.scenes.map((scene) => <Sequence key={scene.id} from={scene.startFrame} durationInFrames={scene.durationInFrames}>
      <LessonScene scene={scene} project={project}/>
    </Sequence>)}
    <Box box={l.header} tint={color.scan}>{project.brand} / {project.ui.pattern}</Box>
    {caption && <Box box={l.caption} style={{background: '#060c18', borderRadius: 16,
      display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center'}}>{caption.text}</Box>}
    <Watermark brand={project.brandConfig} layout={l}/>
    <Audit font={project.font} safe={l.safe}/>
  </AbsoluteFill>;
}

export function BrandClip({layout, brand, font, text}) {
  const frame = useCurrentFrame();
  const margin = Math.max(layout.safe.left, layout.safe.right, 70);
  return <AbsoluteFill data-reel-root style={{width: layout.width, height: layout.height,
    background: color.bg, fontFamily: 'ReelRegional, sans-serif'}}>
    <div style={{position: 'absolute', left: margin, right: margin, top: layout.height / 2 - 100,
      height: 4, background: color.scan, transform: `scaleX(${Math.min(1, (frame + 1) / 15)})`}}/>
    <Box box={{x: margin, y: layout.height / 2 - 50, width: layout.width - margin * 2, height: 100, size: 54}}
      style={{textAlign: 'center', fontWeight: 800}}>{text}</Box>
    <Watermark brand={brand} layout={layout}/>
    <Audit font={font} safe={layout.safe}/>
  </AbsoluteFill>;
}

export function StudioPreview({project}) {
  const frame = useCurrentFrame();
  const intro = Math.round(project.brandConfig.introSeconds * 30);
  const samples = previewSamples(project);
  const end = intro + samples.length * 30;
  if (frame < intro || frame >= end) return <BrandClip layout={project.layout} brand={project.brandConfig}
    font={project.font} text={frame < intro ? project.brand : project.ui.outro}/>;
  return <StudioLesson project={{...project, preview: true}} frameOverride={previewFrame(project, frame)}/>;
}
