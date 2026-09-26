import { useState, type FormEvent } from 'react';

import {
  enrollSavedCanonicalWalletLocalPassword,
  unlockCanonicalWalletLocalPassword,
  type WalletLocalPasswordGateView,
} from '../../../../bridges/wallet/canonical/wallet-canonical-local-password';
import '../styles/security/wallet-local-password.css';

type Props = Readonly<{
  view: Exclude<WalletLocalPasswordGateView, { state: 'unlocked' }>;
  onEnroll?: (password: string) => Promise<void>;
  onComplete?: () => void;
  onRecover: () => void;
}>;

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export function WalletLocalPassword({ view, onComplete, onEnroll, onRecover }: Props) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const enrollment = view.state === 'new-password';

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (busy || view.state === 'recovery-required') return;
    const secret = password;
    setPassword('');
    setConfirmation('');
    setBusy(true);
    setError('');
    try {
      if (enrollment) {
        if (secret.length < 8) throw new Error('Use at least 8 characters.');
        if (secret !== confirmation) throw new Error('Passwords do not match.');
        if (onEnroll) await onEnroll(secret);
        else await enrollSavedCanonicalWalletLocalPassword(view.runtimeId, secret);
      } else {
        await unlockCanonicalWalletLocalPassword(view.runtimeId, secret);
      }
      onComplete?.();
    } catch (failure: unknown) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

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
        <button className="identity-secondary-action" disabled={busy} onClick={onRecover} type="button">
          Restore wallet
        </button>
      </form>
    </main>
  );
}
