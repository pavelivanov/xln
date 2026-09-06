import { useEffect, useRef, useSyncExternalStore } from 'react';
import { IdentityOnboarding } from '../../../../wallet/src/identity/identity-onboarding';
import { getWalletEmbeddedRuntimeSnapshot, subscribeWalletEmbeddedRuntime } from '../../../../wallet/src/runtime/wallet-embedded-runtime';
import { resolveWalletRuntimeSummary } from '../../../../wallet/src/app-shell-model';
import { WalletNavigationScope } from '../../../../wallet/src/navigation/wallet-navigation';
import { selectWorkspaceRuntime } from '../runtime/ops-runtime-selection';
import { useOpenWorkspaceWallet } from '../session/ops-workspace-navigation';
import { opsEntityWorkspaceSource } from '../../entity-workspace/ops-entity-workspace-runtime';

export function OpsBrainVaultPanel() {
  const embedded = useSyncExternalStore(subscribeWalletEmbeddedRuntime, getWalletEmbeddedRuntimeSnapshot);
  const openWallet = useOpenWorkspaceWallet();
  const adapter = useSyncExternalStore(opsEntityWorkspaceSource.subscribe, opsEntityWorkspaceSource.getAdapter);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const summary = resolveWalletRuntimeSummary({ mode: 'embedded', wsUrl: null, access: null, sessionKey: null }, navigator.onLine, embedded);
  const navigate = (href: string): void => {
    if (!openWallet) throw new Error('OPS_WALLET_NAVIGATION_UNAVAILABLE');
    openWallet(href);
  };
  const opened = async (runtimeId: string): Promise<void> => {
    // IdentityOnboarding retains this callback for the opening operation.
    // A newer Runtime selection or panel close owns the workspace focus.
    if (!mounted.current) return;
    if (opsEntityWorkspaceSource.getAdapter() !== adapter) throw new Error('OPS_BRAINVAULT_WORKSPACE_SELECTION_CHANGED');
    const current = getWalletEmbeddedRuntimeSnapshot();
    if (current.status !== 'ready' || current.runtimeId !== runtimeId) throw new Error('OPS_BRAINVAULT_OPENED_RUNTIME_MISMATCH');
    await selectWorkspaceRuntime('embedded');
  };
  return <section className="ops-brainvault-panel" data-testid="workspace-brainvault">
    <header><h2>BrainVault</h2><p>Create or recover a local browser Runtime. Opening it selects that Runtime for the shared workspace.</p></header>
    <WalletNavigationScope.Provider value={navigate}><IdentityOnboarding runtimeId={embedded.runtimeId} runtimeState={summary.state} onRuntimeOpened={opened} /></WalletNavigationScope.Provider>
  </section>;
}
