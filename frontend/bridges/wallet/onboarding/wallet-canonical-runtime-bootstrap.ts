import { readJsonUnknown, requireUnknownRecord } from '../../../packages/runtime-client/src/boundary';
import { parseRemoteRuntimeImportSourcePayload } from '../../../packages/browser/src/runtime/session/remote-runtime-import';
import {
  readWalletLocalLauncherRequest,
  setWalletLocalLauncherOnboarding,
  stripWalletLocalLauncherHash,
  type WalletLocalLauncherRequest,
} from '../../../packages/browser/src/runtime/wallet-local-launcher';
import type { StoredRemoteRuntimeImportEntry } from '../../../packages/browser/src/runtime/session/remote-runtime-import';
import { WalletRuntimeBootstrapCoordinator } from '../../../packages/browser/src/runtime/wallet-runtime-bootstrap';
import {
  importRemoteRuntimeEntries,
  persistActiveRemoteRuntimeImport,
} from '../../runtime/remote/remote-runtime-import-flow';
import {
  refreshCurrentRuntimeProjection,
  switchAppRuntimeAdapter,
} from '../../runtime/xln-store';
import { setRuntimeViewActiveEntityId } from '../../runtime/runtime-view-store';

const stripLauncherParams = (): void => {
  const nextHash = stripWalletLocalLauncherHash(window.location.hash);
  const next = `${window.location.pathname}${window.location.search}${nextHash}`;
  window.history.replaceState(window.history.state, '', next);
};

const consumePairingToken = async (pairingToken: string) => {
  const response = await fetch('/api/local-pairing/consume', {
    method: 'POST',
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pairingToken }),
  });
  const payload = await readJsonUnknown(response).catch((): Record<string, unknown> => ({}));
  if (!response.ok) {
    const error = requireUnknownRecord(payload, 'LOCAL_PAIRING_ERROR_PAYLOAD_INVALID');
    throw new Error(typeof error['error'] === 'string' ? error['error'] : `LOCAL_PAIRING_FAILED:${response.status}`);
  }
  return parseRemoteRuntimeImportSourcePayload(payload);
};

type PairedRuntimeActivationDependencies = Readonly<{
  persistActiveRemoteRuntimeImport: typeof persistActiveRemoteRuntimeImport;
  switchAppRuntimeAdapter: typeof switchAppRuntimeAdapter;
  setRuntimeViewActiveEntityId: typeof setRuntimeViewActiveEntityId;
  setWalletLocalLauncherOnboarding: typeof setWalletLocalLauncherOnboarding;
  refreshCurrentRuntimeProjection: typeof refreshCurrentRuntimeProjection;
}>;

const pairedRuntimeActivationDependencies: PairedRuntimeActivationDependencies = {
  persistActiveRemoteRuntimeImport,
  switchAppRuntimeAdapter,
  setRuntimeViewActiveEntityId,
  setWalletLocalLauncherOnboarding,
  refreshCurrentRuntimeProjection,
};

export const activateCanonicalWalletPairedRuntime = async (
  request: WalletLocalLauncherRequest,
  selected: StoredRemoteRuntimeImportEntry,
  dependencies: PairedRuntimeActivationDependencies = pairedRuntimeActivationDependencies,
): Promise<void> => {
  dependencies.persistActiveRemoteRuntimeImport(selected);
  await dependencies.switchAppRuntimeAdapter({
    mode: 'remote', runtimeId: selected.runtimeId, wsUrl: selected.wsUrl, authKey: selected.token,
  });
  if (request.entityId) dependencies.setRuntimeViewActiveEntityId(request.entityId);
  dependencies.setWalletLocalLauncherOnboarding({
    stage: request.stage, entityId: request.entityId, runtimeId: selected.runtimeId,
  });
  if (request.entityId) await dependencies.refreshCurrentRuntimeProjection();
};

export const bootstrapCanonicalWalletRuntimeFromLocation = async (): Promise<boolean> => {
  const request = readWalletLocalLauncherRequest(window.location.hash);
  if (!request.pairingToken) return false;
  stripLauncherParams();
  let selected: Awaited<ReturnType<typeof importRemoteRuntimeEntries>>['validated'][number] | undefined;
  const coordinator = new WalletRuntimeBootstrapCoordinator({
    pairLocalRuntime: async pairingToken => {
      const entries = await consumePairingToken(pairingToken);
      const imported = await importRemoteRuntimeEntries(entries);
      selected = imported.validated[0];
    },
    importRemoteRuntimes: async input => {
      if (input.payload || input.source) throw new Error('LOCAL_PAIRING_REMOTE_IMPORT_UNEXPECTED');
    },
    requiresRemoteConsent: () => false,
    publishPendingConsent: () => { throw new Error('LOCAL_PAIRING_CONSENT_UNEXPECTED'); },
    persistRemoteRequest: () => { throw new Error('LOCAL_PAIRING_REMOTE_REQUEST_UNEXPECTED'); },
    stripRemoteRuntimeParams: () => {},
  });
  await coordinator.process({
    pairingToken: request.pairingToken,
    importPayload: '',
    importSource: '',
    remoteRequest: null,
  });
  if (!selected) throw new Error('LOCAL_PAIRING_RUNTIME_MISSING');
  await activateCanonicalWalletPairedRuntime(request, selected);
  return true;
};
