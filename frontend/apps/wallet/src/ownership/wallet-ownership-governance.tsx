import { useEffect, useState, useSyncExternalStore } from 'react';
import type { WalletPaymentSource } from '../payments/wallet-payment-source';
import type { WalletControlTakeoverReview, WalletControlTakeoverStatus, WalletControlTakeoverTarget } from '../../../../bridges/wallet/wallet-canonical-ownership-governance';

const ZERO_HASH = `0x${'0'.repeat(64)}`;
const compact = (value: string): string => value.length <= 18 ? value : `${value.slice(0, 10)}…${value.slice(-6)}`;

export function WalletOwnershipGovernance({ source, entityId, signerId, commandsReady, commandReason }: Readonly<{
  source: WalletPaymentSource;
  entityId: string;
  signerId: string;
  commandsReady: boolean;
  commandReason: string;
}>) {
  const payment = useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  const [targets, setTargets] = useState<readonly WalletControlTakeoverTarget[]>([]);
  const [targetId, setTargetId] = useState('');
  const [status, setStatus] = useState<WalletControlTakeoverStatus | null>(null);
  const [review, setReview] = useState<WalletControlTakeoverReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const observedHeight = payment.projection?.height ?? -1;
  useEffect(() => {
    if (observedHeight < 0) return;
    let current = true;
    const adapter = source.workspaceRuntime().adapter;
    const refresh = async () => {
      try {
        const governance = await import('../../../../bridges/wallet/wallet-canonical-ownership-governance');
        const next = await governance.readWalletControlTakeoverTargets(adapter, entityId, signerId);
        if (!current) return;
        setTargets(next);
        setTargetId(selected => next.some(target => target.entityId === selected) ? selected : '');
        setError('');
      } catch (cause: unknown) {
        if (current) setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        if (current) setLoading(false);
      }
    };
    // Runtime control replies also emit adapter changes. Follow the wallet's
    // committed-height projection so a control read cannot recursively trigger
    // another control read, and coalesce fast frame bursts into one refresh.
    const timer = window.setTimeout(() => { void refresh(); }, 200);
    return () => { current = false; window.clearTimeout(timer); };
  }, [source, entityId, signerId, observedHeight]);
  const commandBusy = payment.command.status === 'submitting' || payment.command.status === 'pending';
  const proposalPending = Boolean(status && status.proposedBoardHash !== ZERO_HASH);
  const refreshStatus = async (selected = targetId) => {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      const governance = await import('../../../../bridges/wallet/wallet-canonical-ownership-governance');
      setStatus(await governance.readWalletControlTakeoverStatus(
        source.workspaceRuntime().adapter, entityId, signerId, selected,
      ));
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };
  const openReview = async () => {
    setBusy(true);
    setError('');
    try {
      const governance = await import('../../../../bridges/wallet/wallet-canonical-ownership-governance');
      const adapter = source.workspaceRuntime().adapter;
      const next = await governance.reviewWalletControlBoardProposal(adapter, entityId, signerId, targetId);
      setReview(next);
      setStatus(await governance.readWalletControlTakeoverStatus(adapter, entityId, signerId, targetId));
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };
  const submitProposal = async () => {
    if (!review) return;
    setBusy(true);
    setError('');
    try {
      const governance = await import('../../../../bridges/wallet/wallet-canonical-ownership-governance');
      const adapter = source.workspaceRuntime().adapter;
      await source.submitEntityInput(await governance.prepareWalletControlBoardProposal(
        adapter, entityId, signerId, review,
      ));
      setReview(null);
      setStatus(await governance.observeWalletControlBoardProposal(adapter, entityId, signerId, review));
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };
  const selectTarget = (value: string) => {
    setTargetId(value);
    setStatus(null);
    setReview(null);
    setError('');
    if (value) void refreshStatus(value);
  };
  return <section className="wallet-ownership-governance" data-testid="ownership-control-takeover" aria-busy={loading || busy}>
    <header><div><strong>CONTROL governance</strong><p>Propose this signer as the successor board for an eligible synchronized Entity.</p></div></header>
    {loading ? <p role="status">Reading eligible takeover targets…</p> : targets.length === 0
      ? <p>No eligible target. The signer must already follow the target as a validator on the same EntityProvider.</p>
      : <><label><span>Target Entity</span><select data-testid="ownership-takeover-target" value={targetId} onChange={event => selectTarget(event.target.value)}>
        <option value="">Select target</option>{targets.map(target => <option value={target.entityId} key={target.entityId}>{target.name}</option>)}
      </select></label>
      {status?.targetEntityId === targetId ? <div className="wallet-ownership-takeover-state" data-testid="ownership-takeover-status">
        <span>Current board <code>{compact(status.currentBoardHash)}</code></span>
        <span>{proposalPending ? <>Proposed board <code data-testid="ownership-proposed-board">{status.proposedBoardHash}</code></> : 'No pending board proposal'}</span>
        <span>Next action nonce {status.actionNonce + 1n}</span>
      </div> : null}
      {review?.targetEntityId === targetId ? <div className="wallet-ownership-review" data-testid="ownership-takeover-review">
        <strong>Review board proposal</strong>
        <p>The selected shareholder Entity will vote its settled CONTROL reserve for this single-signer successor board.</p>
        <dl><div><dt>Target</dt><dd>{review.targetName}</dd></div><div><dt>Action nonce</dt><dd>{review.actionNonce}</dd></div><div><dt>New board</dt><dd><code>{review.newBoardHash}</code></dd></div></dl>
        <div className="wallet-ownership-actions"><button type="button" onClick={() => { setReview(null); setError(''); }} disabled={busy || commandBusy}>Cancel</button>
          <button type="button" data-testid="ownership-takeover-submit" onClick={() => void submitProposal()} disabled={!commandsReady || busy || commandBusy}>Submit proposal</button></div>
      </div> : <div className="wallet-ownership-actions"><button type="button" onClick={() => void refreshStatus()} disabled={!targetId || busy || commandBusy}>Refresh status</button>
        <button type="button" data-testid="ownership-takeover-propose" onClick={() => void openReview()} disabled={!targetId || proposalPending || !commandsReady || busy || commandBusy}>Review proposal</button></div>}
      </>}
    {!commandsReady ? <p role="status">{commandReason || 'Runtime commands are unavailable.'}</p> : null}
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
