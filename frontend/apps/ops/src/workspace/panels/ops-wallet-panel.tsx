import { useWorkspaceTranslation } from "../../../../../bridges/workspace-localization-react";

import type { WalletCommandDraft } from '../../../../wallet/src/commands/wallet-command-draft';
import { Suspense, lazy, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { IDockviewPanelProps } from 'dockview';
import type { RuntimeAdapter } from '@xln/core/api/public/runtime-module';
import { opsEntityWorkspaceSource } from '../../entity-workspace/ops-entity-workspace-runtime';
import { workspaceNetwork } from '../session/ops-workspace-playback';
import { OpsBoundEntityPanel } from '../entity/ops-entity-panel';
import { OpsRuntimeDiagnosticsPanel } from '../runtime/ops-runtime-diagnostics-panel';
import { WalletRuntimeScope } from '../../../../wallet/src/runtime/wallet-runtime-scope';
import { borrowWalletRuntimeReadDependencies } from '../../../../wallet/src/runtime/wallet-runtime-read-boundary';
import { WalletNavigationScope } from '../../../../wallet/src/navigation/wallet-navigation';
import { resolveWalletAppRoute, walletPaymentTabHref } from '../../../../wallet/src/navigation/wallet-navigation-model';
import { WalletWorkspaceSelection } from '../../../../wallet/src/runtime/wallet-workspace-selection';
import { WalletAccountRail } from '../../../../wallet/src/account/wallet-account-rail';
import { WalletPortfolio } from '../../../../wallet/src/portfolio/wallet-portfolio';
import { WalletExistingSetupGate } from '../../../../wallet/src/onboarding/wallet-onboarding';
import { useOpenWorkspaceIdentity } from '../session/ops-workspace-navigation';

type WalletNavigation = Readonly<{ id: number; href: string; runtimeId?: string; command?: WalletCommandDraft }>;

const WalletPayments = lazy(async () => ({ default: (await import('../../../../wallet/src/payments/wallet-payments')).WalletPayments }));
const WalletMarkets = lazy(async () => ({ default: (await import('../../../../wallet/src/markets/wallet-markets')).WalletMarkets }));
const WalletAccountWorkspace = lazy(async () => ({ default: (await import('../../../../wallet/src/account/wallet-account-workspace')).WalletAccountWorkspace }));
const WalletFinancialHealth = lazy(async () => ({ default: (await import('../../../../wallet/src/financial-health/wallet-financial-health')).WalletFinancialHealth }));

const adapterIds = new WeakMap<RuntimeAdapter, number>();
let nextAdapterId = 0;
const adapterKey = (adapter: RuntimeAdapter): number => {
  const existing = adapterIds.get(adapter);
  if (existing !== undefined) return existing;
  const id = ++nextAdapterId;
  adapterIds.set(adapter, id);
  return id;
};

function LiveWallet({ adapter, navigation }: Readonly<{ adapter: RuntimeAdapter; navigation: WalletNavigation | undefined }>) {
  const { t } = useWorkspaceTranslation();
  const [selection] = useState(() => new WalletWorkspaceSelection());
  const selected = useSyncExternalStore(selection.subscribe, selection.getSnapshot);
  const [href, setHref] = useState('/app?portfolio=1');
  const [draft, setDraft] = useState<WalletCommandDraft | null>(null);
  const [navigationIssue, setNavigationIssue] = useState('');
  const openIdentity = useOpenWorkspaceIdentity();
  const navigate = (next: string): void => {
    const url = new URL(next, window.location.origin);
    if (url.origin !== window.location.origin || url.pathname !== '/app') throw new Error('OPS_WALLET_NAVIGATION_INVALID');
    if (resolveWalletAppRoute(url.search, url.hash).view === 'identity') {
      if (!openIdentity) throw new Error('OPS_IDENTITY_NAVIGATION_UNAVAILABLE');
      openIdentity(); return;
    }
    setNavigationIssue(''); setDraft(null); setHref(next);
  };
  useEffect(() => {
    if (!navigation) return;
    if (navigation.command && navigation.runtimeId !== adapter.runtimeId) {
      setDraft(null); setNavigationIssue('This draft belongs to a different Runtime. Open a new draft for the selected Runtime.'); return;
    }
    navigate(navigation.href); setDraft(navigation.command ?? null);
  }, [navigation, adapter.runtimeId]);
  const url = new URL(href, window.location.origin);
  const route = resolveWalletAppRoute(url.search, url.hash);
  const loadRuntime = useMemo(() => async () => {
    const requireCurrent = (): void => {
      if (opsEntityWorkspaceSource.getAdapter() !== adapter || workspaceNetwork.get().selectedStep) {
        throw new Error('OPS_WALLET_RUNTIME_CONTEXT_CHANGED');
      }
    };
    requireCurrent();
    const dependencies = await borrowWalletRuntimeReadDependencies(adapter);
    requireCurrent();
    return dependencies;
  }, [adapter]);
  return <WalletRuntimeScope.Provider value={loadRuntime}><WalletNavigationScope.Provider value={navigate}>
    <section className="workspace-wallet-pane" data-testid="ops-wallet-panel" data-runtime-id={adapter.runtimeId} onClick={event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      const link = target instanceof Element ? target.closest('a[href^="/app"]') : null;
      if (!link) return;
      const next = link.getAttribute('href');
      if (!next) return;
      event.preventDefault(); navigate(next); event.currentTarget.scrollTop = 0;
    }}>
      <nav className="workspace-wallet-nav" aria-label="Wallet sections">
        <button type="button" onClick={() => setHref('/app?portfolio=1')}>{t('workspace.assets')}</button>
        <button type="button" onClick={() => setHref('/app#accounts/open')}>{t('network.accounts')}</button>
        <button type="button" onClick={() => setHref('/app#ownership')}>{t('workspace.ownership')}</button>
        <button type="button" onClick={() => setHref('/app#settings')}>{t('settings.title')}</button>
      </nav>
      {navigationIssue ? <p role="alert">{navigationIssue}</p> : null}
      <WalletAccountRail route={route} selection={selection} />
      <Suspense fallback={<p role="status">Loading Wallet…</p>}>
        <WalletExistingSetupGate runtimeId={adapter.runtimeId} runtimeState={adapter.mode === 'embedded' ? 'local-ready' : 'remote-ready'}>
        {route.view === 'portfolio' || route.view === 'overview' ? <WalletPortfolio draft={draft?.type === 'open' ? draft : undefined} workspaceSelection={selection} section={route.view === 'portfolio' ? route.section : 'assets'} /> : null}
        {route.view === 'payments' ? <WalletPayments draft={draft?.type === 'pay' ? draft : undefined} workspaceSelection={selection} tab={route.tab} invoice={route.invoice} onTabChange={tab => setHref(walletPaymentTabHref(tab))} /> : null}
        {route.view === 'markets' ? <WalletMarkets draft={draft?.type === 'swap' ? draft : undefined} workspaceSelection={selection} tab={route.tab} onTabChange={tab => setHref(`/app#accounts/${tab === 'market' ? 'swap' : 'activity'}`)} /> : null}
        {route.view === 'account-tools' || route.view === 'entity-tools' ? <WalletAccountWorkspace selection={selection} tab={route.tab} /> : null}
        {route.view === 'health' ? <WalletFinancialHealth workspaceSelection={selection} /> : null}
        {route.view === 'diagnostics' ? <OpsRuntimeDiagnosticsPanel /> : null}
        {route.view === 'settings' ? selected.entityId
          ? <OpsBoundEntityPanel entityId={selected.entityId} initialHash={url.hash || '#settings'} key={`${selected.entityId}:${url.hash}`} />
          : <p className="workspace-read-state">Select an Entity in Assets to open its settings.</p> : null}
        </WalletExistingSetupGate>
      </Suspense>
    </section>
  </WalletNavigationScope.Provider></WalletRuntimeScope.Provider>;
}

export function OpsWalletPanel({ params }: IDockviewPanelProps<{ navigation?: WalletNavigation }>) {
  const adapter = useSyncExternalStore(opsEntityWorkspaceSource.subscribe, opsEntityWorkspaceSource.getAdapter);
  const network = useSyncExternalStore(workspaceNetwork.subscribe, workspaceNetwork.get);
  // Never keep a command-bearing wallet mounted behind a recorded frame.
  // The same recorded Entity source owns selection, paging and history reads.
  if (network.selectedStep) return <RecordedWallet />;
  if (!adapter) return <p className="workspace-read-state">Select a Runtime and unlock its owner to open the local Wallet.</p>;
  return <LiveWallet adapter={adapter} navigation={params.navigation} key={adapterKey(adapter)} />;
}

function RecordedWallet() {
  const snapshot = useSyncExternalStore(opsEntityWorkspaceSource.subscribe, opsEntityWorkspaceSource.getSnapshot);
  if (snapshot.context.status !== 'selected') return <p className="workspace-read-state">{snapshot.readState.message}</p>;
  return <OpsBoundEntityPanel entityId={snapshot.context.entityId} key={snapshot.context.entityId} />;
}
