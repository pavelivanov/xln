import { useEffect, useState } from 'react';
import type { IDockviewPanelProps } from 'dockview';

import { OpsEntityWorkspaceView } from '../ops-entity-workspace';
import { opsWorkspaceSession } from '../ops-entity-workspace-runtime';

export function OpsBoundEntityPanel({ entityId, initialHash = '#assets' }: Readonly<{ entityId: string; initialHash?: string }>) {
  const [source] = useState(() => opsWorkspaceSession.createEntitySource(entityId));
  const [hash, setHash] = useState(initialHash);
  useEffect(() => {
    const release = opsWorkspaceSession.trackSource(source);
    void source.start();
    const stop = (event: PageTransitionEvent) => { if (!event.persisted) source.stop(); };
    window.addEventListener('pagehide', stop);
    return () => { window.removeEventListener('pagehide', stop); release(); };
  }, [source]);
  return (
    <div className="workspace-entity-pane" data-entity-id={entityId} onClick={event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      const link = target instanceof Element ? target.closest('a[href^="#"]') : null;
      if (!link) return;
      const next = link.getAttribute('href');
      if (!next) return;
      event.preventDefault();
      event.currentTarget.scrollTop = 0;
      setHash(next);
    }}>
      <OpsEntityWorkspaceView panelHash={hash} source={source} />
    </div>
  );
}

export function OpsEntityPanel({ params }: IDockviewPanelProps<Readonly<{ entityId?: string }>>) {
  if (params.entityId !== undefined) return <OpsBoundEntityPanel entityId={params.entityId} key={params.entityId} />;
  return <div className="workspace-entity-pane"><OpsEntityWorkspaceView /></div>;
}
