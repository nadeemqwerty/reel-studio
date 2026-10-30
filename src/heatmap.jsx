import React from 'react';
import {cells, heatmapTrace} from '../lib/heatmap.mjs';

const trace = heatmapTrace();
const ink = '#f3f6ff', cyan = '#56d5ff', gold = '#ffd166';
const hex = (x, y, radius = 47) => Array.from({length: 6}, (_, i) => {
  const angle = (i * 60 - 30) * Math.PI / 180;
  return `${x + Math.cos(angle) * radius},${y + Math.sin(angle) * radius}`;
}).join(' ');
const tint = (n) => ['#13213a', '#245584', '#218aab', '#c5a44b'][Math.min(3, n)];

export function HeatmapGraphic({kind, frame}) {
  if (kind === 'stream' || kind === 'scale') return <svg width="760" height="460" viewBox="0 0 760 460">
    {kind === 'stream' ? <>
      <path d="M170 220 H330 M500 220 H620" fill="none" stroke={cyan} strokeWidth="4"/>
      {[[20, 'DRIVER'], [285, 'STREAM'], [550, 'WORKER']].map(([x, label]) => <g key={label}>
        <rect x={x} y="160" width="190" height="125" rx="18" fill="#13213a" stroke={cyan} strokeWidth="2"/>
        <text x={x + 95} y="215" textAnchor="middle" fill={ink} fontSize="25">{label}</text>
        <text x={x + 95} y="250" textAnchor="middle" fill={gold} fontSize="18">{label === 'DRIVER' ? 'D1 / cell / seq' : label === 'STREAM' ? 'e.g. Kafka' : 'state + counts'}</text>
      </g>)}
      <circle cx={220 + ((frame * 2) % 310)} cy="320" r="10" fill={gold}/>
      <text x="380" y="400" textAnchor="middle" fill={ink} fontSize="27">Process updates. Maintain the summary.</text>
    </> : <>
      {['A', 'B', 'C'].map((region, i) => <g key={region}>
        <rect x={30 + i * 245} y="100" width="215" height="250" rx="20" fill="#13213a" stroke={cyan} strokeWidth="2"/>
        <text x={137 + i * 245} y="155" textAnchor="middle" fill={gold} fontSize="24">REGION {region}</text>
        <text x={137 + i * 245} y="225" textAnchor="middle" fill={ink} fontSize="24">Driver state</text>
        <text x={137 + i * 245} y="275" textAnchor="middle" fill={ink} fontSize="24">Cell counts</text>
      </g>)}
      <text x="380" y="415" textAnchor="middle" fill={ink} fontSize="25">Atomic changes within each ownership boundary</text>
    </>}
  </svg>;
  const moving = kind === 'move' && frame >= 45 && frame < 90;
  const state = ['hook', 'cells'].includes(kind) || (kind === 'move' && frame < 90) ? trace.initial
    : kind === 'repeat' || kind === 'move' ? trace.repeated
      : kind === 'expiry' && frame < 90 ? trace.beforeExpiry : trace.expired;
  const heat = ['heat', 'h3', 'challenge'].includes(kind);
  const marker = kind === 'move' ? (frame < 90 ? 'A: 3 -> 2     B: 1 -> 2' : 'A: 2     B: 2')
    : kind === 'repeat' ? 'D1 sends more updates. B stays at 2.'
      : kind === 'expiry' ? (frame < 90 ? '30s timeout (simulated) / B: 2' : 'D1 expired / B: 1')
        : kind === 'h3' ? 'Illustrative hexagons / see H3 documentation'
          : kind === 'challenge' ? 'New: D1 -> B     Then old: D1 -> A ?'
            : kind === 'hook' ? 'Driver locations -> a live summary' : heat ? 'COLOUR = DRIVER COUNT:  0   1   2   3+' : 'A = centre cell / B = neighbour to the right';
  return <svg width="760" height="480" viewBox="0 0 760 480">
    {cells.map((cell) => {
      const count = state.counts[cell.id];
      const active = Object.entries(state.drivers).filter(([, d]) => d.active && d.cell === cell.id);
      return <g key={cell.id}>
        <polygon points={hex(cell.x, cell.y)} fill={heat ? tint(count) : '#13213a'}
          stroke={cell.id === '0,0' || cell.id === '1,0' ? gold : '#376386'} strokeWidth="2"/>
        <text x={cell.x} y={cell.y - 7} textAnchor="middle" fill={ink} fontSize="30" fontWeight="800">{count}</text>
        <text x={cell.x} y={cell.y + 16} textAnchor="middle" fill={cyan} fontSize="16">
          {cell.id === '0,0' ? 'A' : cell.id === '1,0' ? 'B' : ''}
        </text>
        {!heat && active.map(([id], i) => moving && id === 'D1' ? null :
          <rect key={id} x={cell.x - active.length * 9 + i * 18} y={cell.y + 26}
            width="13" height="20" rx="4" fill={id === 'D1' ? gold : cyan}/>)}
      </g>;
    })}
    {moving && <rect x={371 + ((frame - 45) / 45) * Math.sqrt(3) * 50} y="231" width="13" height="20" rx="4" fill={gold}/>}
    <rect x="10" y="420" width="740" height="52" rx="12" fill="#07101e"/>
    <text x="380" y="453" textAnchor="middle" fill={gold} fontSize="24">{marker}</text>
  </svg>;
}
