import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { RuntimeAdapter } from '../../../../../../core/api/public/runtime-module';
import { IdentityOnboarding } from '../../../../wallet/src/identity/identity-onboarding';
import {
  getWalletEmbeddedRuntimeSnapshot,
  requireWalletEmbeddedRuntimeAdapter,
  subscribeWalletEmbeddedRuntime,
} from '../../../../wallet/src/runtime/wallet-embedded-runtime';
import { resolveWalletRuntimeSummary } from '../../../../wallet/src/app-shell-model';
import { WalletNavigationScope } from '../../../../wallet/src/navigation/wallet-navigation';
import { selectWorkspaceRuntime } from '../runtime/ops-runtime-selection';
import { useOpenWorkspaceWallet } from '../session/ops-workspace-navigation';
import { opsEntityWorkspaceSource } from '../../entity-workspace/ops-entity-workspace-runtime';
import { useWorkspaceEnvironment } from '../session/use-workspace-environment';
import { OpsRemoteBrainVault } from './ops-remote-brainvault';

export function OpsBrainVaultPanel() {
  const adapter = useSyncExternalStore(opsEntityWorkspaceSource.subscribe, opsEntityWorkspaceSource.getAdapter);
  const context = useWorkspaceEnvironment();
  const [entry, setEntry] = useState({ adapter, local: false, revision: 0, handoff: null as RuntimeAdapter | null });
  if (entry.adapter !== adapter) {
    // An accepted local open crosses a disconnected state before the shared
    // session publishes its exact adapter. Preserve only that form's setup.
    const ownHandoff = entry.handoff !== null && (adapter === null || adapter === entry.handoff);
    setEntry({
      adapter,
      local: ownHandoff,
      revision: entry.revision + (ownHandoff ? 0 : 1),
      handoff: ownHandoff && adapter === null ? entry.handoff : null,
    });
  }
  const local = adapter?.mode !== 'remote' || entry.local;
  const chooseLocal = (value: boolean): void =>
    setEntry({ adapter, local: value, revision: entry.revision + 1, handoff: null });
  return (
    <section
      className="ops-brainvault-panel"
      data-testid="workspace-brainvault"
      data-destination={local ? 'local' : 'remote'}
    >
      <header>
        <h2>BrainVault</h2>
        <p>
          {local
            ? 'Create or recover a local browser Runtime. Opening it selects that Runtime for the shared workspace.'
            : 'Derive and install an owner on the exact selected Runtime node.'}
        </p>
      </header>
      {adapter?.mode === 'remote' ? (
        <button type="button" onClick={() => chooseLocal(!local)}>
          {local ? 'Cancel local creation/recovery' : 'Create/recover local Runtime'}
        </button>
      ) : null}
      {local ? (
        <OpsLocalBrainVault
          key={entry.revision}
          adapter={adapter}
          onHandoff={openedAdapter => setEntry(current => ({ ...current, handoff: openedAdapter }))}
        />
      ) : (
        <OpsRemoteBrainVault key={entry.revision} adapter={adapter} historical={context.historical} />
      )}
    </section>
  );
}

function OpsLocalBrainVault({
  adapter,
  onHandoff,
}: Readonly<{ adapter: RuntimeAdapter | null; onHandoff: (adapter: RuntimeAdapter) => void }>) {
  const embedded = useSyncExternalStore(subscribeWalletEmbeddedRuntime, getWalletEmbeddedRuntimeSnapshot);
  const openWallet = useOpenWorkspaceWallet();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const summary = resolveWalletRuntimeSummary(
    { mode: 'embedded', wsUrl: null, access: null, sessionKey: null },
    navigator.onLine,
    embedded,
  );
  const navigate = (href: string): void => {
    if (!openWallet) throw new Error('OPS_WALLET_NAVIGATION_UNAVAILABLE');
    openWallet(href);
  };
  const opened = async (runtimeId: string): Promise<void> => {
    // IdentityOnboarding retains this callback for the opening operation.
    // A newer Runtime selection or panel close owns the workspace focus.
    if (!mounted.current) return;
    if (opsEntityWorkspaceSource.getAdapter() !== adapter)
      throw new Error('OPS_BRAINVAULT_WORKSPACE_SELECTION_CHANGED');
    const current = getWalletEmbeddedRuntimeSnapshot();
    if (current.status !== 'ready' || current.runtimeId !== runtimeId)
      throw new Error('OPS_BRAINVAULT_OPENED_RUNTIME_MISMATCH');
    onHandoff(requireWalletEmbeddedRuntimeAdapter());
    await selectWorkspaceRuntime('embedded');
  };
  return (
    <WalletNavigationScope.Provider value={navigate}>
      <IdentityOnboarding runtimeId={embedded.runtimeId} runtimeState={summary.state} onRuntimeOpened={opened} />
    </WalletNavigationScope.Provider>
  );
}
