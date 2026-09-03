import type { WalletIdentityDraft, WalletIdentityDraftValidation } from './identity-onboarding-model';
import { walletIdentityModeLabel } from './identity-onboarding-model';
import './styles/identity-recovery.css';

type IdentityReviewProps = Readonly<{
  address: string;
  draft: WalletIdentityDraft;
  onEdit: () => void;
  onVerifyMnemonic: () => void;
  validation: WalletIdentityDraftValidation;
}>;

export function IdentityReview({
  address,
  draft,
  onEdit,
  onVerifyMnemonic,
  validation,
}: IdentityReviewProps) {
  return (
    <section className="identity-review" aria-labelledby="identity-review-title">
      <p className="wallet-shell-eyebrow">Identity input ready</p>
      <h1 id="identity-review-title">Review recovery requirements</h1>
      <p>No wallet has been created and no secret has left this form.</p>
      <dl>
        <div><dt>Method</dt><dd>{walletIdentityModeLabel(draft.mode)}</dd></div>
        {draft.mode === 'brainvault' ? <div><dt>Vault name</dt><dd>{draft.name}</dd></div> : null}
        {address ? <div><dt>Public address</dt><dd>{address}</dd></div> : null}
        <div><dt>Recovery</dt><dd>{validation.detail}</dd></div>
      </dl>
      <div className="identity-review-warning">
        <strong>{draft.mode === 'brainvault' ? 'Exact inputs are mandatory.' : 'The words control the wallet.'}</strong>
        <span>{draft.mode === 'brainvault'
          ? 'Name, passphrase, and work factor must match on every recovery.'
          : 'Keep the seed offline and hidden from cameras, cloud backups, and other people.'}</span>
      </div>
      <div className="identity-review-actions">
        {draft.mode === 'mnemonic' ? (
          <button className="identity-primary-action" onClick={onVerifyMnemonic} type="button">
            Verify recovery
          </button>
        ) : null}
        <button className="identity-secondary-action" onClick={onEdit} type="button">
          Edit inputs
        </button>
      </div>
    </section>
  );
}

export function IdentityRecoveryVerified({
  address,
  openedRuntimeId,
  opening,
  openingError,
  onOpen,
  onReset,
}: Readonly<{
  address: string;
  openedRuntimeId: string;
  opening: boolean;
  openingError: string;
  onOpen: () => void;
  onReset: () => void;
}>) {
  const opened = openedRuntimeId !== '';
  return (
    <section className="identity-review" aria-labelledby="identity-verified-title">
      <p className="wallet-shell-eyebrow">{opened ? 'Runtime ready' : 'Recovery verified'}</p>
      <h1 id="identity-verified-title">{opened ? 'Wallet opened' : 'The same wallet returned'}</h1>
      <p>{opened
        ? 'The canonical vault persisted this identity and attached its local Runtime.'
        : 'The second seed phrase reproduced the first public address.'}</p>
      <dl className="identity-verified-facts">
        <div><dt>Method</dt><dd>Mnemonic</dd></div>
        <div><dt>Public address</dt><dd>{address}</dd></div>
        <div><dt>Status</dt><dd>{opened ? 'Runtime persisted' : 'Recovery match'}</dd></div>
      </dl>
      <div className="identity-verified-note">
        <strong>{opened ? 'The verified phrase was released from the form.' : 'Both seed entries were cleared.'}</strong>
        <span>{opened
          ? `Active Runtime ${openedRuntimeId}. Recovery discovery completed before opening.`
          : 'The verified phrase remains only in this tab until you open the wallet or reset.'}</span>
      </div>
      {openingError ? <p className="identity-opening-error" role="alert">{openingError}</p> : null}
      <div className="identity-review-actions">
        {opened ? (
          <a className="identity-primary-action" href="/app?portfolio=1">Continue to assets</a>
        ) : openingError ? null : (
          <button className="identity-primary-action" disabled={opening} onClick={onOpen} type="button">
            {opening ? 'Checking recovery…' : 'Check recovery and open wallet'}
          </button>
        )}
        <button className="identity-secondary-action" disabled={opening} onClick={onReset} type="button">
          {openingError ? 'Re-enter seed' : 'Start over'}
        </button>
      </div>
    </section>
  );
}
