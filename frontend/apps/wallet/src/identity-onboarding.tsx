import { useEffect, useRef, useState, type FormEvent } from 'react';

import { DEMO_ACCOUNTS } from '../../../packages/ui/src/demo-accounts';
import type { WalletCanonicalRecoveryDiscoveryView, WalletCanonicalRuntimeOpeningRequest } from '../../../packages/browser/src/wallet-runtime-opening';
import type { WalletBrainVaultDerivationProgress, WalletBrainVaultPreparedView } from '../../../packages/browser/src/wallet-brainvault-opening';
import { selectWalletIdentityMode, type WalletIdentityMode } from '../../../packages/browser/src/wallet-identity-entry';
import {
  beginWalletMnemonicRecoveryRehearsal,
  createWalletIdentityDraft,
  deriveWalletIdentityMnemonicAddress,
  evaluateWalletMnemonicRecoveryAttempt,
  normalizeWalletIdentityMnemonic,
  validateWalletIdentityDraft,
  walletIdentityMnemonicErrorMessage,
  walletBrainVaultDerivationErrorMessage,
  walletRuntimeOpeningErrorMessage,
  type WalletIdentityDraft,
} from './identity-onboarding-model';
import { IdentityRecoveryVerified, IdentityReview } from './identity-recovery';
import { IdentityBrainVaultProgress } from './identity-brainvault-progress';
import { IdentityEntryForm } from './identity-entry-form';
import { resetWalletRecoveryRehearsal, type WalletRecoveryRehearsalState } from '../../../packages/browser/src/wallet-recovery-rehearsal';
import {
  discardWalletBrainVault,
  discardWalletRuntimeRecovery,
  openPreparedWalletBrainVault,
  openWalletRuntimeWithCanonicalVault,
  prepareWalletBrainVaultWithCanonicalVault,
  restoreWalletRuntimeFromCanonicalRecovery,
} from './wallet-embedded-runtime';
import './styles/identity-onboarding.css';
export function IdentityOnboarding() {
  const [draft, setDraft] = useState<WalletIdentityDraft>(() => (
    createWalletIdentityDraft(window.location.search, DEMO_ACCOUNTS)
  ));
  const [reviewing, setReviewing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionError, setSubmissionError] = useState('');
  const [derivedAddress, setDerivedAddress] = useState('');
  const [deriving, setDeriving] = useState(false);
  const [recoveryVerified, setRecoveryVerified] = useState(false);
  const [openingRuntime, setOpeningRuntime] = useState(false);
  const [openingError, setOpeningError] = useState('');
  const [openedRuntimeId, setOpenedRuntimeId] = useState('');
  const [recoveryDiscovery, setRecoveryDiscovery] = useState<WalletCanonicalRecoveryDiscoveryView | null>(null);
  const [selectedRecoveryCandidateId, setSelectedRecoveryCandidateId] = useState('');
  const [brainVaultPrepared, setBrainVaultPrepared] = useState<WalletBrainVaultPreparedView | null>(null);
  const [brainVaultProgress, setBrainVaultProgress] = useState<WalletBrainVaultDerivationProgress | null>(null);
  const verifiedMnemonicRef = useRef('');
  const recoveryTokenRef = useRef('');
  const brainVaultTokenRef = useRef('');
  const brainVaultRunRef = useRef(0);
  const [rehearsal, setRehearsal] = useState<WalletRecoveryRehearsalState>(resetWalletRecoveryRehearsal);
  const validation = validateWalletIdentityDraft(draft);

  useEffect(() => () => {
    verifiedMnemonicRef.current = '';
    discardWalletRuntimeRecovery(recoveryTokenRef.current);
    recoveryTokenRef.current = '';
    discardWalletBrainVault(brainVaultTokenRef.current);
    brainVaultTokenRef.current = '';
    brainVaultRunRef.current += 1;
  }, []);

  const selectMode = (nextMode: WalletIdentityMode): void => {
    setSubmitted(false);
    setSubmissionError('');
    setDerivedAddress('');
    setReviewing(false);
    setRecoveryVerified(false);
    verifiedMnemonicRef.current = '';
    discardWalletRuntimeRecovery(recoveryTokenRef.current);
    recoveryTokenRef.current = '';
    discardWalletBrainVault(brainVaultTokenRef.current);
    brainVaultTokenRef.current = '';
    brainVaultRunRef.current += 1;
    setRecoveryDiscovery(null);
    setSelectedRecoveryCandidateId('');
    setBrainVaultPrepared(null);
    setBrainVaultProgress(null);
    setOpeningError('');
    setOpenedRuntimeId('');
    setRehearsal(resetWalletRecoveryRehearsal());
    setDraft((current) => ({
      ...current,
      ...selectWalletIdentityMode({
        state: current,
        phase: 'input',
        rehearsalMode: null,
        nextMode,
      }),
    }));
  };

  const reviewIdentity = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSubmitted(true);
    setSubmissionError('');
    if (!validation.valid) return;
    if (draft.mode === 'mnemonic') {
      setDeriving(true);
      let address: string;
      try {
        address = await deriveWalletIdentityMnemonicAddress(draft.mnemonicInput);
      } catch (error: unknown) {
        setSubmissionError(walletIdentityMnemonicErrorMessage(error));
        setDeriving(false);
        return;
      }
      setDeriving(false);
      if (rehearsal.mode !== null) {
        const attempt = evaluateWalletMnemonicRecoveryAttempt(rehearsal, address);
        setRehearsal(attempt.state);
        if (!attempt.matched) {
          setSubmissionError(attempt.error);
          return;
        }
        verifiedMnemonicRef.current = normalizeWalletIdentityMnemonic(draft.mnemonicInput);
        setDraft((current) => ({ ...current, mnemonicInput: '' }));
        setDerivedAddress(address);
        setRecoveryVerified(true);
        return;
      }
      setDerivedAddress(address);
    }
    setReviewing(true);
  };

  const beginMnemonicRecovery = (): void => {
    if (draft.mode !== 'mnemonic' || !derivedAddress) {
      throw new Error('WALLET_MNEMONIC_RECOVERY_REVIEW_REQUIRED');
    }
    setRehearsal(beginWalletMnemonicRecoveryRehearsal(derivedAddress));
    setDraft((current) => ({ ...current, mnemonicInput: '' }));
    setDerivedAddress('');
    setSubmissionError('');
    setSubmitted(false);
    setReviewing(false);
  };

  const resetIdentity = (): void => {
    verifiedMnemonicRef.current = '';
    discardWalletRuntimeRecovery(recoveryTokenRef.current);
    recoveryTokenRef.current = '';
    discardWalletBrainVault(brainVaultTokenRef.current);
    brainVaultTokenRef.current = '';
    brainVaultRunRef.current += 1;
    setDraft(createWalletIdentityDraft('', DEMO_ACCOUNTS));
    setDerivedAddress('');
    setSubmissionError('');
    setSubmitted(false);
    setReviewing(false);
    setRecoveryVerified(false);
    setOpeningRuntime(false);
    setOpeningError('');
    setOpenedRuntimeId('');
    setRecoveryDiscovery(null);
    setSelectedRecoveryCandidateId('');
    setBrainVaultPrepared(null);
    setBrainVaultProgress(null);
    setRehearsal(resetWalletRecoveryRehearsal());
  };

  const deriveBrainVault = async (): Promise<void> => {
    if (draft.mode !== 'brainvault' || !validation.valid) return;
    const runId = brainVaultRunRef.current + 1;
    brainVaultRunRef.current = runId;
    const input = { name: draft.name, passphrase: draft.passphrase, factor: draft.factor };
    setDraft(current => ({ ...current, passphrase: '', showPassphrase: false }));
    setReviewing(false);
    setDeriving(true);
    setSubmissionError('');
    setBrainVaultProgress({
      phase: 'deriving', completed: 0, total: 0, workers: 0, notice: 'Initializing canonical worker…',
    });
    try {
      const prepared = await prepareWalletBrainVaultWithCanonicalVault(input, progress => {
        if (brainVaultRunRef.current === runId) setBrainVaultProgress(progress);
      });
      if (brainVaultRunRef.current !== runId) return;
      brainVaultTokenRef.current = prepared.token;
      recoveryTokenRef.current = prepared.discovery.token;
      setBrainVaultPrepared(prepared);
      setDerivedAddress(prepared.runtimeId);
      setRecoveryDiscovery(prepared.discovery.candidates.length > 0 ? prepared.discovery : null);
      setSelectedRecoveryCandidateId(prepared.discovery.candidates[0]?.id || '');
      setRecoveryVerified(true);
    } catch (error: unknown) {
      if (brainVaultRunRef.current !== runId) return;
      setSubmitted(true);
      setSubmissionError(walletBrainVaultDerivationErrorMessage(error));
    } finally {
      if (brainVaultRunRef.current === runId) {
        setDeriving(false);
        setBrainVaultProgress(null);
      }
    }
  };

  const runtimeOpeningRequest = (seed: string): WalletCanonicalRuntimeOpeningRequest => ({
    runtimeId: derivedAddress,
    name: `Mnemonic ${derivedAddress.slice(0, 6)}`,
    labelOverride: undefined,
    seed,
    mnemonic12: '',
    devicePassphrase: '',
    loginType: 'manual',
    unlockDurationMs: 600_000,
  });

  const openVerifiedIdentity = async (): Promise<void> => {
    const seed = verifiedMnemonicRef.current;
    if (!brainVaultPrepared && (!seed || !derivedAddress)) {
      throw new Error('WALLET_VERIFIED_IDENTITY_REQUIRED');
    }
    setOpeningRuntime(true);
    setOpeningError('');
    try {
      let outcome;
      if (brainVaultPrepared) {
        outcome = await openPreparedWalletBrainVault(brainVaultPrepared, selectedRecoveryCandidateId);
      } else {
        const request = runtimeOpeningRequest(seed);
        outcome = recoveryDiscovery
          ? await restoreWalletRuntimeFromCanonicalRecovery(
              request, recoveryDiscovery, selectedRecoveryCandidateId,
            )
          : await openWalletRuntimeWithCanonicalVault(request);
      }
      if (outcome.status === 'recovery-required') {
        recoveryTokenRef.current = outcome.discovery.token;
        setRecoveryDiscovery(outcome.discovery);
        setSelectedRecoveryCandidateId(outcome.discovery.candidates[0]?.id || '');
        return;
      }
      verifiedMnemonicRef.current = '';
      recoveryTokenRef.current = '';
      brainVaultTokenRef.current = '';
      setRecoveryDiscovery(null);
      setSelectedRecoveryCandidateId('');
      setOpenedRuntimeId(outcome.runtimeId);
    } catch (error: unknown) {
      verifiedMnemonicRef.current = '';
      discardWalletRuntimeRecovery(recoveryTokenRef.current);
      recoveryTokenRef.current = '';
      discardWalletBrainVault(brainVaultTokenRef.current);
      brainVaultTokenRef.current = '';
      setRecoveryDiscovery(null);
      setSelectedRecoveryCandidateId('');
      setBrainVaultPrepared(null);
      setOpeningError(walletRuntimeOpeningErrorMessage(error));
    } finally {
      setOpeningRuntime(false);
    }
  };

  if (recoveryVerified) {
    return <IdentityRecoveryVerified
      address={derivedAddress}
      mode={draft.mode}
      openedRuntimeId={openedRuntimeId}
      opening={openingRuntime}
      openingError={openingError}
      recoveryDiscovery={recoveryDiscovery}
      selectedRecoveryCandidateId={selectedRecoveryCandidateId}
      onOpen={() => { void openVerifiedIdentity(); }}
      onReset={resetIdentity}
      onSelectRecoveryCandidate={setSelectedRecoveryCandidateId}
    />;
  }

  if (brainVaultProgress) {
    return <IdentityBrainVaultProgress progress={brainVaultProgress} onCancel={resetIdentity} />;
  }

  if (reviewing) {
    return <IdentityReview
      address={derivedAddress}
      draft={draft}
      onDeriveBrainVault={() => { void deriveBrainVault(); }}
      onEdit={() => setReviewing(false)}
      onVerifyMnemonic={beginMnemonicRecovery}
      validation={validation}
    />;
  }

  return <IdentityEntryForm
    deriving={deriving}
    draft={draft}
    onDraft={(update) => setDraft(update)}
    onMode={selectMode}
    onReset={resetIdentity}
    onSubmit={(event) => { void reviewIdentity(event); }}
    rehearsalActive={rehearsal.mode !== null}
    submissionError={submissionError}
    submitted={submitted}
    validation={validation}
  />;
}
