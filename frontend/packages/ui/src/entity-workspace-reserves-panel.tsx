import type { EntityWorkspaceReserves } from '../../runtime-client/src/entity-workspace-reserves';
import './entity-workspace-reserves-panel.css';

export function EntityWorkspaceReservesPanel({
  reserves,
}: Readonly<{ reserves: EntityWorkspaceReserves }>) {
  if (reserves.status !== 'selected') return null;
  return (
    <section className="entity-workspace-reserves" data-testid="assets-reserve-projection">
      <header>
        <span>Committed reserves</span>
        <strong><b data-testid="assets-reserve-count">{reserves.items.length}</b> token entries</strong>
        <p>Exact Entity-state amounts. Token metadata and prices are not inferred.</p>
      </header>
      {reserves.items.length === 0
        ? <p className="entity-workspace-reserves-empty">No reserve entries committed.</p>
        : (
          <ol>
            {reserves.items.map(({ tokenId, amount }) => (
              <li key={tokenId}>
                <span>Token #{tokenId}</span>
                <div title={amount.toString()}>
                  <code>{amount.toString()}</code>
                  <em>raw units</em>
                </div>
              </li>
            ))}
          </ol>
        )}
      <footer><span>Authority</span><strong>Committed Entity state</strong></footer>
    </section>
  );
}
