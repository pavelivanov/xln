import type { EntityWorkspaceAccounts } from '../../runtime-client/src/entity-workspace-accounts';
import { formatAddress } from './entity-workspace-display';
import './entity-workspace-accounts-panel.css';

type EntityWorkspaceAccountsPanelProps = Readonly<{
  accounts: EntityWorkspaceAccounts;
  onSelectPage: (page: number) => void;
}>;

export function EntityWorkspaceAccountsPanel({
  accounts,
  onSelectPage,
}: EntityWorkspaceAccountsPanelProps) {
  if (accounts.status !== 'selected') return null;
  return (
    <section className="entity-workspace-accounts-panel" data-testid="accounts-page-projection">
      <header>
        <span>Committed Account page</span>
        <strong><b data-testid="accounts-visible-count">{accounts.items.length}</b> shown</strong>
        <p><b data-testid="accounts-total-count">{accounts.totalItems}</b> total · Page {accounts.pageCount === 0 ? 0 : accounts.pageIndex + 1} of {accounts.pageCount}</p>
      </header>
      {accounts.items.length === 0
        ? <p className="entity-workspace-accounts-empty">No committed bilateral Accounts for this Entity.</p>
        : <ol>
            {accounts.items.map((account, index) => (
              <li key={account.counterpartyId}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <small>Counterparty</small>
                  <strong title={account.counterpartyId}>{formatAddress(account.counterpartyId)}</strong>
                </div>
                <dl>
                  <div><dt>Frame</dt><dd>{account.frameHeight}</dd></div>
                  <div><dt>State</dt><dd title={account.stateHash}>{formatAddress(account.stateHash)}</dd></div>
                </dl>
                <dl className="account-commitment-detail" data-testid="account-commitment">
                  <div><dt>J height</dt><dd data-testid="account-commitment-j-height">{account.jurisdictionHeight}</dd></div>
                  <div><dt>Timestamp</dt><dd>{account.frameTimestamp}</dd></div>
                  <div><dt>Frame txs</dt><dd>{account.transactionCount}</dd></div>
                  <div className="account-commitment-wide">
                    <dt>Account state root</dt>
                    <dd data-testid="account-commitment-root" title={account.accountStateRoot}>{formatAddress(account.accountStateRoot)}</dd>
                  </div>
                  <div className="account-commitment-wide">
                    <dt>Previous frame</dt>
                    <dd title={account.previousFrameHash}>{account.previousFrameHash ? formatAddress(account.previousFrameHash) : 'None'}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ol>}
      <footer>
        <button
          disabled={accounts.pageIndex === 0}
          onClick={() => onSelectPage(accounts.pageIndex - 1)}
          type="button"
        >Previous</button>
        <span>Exact committed frame evidence</span>
        <button
          disabled={accounts.pageIndex + 1 >= accounts.pageCount}
          onClick={() => onSelectPage(accounts.pageIndex + 1)}
          type="button"
        >Next</button>
      </footer>
    </section>
  );
}
