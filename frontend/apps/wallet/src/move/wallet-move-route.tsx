import { useEffect, useRef, useState } from 'react';
import { buildMoveArrowPath, MOVE_ENDPOINTS, MOVE_ENDPOINT_LABEL, type MoveEndpoint } from '../../../../src/lib/components/Entity/move-routes';
import { createMoveVisualController } from '../../../../src/lib/components/Entity/move/move-visual-controller';

export function WalletMoveRoute({ from, to, disabled, onChange }: Readonly<{
  from: MoveEndpoint; to: MoveEndpoint; disabled: boolean; onChange: (from: MoveEndpoint, to: MoveEndpoint) => void;
}>) {
  const [drag, setDrag] = useState<MoveEndpoint | null>(null);
  const [hover, setHover] = useState<MoveEndpoint | null>(null);
  const [ready, setReady] = useState(false);
  const [, setRevision] = useState(0);
  const current = useRef({ from, to, drag, ready }); current.current = { from, to, drag, ready };
  const root = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);
  const [controller] = useState(() => createMoveVisualController({ getFromEndpoint: () => current.current.from, getToEndpoint: () => current.current.to,
    getDragSource: () => current.current.drag, isLineReady: () => current.current.ready, setLineReady: setReady,
    setCommittedLineReady: () => {}, bumpLayoutVersion: () => setRevision(value => value + 1) }));
  useEffect(() => { controller.setRoot(root.current); return () => controller.destroy(); }, [controller]);
  useEffect(() => { controller.bumpNodeLayout(); }, [controller, from, to]);
  const targetAt = (x: number, y: number): MoveEndpoint | null => {
    const element = document.elementFromPoint(x, y)?.closest('[data-move-side="to"]');
    const endpoint = element?.getAttribute('data-move-endpoint');
    return endpoint === 'external' || endpoint === 'reserve' || endpoint === 'account' ? endpoint : null;
  };
  const clear = () => { setDrag(null); setHover(null); controller.clearDrag(); };
  const path = ready ? buildMoveArrowPath(controller.getNodeAnchor('from', drag || from), controller.getNodeAnchor('to', hover || to)) : '';
  return <div className="wallet-move-route" ref={root} onKeyDown={event => { if (event.key === 'Escape') clear(); }}>
    {(['from', 'to'] as const).map(side => <div key={side}><h3>{side === 'from' ? 'From' : 'To'}</h3>{MOVE_ENDPOINTS.map(endpoint => <button key={endpoint} type="button" disabled={disabled}
      data-testid={`move-${side === 'from' ? 'source' : 'target'}-${endpoint}`} data-move-side={side} data-move-endpoint={endpoint}
      aria-pressed={(side === 'from' ? from : to) === endpoint} data-hover={side === 'to' && hover === endpoint}
      onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } onChange(side === 'from' ? endpoint : from, side === 'to' ? endpoint : to); }}
      onPointerDown={event => { if (side !== 'from' || event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); setDrag(endpoint); controller.beginDrag(); }}
      onPointerMove={event => { if (drag) setHover(targetAt(event.clientX, event.clientY)); }}
      onPointerUp={event => { if (!drag) return; const target = targetAt(event.clientX, event.clientY); if (target) { suppressClick.current = true; onChange(drag, target); } clear(); }}
      onPointerCancel={clear}>{MOVE_ENDPOINT_LABEL[endpoint]}</button>)}</div>)}
    <svg aria-hidden="true"><defs><marker id="wallet-move-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7" /></marker></defs><path d={path} markerEnd="url(#wallet-move-arrow)" /></svg>
  </div>;
}
