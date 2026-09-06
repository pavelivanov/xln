import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { safeStringify } from '@xln/core/protocol/serialization';
import { DEFAULT_XLN_MASCOT_DOCK, clampMascotPoint, moveMascotDock, normalizeXlnMascotDock, resolveMascotPanelRect, resolveMascotPoint, resolveMascotViewport, snapMascotToEdge, type MascotPoint } from '../../../../../packages/ui/src/mascot-geometry';
import { parseJsonUnknown, isUnknownRecord } from '../../../../../packages/runtime-client/src/boundary';
import type { XlnAssistantMessage } from '../../../../../src/lib/ai/xln-assistant-client';
import { OpsGuideChat } from './ops-guide-chat';
import mascotMark from '../../../../static/img/l.png';

const viewport = () => {
  const visual = window.visualViewport;
  return resolveMascotViewport(window.innerWidth, window.innerHeight, visual ? { width: visual.width, height: visual.height, offsetLeft: visual.offsetLeft, offsetTop: visual.offsetTop } : null);
};
const readSettings = (): Record<string, unknown> => {
  const raw = localStorage.getItem('xln-settings');
  if (raw === null) return {};
  const record = parseJsonUnknown(raw, 'GUIDE_SETTINGS_JSON_INVALID');
  if (!isUnknownRecord(record)) throw new Error('GUIDE_SETTINGS_INVALID');
  return record;
};
export function OpsWorkspaceGuide() {
  const [expanded, setExpanded] = useState(false);
  const [dock, setDock] = useState(DEFAULT_XLN_MASCOT_DOCK);
  const [bounds, setBounds] = useState(viewport);
  const [dragPoint, setDragPoint] = useState<MascotPoint | null>(null);
  const [messages, setMessages] = useState<XlnAssistantMessage[]>([]);
  const [issue, setIssue] = useState('');
  const button = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ id: number; start: MascotPoint; origin: MascotPoint; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const point = dragPoint ?? resolveMascotPoint(dock, bounds);
  const panel = resolveMascotPanelRect(dock, point, bounds);
  useEffect(() => {
    try { setDock(normalizeXlnMascotDock(readSettings()['xlnMascotDock'])); }
    catch (cause) { setIssue(cause instanceof Error ? cause.message : String(cause)); }
    const resize = () => setBounds(viewport());
    window.addEventListener('resize', resize);
    const visual = window.visualViewport;
    if (visual) { visual.addEventListener('resize', resize); visual.addEventListener('scroll', resize); }
    return () => { window.removeEventListener('resize', resize); if (visual) { visual.removeEventListener('resize', resize); visual.removeEventListener('scroll', resize); } };
  }, []);
  const persist = (next: typeof dock): void => {
    try { localStorage.setItem('xln-settings', safeStringify({ ...readSettings(), xlnMascotDock: next })); setDock(next); }
    catch (cause) { setIssue(cause instanceof Error ? cause.message : String(cause)); }
  };
  const finish = (event: PointerEvent, cancelled: boolean): void => {
    if (!drag.current || event.pointerId !== drag.current.id) return;
    if (drag.current.moved && dragPoint && !cancelled) { persist(snapMascotToEdge(dragPoint, bounds)); suppressClick.current = true; }
    drag.current = null; setDragPoint(null);
  };
  const close = (): void => { setExpanded(false); button.current?.focus(); };
  return <>
    <button className="ops-guide-toggle" ref={button} style={{ left: point.x, top: point.y }} aria-label={expanded ? 'Close xln assistant. Drag to move.' : 'Ask xln. Drag to move.'} aria-expanded={expanded} data-testid="xln-mascot-toggle" type="button"
      onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } setExpanded(value => !value); }}
      onPointerDown={event => { if (event.button !== 0) return; drag.current = { id: event.pointerId, start: { x: event.clientX, y: event.clientY }, origin: point, moved: false }; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={event => { const current = drag.current; if (!current || current.id !== event.pointerId) return; const dx = event.clientX - current.start.x, dy = event.clientY - current.start.y; if (Math.hypot(dx, dy) < 5 && !current.moved) return; current.moved = true; setDragPoint(clampMascotPoint({ x: current.origin.x + dx, y: current.origin.y + dy }, bounds)); }}
      onPointerUp={event => finish(event, false)} onPointerCancel={event => finish(event, true)}
      onKeyDown={event => { if (event.key === 'Escape') close(); if (event.key.startsWith('Arrow')) { event.preventDefault(); persist(moveMascotDock(dock, event.key, event.shiftKey)); } }}><img src={mascotMark} alt="" width={40} height={40} /></button>
    {expanded ? <div className="ops-guide-chat" style={{ left: panel.x, top: panel.y, width: panel.width, height: panel.height }}><OpsGuideChat messages={messages} setMessages={setMessages} onClose={close} /></div> : null}
    {issue ? <p className="ops-guide-error" role="alert">{issue}</p> : null}
  </>;
}
