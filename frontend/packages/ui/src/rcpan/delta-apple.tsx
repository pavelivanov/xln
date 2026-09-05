import { buildDeltaAppleModel } from './delta-apple-model';
import { iconForSymbol } from './delta-token-format';
import type { DeltaParts } from './delta-types';
import './delta-apple.css';

export type AccountBarStyle = 'hairline' | 'pips' | 'twin' | 'capsule' | 'thread';

function AppleBar({ model: m, tokenClass, barStyle }: Readonly<{
  model: ReturnType<typeof buildDeltaAppleModel>; tokenClass: string; barStyle: AccountBarStyle;
}>) {
  if (barStyle === 'pips') return <div className="bar-wrap pips">{Array.from({ length: 8 }, (_, index) => <span key={index} className={`pip ${index < m.pipsFilled ? `on ${tokenClass}` : 'off'}`} />)}</div>;
  if (barStyle === 'twin') return <div className="bar-wrap twin">
    <span className={`twin-line ${tokenClass}`} style={{ width: `${m.empty ? 0 : Math.max(4, m.outPct)}%` }} />
    <span className="twin-line off" style={{ width: `${m.empty ? 0 : Math.max(4, m.inPct)}%` }} />
  </div>;
  if (barStyle === 'capsule') return <div className="bar-wrap"><div className="capsule">{!m.empty ? <>
    <div className="cap-coll" style={{ left: `${m.collStartPct}%`, width: `${m.collWidthPct}%` }} /><div className={`cap-fill ${tokenClass}`} style={{ width: `${m.markerPct}%` }} />
  </> : null}</div></div>;
  if (barStyle === 'thread') return <div className="bar-wrap"><div className="thread" />{m.empty ? <div className="zero" /> : <div className={`diamond ${tokenClass}`} style={{ left: `${m.markerPct}%` }} />}</div>;
  return <div className="bar-wrap"><div className="track">{!m.empty ? <>
    <div className={`reach ${tokenClass}`} style={{ width: `${m.markerPct}%` }} /><div className="coll" style={{ left: `${m.collStartPct}%`, width: `${m.collWidthPct}%` }} />
  </> : null}</div>{m.empty ? <div className="zero" /> : <div className={`dot ${tokenClass}`} style={{ left: `${m.markerPct}%` }} />}</div>;
}

export function DeltaApple({ derived, decimals, symbol, name, outAmount, inAmount, barStyle, expanded, controls, onToggle }: Readonly<{
  derived: DeltaParts; decimals: number; symbol: string; name: string; outAmount: string; inAmount: string;
  barStyle: AccountBarStyle; expanded: boolean; controls: string; onToggle: () => void;
}>) {
  const m = buildDeltaAppleModel(derived, decimals);
  const icon = iconForSymbol(symbol);
  return <div className={`wallet-delta-apple ${expanded ? 'open' : ''}`} data-bar-style={barStyle}>
    <button className="head" type="button" onClick={onToggle} aria-label={`${expanded ? 'Hide' : 'Show'} ${symbol} details`} aria-expanded={expanded} aria-controls={controls}>
      <span className={`token-icon ${icon.cls}`}>{icon.text}</span><span className="meta"><span className="sym">{symbol}</span><span className="nm">{name}</span></span>
      <span className="amt">{outAmount}</span><span className="chev" aria-hidden="true">›</span>
    </button>
    <AppleBar model={m} tokenClass={icon.cls} barStyle={barStyle} />
    <div className="detail" aria-hidden={!expanded}>{m.empty ? <div className="empty">No collateral or credit yet · fund with a faucet or deposit.</div> : <>
      <div className="caprow"><span className="send">← can send {outAmount}</span><span className="recv">can receive {inAmount} →</span></div>
      <div className="kv"><span>collateral · your / their</span><span>{m.fmt(derived.outCollateral)} / {m.fmt(derived.inCollateral)}</span></div>
      <div className="kv"><span>collateral total</span><span>{m.fmt(m.collateralTotal)}</span></div>
      <div className="kv"><span>credit on send side</span><span>{m.fmt(m.sendCredit)}</span></div>
      <div className="kv"><span>credit on receive side</span><span>{m.fmt(m.recvCredit)}</span></div>
      {(derived.outTotalHold ?? 0n) > 0n || (derived.inTotalHold ?? 0n) > 0n ? <div className="kv hold"><span>holds · out / in</span><span>{m.fmt(derived.outTotalHold)} / {m.fmt(derived.inTotalHold)}</span></div> : null}
    </>}</div>
  </div>;
}
