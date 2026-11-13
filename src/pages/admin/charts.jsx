import { useId } from 'react';

// Qo'shimcha kutubxonasiz yengil diagrammalar (SVG/CSS). Ranglar saytning dark/light mavzusiga moslashadi.

export function AreaChart({ data, color = 'var(--violet)', height = 190, unit = '' }) {
  const gid = useId().replace(/:/g, '');
  const W = 640; const H = height; const pad = { l: 34, r: 12, t: 12, b: 24 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const step = Math.max(1, Math.ceil(max / 4)); const top = step * 4;
  const iw = W - pad.l - pad.r; const ih = H - pad.t - pad.b;
  const x = (i) => pad.l + (data.length < 2 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v) => pad.t + ih - (v / top) * ih;
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ');
  const area = data.length ? `${line} L${x(data.length - 1).toFixed(1)},${pad.t + ih} L${x(0).toFixed(1)},${pad.t + ih} Z` : '';
  const every = Math.ceil(data.length / 7);
  return (
    <svg className="ap-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="chart">
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".32" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {[0, 1, 2, 3, 4].map((k) => (
        <g key={k}>
          <line x1={pad.l} x2={W - pad.r} y1={y(k * step)} y2={y(k * step)} stroke="var(--line)" strokeDasharray={k ? '3 4' : ''} />
          <text x={pad.l - 6} y={y(k * step) + 4} textAnchor="end" className="ap-axis">{k * step}</text>
        </g>
      ))}
      {area && <path d={area} fill={`url(#${gid})`} />}
      {line && <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
      {data.map((d, i) => (
        <g key={d.label + i}>
          <circle cx={x(i)} cy={y(d.value)} r="4" fill="var(--surface)" stroke={color} strokeWidth="2"><title>{`${d.label}: ${d.value}${unit}`}</title></circle>
          {i % every === 0 && <text x={x(i)} y={H - 6} textAnchor="middle" className="ap-axis">{d.label}</text>}
        </g>
      ))}
    </svg>
  );
}

export function BarChart({ data, max = 100, unit = '%', height = 170 }) {
  return (
    <div className="ap-bars" style={{ height }}>
      {data.map((d) => (
        <div key={d.label} className="ap-bar-col" title={`${d.label}: ${d.value ?? '—'}${d.value === null ? '' : unit}`}>
          <span className="ap-bar-val">{d.value === null ? '—' : `${d.value}${unit}`}</span>
          <div className="ap-bar-track"><div className={`ap-bar ${d.tone || ''}`} style={{ height: `${d.value === null ? 0 : Math.max(3, (d.value / max) * 100)}%` }} /></div>
          <span className="ap-bar-label">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function HBars({ rows, tone = 'warm' }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="ap-hbars">
      {rows.map((r) => (
        <div key={r.key || r.label} className="ap-hbar">
          <div className="ap-hbar-top"><b>{r.label}</b>{r.sub && <span className="muted small"> · {r.sub}</span>}<span className="ap-hbar-right">{r.right ?? r.value}</span></div>
          <div className="hbar"><span className={tone} style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

export function Donut({ segments, center, sub, size = 168 }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = 62; const c = 2 * Math.PI * r; let off = 0;
  return (
    <div className="ap-donut">
      <svg width={size} height={size} viewBox="0 0 160 160" role="img" aria-label="donut">
        <circle cx="80" cy="80" r={r} fill="none" stroke="var(--track)" strokeWidth="18" />
        {total > 0 && segments.filter((s) => s.value > 0).map((s) => {
          const len = (s.value / total) * c; const el = (
            <circle key={s.label} cx="80" cy="80" r={r} fill="none" stroke={s.color} strokeWidth="18" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-off} transform="rotate(-90 80 80)"><title>{`${s.label}: ${s.value}`}</title></circle>
          ); off += len; return el;
        })}
        <text x="80" y="82" textAnchor="middle" className="ap-donut-num">{center}</text>
        {sub && <text x="80" y="100" textAnchor="middle" className="ap-axis">{sub}</text>}
      </svg>
      <ul className="ap-legend">
        {segments.map((s) => <li key={s.label}><i style={{ background: s.color }} />{s.label}<b>{s.value}</b></li>)}
      </ul>
    </div>
  );
}
