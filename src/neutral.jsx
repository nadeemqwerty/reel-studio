import React, {useEffect, useRef} from 'react';
import {AbsoluteFill, useCurrentFrame, cancelRender} from 'remotion';
import {motion} from '../lib/core.mjs';
import {formatValue, geometry} from '../lib/geometry.mjs';
import {diagramTransform} from '../lib/production.mjs';

export const color = {bg: '#101827', panel: '#1b2940', text: '#f2f6ff', muted: '#b8c6da',
  scan: '#62d5ff', write: '#ffd078', done: '#9ee8bc'};

function ArrayLayer({scene, frame, layer, locale, tokens = scene.before, y = 820, state = motion(scene, frame)}) {
  const g = geometry(scene, frame, tokens, y, state);
  return <>
    {g.cells.map((cell) => layer === 'base'
      ? <div key={`cell-${cell.index}`} style={{position: 'absolute', left: cell.x, top: cell.y, width: cell.width,
        height: 128, boxSizing: 'border-box', borderRadius: 18, background: color.panel,
        border: `3px solid ${cell.complete ? color.done : '#52617a'}`}}/>
      : <div data-reel-text key={`index-${cell.index}`} style={{position: 'absolute', left: cell.x, top: cell.y + 146,
        width: cell.width, height: 48, visibility: cell.indexVisible ? 'visible' : 'hidden',
        textAlign: 'center', color: color.muted, fontSize: 30}}>{formatValue(cell.index, locale)}</div>)}
    {g.tokens.map((token) => layer === 'base'
      ? <div data-token-body={token.id} key={token.id} style={{position: 'absolute', left: token.x + 8,
        top: token.y + 8, width: token.width - 16, height: 112, borderRadius: 14,
        background: '#293b58', boxShadow: '0 5px 12px #060c1866'}}/>
      : <div data-reel-text data-token-label={token.id} key={token.id} style={{position: 'absolute',
        left: token.x, top: token.y, width: token.width, height: 128,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        lineHeight: 1, fontSize: 48, fontWeight: 700}}>{formatValue(token.value, locale)}</div>)}
    {g.pointers.filter((p) => !p.occluded).map((p) => <div key={p.id} style={{position: 'absolute', left: p.x, top: p.y,
      width: p.width, height: 50, textAlign: 'center', color: p.id === 'w' ? color.write : color.scan}}>
      {layer === 'base'
        ? <div style={{position: 'absolute', left: '50%', top: 35, marginLeft: -9, width: 0, height: 0,
          borderLeft: '9px solid transparent', borderRight: '9px solid transparent', borderTop: '12px solid currentColor'}}/>
        : <span style={{fontSize: 32, fontWeight: 700}}>{p.id}</span>}
    </div>)}
  </>;
}

export function Arrays({scene, frame, layer, locale}) {
  const transform = diagramTransform(scene.layout, scene.kind);
  return <div style={{position: 'absolute', inset: 0, transformOrigin: '0 0',
    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`}}>
    {scene.kind === 'hook' ? <>
    <ArrayLayer scene={scene} frame={frame} layer={layer} locale={locale} tokens={scene.before} y={610} state={null}/>
    <ArrayLayer scene={scene} frame={frame} layer={layer} locale={locale} tokens={scene.after} y={1070} state={null}/>
  </> : <ArrayLayer scene={scene} frame={frame} layer={layer} locale={locale}/>}
  </div>;
}

export function NeutralScene({scene, frameOverride}) {
  const currentFrame = useCurrentFrame();
  const frame = frameOverride ?? currentFrame;
  const root = useRef(null);
  useEffect(() => {
    if (root.current?.textContent?.trim()) {
      cancelRender(new Error('Text leaked into neutral base.'));
    }
  }, [frame]);
  return <AbsoluteFill ref={root} data-reel-root style={{background: color.bg}}>
    <div style={{position: 'absolute', inset: 0, opacity: 0.12,
      backgroundImage: 'linear-gradient(#52617a 1px, transparent 1px),linear-gradient(90deg,#52617a 1px,transparent 1px)',
      backgroundSize: '90px 90px'}}/>
    <Arrays scene={scene} frame={frame} layer="base"/>
  </AbsoluteFill>;
}
