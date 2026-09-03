import { useRef, useState, type ChangeEvent } from 'react';

import type { WalletIdentityDraft, WalletIdentityDraftValidation } from './identity-onboarding-model';
import { walletIdentityModeLabel, walletRecoveryFileErrorMessage } from './identity-onboarding-model';
import type { WalletCanonicalRecoveryDiscoveryView } from '../../../packages/browser/src/wallet-runtime-opening';
import type { WalletIdentityMode } from '../../../packages/browser/src/wallet-identity-entry';
import type { WalletRuntimeSummary } from './app-shell-model';
import { WalletRecoveryServices } from './wallet-recovery-services';
import './styles/identity-recovery.css';

type IdentityReviewProps = Readonly<{
  address: string;
  draft: WalletIdentityDraft;
  onEdit: () => void;
  onDeriveBrainVault: () => void;
  onVerifyMnemonic: () => void;
  validation: WalletIdentityDraftValidation;
}>;

export function IdentityReview({
  address,
  draft,
  onEdit,
  onDeriveBrainVault,
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
        {draft.mode === 'brainvault' ? (
          <button className="identity-primary-action" onClick={onDeriveBrainVault} type="button">
            Derive Brain Vault
          </button>
        ) : (
          <button className="identity-primary-action" onClick={onVerifyMnemonic} type="button">
            Verify recovery
          </button>
        )}
        <button className="identity-secondary-action" onClick={onEdit} type="button">
          Edit inputs
        </button>
      </div>
    </section>
  );
}

export function IdentityRecoveryVerified({
  address,
  mode,
  openedRuntimeId,
  opening,
  openingError,
  recoveryDiscovery,
  runtimeState,
  selectedRecoveryCandidateId,
  onOpen,
  onImportRecoveryFile,
  onReset,
  onSelectRecoveryCandidate,
}: Readonly<{
  address: string;
  mode: WalletIdentityMode;
  openedRuntimeId: string;
  opening: boolean;
  openingError: string;
  recoveryDiscovery: WalletCanonicalRecoveryDiscoveryView | null;
  runtimeState: WalletRuntimeSummary['state'];
  selectedRecoveryCandidateId: string;
  onOpen: () => void;
  onImportRecoveryFile: (file: File) => Promise<void>;
  onReset: () => void;
  onSelectRecoveryCandidate: (candidateId: string) => void;
}>) {
  const opened = openedRuntimeId !== '';
  const choosingRecovery = recoveryDiscovery !== null;
  const brainVault = mode === 'brainvault';
  const backupFileInput = useRef<HTMLInputElement>(null);
  const [importingFile, setImportingFile] = useState(false);
  const [fileError, setFileError] = useState('');
  const importRecoveryFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setImportingFile(true);
    setFileError('');
    try {
      await onImportRecoveryFile(file);
    } catch (error: unknown) {
      setFileError(walletRecoveryFileErrorMessage(error));
    } finally {
      input.value = '';
      setImportingFile(false);
    }
  };
  return (
    <section className="identity-review" aria-labelledby="identity-verified-title">
      <p className="wallet-shell-eyebrow">{opened ? 'Runtime ready' : choosingRecovery ? 'Recovery found' : brainVault ? 'Derivation complete' : 'Recovery verified'}</p>
      <h1 id="identity-verified-title">{opened ? 'Wallet opened' : choosingRecovery ? 'Choose a backup' : brainVault ? 'Brain Vault ready' : 'The same wallet returned'}</h1>
      <p>{opened
        ? 'The canonical vault persisted this identity and attached its local Runtime.'
        : choosingRecovery
          ? 'Fresh creation is blocked. Restore one of the encrypted backups found for this wallet.'
          : brainVault
            ? 'The canonical worker derived this public address and recovery discovery found no existing backup.'
            : 'The second seed phrase reproduced the first public address.'}</p>
      <dl className="identity-verified-facts">
        <div><dt>Method</dt><dd>{walletIdentityModeLabel(mode)}</dd></div>
        <div><dt>Public address</dt><dd>{address}</dd></div>
        <div><dt>Status</dt><dd>{opened ? 'Runtime persisted' : choosingRecovery ? 'Backup required' : brainVault ? 'Recovery checked' : 'Recovery match'}</dd></div>
      </dl>
      {recoveryDiscovery ? (
        <div className="identity-recovery-candidates" role="radiogroup" aria-label="Recovery backup versions">
          {recoveryDiscovery.candidates.map((candidate, index) => (
            <button
              aria-checked={candidate.id === selectedRecoveryCandidateId}
              className={candidate.id === selectedRecoveryCandidateId ? 'is-selected' : ''}
              disabled={opening}
              key={candidate.id}
              onClick={() => onSelectRecoveryCandidate(candidate.id)}
              role="radio"
              type="button"
            >
              <span><strong>{index === 0 ? 'Latest backup' : 'Backup version'}</strong>{candidate.sourceLabel}</span>
              <span>H{candidate.runtimeHeight.toLocaleString()} · {candidate.signerCount} signer{candidate.signerCount === 1 ? '' : 's'} · {candidate.bundleCount} bundle{candidate.bundleCount === 1 ? '' : 's'}</span>
              <time dateTime={new Date(candidate.createdAt).toISOString()}>{new Date(candidate.createdAt).toLocaleString()}</time>
            </button>
          ))}
          <p>{recoveryDiscovery.checkedTowers} tower{recoveryDiscovery.checkedTowers === 1 ? '' : 's'} and {recoveryDiscovery.checkedPeers} saved peer{recoveryDiscovery.checkedPeers === 1 ? '' : 's'} checked.</p>
          {recoveryDiscovery.errors.length > 0 ? (
            <p className="identity-recovery-warning">Recovery warnings: {recoveryDiscovery.errors.slice(0, 3).join(' | ')}</p>
          ) : null}
        </div>
      ) : null}
      <div className="identity-verified-note">
        <strong>{opened
          ? brainVault ? 'Derived wallet material was released.' : 'The verified phrase was released from the form.'
          : choosingRecovery
            ? brainVault ? 'Derived wallet material remains outside React state.' : 'The verified phrase remains only for this restore.'
            : brainVault ? 'Derived wallet material remains outside React state.' : 'Both seed entries were cleared.'}</strong>
        <span>{opened
          ? `Active Runtime ${openedRuntimeId}. Recovery discovery completed before opening.`
          : choosingRecovery
            ? 'Selecting a backup never authorizes fresh creation. Reset clears this recovery session.'
            : brainVault
              ? 'Only the migration bridge can consume it, once, to create and open this wallet.'
              : 'The verified phrase remains only in this tab until you open the wallet or reset.'}</span>
      </div>
      {openingError ? <p className="identity-opening-error" role="alert">{openingError}</p> : null}
      {fileError ? <p className="identity-opening-error" role="alert">{fileError}</p> : null}
      <div className="identity-review-actions">
        {opened ? (
          <a className="identity-primary-action" href="/app?portfolio=1">Continue to assets</a>
        ) : openingError ? null : (
          <button className="identity-primary-action" disabled={opening || importingFile} onClick={onOpen} type="button">
            {opening
              ? choosingRecovery ? 'Restoring backup…' : 'Checking recovery…'
              : choosingRecovery ? 'Restore selected backup' : brainVault ? 'Create and open wallet' : 'Check recovery and open wallet'}
          </button>
        )}
        {!opened && !openingError ? (
          <button
            className="identity-secondary-action"
            disabled={opening || importingFile}
            onClick={() => backupFileInput.current?.click()}
            type="button"
          >
            {importingFile ? 'Loading backup…' : 'Import runtime backup'}
          </button>
        ) : null}
        <button className="identity-secondary-action" disabled={opening || importingFile} onClick={onReset} type="button">
          {openingError ? brainVault ? 'Re-enter inputs' : 'Re-enter seed' : 'Start over'}
        </button>
      </div>
      <input
        accept=".json,application/json,text/plain"
        className="identity-recovery-file-input"
        onChange={(event) => { void importRecoveryFile(event); }}
        ref={backupFileInput}
        type="file"
      />
      {opened ? <WalletRecoveryServices runtimeState={runtimeState} /> : null}
    </section>
  );
}
