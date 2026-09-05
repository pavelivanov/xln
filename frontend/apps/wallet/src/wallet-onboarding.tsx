import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { WalletOnboardingReadyView, WalletOnboardingResult, WalletOnboardingView } from '../../../packages/browser/src/wallet-onboarding';
import type { WalletRecoveryServicesMutation } from '../../../packages/browser/src/wallet-recovery-services';
import { hydrateJurisdictionPolicyDefaults, type HubJoinPreference } from '../../../src/lib/utils/onboarding/onboardingPreferences';
import { toUsdInt, type OnboardingSetupDraft } from '../../../src/lib/components/Entity/onboarding/onboarding-setup';
import type { WalletRuntimeSummary } from './app-shell-model';
import { finishWalletOnboarding, loadWalletOnboarding } from './wallet-onboarding-source';
import { WalletRecoveryServices } from './wallet-recovery-services';
import { navigateWallet } from './wallet-navigation';
import { hasPersistedWalletVault } from '../../../packages/browser/src/wallet-vault-storage';
import './styles/wallet-onboarding.css';

const errorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);
const JOIN_OPTIONS = [
  ['manual', 'Join hubs manually'], ['1', 'Auto-join 1 hub'],
  ['2', 'Auto-join 2 hubs'], ['3', 'Auto-join 3 hubs'],
] as const;

const initialDraft = (view: WalletOnboardingReadyView): OnboardingSetupDraft => ({
  entityId: view.entityId, displayName: view.displayName, autoJoinHubs: view.autoJoinHubs,
  softLimitUsd: view.policy.softLimitUsd, hardLimitUsd: view.policy.hardLimitUsd, maxFeeUsd: view.policy.maxFeeUsd,
  defaultSoftLimitUsd: 500, defaultHardLimitUsd: 10_000, defaultMaxFeeUsd: 15,
});

function WalletOnboardingForm({ view, runtimeState, onComplete }: Readonly<{
  view: WalletOnboardingReadyView;
  runtimeState: WalletRuntimeSummary['state'];
  onComplete: (result: WalletOnboardingResult) => void;
}>) {
  const [draft, setDraft] = useState(() => initialDraft(view));
  const [selectedJurisdictions, setSelectedJurisdictions] = useState<Record<string, boolean>>({});
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [recovery, setRecovery] = useState<WalletRecoveryServicesMutation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const operation = useRef<AbortController | null>(null);
  const editedPolicy = useRef(false);
  const initial = useRef(view);

  useEffect(() => {
    let active = true;
    void hydrateJurisdictionPolicyDefaults(initial.current.activeJurisdictionName.toLowerCase())
      .then(defaults => {
        if (!active) return;
        setDraft(current => ({ ...current,
          defaultSoftLimitUsd: defaults.softLimitUsd, defaultHardLimitUsd: defaults.hardLimitUsd, defaultMaxFeeUsd: defaults.maxFeeUsd,
          ...(initial.current.policy.timestamp > 0 || editedPolicy.current ? {} : defaults),
        }));
      })
      .catch((failure: unknown) => { if (active) setNotice(`Jurisdiction defaults unavailable; using built-in safe defaults. ${errorMessage(failure)}`); });
    return () => { active = false; operation.current?.abort(); };
  }, []);

  const selectedCount = view.jurisdictions.filter(option => selectedJurisdictions[option.key] !== false).length;
  const ready = view.writable && !busy && recovery !== null && termsAccepted
    && draft.displayName.trim().length >= 2 && draft.softLimitUsd > 0
    && draft.hardLimitUsd >= draft.softLimitUsd && draft.maxFeeUsd >= 0 && selectedCount > 0;

  const finish = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!ready || !recovery || operation.current) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setError('');
    try {
      const result = await finishWalletOnboarding({
        runtimeId: view.runtimeId, draft: { ...draft, entityId: view.entityId },
        selectedJurisdictions, termsAccepted, recovery,
      }, controller.signal);
      if (!controller.signal.aborted) onComplete(result);
    } catch (failure: unknown) {
      if (!controller.signal.aborted) setError(errorMessage(failure));
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      if (operation.current === controller) operation.current = null;
    }
  };

  const changeLimit = (key: 'softLimitUsd' | 'hardLimitUsd' | 'maxFeeUsd', value: number, fallback: number) => {
    editedPolicy.current = true;
    setDraft(current => ({ ...current, [key]: toUsdInt(value, fallback) }));
  };

  return <form className="wallet-onboarding" onSubmit={event => { void finish(event); }} aria-labelledby="wallet-onboarding-title">
    <header><h2 id="wallet-onboarding-title">Configure account</h2><p>Set the public profile, default limits, and first hub account.</p></header>
    <fieldset disabled={busy || !view.writable}>
      <legend className="wallet-onboarding-sr-only">Account setup</legend>
      <label className="wallet-onboarding-name"><span>Display name</span><input autoComplete="nickname" maxLength={32} minLength={2} required value={draft.displayName} onChange={event => setDraft(current => ({ ...current, displayName: event.target.value }))} /></label>
      <section aria-labelledby="wallet-onboarding-limits"><h3 id="wallet-onboarding-limits">Default limits</h3>
        <div className="wallet-onboarding-limits">
          <label><span>Soft limit (USD)</span><input min={1} type="number" step={1} value={draft.softLimitUsd} onChange={event => changeLimit('softLimitUsd', event.target.valueAsNumber, draft.defaultSoftLimitUsd)} /></label>
          <label><span>Hard limit (USD)</span><input min={draft.softLimitUsd} type="number" step={1} value={draft.hardLimitUsd} onChange={event => changeLimit('hardLimitUsd', event.target.valueAsNumber, draft.defaultHardLimitUsd)} /></label>
          <label><span>Maximum fee (USD)</span><input min={0} type="number" step={1} value={draft.maxFeeUsd} onChange={event => changeLimit('maxFeeUsd', event.target.valueAsNumber, draft.defaultMaxFeeUsd)} /></label>
        </div>
        {notice ? <p className="wallet-settings-error" role="status">{notice}</p> : null}
      </section>
      <details className="wallet-onboarding-advanced"><summary>Advanced setup <span>Hub joining, jurisdictions and recovery</span></summary>
        <label><span>Initial hub join</span><select value={draft.autoJoinHubs} onChange={event => setDraft(current => ({ ...current, autoJoinHubs: event.target.value as HubJoinPreference }))}>
          {JOIN_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <section aria-labelledby="wallet-onboarding-jurisdictions"><h3 id="wallet-onboarding-jurisdictions">Jurisdictions</h3>
          {view.jurisdictions.length === 0 ? <p>Runtime lanes are still loading.</p> : <div className="wallet-onboarding-jurisdictions">
            {view.jurisdictions.map((option, index) => <label key={`${option.key}:${option.signerId}:${index}`}>
              <input type="checkbox" checked={selectedJurisdictions[option.key] !== false} onChange={event => setSelectedJurisdictions(current => ({ ...current, [option.key]: event.target.checked }))} />
              <span><strong>{option.name}</strong><code>{option.entityId}</code></span>
            </label>)}
          </div>}
        </section>
        <WalletRecoveryServices runtimeState={runtimeState} onDraftChange={setRecovery} />
      </details>
      <label className="wallet-onboarding-terms"><input type="checkbox" checked={termsAccepted} onChange={event => setTermsAccepted(event.target.checked)} /><span>I understand this is testnet software and I accept the associated risks.</span></label>
      <button className="identity-primary-action" type="submit" disabled={!ready}>{busy ? 'Starting…' : 'Start'}</button>
    </fieldset>
    {!view.writable ? <p role="alert" className="wallet-settings-error">{view.blockedReason}</p> : null}
    {error ? <p role="alert" className="wallet-settings-error">{error}</p> : null}
  </form>;
}

export function WalletPostCreationSetup({ runtimeId, runtimeState, fallback }: Readonly<{
  runtimeId: string;
  runtimeState: WalletRuntimeSummary['state'];
  fallback?: ReactNode;
}>) {
  const [view, setView] = useState<WalletOnboardingView | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<WalletOnboardingResult | null>(null);
  useEffect(() => {
    let active = true;
    let release: (() => void) | null = null;
    setView(null); setError(''); setResult(null);
    void loadWalletOnboarding().then(canonical => {
      if (!active) return;
      canonical.synchronizeCanonicalWalletOnboardingCompletion(runtimeId);
      release = canonical.subscribeCanonicalWalletOnboarding(runtimeId,
        next => { if (active) { setView(next); setError(''); } },
        failure => { if (active) setError(errorMessage(failure)); });
    }).catch((failure: unknown) => { if (active) setError(errorMessage(failure)); });
    return () => { active = false; release?.(); };
  }, [runtimeId]);
  if (error) return <p role="alert" className="wallet-settings-error">{error}</p>;
  if (!view || view.state === 'waiting') return <p role="status">{view?.reason || 'Loading account setup…'}</p>;
  if (view.state === 'ready' && !result) return <WalletOnboardingForm key={runtimeId} view={view} runtimeState={runtimeState} onComplete={setResult} />;
  if (!result && fallback !== undefined) return fallback;
  return <>
    {result ? <p className="wallet-settings-status" role="status">Account configured for {result.displayName}. Joined {result.autoJoinedCount} hub accounts.</p> : null}
    <a className="identity-primary-action wallet-onboarding-continue" href="/app?portfolio=1" onClick={event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      navigateWallet('/app?portfolio=1');
    }}>Continue to assets</a>
    <WalletRecoveryServices runtimeState={runtimeState} />
  </>;
}

export function WalletExistingSetupGate({ runtimeId, runtimeState, children }: Readonly<{
  runtimeId: string;
  runtimeState: WalletRuntimeSummary['state'];
  children: ReactNode;
}>) {
  if (!runtimeId || runtimeState !== 'local-ready' || !hasPersistedWalletVault(localStorage)) return children;
  return <WalletPostCreationSetup key={runtimeId} runtimeId={runtimeId} runtimeState={runtimeState} fallback={children} />;
}
