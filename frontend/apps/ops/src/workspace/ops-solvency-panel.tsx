import {
  formatSolvencyAmount,
  getSolvencyStatusView,
  shortenSolvencyAddress,
} from '../../../../packages/runtime-client/src/solvency-panel-view';
import { readOpsSolvency } from './ops-workspace-query';
import { useWorkspaceQuery } from './use-workspace-query';
import { WorkspaceReadBoundary } from './workspace-read-boundary';

export function OpsSolvencyPanel() {
  const { snapshot, connection, connected } = useWorkspaceQuery(readOpsSolvency);
  const data = snapshot.data;
  const status = getSolvencyStatusView(data === null ? null : data.isValid);
  return (
    <section className="workspace-read-panel" data-testid="solvency-panel">
      <header><div><h2>Solvency</h2><p>Asset conservation · live Runtime</p></div></header>
      <WorkspaceReadBoundary connected={connected} connection={connection} error={snapshot.error} loading={snapshot.loading && data === null}>
        <div className={`workspace-solvency-status is-${status.tone}`} data-testid="solvency-status"><span aria-hidden="true">{status.icon}</span>{status.label}</div>
        {data && data.assets.length ? (
          <div className="workspace-solvency-assets">
            {data.assets.map(asset => (
              <section className={`workspace-solvency-asset${asset.isValid === false ? ' is-invalid' : ''}`} data-testid="solvency-asset" key={`${asset.stackId}:${asset.tokenId}`}>
                <header><strong>CHAIN {asset.chainId} · TOKEN #{asset.tokenId}</strong><code title={asset.depositoryAddress}>{shortenSolvencyAddress(asset.depositoryAddress)}</code></header>
                <dl>
                  <div><dt>Reserves</dt><dd data-testid="solvency-reserves">{formatSolvencyAmount(asset.reserves)}</dd></div>
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
