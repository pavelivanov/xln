import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { RuntimeAdapterBrainVaultProgress } from '../../../../../core/api/runtime-adapter/types';
import { IdentityEntryForm } from '../identity/identity-entry-form';
import {
  validateWalletIdentityDraft,
  walletBrainVaultDerivationErrorMessage,
  type WalletIdentityDraft,
} from '../identity/identity-onboarding-model';
import { deriveCanonicalWalletDaemonOwner } from '../../../../bridges/wallet/onboarding/wallet-canonical-daemon-owner';
import '../styles/onboarding/identity-onboarding.css';

const REMOTE_BRAINVAULT_WORKER_REQUEST = 256;

const initialDraft = (): WalletIdentityDraft => ({
  mode: 'brainvault', name: '', passphrase: '', mnemonicInput: '', factor: 3, showPassphrase: false,
});

export function WalletDaemonOwnerSetup() {
  const [draft, setDraft] = useState(initialDraft);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<RuntimeAdapterBrainVaultProgress | null>(null);
  const operation = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const validation = validateWalletIdentityDraft(draft);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      operation.current?.abort();
    };
  }, []);

  const derive = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSubmitted(true); setError('');
    if (!validation.valid || operation.current) return;
    const controller = new AbortController();
    operation.current = controller;
    const input = {
      name: draft.name,
      passphrase: draft.passphrase,
      factor: draft.factor,
      // The daemon clamps this request against its own CPU and RAM. Browser
      // hardwareConcurrency must not throttle a more capable custody host.
      workers: REMOTE_BRAINVAULT_WORKER_REQUEST,
    };
    setDraft(current => ({ ...current, passphrase: '', showPassphrase: false }));
    setProgress({ completed: 0, total: 0, elapsedMs: 0, lastShardMs: 0, workers: 0 });
    try {
      await deriveCanonicalWalletDaemonOwner(input, controller.signal, setProgress);
    } catch (cause: unknown) {
      if (mounted.current && !controller.signal.aborted) setError(walletBrainVaultDerivationErrorMessage(cause));
    } finally {
      if (mounted.current) setProgress(null);
      if (operation.current === controller) operation.current = null;
    }
  };

  if (progress) {
    const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
    const finalizing = progress.total > 0 && progress.completed === progress.total;
    return <section className="identity-review identity-derivation" aria-labelledby="daemon-derivation-title">
      <p className="wallet-shell-eyebrow">Local node custody</p>
      <h1 id="daemon-derivation-title">Deriving Brain Vault</h1>
      <p>The node is deriving and storing its owner. Its mnemonic and signer never enter this browser.</p>
      <div className="identity-derivation-meter">
        <div aria-label={`Brain Vault progress ${percent}%`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={percent} role="progressbar"><span style={{ width: `${percent}%` }} /></div>
        <strong>{finalizing ? 'Installing owner on local node' : progress.total > 0 ? `${progress.completed} / ${progress.total} shards` : 'Preparing local workers'}</strong>
        <span>{progress.workers} active worker{progress.workers === 1 ? '' : 's'}</span>
      </div>
      <button className="identity-secondary-action" disabled={finalizing} onClick={() => operation.current?.abort()} type="button">
        {finalizing ? 'Finalizing owner…' : 'Cancel derivation'}
      </button>
    </section>;
  }

  return <IdentityEntryForm
    copy={{
      eyebrow: 'Local node custody',
      title: 'Create the node owner',
      description: 'Brain Vault runs on the paired node. Its mnemonic and signer remain in owner-only node state.',
      submit: 'Create owner on local node',
    }}
    deriving={false}
    draft={draft}
    modeOptions={['brainvault']}
    onDraft={setDraft}
    onMode={() => {}}
    onReset={() => setDraft(initialDraft())}
    onSubmit={(event) => { void derive(event); }}
    rehearsalActive={false}
    submissionError={error}
    submitted={submitted}
    validation={validation}
  />;
}
