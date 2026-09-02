import { CandidateShell } from '../../../packages/ui/src/candidate-shell';
import { WalletAppShell } from './app-shell';
import { TestnetPage } from './testnet-page';
import { WalletAddressPage } from './wallet-address';
import type { WalletPage } from './wallet-model';

export function WalletApp({ page }: Readonly<{ page: WalletPage }>) {
  if (page.kind === 'testnet') return <TestnetPage />;
  if (page.kind === 'app') return <WalletAppShell />;
  if (page.kind === 'address-directory') return <WalletAddressPage request={{ kind: 'directory' }} />;
  if (page.kind === 'address-detail') return (
    <WalletAddressPage
      request={{
        kind: 'detail',
        entityId: page.entityId,
        requestedRuntimeId: page.requestedRuntimeId,
      }}
    />
  );
  return (
    <CandidateShell
      copy={{
        eyebrow: 'Financial surface',
        title: 'Wallet, independently built.',
        summary: `${page.pathname} remains on the canonical Svelte wallet while its React flow is migrated. Runtime projections stay unchanged.`,
      }}
      surfaceId="wallet"
    />
  );
}
