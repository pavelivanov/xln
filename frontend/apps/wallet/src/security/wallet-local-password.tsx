import { useState, type FormEvent } from 'react';

import {
  enrollSavedCanonicalWalletLocalPassword,
  unlockCanonicalWalletLocalPassword,
  type WalletLocalPasswordBlockedView,
} from '../../../../bridges/wallet/canonical/wallet-canonical-local-password';
import '../styles/security/wallet-local-password.css';

type CommonProps = Readonly<{
  onComplete?: () => void;
  onRecover: () => void;
}>;

type Props = CommonProps & (
  | Readonly<{
      mode: 'direct';
      view: WalletLocalPasswordBlockedView;
      onEnroll?: (password: string) => Promise<void>;
    }>
  | Readonly<{
      mode: 'chooser';
      entries: readonly WalletLocalPasswordBlockedView[];
      onCreate: () => void;
    }>
);

const EMPTY_ENTRIES: readonly WalletLocalPasswordBlockedView[] = [];

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export function WalletLocalPassword(props: Props) {
  const [selectedRuntimeId, setSelectedRuntimeId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const entries = props.mode === 'chooser' ? props.entries : EMPTY_ENTRIES;
  const directView = props.mode === 'direct' ? props.view : undefined;
  const view = directView ?? entries.find(entry => entry.runtimeId === selectedRuntimeId);
  const enrollment = view?.state === 'new-password';

  const resetForm = (): void => {
    setPassword('');
    setConfirmation('');
    setBusy(false);
    setError('');
  };

  const selectRuntime = (runtimeId: string): void => {
    resetForm();
    setSelectedRuntimeId(runtimeId);
  };

  const returnToChooser = (): void => {
    resetForm();
    setSelectedRuntimeId('');
  };

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!view || busy || view.state === 'recovery-required') return;
    const secret = password;
    setPassword('');
    setConfirmation('');
    setBusy(true);
    setError('');
    try {
      if (enrollment) {
        if (secret.length < 8) throw new Error('Use at least 8 characters.');
        if (secret !== confirmation) throw new Error('Passwords do not match.');
        if (props.mode === 'direct' && props.onEnroll) await props.onEnroll(secret);
        else await enrollSavedCanonicalWalletLocalPassword(view.runtimeId, secret);
      } else {
        await unlockCanonicalWalletLocalPassword(view.runtimeId, secret);
      }
      props.onComplete?.();
    } catch (failure: unknown) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  if (props.mode === 'chooser' && !view) {
    return (
      <main className="wallet-local-password">
        <section className="wallet-local-password-welcome" aria-labelledby="wallet-local-password-welcome-title">
          <p className="wallet-shell-eyebrow">Local wallet</p>
          <h1 id="wallet-local-password-welcome-title">Choose how to continue</h1>
          <p>Create a new wallet, restore one, or unlock a wallet saved on this device.</p>
          <div className="wallet-local-password-entry-actions">
            <button className="identity-primary-action" onClick={props.onCreate} type="button">Create a wallet</button>
            <button className="identity-secondary-action" onClick={props.onRecover} type="button">Restore a wallet</button>
          </div>
          <div className="wallet-local-password-saved" aria-label="Saved wallets">
            <p className="wallet-shell-eyebrow">Saved wallets</p>
            {entries.map(entry => (
              <button
                className="wallet-local-password-wallet"
                key={entry.runtimeId}
                onClick={() => selectRuntime(entry.runtimeId)}
                type="button"
              >
                <span>{entry.label}</span>
                <small>{entry.runtimeId.slice(0, 8)} · {entry.state === 'recovery-required' ? 'Recovery required' : 'Continue'}</small>
              </button>
            ))}
          </div>
        </section>
      </main>
    );
  }

  if (!view) throw new Error('WALLET_LOCAL_PASSWORD_VIEW_MISSING');

  return (
    <main className="wallet-local-password">
      <form
        onSubmit={event => {
          void submit(event);
        }}
      >
        <p className="wallet-shell-eyebrow">{view.label}</p>
        <h1>
          {enrollment ? 'Set a local password' : view.state === 'locked-password' ? 'Unlock wallet' : 'Restore wallet'}
        </h1>
        <p>
          {enrollment
            ? 'Encrypt this wallet for future local unlocks. The device-restorable key is deleted after enrollment.'
            : view.state === 'locked-password'
              ? 'Enter the local password for this saved wallet.'
              : 'The device unlock lease is unavailable. Restore with the original Brain Vault inputs or recovery phrase.'}
        </p>
        {view.state !== 'recovery-required' ? (
          <>
            <label htmlFor="local-wallet-password">Password</label>
            <input
              autoComplete={enrollment ? 'new-password' : 'current-password'}
              disabled={busy}
              id="local-wallet-password"
              minLength={enrollment ? 8 : undefined}
              onChange={event => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
            {enrollment ? (
              <>
                <label htmlFor="local-wallet-confirm">Confirm password</label>
                <input
                  autoComplete="new-password"
                  disabled={busy}
                  id="local-wallet-confirm"
                  onChange={event => setConfirmation(event.target.value)}
                  required
                  type="password"
                  value={confirmation}
                />
              </>
            ) : null}
            <button className="identity-primary-action" disabled={busy || !password} type="submit">
              {busy ? 'Opening…' : enrollment ? 'Save and open' : 'Unlock'}
            </button>
          </>
        ) : null}
        {error ? (
          <p className="wallet-local-password-error" role="alert">
            {error}
          </p>
        ) : null}
        {props.mode === 'chooser' ? (
          <button className="wallet-local-password-back" disabled={busy} onClick={returnToChooser} type="button">
            Back to wallets
          </button>
        ) : null}
        <button className="identity-secondary-action" disabled={busy} onClick={props.onRecover} type="button">
          Restore wallet
        </button>
      </form>
    </main>
  );
}
