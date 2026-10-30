import React from 'react';
import {AbsoluteFill, Audio, Composition, Img, Sequence, staticFile, useCurrentFrame, registerRoot} from 'remotion';
import {FORMATS} from '../lib/production.mjs';
import {BrandClip} from './studio.jsx';
import {Audit} from './regional.jsx';
import {HeatmapGraphic} from './heatmap.jsx';
import {traceMoveZeroes, motion} from '../lib/core.mjs';

const colors = {bg: '#0b1322', text: '#f3f6ff', cyan: '#56d5ff', gold: '#ffd166', muted: '#aebed4'};
const text = (x, y, width, height, size, extra = {}) => ({position: 'absolute', left: x, top: y,
  width, height, fontSize: size, lineHeight: 1.25, whiteSpace: 'pre-line', color: colors.text, ...extra});
const Label = ({style, children}) => <div data-reel-text style={style}>{children}</div>;
const demo = {kind: 'step', ...traceMoveZeroes([0, 1, 0, 3]).steps[1]};

function Graphic({kind, frame, avatar}) {
  const pulse = 0.5 + 0.5 * Math.sin(frame / 16);
  const card = (x, y, width, height, accent = colors.cyan) => ({position: 'absolute', left: x, top: y,
    width, height, border: `2px solid ${accent}`, borderRadius: 24, background: '#13213a'});
  if (kind === 'brand') return <>
    <div style={{...card(235, 35, 290, 290), borderRadius: '50%', opacity: 0.2 + pulse * 0.15,
      transform: `scale(${1.12 + pulse * 0.05})`, boxShadow: `0 0 90px ${colors.cyan}`}}/>
    <Img src={staticFile(avatar)} style={{position: 'absolute', left: 235, top: 35, width: 290, height: 290, borderRadius: '50%'}}/>
    <Label style={text(0, 370, 760, 60, 32, {textAlign: 'center', color: colors.cyan})}>SWE INTERVIEW PREP</Label>
  </>;
  if (kind === 'dsa') {
    const state = motion(demo, Math.min(239, frame));
    return <>
      {state.tokens.map((token) => <div key={token.id} style={{...card(20 + token.position * 185, 140 + token.dy * 0.5, 105, 90),
        borderColor: colors.cyan}}>
        <Label style={text(0, 15, 105, 65, 44, {textAlign: 'center', fontWeight: 800})}>{token.value}</Label>
      </div>)}
      <Label style={text(20 + state.r * 185, 15, 105, 40, 26, {textAlign: 'center', color: colors.cyan})}>r / read</Label>
      <Label style={text(20 + state.w * 185, 325, 140, 40, 26, {textAlign: 'center', color: colors.gold})}>w / write</Label>
      <Label style={text(0, 380, 760, 60, 30, {textAlign: 'center', color: colors.cyan})}>MOVE ZEROES / TWO POINTERS</Label>
    </>;
  }
  if (kind === 'roadmap') return <>
    <svg width="760" height="450" style={{position: 'absolute'}}>
      <path d="M170 220 H320 M470 220 H590 V100 H650 M590 220 V340 H650" fill="none" stroke={colors.gold} strokeWidth="4" strokeDasharray="9 9"/>
      <circle cx={180 + ((frame * 3) % 130)} cy="220" r="7" fill={colors.gold}/>
    </svg>
    {[['Client', 20, 175, 150], ['API', 320, 175, 150], ['Cache', 590, 55, 170],
      ['Database', 590, 295, 170]].map(([label, x, y, width]) =>
      <div key={label} style={card(x, y, width, 90, colors.gold)}>
        <Label style={text(5, 25, width - 10, 48, 28, {textAlign: 'center'})}>{label}</Label>
      </div>)}
    <Label style={text(0, 410, 760, 40, 26, {textAlign: 'center', color: colors.gold})}>SYSTEM DESIGN / MADE VISUAL</Label>
  </>;
  if (kind === 'cta') return <>
    {['Follow', 'Subscribe', 'Comment'].map((label, i) => <div key={label}
      style={{...card(90 + i * 25, 30 + i * 130, 530, 100, i === 2 ? colors.gold : colors.cyan),
        transform: `translateX(${Math.sin(frame / 24 + i) * 5}px)`}}>
      <Label style={text(30, 24, 470, 55, 38, {textAlign: 'center', fontWeight: 800})}>{label}</Label>
    </div>)}
  </>;
  return <>
    {(kind === 'hook' ? ['WHAT?', 'HOW?', 'WHY?'] : ['SEE', 'UNDERSTAND', 'TRY']).map((label, i) => {
      const selected = Math.floor(frame / 35) % 3 === i;
      return <div key={label} style={{...card(i * 260, 100 - (selected ? 15 : 0), 240, 240,
        selected ? colors.gold : colors.cyan), boxShadow: selected ? '0 16px 55px #0006' : 'none'}}>
        <Label style={text(15, 25, 210, 105, 70, {textAlign: 'center', fontWeight: 800,
          color: selected ? colors.gold : colors.cyan})}>{kind === 'hook' ? '?' : `0${i + 1}`}</Label>
        <Label style={text(10, 165, 220, 48, 26, {textAlign: 'center', fontWeight: 700})}>{label}</Label>
      </div>;
    })}
    <Label style={text(0, 390, 760, 50, 30, {textAlign: 'center', color: colors.muted})}>
      {kind === 'hook' ? 'Make the ideas click.' : 'Understand it. Then apply it.'}
    </Label>
  </>;
}

function ChannelIntro({project, format, cover = false}) {
  const frame = useCurrentFrame();
  const layout = {format, ...FORMATS[format]};
  const wide = format === 'landscape';
  const {width, height, safe} = layout;
  const left = safe.left + 20;
  const usable = width - left - safe.right;
  const brand = {name: project.brand, watermark: {enabled: false}};
  if (frame >= project.bodyFrames) return <BrandClip layout={layout} brand={brand} font={project.font}
    text={'Thanks for watching!\nLike and subscribe.\nComment your next topic.'}/>;
  const scene = project.scenes.find((s) => frame >= s.startFrame && frame < s.endFrame);
  const local = frame - scene.startFrame;
  const caption = project.captions.find((c) => frame >= c.from && frame < c.to);
  const graphicWidth = wide ? 760 : Math.min(800, usable);
  const scale = graphicWidth / 760;
  return <AbsoluteFill data-reel-root lang="en" style={{background: colors.bg, color: colors.text,
    fontFamily: 'ReelRegional, sans-serif', backgroundImage:
      'radial-gradient(ellipse at 75% 40%, #153b542f, transparent 70%), linear-gradient(#ffffff04 1px, transparent 1px), linear-gradient(90deg, #ffffff04 1px, transparent 1px)',
    backgroundSize: '100% 100%, 64px 64px, 64px 64px'}}>
    <Img src={staticFile(project.avatar)} style={{position: 'absolute', left, top: safe.top + 10, width: 76, height: 76, borderRadius: '50%'}}/>
    <Label style={text(left + 95, safe.top + 30, 500, 48, 30, {fontWeight: 800, color: colors.cyan})}>{project.brand}</Label>
    <Label style={text(left, wide ? 245 : 330, wide ? 850 : usable, 60, 24,
      {color: scene.kind === 'roadmap' ? colors.gold : colors.cyan, letterSpacing: 1.5})}>{scene.eyebrow}</Label>
    <Label style={text(left, wide ? 340 : 440, wide ? 850 : usable, 240, 76,
      {fontWeight: 800, opacity: Math.min(1, (local + 6) / 12)})}>{scene.title}</Label>
    <Label style={text(left, wide ? 615 : 720, wide ? 850 : usable, 130, 32,
      {color: colors.muted})}>{scene.detail}</Label>
    <div style={{position: 'absolute', left: wide ? 1060 : left + (usable - graphicWidth) / 2,
      top: wide ? 290 : 960, width: 760, height: 460, transform: `scale(${scale})`, transformOrigin: 'top left'}}>
      {project.kind === 'heatmap' ? <HeatmapGraphic kind={scene.kind} frame={local}/>
        : <Graphic kind={scene.kind} frame={local} avatar={project.avatar}/>}
    </div>
    {!cover && caption && <Label style={text(left, wide ? 885 : 1550, usable, wide ? 110 : 145, wide ? 36 : 40,
      {background: '#050b17', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '0 18px', boxSizing: 'border-box'})}>{caption.text}</Label>}
    <div style={{position: 'absolute', left, top: height - safe.bottom - 12,
      width: usable * Math.min(1, frame / project.bodyFrames), height: 4, background: colors.cyan}}/>
    {project.kind === 'heatmap' && <Label style={text(left, height - safe.bottom - 46, usable, 30, 20,
      {color: colors.muted})}>Illustrative design and grid, not Uber's internal stack.</Label>}
    {project.audio && <Sequence from={project.audioStartFrames}><Audio src={staticFile(project.audio)}/></Sequence>}
    <Audit font={project.font} safe={safe}/>
  </AbsoluteFill>;
}

registerRoot(() => <Composition id="ChannelIntro" component={ChannelIntro} width={1080} height={1920}
  fps={30} durationInFrames={900} calculateMetadata={({props}) => ({...FORMATS[props.format],
    durationInFrames: props.project.durationInFrames})}/>);
