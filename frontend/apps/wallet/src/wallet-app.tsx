import { CandidateShell } from '../../../packages/ui/src/shell/candidate-shell';
import { WalletAppShell } from './app-shell';
import { TestnetPage } from './testnet/testnet-page';
import { WalletAddressPage } from './address/wallet-address';
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
        title: 'Wallet route unavailable.',
        summary: `${page.pathname} is not implemented by the canonical React wallet. No retired implementation is available.`,
      }}
      surfaceId="wallet"
    />
  );
}
