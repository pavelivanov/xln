import { useWorkspaceTranslation } from '../../../../../bridges/workspace-localization-react';
import { useState, useSyncExternalStore } from 'react';
import { captionForStep } from '../../../../../src/lib/network3d/timeline/networkCaption';
import { opsEntityWorkspaceSource } from '../../entity-workspace/ops-entity-workspace-runtime';
import { copyWorkspaceTrail, pauseWorkspacePlayback, playWorkspace, refreshWorkspaceTimeline, returnWorkspaceLive, selectWorkspaceStep, setWorkspaceSpeed, workspaceBoot, workspaceNetwork, workspacePlayback } from './ops-workspace-playback';

export function OpsWorkspaceTimeline() {
  const { t } = useWorkspaceTranslation();
  const network = useSyncExternalStore(workspaceNetwork.subscribe, workspaceNetwork.get);
  const playback = useSyncExternalStore(workspacePlayback.subscribe, workspacePlayback.get);
  const adapter = useSyncExternalStore(opsEntityWorkspaceSource.subscribe, opsEntityWorkspaceSource.getAdapter);
  const [copyIssue, setCopyIssue] = useState('');
  const count = network.machine ? network.machine.steps.length : 0;
  const step = network.selectedStep;
  const caption = step ? captionForStep({ ...step.event, cues: step.cues }, network.activity) : null;
  return <section className="ops-workspace-timeline" aria-label={t('workspace.playbackLabel')} data-testid="workspace-network-timeline">
    <div className="ops-timeline-controls">
      <button disabled={!count || network.loading} onClick={() => { if (playback.playing) pauseWorkspacePlayback(); else playWorkspace(); }} type="button">{playback.playing ? t('workspace.pause') : t('workspace.play')}</button>
      <button aria-label={t('workspace.previousFrame')} disabled={network.loading || network.selectedStepIndex <= 0} onClick={() => { void selectWorkspaceStep(network.selectedStepIndex - 1); }} type="button">←</button>
      <input aria-label={t('workspace.networkFrame')} disabled={!count || network.loading} max={Math.max(0, count - 1)} min={0} onChange={event => { void selectWorkspaceStep(Number(event.currentTarget.value)); }} type="range" value={Math.max(0, network.selectedStepIndex)} />
      <button aria-label={t('workspace.nextFrame')} disabled={network.loading || !count || network.selectedStepIndex >= count - 1} onClick={() => { void selectWorkspaceStep(network.selectedStepIndex + 1); }} type="button">→</button>
      <output>{step ? `h${step.event.height} · ${network.selectedStepIndex + 1}/${count}` : t('time.live')}</output>
      <label>{t('workspace.speed')} <select aria-label={t('workspace.playbackSpeed')} onChange={event => setWorkspaceSpeed(Number(event.currentTarget.value))} value={playback.speed}>{[0.25, 0.5, 1, 2, 4, 10, playback.speed].filter((value, index, values) => values.indexOf(value) === index).map(speed => <option key={speed} value={speed}>{speed}×</option>)}</select></label>
      {workspaceBoot.kind === 'plain' || adapter ? <><button disabled={!adapter || network.loading} onClick={() => { if (adapter) void refreshWorkspaceTimeline(adapter); }} type="button">{t('workspace.loadTimeline')}</button><button onClick={returnWorkspaceLive} type="button">{t('time.live')}</button></> : null}
      <button disabled={!count || network.loading} onClick={() => { setCopyIssue(''); void copyWorkspaceTrail().catch(cause => setCopyIssue(cause instanceof Error ? cause.message : String(cause))); }} type="button">{t('workspace.copyTrail')}</button>
    </div>
    {caption ? <div className="ops-timeline-caption"><strong>{caption.title}</strong><span>{caption.subtitle}</span><p>{caption.mechanic}</p></div> : null}
    {playback.error || network.error || copyIssue ? <p role="alert">{playback.error || network.error || copyIssue}</p> : null}
  </section>;
}
