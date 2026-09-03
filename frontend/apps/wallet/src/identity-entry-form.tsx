import { useRef, type FormEvent, type KeyboardEvent } from 'react';

import {
  resolveWalletIdentityModeNavigation,
  type WalletIdentityMode,
} from '../../../packages/browser/src/wallet-identity-entry';
import type {
  WalletIdentityDraft,
  WalletIdentityDraftValidation,
} from './identity-onboarding-model';
import { walletIdentityModeLabel } from './identity-onboarding-model';

const FACTORS = [1, 2, 3, 4, 5] as const;

type IdentityEntryFormProps = Readonly<{
  draft: WalletIdentityDraft;
  validation: WalletIdentityDraftValidation;
  submitted: boolean;
  submissionError: string;
  deriving: boolean;
  rehearsalActive: boolean;
  onDraft: (update: (current: WalletIdentityDraft) => WalletIdentityDraft) => void;
  onMode: (mode: WalletIdentityMode) => void;
  onReset: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}>;

export function IdentityEntryForm(props: IdentityEntryFormProps) {
  const tabRefs = useRef<Record<WalletIdentityMode, HTMLButtonElement | null>>({
    brainvault: null,
    mnemonic: null,
  });

  const handleModeKey = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentMode: WalletIdentityMode,
  ): void => {
    const nextMode = resolveWalletIdentityModeNavigation({
      currentMode,
      key: event.key,
      rehearsalMode: props.rehearsalActive ? 'mnemonic' : null,
    });
    if (nextMode === null) return;
    event.preventDefault();
    props.onMode(nextMode);
    tabRefs.current[nextMode]?.focus();
  };

  return (
    <section className="identity-onboarding" aria-labelledby="identity-onboarding-title">
      <header>
        <p className="wallet-shell-eyebrow">{props.rehearsalActive ? 'Recovery rehearsal' : 'Wallet identity'}</p>
        <h1 id="identity-onboarding-title">{props.rehearsalActive ? 'Re-enter your seed' : 'Review identity inputs'}</h1>
        <p>{props.rehearsalActive
          ? 'The first phrase was cleared. Only its public wallet address remains.'
          : 'Rehearse recovery inputs before wallet creation. No wallet is created or persisted here.'}</p>
      </header>

      {props.rehearsalActive ? (
        <p className="identity-rehearsal-context">
          Enter the same seed phrase again. A different valid wallet is rejected without replacing the expected address.
        </p>
      ) : <div className="identity-mode-tabs" role="tablist" aria-label="Wallet identity method">
        {(['brainvault', 'mnemonic'] as const).map((mode) => (
          <button
            aria-controls={`identity-panel-${mode}`}
            aria-selected={props.draft.mode === mode}
            id={`identity-mode-${mode}`}
            key={mode}
            disabled={props.deriving}
            onClick={() => props.onMode(mode)}
            onKeyDown={(event) => handleModeKey(event, mode)}
            ref={(node) => { tabRefs.current[mode] = node; }}
            role="tab"
            tabIndex={props.draft.mode === mode ? 0 : -1}
            type="button"
          >
            <strong>{walletIdentityModeLabel(mode)}</strong>
            <span>{mode === 'brainvault' ? 'Memorized recovery' : 'Physical backup'}</span>
          </button>
        ))}
      </div>}

      <form onSubmit={props.onSubmit} noValidate>
        {props.draft.mode === 'brainvault' ? (
          <div id="identity-panel-brainvault" role="tabpanel" aria-labelledby="identity-mode-brainvault">
            <label>
              <span>Vault name <small>public, exact input</small></span>
              <input
                autoCapitalize="none"
                autoComplete="off"
                disabled={props.deriving}
                onChange={(event) => props.onDraft(current => ({ ...current, name: event.target.value }))}
                spellCheck={false}
                type="text"
                value={props.draft.name}
              />
            </label>
            <label>
              <span>Secret passphrase <small>cleared before derivation</small></span>
              <span className="identity-secret-input">
                <input
                  autoCapitalize="none"
                  autoComplete="off"
                  disabled={props.deriving}
                  onChange={(event) => props.onDraft(current => ({ ...current, passphrase: event.target.value }))}
                  spellCheck={false}
                  type={props.draft.showPassphrase ? 'text' : 'password'}
                  value={props.draft.passphrase}
                />
                <button
                  aria-label={props.draft.showPassphrase ? 'Hide passphrase' : 'Show passphrase'}
                  disabled={props.deriving}
                  onClick={() => props.onDraft(current => ({
                    ...current,
                    showPassphrase: !current.showPassphrase,
                  }))}
                  type="button"
                >
                  {props.draft.showPassphrase ? 'Hide' : 'Show'}
                </button>
              </span>
            </label>
            <fieldset>
              <legend>Work factor</legend>
              <div className="identity-factor-row">
                {FACTORS.map((factor) => (
                  <button
                    aria-pressed={props.draft.factor === factor}
                    disabled={props.deriving}
                    key={factor}
                    onClick={() => props.onDraft(current => ({ ...current, factor }))}
                    type="button"
                  >
                    {factor}
                  </button>
                ))}
              </div>
              <p>Higher factors require more recovery time and memory work.</p>
            </fieldset>
          </div>
        ) : (
          <div id="identity-panel-mnemonic" role="tabpanel" aria-labelledby="identity-mode-mnemonic">
            <label>
              <span>Seed phrase <small>{props.validation.detail}</small></span>
              <textarea
                autoCapitalize="none"
                autoComplete="off"
                disabled={props.deriving}
                onChange={(event) => props.onDraft(current => ({ ...current, mnemonicInput: event.target.value }))}
                placeholder="Enter 12 or 24 BIP39 words"
                rows={5}
                spellCheck={false}
                value={props.draft.mnemonicInput}
              />
            </label>
            <p className="identity-inline-warning">Anyone with these words controls the wallet.</p>
          </div>
        )}

        {props.submitted && (!props.validation.valid || props.submissionError) ? (
          <ul className="identity-errors" aria-label="Identity input errors" aria-live="polite">
            {props.validation.errors.map((error) => <li key={error}>{error}</li>)}
            {props.submissionError ? <li>{props.submissionError}</li> : null}
          </ul>
        ) : null}

        <div className={props.rehearsalActive ? 'identity-rehearsal-actions' : undefined}>
          <button className="identity-primary-action" disabled={props.deriving} type="submit">
            {props.deriving ? 'Checking phrase…' : props.rehearsalActive ? 'Verify recovered wallet' : 'Review identity inputs'}
          </button>
          {props.rehearsalActive ? (
            <button className="identity-secondary-action" onClick={props.onReset} type="button">
              Cancel rehearsal
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
