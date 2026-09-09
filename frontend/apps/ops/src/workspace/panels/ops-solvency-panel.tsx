import { useEffect, useState, useSyncExternalStore } from 'react';
import type { RuntimeAdapterSolvencySummary } from '@xln/core/api/public/runtime-module';
import { networkMachineRuntimeOperations } from '../../../../../src/lib/stores/network/networkMachineRuntimeStore';
import { workspaceNetwork } from '../session/ops-workspace-playback';

import {
  formatSolvencyAmount,
  getSolvencyStatusView,
  shortenSolvencyAddress,
} from '../../../../../packages/runtime-client/src/panels/solvency-panel-view';
import { readOpsSolvency } from '../session/ops-workspace-query';
import { useWorkspaceQuery } from '../session/use-workspace-query';
import { WorkspaceReadBoundary } from '../session/workspace-read-boundary';
import { useWorkspaceTranslation } from '../../../../../bridges/workspace-localization-react';

export function OpsSolvencyPanel() {
  const { t } = useWorkspaceTranslation();
  const { snapshot, connection, connected } = useWorkspaceQuery(readOpsSolvency);
  const network = useSyncExternalStore(workspaceNetwork.subscribe, workspaceNetwork.get);
  const step = network.selectedStep;
  const [recorded, setRecorded] = useState<{ step: typeof step; data: RuntimeAdapterSolvencySummary | null; error: string | null } | null>(null);
  useEffect(() => {
    if (!step) { setRecorded(null); return; }
    let current = true;
    void networkMachineRuntimeOperations.readSelectedSolvency().then(data => {
      if (current) setRecorded({ step, data, error: null });
    }).catch(cause => { if (current) setRecorded({ step, data: null, error: cause instanceof Error ? cause.message : String(cause) }); });
    return () => { current = false; };
  }, [step]);
  const selected = recorded?.step === step ? recorded : null;
  const data = step ? selected?.data ?? null : snapshot.data;
  const status = getSolvencyStatusView(data === null ? null : data.isValid);
  return (
    <section className="workspace-read-panel" data-testid="solvency-panel">
      <header><div><h2>{t('workspace.solvency')}</h2><p>Asset conservation · {step ? `${t('time.historical')} h${step.event.height}` : `${t('time.live')} Runtime`}</p></div></header>
      <WorkspaceReadBoundary connected={step ? true : connected} connection={connection} error={step ? selected?.error ?? null : snapshot.error} loading={step ? selected === null : snapshot.loading && data === null}>
        <div className={`workspace-solvency-status is-${status.tone}`} data-testid="solvency-status"><span aria-hidden="true">{status.icon}</span>{status.label}</div>
        {data && data.assets.length ? (
          <div className="workspace-solvency-assets">
            {data.assets.map(asset => (
              <section className={`workspace-solvency-asset${asset.isValid === false ? ' is-invalid' : ''}`} data-testid="solvency-asset" key={`${asset.stackId}:${asset.tokenId}`}>
                <header><strong>CHAIN {asset.chainId} · TOKEN #{asset.tokenId}</strong><code title={asset.depositoryAddress}>{shortenSolvencyAddress(asset.depositoryAddress)}</code></header>
                <dl>
                  <div><dt>{t('network.reserves')}</dt><dd data-testid="solvency-reserves">{formatSolvencyAmount(asset.reserves)}</dd></div>
                  <div><dt>Confirmed collateral</dt><dd data-testid="solvency-collateral">{formatSolvencyAmount(asset.confirmedCollateral)}</dd></div>
                </dl>
                {asset.isValid === false && asset.delta !== null ? <p className="is-error">Raw-unit delta: {formatSolvencyAmount(asset.delta)}</p> : null}
                {asset.isValid === null ? <p>Not verified: needs the Depository total for this token</p> : null}
              </section>
            ))}
          </div>
        ) : <p className="workspace-read-state">No asset conservation data</p>}
      </WorkspaceReadBoundary>
    </section>
  );
}
