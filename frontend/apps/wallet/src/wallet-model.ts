export type WalletPage =
  | Readonly<{ kind: 'testnet' }>
  | Readonly<{ kind: 'app' }>
  | Readonly<{ kind: 'address-directory' }>
  | Readonly<{ kind: 'address-detail'; entityId: string; requestedRuntimeId: string }>
  | Readonly<{ kind: 'pending'; pathname: string }>;

export const resolveWalletPage = (pathname: string, search = ''): WalletPage => {
  if (pathname === '/testnet') return { kind: 'testnet' };
  if (pathname === '/app') return { kind: 'app' };
  if (pathname === '/address' || pathname === '/address/') return { kind: 'address-directory' };
  if (pathname.startsWith('/address/')) {
    const encodedEntityId = pathname.slice('/address/'.length);
    if (!encodedEntityId || encodedEntityId.includes('/')) return { kind: 'pending', pathname };
    let entityId: string;
    try {
      entityId = decodeURIComponent(encodedEntityId);
    } catch {
      throw new Error('WALLET_ADDRESS_ROUTE_ENCODING_INVALID');
    }
    const params = new URLSearchParams(search);
    return {
      kind: 'address-detail',
      entityId,
      requestedRuntimeId: (params.get('runtimeId') || params.get('rt') || '').trim().toLowerCase(),
    };
  }
  return { kind: 'pending', pathname };
};

export const walletPageMetadata = (page: WalletPage): Readonly<{
  title: string;
  description: string;
}> => page.kind === 'testnet'
  ? {
    title: 'xln Testnet',
    description: 'Explore the xln bilateral payment network on testnet.',
  }
  : page.kind === 'app'
    ? {
      title: 'xln Wallet',
      description: 'Inspect your xln Runtime and wallet authority.',
    }
    : page.kind === 'address-directory'
      ? {
        title: 'xln Address Directory',
        description: 'Inspect registered Entity profiles on the selected xln Runtime.',
      }
      : page.kind === 'address-detail'
        ? {
          title: 'xln Entity Explorer',
          description: 'Inspect one Entity profile and its certified activity.',
        }
    : {
      title: 'xln Wallet',
      description: 'The independently built xln wallet candidate.',
    };
