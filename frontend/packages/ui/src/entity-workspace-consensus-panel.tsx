import type { EntityWorkspaceConsensusEvidence } from '../../runtime-client/src/entity-workspace-consensus-evidence';
import { formatAddress, formatEntityWorkspaceTimestamp } from './entity-workspace-display';
import './entity-workspace-consensus-panel.css';

type SelectedEvidence = Extract<
  EntityWorkspaceConsensusEvidence,
  Readonly<{ status: 'selected' }>
>;

function ConsensusSummary({ evidence }: Readonly<{ evidence: SelectedEvidence }>) {
  const timestamp = formatEntityWorkspaceTimestamp(evidence.entityTimestamp);
  return (
    <dl className="entity-workspace-consensus-summary">
      <div><dt>Runtime height</dt><dd data-testid="consensus-runtime-height">R{evidence.runtimeHeight}</dd></div>
      <div><dt>Entity height</dt><dd data-testid="consensus-entity-height">E{evidence.entityHeight}</dd></div>
      <div><dt>J finalized</dt><dd data-testid="consensus-finalized-j-height">J{evidence.lastFinalizedJurisdictionHeight}</dd></div>
      <div><dt>Board mode</dt><dd>{evidence.boardMode}</dd></div>
      <div><dt>Threshold</dt><dd data-testid="consensus-threshold">{evidence.threshold.toString()} / {evidence.totalShares.toString()}</dd></div>
      <div><dt>Accounts</dt><dd data-testid="consensus-account-count">{evidence.totalAccounts}</dd></div>
      <div className="consensus-summary-wide">
        <dt>Entity timestamp</dt>
        <dd><time data-testid="consensus-entity-timestamp" dateTime={timestamp.dateTime} title={`Runtime timestamp ${evidence.entityTimestamp}`}>{timestamp.label}</time></dd>
      </div>
      <div className="consensus-summary-wide">
        <dt>Entity frame head</dt>
        <dd data-testid="consensus-entity-frame-hash" title={evidence.entityFrameHash}>{evidence.entityFrameHash === 'genesis' ? 'Genesis' : formatAddress(evidence.entityFrameHash)}</dd>
      </div>
    </dl>
  );
}

function ConsensusBoard({ evidence }: Readonly<{ evidence: SelectedEvidence }>) {
  return (
    <section>
      <header><span>Board</span><strong>{evidence.members.length} validators</strong></header>
      <ol data-testid="consensus-board-members">
        {evidence.members.map((member) => (
          <li data-attached={member.isAttachedSigner || undefined} key={member.signerId}>
            <code title={member.signerId}>{formatAddress(member.signerId)}</code>
            <span>{member.shares.toString()} {member.shares === 1n ? 'share' : 'shares'}</span>
            {member.isAttachedSigner ? <b>Attached</b> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function AccountHeads({ evidence }: Readonly<{ evidence: SelectedEvidence }>) {
  return (
    <section>
      <header>
        <span>Account frame heads</span>
        <strong>Page {evidence.accountPageCount === 0 ? 0 : evidence.accountPageIndex + 1} / {evidence.accountPageCount}</strong>
      </header>
      {evidence.accounts.length === 0
        ? <p>No committed bilateral Accounts.</p>
        : <ol data-testid="consensus-account-heads">
            {evidence.accounts.map((account) => (
              <li key={account.counterpartyId}>
                <code title={account.counterpartyId}>{formatAddress(account.counterpartyId)}</code>
                <span>A{account.frameHeight}</span>
                <code title={account.stateHash}>{formatAddress(account.stateHash)}</code>
              </li>
            ))}
          </ol>}
    </section>
  );
}

export function EntityWorkspaceConsensusPanel({
  evidence,
}: Readonly<{ evidence: EntityWorkspaceConsensusEvidence }>) {
  if (evidence.status !== 'selected') return null;
  return (
    <section className="entity-workspace-consensus" data-testid="settings-consensus-evidence">
      <header>
        <div>
          <span>Remote consensus evidence</span>
          <strong>Committed board and Account heads</strong>
        </div>
        <b>Committed only</b>
      </header>
      <ConsensusSummary evidence={evidence} />
      <div className="entity-workspace-consensus-grid">
        <ConsensusBoard evidence={evidence} />
        <AccountHeads evidence={evidence} />
      </div>
      <footer>
        Validator-local proposals, votes, locks, and certificates are not exposed by this remote projection.
      </footer>
    </section>
  );
}
