import type { WalletBrainVaultDerivationProgress } from '../../../packages/browser/src/wallet-brainvault-opening';

export function IdentityBrainVaultProgress({
  progress,
  onCancel,
}: Readonly<{
  progress: WalletBrainVaultDerivationProgress;
  onCancel: () => void;
}>) {
  const percent = progress.total > 0
    ? Math.round((progress.completed / progress.total) * 100)
    : 0;
  const checkingRecovery = progress.phase === 'recovery';
  return (
    <section className="identity-review identity-derivation" aria-labelledby="identity-derivation-title">
      <p className="wallet-shell-eyebrow">{checkingRecovery ? 'Recovery check' : 'Memory-hard derivation'}</p>
      <h1 id="identity-derivation-title">{checkingRecovery ? 'Checking encrypted backups' : 'Deriving Brain Vault'}</h1>
      <p>{checkingRecovery
        ? 'The canonical recovery adapter is checking configured towers and saved peers before creation.'
        : 'The canonical WebAssembly worker is deriving every shard. Keep this tab open.'}</p>
      <div className="identity-derivation-meter">
        <div aria-label={`Brain Vault progress ${percent}%`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={percent} role="progressbar">
          <span style={{ width: `${percent}%` }} />
        </div>
        <strong>{checkingRecovery
          ? 'Recovery sources'
          : progress.total > 0 ? `${progress.completed} / ${progress.total} shards` : 'Preparing worker pool'}</strong>
        <span>{checkingRecovery
          ? 'Secrets remain in the migration bridge.'
          : progress.total > 0
            ? `${progress.workers} active worker${progress.workers === 1 ? '' : 's'}`
            : 'Validating the canonical worker version.'}</span>
      </div>
      {progress.notice ? <p className="identity-recovery-warning" role="status">{progress.notice}</p> : null}
      <button className="identity-secondary-action" onClick={onCancel} type="button">Cancel derivation</button>
    </section>
  );
}
