import { useEffect, useState } from 'react';

import type {
  WalletRecoveryServiceRole,
  WalletRecoveryServicesMutation,
  WalletRecoveryServicesReadyView,
  WalletRecoveryServicesView,
  WalletRecoverySetupMode,
} from '../../../packages/browser/src/wallet-recovery-services';
import type { WalletRuntimeSummary } from './app-shell-model';
import {
  previewWalletRecoveryServices,
  readWalletRecoveryServices,
  saveWalletRecoveryServices,
} from './wallet-recovery-services-source';
import './styles/wallet-recovery-services.css';

const RECOVERY_MODES = [
  ['official', 'Backup + disputer', 'Encrypted backups and delayed last-resort dispute rescue.'],
  ['backup_only', 'Backup only', 'Encrypted Runtime backup without dispute rescue.'],
  ['local_only', 'Local only', 'No official remote service; manual services remain available.'],
] as const;

const recoveryErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error || 'Recovery service update failed');

const mutationFromView = (
  view: WalletRecoveryServicesReadyView,
  overrides: Partial<Pick<WalletRecoveryServicesMutation, 'mode' | 'services'>> = {},
): WalletRecoveryServicesMutation => ({
  runtimeId: view.runtimeId,
  mode: overrides.mode ?? view.mode,
  services: overrides.services ?? view.services,
});

export function WalletRecoveryServices({
  runtimeState,
}: Readonly<{ runtimeState: WalletRuntimeSummary['state'] }>) {
  const [view, setView] = useState<WalletRecoveryServicesView | null>(null);
  const [manualUrl, setManualUrl] = useState('');
  const [manualRole, setManualRole] = useState<WalletRecoveryServiceRole>('blind_backup');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setStatus('');
    setError('');
    if (runtimeState !== 'local-ready') {
      setView({
        state: 'unavailable',
        reason: runtimeState.startsWith('remote')
          ? 'Recovery services are configured by the owning local Runtime.'
          : 'Waiting for the local Runtime authority.',
      });
      return () => { active = false; };
    }
    setView(null);
    void readWalletRecoveryServices()
      .then((next) => { if (active) setView(next); })
      .catch((failure: unknown) => { if (active) setError(recoveryErrorMessage(failure)); });
    return () => { active = false; };
  }, [runtimeState]);

  const preview = async (mutation: WalletRecoveryServicesMutation): Promise<boolean> => {
    setBusy(true);
    setStatus('');
    setError('');
    try {
      setView(await previewWalletRecoveryServices(mutation));
      return true;
    } catch (failure: unknown) {
      setError(recoveryErrorMessage(failure));
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!view) {
    return (
      <section className="wallet-recovery-services" aria-labelledby="wallet-recovery-services-title">
        <p className="wallet-shell-eyebrow">Runtime protection</p>
        <h2 id="wallet-recovery-services-title">Recovery services</h2>
        {error
          ? <p className="wallet-settings-error" role="alert">{error}</p>
          : <p className="wallet-recovery-unavailable">Loading recovery services…</p>}
      </section>
    );
  }
  if (view.state === 'unavailable') {
    return (
      <section className="wallet-recovery-services" aria-labelledby="wallet-recovery-services-title">
        <p className="wallet-shell-eyebrow">Runtime protection</p>
        <h2 id="wallet-recovery-services-title">Recovery services</h2>
        <p className="wallet-recovery-unavailable">{view.reason}</p>
      </section>
    );
  }

  const disabled = busy || !view.writable;
  const updateRole = (url: string, role: WalletRecoveryServiceRole): void => {
    void preview(mutationFromView(view, {
      services: view.services.map((service) => service.url === url ? { ...service, role } : service),
    }));
  };
  const removeService = (url: string): void => {
    void preview(mutationFromView(view, {
      services: view.services.filter((service) => service.url !== url),
    }));
  };
  const addService = (): void => {
    void preview(mutationFromView(view, {
      services: [...view.services, {
        id: `manual-${view.services.length + 1}`,
        url: manualUrl,
        role: manualRole,
        official: false,
      }],
    })).then((accepted) => { if (accepted) setManualUrl(''); });
  };
  const save = async (): Promise<void> => {
    setBusy(true);
    setStatus('');
    setError('');
    try {
      setView(await saveWalletRecoveryServices(mutationFromView(view)));
      setStatus('Recovery services saved to the active Runtime.');
    } catch (failure: unknown) {
      setError(recoveryErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="wallet-recovery-services" aria-labelledby="wallet-recovery-services-title">
      <header>
        <div>
          <p className="wallet-shell-eyebrow">Runtime protection</p>
          <h2 id="wallet-recovery-services-title">Recovery services</h2>
        </div>
        <code>{view.runtimeId}</code>
      </header>

      <div className="wallet-recovery-mode-grid" role="radiogroup" aria-label="Runtime recovery mode">
        {RECOVERY_MODES.map(([mode, title, copy]) => (
          <button
            aria-checked={view.mode === mode}
            disabled={disabled || (mode !== 'local_only' && !view.officialAvailable)}
            key={mode}
            onClick={() => void preview(mutationFromView(view, { mode: mode as WalletRecoverySetupMode }))}
            role="radio"
            type="button"
          >
            <strong>{title}</strong>
            <span>{mode !== 'local_only' && !view.officialAvailable ? 'No official tower is available here.' : copy}</span>
          </button>
        ))}
      </div>

      <div className="wallet-recovery-service-list" aria-label="Configured recovery services">
        {view.services.length === 0 ? <p>No remote recovery service configured.</p> : null}
        {view.services.map((service) => (
          <div className="wallet-recovery-service-row" key={service.url}>
            <span><strong>{service.official ? 'Official xln tower' : 'Manual service'}</strong><code>{service.url}</code></span>
            <span>
              <select
                aria-label={`Role for ${service.url}`}
                disabled={disabled || service.official}
                onChange={(event) => updateRole(service.url, event.target.value as WalletRecoveryServiceRole)}
                value={service.role}
              >
                <option value="blind_backup">Backup service</option>
                <option value="delayed_last_resort">Last-resort disputer</option>
              </select>
              {!service.official ? <button disabled={disabled} onClick={() => removeService(service.url)} type="button">Remove</button> : null}
            </span>
          </div>
        ))}
      </div>

      <div className="wallet-recovery-manual-editor">
        <label><span>Service URL</span><input disabled={disabled} onChange={(event) => setManualUrl(event.target.value)} placeholder="https://tower.example.com" type="url" value={manualUrl} /></label>
        <label><span>Role</span><select aria-label="Manual recovery service role" disabled={disabled} onChange={(event) => setManualRole(event.target.value as WalletRecoveryServiceRole)} value={manualRole}><option value="blind_backup">Backup service</option><option value="delayed_last_resort">Last-resort disputer</option></select></label>
        <button disabled={disabled} onClick={addService} type="button">Add service</button>
      </div>

      <button className="wallet-recovery-save" disabled={disabled} onClick={() => void save()} type="button">{busy ? 'Saving…' : 'Save recovery services'}</button>
      {!view.writable ? <p className="wallet-settings-error" role="alert">{view.blockedReason}</p> : null}
      {status ? <p className="wallet-settings-status" aria-live="polite">{status}</p> : null}
      {error ? <p className="wallet-settings-error" role="alert">{error}</p> : null}
    </section>
  );
}
