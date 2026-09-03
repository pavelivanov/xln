import { useEffect, useState } from 'react';

import type { WalletPushWakeView } from '../../../packages/browser/src/wallet-push-wake';
import type { WalletRuntimeSummary } from './app-shell-model';
import {
  readWalletPushWake,
  registerWalletPushWake,
  unregisterWalletPushWake,
} from './wallet-push-wake-source';
import './styles/wallet-push-wake.css';

const pushWakeErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error || 'Device wake update failed');

const shortEntityId = (entityId: string): string =>
  entityId.length > 20 ? `${entityId.slice(0, 10)}…${entityId.slice(-6)}` : entityId;

export function WalletPushWake({
  refreshKey,
  runtimeState,
}: Readonly<{
  refreshKey: number;
  runtimeState: WalletRuntimeSummary['state'];
}>) {
  const [view, setView] = useState<WalletPushWakeView | null>(null);
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
          ? 'Device wake is controlled by the owning local Runtime.'
          : 'Waiting for the local Runtime authority.',
      });
      return () => { active = false; };
    }
    setView(null);
    void readWalletPushWake()
      .then((next) => { if (active) setView(next); })
      .catch((failure: unknown) => { if (active) setError(pushWakeErrorMessage(failure)); });
    return () => { active = false; };
  }, [refreshKey, runtimeState]);

  if (!view) {
    return (
      <section className="wallet-push-wake" aria-labelledby="wallet-push-wake-title">
        <p className="wallet-shell-eyebrow">Dispute alerts</p>
        <h2 id="wallet-push-wake-title">Device wake</h2>
        {error
          ? <p className="wallet-settings-error" role="alert">{error}</p>
          : <p className="wallet-push-wake-empty">Loading device wake status…</p>}
      </section>
    );
  }
  if (view.state === 'unavailable') {
    return (
      <section className="wallet-push-wake" aria-labelledby="wallet-push-wake-title">
        <p className="wallet-shell-eyebrow">Dispute alerts</p>
        <h2 id="wallet-push-wake-title">Device wake</h2>
        <p className="wallet-push-wake-empty">{view.reason}</p>
      </section>
    );
  }

  const registered = view.registeredCount > 0;
  const register = async (): Promise<void> => {
    setBusy(true);
    setStatus('');
    setError('');
    try {
      const result = await registerWalletPushWake(view.runtimeId);
      setView(result.view);
      if (result.errors.length > 0) {
        setError(`Registered ${result.accepted}/${result.attempted}; ${result.errors.join(' | ')}`);
      } else {
        setStatus(`Registered with ${result.accepted}/${result.attempted} recovery services.`);
      }
    } catch (failure: unknown) {
      setError(pushWakeErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  };
  const unregister = async (): Promise<void> => {
    setBusy(true);
    setStatus('');
    setError('');
    try {
      const result = await unregisterWalletPushWake(view.runtimeId);
      setView(result.view);
      if (result.errors.length > 0) {
        setError(`Disabled ${result.accepted}/${result.attempted}; ${result.errors.join(' | ')}`);
      } else {
        setStatus(`Device wake disabled at ${result.accepted}/${result.attempted} recovery services.`);
      }
    } catch (failure: unknown) {
      setError(pushWakeErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="wallet-push-wake" aria-labelledby="wallet-push-wake-title">
      <header>
        <div>
          <p className="wallet-shell-eyebrow">Dispute alerts</p>
          <h2 id="wallet-push-wake-title">Device wake</h2>
        </div>
        <span className={registered ? 'is-on' : ''}>{registered ? 'Registered' : 'Off'}</span>
      </header>
      <p className="wallet-push-wake-intro">
        Allow recovery services to wake this device when the active entity needs dispute attention.
      </p>
      <dl className="wallet-push-wake-summary">
        <div><dt>Entity</dt><dd><code title={view.entityId}>{shortEntityId(view.entityId)}</code></dd></div>
        <div><dt>Services</dt><dd>{view.registeredCount}/{view.services.length}</dd></div>
      </dl>
      <div className="wallet-push-wake-services" aria-label="Device wake recovery services">
        {view.services.length === 0 ? <p>No saved recovery service is available.</p> : null}
        {view.services.map((service) => (
          <div key={service.url}>
            <span><strong>{service.role === 'delayed_last_resort' ? 'Last-resort disputer' : 'Backup service'}</strong><code>{service.url}</code></span>
            <span className={service.registered ? 'is-on' : ''}>{service.registered ? service.platform : 'Off'}</span>
          </div>
        ))}
      </div>
      <div className="wallet-push-wake-actions">
        <button disabled={busy || !view.writable || view.services.length === 0} onClick={() => void register()} type="button">
          {busy ? 'Updating…' : registered ? 'Refresh registration' : 'Register this device'}
        </button>
        <button disabled={busy || !view.writable || !registered} onClick={() => void unregister()} type="button">
          Disable device wake
        </button>
      </div>
      {!view.writable ? <p className="wallet-settings-error" role="alert">{view.blockedReason}</p> : null}
      {status ? <p className="wallet-settings-status" aria-live="polite">{status}</p> : null}
      {error ? <p className="wallet-settings-error" role="alert">{error}</p> : null}
    </section>
  );
}
