import React, {useEffect, useState} from 'react';
import {AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame,
  delayRender, continueRender, cancelRender} from 'remotion';
import {motion} from '../lib/core.mjs';
import {canonicalFrame} from '../lib/regional.mjs';
import {Arrays, color} from './neutral.jsx';
const Text = ({children, top, size = 40, height = 90, tint = color.text, style = {}}) =>
  <div data-reel-text style={{position: 'absolute', left: 80, right: 140, top, height,
    fontSize: size, lineHeight: 1.4, color: tint, ...style}}>{children}</div>;

export function Audit({neutral = false, font, safe}) {
  const frame = useCurrentFrame();
  const [handle] = useState(() => delayRender('Load and audit regional font'));
  const check = () => {
    const root = document.querySelector('[data-reel-root]');
    if (neutral && root?.textContent?.trim()) throw new Error('Text leaked into neutral base.');
    for (const box of root?.querySelectorAll('[data-reel-text]') ?? []) {
      if (box.scrollWidth > box.clientWidth + 2 || box.scrollHeight > box.clientHeight + 2) {
        throw new Error(`Text overflow: ${box.textContent}; content ${box.scrollWidth}x${box.scrollHeight}, box ${box.clientWidth}x${box.clientHeight}`);
      }
      if (safe && root) {
        const bounds = root.getBoundingClientRect();
        const rect = box.getBoundingClientRect();
        const scale = bounds.width / root.clientWidth;
        if (rect.left < bounds.left + safe.left * scale - 2 ||
            rect.right > bounds.right - safe.right * scale + 2 ||
            rect.top < bounds.top + safe.top * scale - 2 ||
            rect.bottom > bounds.bottom - safe.bottom * scale + 2) {
          throw new Error(`Text outside safe area: ${box.textContent}`);
        }
      }
    }
  };
  useEffect(() => {
    (async () => {
      if (font) {
        const face = new FontFace('ReelRegional', `url("${staticFile(font)}")`, {weight: '100 900'});
        document.fonts.add(await face.load());
        await document.fonts.ready;
      }
      check();
      continueRender(handle);
    })().catch(cancelRender);
  }, [font, handle]);
  useEffect(() => {
    try { check(); } catch (error) { cancelRender(error); }
  }, [frame, neutral]);
  return null;
}

function LocalScene({scene, project}) {
  const frame = useCurrentFrame();
  const canonical = canonicalFrame(scene, frame);
  const ui = project.ui;
  return <AbsoluteFill>
    {frame < scene.baseFrames
      ? <OffthreadVideo muted src={staticFile(scene.base.file)}/>
      : <Img src={staticFile(scene.base.endpoint)} style={{width: '100%', height: '100%'}}/>}
    <Text top={270} size={62} height={95} style={{fontWeight: 800}}>{scene.title}</Text>
    <Text top={365} size={42} height={118} tint={color.write} style={{fontWeight: 700}}>{scene.subtitle}</Text>
    <Arrays scene={scene} frame={canonical} layer="text" locale={project.locale}/>
    {scene.kind === 'hook' && <>
      <Text top={530} size={30} height={70} tint={color.muted}>{ui.input}</Text>
      <Text top={985} size={30} height={80} tint={color.muted}>{ui.goal}</Text>
    </>}
    {scene.kind === 'setup' && <>
      <Text top={1080} tint={color.scan}>{ui.scan}</Text>
      <Text top={1170} tint={color.write}>{ui.write}</Text>
    </>}
    {scene.kind === 'step' && <>
      <Text top={510} size={36}>{scene.instruction}</Text>
      {motion(scene, canonical).done && <Text top={1070} size={34} tint={color.scan}>{ui.complete}</Text>}
      <Text top={1180} size={36}>{scene.swap ? ui.swapRule : ui.zeroRule}</Text>
      <Text top={1280} size={30} tint={color.muted}>{ui.prefix}</Text>
    </>}
    {scene.kind === 'summary' && <>
      <Text top={1080} size={36}>{ui.order}</Text>
      <Text top={1170} size={42} tint={color.done}>{ui.complexity}</Text>
      <Text top={1270} size={30} tint={color.muted}>{ui.rule}</Text>
    </>}
    {scene.kind === 'challenge' && <>
      <Text top={1090}>{ui.challenge}</Text>
      <Text top={1190} size={36} tint={color.done}>{ui.cta}</Text>
    </>}
    <Sequence from={Math.round(scene.audioStart * 30)}><Audio src={staticFile(scene.audio)}/></Sequence>
  </AbsoluteFill>;
}

export function RegionalReel({project}) {
  const frame = useCurrentFrame();
  const caption = project.captions.find((c) => frame >= c.from && frame < c.to);
  return <AbsoluteFill data-reel-root lang={project.locale}
    style={{width: 1080, height: 1920, background: color.bg, color: color.text, fontFamily: 'ReelRegional, sans-serif'}}>
    {project.scenes.map((scene) => <Sequence key={scene.id} from={scene.startFrame} durationInFrames={scene.durationInFrames}>
      <LocalScene scene={scene} project={project}/>
    </Sequence>)}
    <Text top={180} size={26} height={60} tint={color.scan}>{project.brand} / {project.ui.pattern}</Text>
    {caption && <div data-reel-text style={{position: 'absolute', left: 70, right: 130, top: 1470,
      height: 118, padding: '20px 24px', boxSizing: 'content-box', borderRadius: 18,
      background: '#060c18', fontSize: 38, textAlign: 'center', lineHeight: '59px'}}>{caption.text}</div>}
    <div style={{position: 'absolute', left: 80, right: 140, top: 1680, height: 5, background: color.panel}}>
      <div style={{height: '100%', width: `${100 * (frame + 1) / project.durationInFrames}%`, background: color.scan}}/>
    </div>
    <Audit font={project.font}/>
  </AbsoluteFill>;
}
