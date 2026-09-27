import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { installBrowserErrorTelemetry } from '../../../packages/browser/src/browser-error-telemetry';
import { initializeNativeShell } from '../../../packages/browser/src/native/capacitor';
import { WalletApp } from './wallet-app';
import { resolveWalletAppView } from './app-shell-model';
import { resolveWalletPage, walletPageMetadata } from './wallet-model';
import { resolveWalletEntryPath } from './navigation/wallet-entry-location';

installBrowserErrorTelemetry();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('FRONTEND_REACT_ROOT_MISSING');

const page = resolveWalletPage(
  resolveWalletEntryPath(window.location.pathname, window.location.protocol),
  window.location.search,
);
const metadata = walletPageMetadata(page);
const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
if (!description) throw new Error('WALLET_DESCRIPTION_META_MISSING');
document.title = metadata.title;
description.content = metadata.description;

void initializeNativeShell();

const renderWallet = async (): Promise<void> => {
  if (page.kind === 'app') {
    const launcher = new URLSearchParams(window.location.hash.replace(/^#\??/u, ''));
    const hasLauncherRequest = ['xlnPair', 'xlnOnboarding', 'xlnEntity']
      .some(parameter => launcher.has(parameter));
    if (hasLauncherRequest) {
      const bootstrap = await import('../../../bridges/wallet/onboarding/wallet-canonical-runtime-bootstrap');
      await bootstrap.bootstrapCanonicalWalletRuntimeFromLocation();
    }
    if (resolveWalletAppView(window.location.search, window.location.hash) === 'scenario-preview') {
      void import('./scenario-preview/wallet-scenario-preview-runtime').then(scenario => {
        scenario.startWalletScenarioPreviewRuntime();
      });
    }
  }
  createRoot(rootElement).render(
    <StrictMode>
      <WalletApp page={page} />
    </StrictMode>,
  );
};

void renderWallet().catch((cause: unknown) => {
  const message = cause instanceof Error ? cause.message : String(cause);
  createRoot(rootElement).render(
    <main className="wallet-shell"><section className="wallet-shell-alert" role="alert">
      <p>Runtime connection failed</p><h1>Reconnect the local node.</h1><span>{message}</span>
    </section></main>,
  );
});
