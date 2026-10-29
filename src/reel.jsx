import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {motion} from '../lib/core.mjs';

const colors = {bg: '#101827', panel: '#1b2940', text: '#f2f6ff', muted: '#b8c6da', scan: '#62d5ff', write: '#ffd078', done: '#9ee8bc'};
const Text = ({children, top, size = 44, color = colors.text, style = {}}) =>
  <div style={{position: 'absolute', left: 80, right: 140, top, fontSize: size, lineHeight: 1.25, color, ...style}}>{children}</div>;

function ArrayView({tokens, state, y = 820}) {
  const gap = 16;
  const width = Math.min(150, (850 - gap * (tokens.length - 1)) / tokens.length);
  const stride = width + gap;
  const x = (index) => 80 + index * stride;
  const tokenState = state?.tokens ?? tokens.map((t, position) => ({...t, position, dy: 0}));
  return <>
    {tokens.map((token, index) => <React.Fragment key={`cell-${index}`}>
      <div style={{position: 'absolute', left: x(index), top: y, width, height: 128, borderRadius: 18,
        border: `3px solid ${index < (state?.w ?? 0) ? colors.done : '#52617a'}`, background: colors.panel}}/>
      <div style={{position: 'absolute', left: x(index), top: y + 146, width, textAlign: 'center', color: colors.muted, fontSize: 32}}>{index}</div>
    </React.Fragment>)}
    {tokenState.map((token) => <div key={token.id} data-token={token.id}
      style={{position: 'absolute', left: x(token.position), top: y + 30 + token.dy, width,
        textAlign: 'center', fontSize: 52, fontWeight: 700, color: colors.text}}>{token.value}</div>)}
    {state?.w !== undefined && state.w < tokens.length && <div style={{position: 'absolute', left: x(state.w), top: y - 140,
      width, textAlign: 'center', fontSize: 42, fontWeight: 700, color: colors.write}}>w</div>}
    {state?.r !== undefined && !state.done && state.r < tokens.length && <div style={{position: 'absolute', left: x(state.r), top: y - 85,
      width, textAlign: 'center', fontSize: 42, fontWeight: 700, color: colors.scan}}>r</div>}
    {state?.done && <Text top={1090} color={colors.scan}>Scan complete.</Text>}
  </>;
}

function Scene({scene, spec}) {
  const frame = useCurrentFrame();
  const state = motion(scene, frame);
  return <AbsoluteFill>
    <Text top={270} size={68} style={{fontWeight: 800}}>{scene.title}</Text>
    <Text top={365} size={48} color={colors.write} style={{fontWeight: 700}}>{scene.subtitle}</Text>
    {scene.kind === 'hook' ? <>
      <Text top={530} size={32} color={colors.muted}>INPUT</Text>
      <ArrayView tokens={scene.before} y={610}/>
      <Text top={1000} size={32} color={colors.muted}>GOAL: SAME ARRAY, SAME NON-ZERO ORDER</Text>
      <ArrayView tokens={scene.after} y={1070}/>
    </> : <ArrayView tokens={scene.before} state={state}/>}
    {scene.kind === 'setup' && <>
      <Text top={1080} color={colors.scan}>r = scan the next value</Text>
      <Text top={1160} color={colors.write}>w = place the next non-zero</Text>
    </>}
    {scene.kind === 'step' && <>
      <Text top={510} size={38}>{scene.swap ? `Swap indices ${scene.r} and ${scene.w}.` : 'Leave w where it is.'}</Text>
      <Text top={1190} size={39}>{scene.swap ? 'Swap values first. Then move both pointers.' : 'The array does not change.'}</Text>
      <Text top={1270} size={34} color={colors.muted}>Green outline = completed non-zero prefix</Text>
    </>}
    {scene.kind === 'summary' && <>
      <Text top={1080} size={38}>Read left to right. Place in that same order.</Text>
      <Text top={1170} size={48} color={colors.done} style={{fontWeight: 700}}>O(n) time / O(1) extra space</Text>
      <Text top={1260} size={34} color={colors.muted}>Zero: scan only. Non-zero: swap, then advance.</Text>
    </>}
    {scene.kind === 'challenge' && <>
      <Text top={1090}>Where should the non-zero value go?</Text>
      <Text top={1190} size={38} color={colors.done}>{spec.callToAction}</Text>
    </>}
    {scene.audio && <Sequence from={12}><Audio src={staticFile(scene.audio)} volume={1}/></Sequence>}
  </AbsoluteFill>;
}

export function Reel({project}) {
  const frame = useCurrentFrame();
  const caption = project.captions.find((c) => frame >= Math.floor(c.start * 30) && frame < Math.ceil(c.end * 30));
  return <AbsoluteFill style={{background: colors.bg, fontFamily: 'Arial, sans-serif', color: colors.text}}>
    <div style={{position: 'absolute', inset: 0, opacity: 0.12,
      backgroundImage: 'linear-gradient(#52617a 1px, transparent 1px),linear-gradient(90deg,#52617a 1px,transparent 1px)',
      backgroundSize: '90px 90px'}}/>
    <Text top={180} size={30} color={colors.scan} style={{fontWeight: 700, letterSpacing: 2}}>{project.spec.brand} / TWO POINTERS</Text>
    {project.scenes.map((scene) => <Sequence key={scene.id} from={scene.startFrame} durationInFrames={scene.durationInFrames}>
      <Scene scene={scene} spec={project.spec}/>
    </Sequence>)}
    {caption && <div style={{position: 'absolute', left: 70, right: 130, top: 1470,
      padding: '24px 28px', borderRadius: 18, background: '#060c18', fontSize: 42,
      textAlign: 'center', lineHeight: 1.3, color: 'white'}}>{caption.text}</div>}
    <div style={{position: 'absolute', left: 80, right: 140, top: 1680, height: 5, background: colors.panel}}>
      <div style={{height: '100%', width: `${100 * (frame + 1) / project.durationInFrames}%`, background: colors.scan}}/>
    </div>
  </AbsoluteFill>;
}
