import type { EntityWorkspaceOwnership } from '../../../../runtime-client/src/entity/entity-workspace-ownership';
import { formatAddress } from '../settings/entity-workspace-display';

export function EntityWorkspaceOwnershipPanel({ ownership }: Readonly<{ ownership: EntityWorkspaceOwnership }>) {
  if (ownership.status !== 'selected') return null;
  return (
    <section className="entity-workspace-board" data-testid="ownership-board-projection">
      <header>
        <span>Committed board</span>
        <strong>{ownership.mode === 'proposer-based' ? 'Proposer based' : 'Gossip based'}</strong>
        <p>Threshold <b data-testid="ownership-threshold">{ownership.threshold.toString()}</b> of <b data-testid="ownership-total-shares">{ownership.totalShares.toString()}</b> voting shares</p>
      </header>
      <div className="entity-workspace-board-members">
        <div><span>Validators</span><strong data-testid="ownership-member-count">{ownership.members.length}</strong></div>
        <ol>
          {ownership.members.map((member, index) => (
            <li data-attached={member.isAttachedSigner || undefined} key={member.signerId}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{formatAddress(member.signerId)}</strong>
              <em>{member.shares.toString()} {member.shares === 1n ? 'share' : 'shares'}</em>
            </li>
          ))}
        </ol>
      </div>
      <footer>
        <span>Attached signer</span>
        <strong>{ownership.attachedSignerId
          ? ownership.members.some((member) => member.isAttachedSigner) ? 'Board member' : 'Observer'
          : 'Not exposed'}</strong>
      </footer>
    </section>
  );
}
