import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { opsEntityWorkspaceSource } from '../../entity-workspace/ops-entity-workspace-runtime';
import { useWorkspaceQuery } from '../session/use-workspace-query';
import type { OpsWorkspaceQueryClient } from '../session/ops-workspace-query';
import { readRecordedEntityAudit } from './ops-recorded-entity';
import { useWorkspaceTranslation } from '../../../../../bridges/workspace-localization-react';

export function OpsEntityAuditPanel() {
  const { t } = useWorkspaceTranslation();
  const state = useSyncExternalStore(opsEntityWorkspaceSource.subscribe, opsEntityWorkspaceSource.getSnapshot);
  const entityId = state.context.entityId;
  const recording = useSyncExternalStore(opsEntityWorkspaceSource.subscribe, opsEntityWorkspaceSource.getRecording);
  const recorded = useMemo(() => recording && entityId ? readRecordedEntityAudit(recording, entityId) : null, [recording, entityId]);
  const atHeight = state.timeMachine.mode === 'history' ? state.timeMachine.selectedHeight : undefined;
  const reader = useCallback(async (client: OpsWorkspaceQueryClient) => {
    if (!entityId) return null;
    const [frame, activity] = await Promise.all([
      client.readViewFrame({ entityId, accountsLimit: 16, booksLimit: 16, ...(atHeight === undefined ? {} : { atHeight }) }),
      client.readActivity({ entityId, limit: 20, scanLimit: 240, ...(atHeight === undefined ? {} : { beforeHeight: atHeight + 1 }) }),
    ]);
    return { frame, activity };
  }, [entityId, atHeight]);
  const { snapshot, refresh } = useWorkspaceQuery(reader);
  const data = snapshot.data;
  const active = data?.frame.activeEntity;
  const evidence = recording && recording.kind !== 'adapter' ? recorded : (data && active ? { entityHeight: active.core.height, accounts: { visible: active.accounts.items.length, total: active.accounts.totalItems }, books: { visible: active.books.items.length, total: active.books.totalItems }, activity: data.activity } : null);
  return <section className="ops-evidence-panel" data-testid="entity-audit-panel">
    <header><div><small>{t('view.labels.entity')} audit</small><h2>{state.context.entityName ?? t('workspace.audit')}</h2></div><button disabled={!entityId || (!recorded && snapshot.loading)} onClick={() => { if (recorded) void opsEntityWorkspaceSource.refresh(); else if (refresh) void refresh(); }} type="button">{t('common.refresh')}</button></header>
    <p className="ops-audit-status"><span>{recording ? recording.kind : opsEntityWorkspaceSource.getAdapter()?.mode ?? 'Disconnected'}</span><span>{atHeight === undefined ? 'LIVE' : `h${atHeight}`}</span><code>{state.context.runtimeId}</code></p>
    {!recorded && snapshot.error ? <p role="alert">{snapshot.error}</p> : !entityId ? <p>Select a reference Entity in the workspace.</p> : !evidence ? <p>{snapshot.loading ? 'Loading projection…' : 'No Entity projection in this frame.'}</p> : <>
      <dl className="ops-audit-metrics"><div><dt>{t('view.labels.entity')} height</dt><dd>{evidence.entityHeight}</dd></div><div><dt>{t('network.accounts')}</dt><dd>{evidence.accounts.visible} / {evidence.accounts.total}</dd></div><div><dt>Books</dt><dd>{evidence.books.visible} / {evidence.books.total}</dd></div><div><dt>Activity scan</dt><dd>{evidence.activity.events.length} / {evidence.activity.scannedFrames}</dd></div></dl>
      <p className="ops-audit-status"><span>accounts cursor: {evidence.accounts.visible < (evidence.accounts.total ?? 0) ? 'more' : 'end'}</span><span>books cursor: {evidence.books.visible < (evidence.books.total ?? 0) ? 'more' : 'end'}</span><span>latest scanned: h{evidence.activity.latestHeight}</span></p>
      <div data-testid="entity-audit-activity">{evidence.activity.events.length ? evidence.activity.events.map(event => <article className="ops-audit-event" key={event.id}><div><strong>{event.title || event.rawType || event.type}</strong><small>{event.source}</small></div><code>h{event.height}</code></article>) : <p>No activity in the scanned window.</p>}</div>
    </>}
  </section>;
}
