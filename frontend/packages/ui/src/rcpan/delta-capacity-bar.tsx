import type { CSSProperties } from 'react';
import { buildDeltaCapacityBarModel, type DeltaBarSettings } from './delta-capacity-bar-model';
import type { DeltaParts, DeltaVisualScale } from './delta-types';
import './delta-capacity-bar.css';

// The shared Svelte model emits CSS declarations; convert only at the React boundary.
const style = (declarations: string): CSSProperties => Object.fromEntries(declarations.split(';').map(entry => {
  const colon = entry.indexOf(':');
  const property = entry.slice(0, colon);
  const key = property.startsWith('--') ? property : property.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
  return [key, entry.slice(colon + 1)];
}));

export function DeltaCapacityBar({ derived, visualScale, settings, layout, expanded, controls, label, onToggle, animation }: Readonly<{
  derived: DeltaParts; visualScale: DeltaVisualScale | null; settings: DeltaBarSettings; layout: 'center' | 'sides';
  expanded: boolean; controls: string; label: string; onToggle: () => void;
  animation: Readonly<{ sweep: boolean; glow: boolean; ripple: boolean }>;
}>) {
  const m = buildDeltaCapacityBarModel({ derived, heightPx: 12, visualScale, presentation: null, settings });
  const segment = (kind: 'credit' | 'coll' | 'debt', width: number, pixels: boolean) => width > 0
    ? <span key={kind} className={`seg ${kind}`} style={style(kind === 'credit'
      ? pixels ? m.creditSegStyle(width) : m.creditPctStyle(width)
      : pixels ? m.segmentWidthStyle(width) : `width:${width}%`)} /> : null;
  const out = (base: bigint) => <>{segment('credit', m.pctOf(derived.outOwnCredit, base), false)}{segment('coll', m.pctOf(derived.outCollateral, base), false)}{segment('debt', m.pctOf(derived.outPeerCredit, base), false)}</>;
  const inbound = (base: bigint) => <>{segment('debt', m.pctOf(derived.inOwnCredit, base), false)}{segment('coll', m.pctOf(derived.inCollateral, base), false)}{segment('credit', m.pctOf(derived.inPeerCredit, base), false)}</>;
  return <button className={`wallet-delta-classic interactive ${m.hasVisualScale ? `visual-${layout}` : ''} ${m.animTransition ? 'anim-transition' : ''} ${animation.glow ? 'anim-glow' : ''}`}
    type="button" aria-label={label} aria-expanded={expanded} aria-controls={controls} onClick={onToggle} style={style(m.presentationStyle)} data-layout={layout} data-scale={settings.accountBarUsdPerPx}>
    {m.hasVisualScale ? <>
      <span className="track" />
      {animation.sweep ? <span className="sweep-line" /> : null}{animation.ripple ? <span className="ripple-ring" /> : null}
      {layout === 'center' ? <span className="axis"><span className="delta-cut" /></span> : null}
      {m.outWidthPx > 0 ? <span className={`shell out ${layout === 'center' ? 'center' : 'side'}-shell`} style={style(m.outCenterWidthStyle)}>
        {segment('credit', m.outOwnWidthPx, true)}{segment('coll', m.outCollWidthPx, true)}{segment('debt', m.outDebtWidthPx, true)}
      </span> : null}
      {m.inWidthPx > 0 ? <span className={`shell in ${layout === 'center' ? 'center' : 'side'}-shell`} style={style(m.inCenterWidthStyle)}>
        {segment('debt', m.inOwnWidthPx, true)}{segment('coll', m.inCollWidthPx, true)}{segment('credit', m.inCreditWidthPx, true)}
      </span> : null}
    </> : m.halfMax === 0n ? <span className="bar empty" /> : layout === 'sides' ? <span className="bar one-sided">
      {out(m.outTotal + m.inTotal)}{inbound(m.outTotal + m.inTotal)}
      {m.outTotal > 0n && m.inTotal > 0n ? <span className="mid one-sided-sep" style={{ left: `${m.pctOf(m.outTotal, m.outTotal + m.inTotal)}%` }}><span className="delta-cut" /></span> : null}
    </span> : <span className="bar center split-center"><span className="half out">{out(m.halfMax)}</span><span className="mid"><span className="delta-cut" /></span><span className="half in">{inbound(m.halfMax)}</span></span>}
  </button>;
}
