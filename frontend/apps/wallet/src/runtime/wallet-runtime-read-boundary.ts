import type {
  RuntimeAdapter,
  RuntimeAdapterConfig,
  RuntimeAdapterReadQuery,
} from '../../../../../core/api/runtime-adapter/types';
import type { RuntimeAdapterViewFrame } from '@xln/core/api/public/runtime-module';
import type { RuntimeAdapterStorageSnapshot } from '../../../../packages/browser/src/runtime/session/runtime-adapter-session';
import { RuntimeQueryClient, type RuntimeQueryResultSchema } from '../../../../packages/runtime-client/src/runtime/query/runtime-query-client';
import type { WalletPortfolioMath } from '../portfolio/wallet-portfolio-model';
import { startWalletEmbeddedRuntime } from './wallet-embedded-runtime';

export type WalletRuntimeReadDependencies = Readonly<{
  adapter: RuntimeAdapter;
  release: () => void;
  math: WalletPortfolioMath & {
    parseTokenAmount: (tokenId: number, amount: string) => bigint;
    refreshTokenCatalog: (apiBase: string) => Promise<void>;
  };
}>;

export type WalletRuntimeReadLoader = (config: RuntimeAdapterStorageSnapshot) => Promise<WalletRuntimeReadDependencies>;

const loadWalletRuntimeMath = async (): Promise<WalletRuntimeReadDependencies['math']> => {
  await import('../../../../../core/support/process/runtime-process.ts');
  const [account, financial, ethers] = await Promise.all([
    import('../../../../../core/account/utils.ts'),
    import('../../../../../core/account/financial-utils.ts'),
    import('ethers'),
  ]);
  const dynamicTokens = new Map<number, Readonly<{ symbol: string; name: string; decimals: number }>>();
  const getTokenInfo = (tokenId: number) => dynamicTokens.get(tokenId) ?? account.getTokenInfo(tokenId);
  return {
    deriveDelta: (delta, isLeft) => account.deriveDelta(delta, isLeft),
    formatTokenAmount: (tokenId, amount) => dynamicTokens.has(tokenId)
      ? `${ethers.formatUnits(amount ?? 0n, getTokenInfo(tokenId).decimals)} ${getTokenInfo(tokenId).symbol}`
      : financial.formatTokenAmount(tokenId, amount),
    getTokenInfo,
    isLeftEntity: account.isLeftEntity,
    parseTokenAmount: (tokenId, amount) => dynamicTokens.has(tokenId)
      ? ethers.parseUnits(amount, getTokenInfo(tokenId).decimals)
      : financial.parseTokenAmount(tokenId, amount),
    refreshTokenCatalog: async (apiBase) => {
      const { fetchExternalTokenCatalog } = await import('../../../../src/lib/components/Entity/external-wallet-reader');
      const tokens = await fetchExternalTokenCatalog(apiBase);
      for (const token of tokens) {
        if (token.tokenId === undefined) continue;
        dynamicTokens.set(token.tokenId, { symbol: token.symbol, name: token.symbol, decimals: token.decimals });
      }
    },
  };
};

export const borrowWalletRuntimeReadDependencies = async (adapter: RuntimeAdapter): Promise<WalletRuntimeReadDependencies> =>
  ({ adapter, release: () => {}, math: await loadWalletRuntimeMath() });

export type WalletMarketMath = Readonly<{
  canonicalPair: (
    tokenA: number,
    tokenB: number,
  ) => Readonly<{ base: number; quote: number; pairId: string }>;
  getStaticSwapTokenDimensions: (
    giveTokenId: number,
    wantTokenId: number,
  ) => Readonly<{ giveTokenDecimals: number; wantTokenDecimals: number }>;
  prepareSwapOrderForDimensions: (
    giveTokenId: number,
    wantTokenId: number,
    giveAmount: bigint,
    wantAmount: bigint,
    dimensions: Readonly<{ giveTokenDecimals: number; wantTokenDecimals: number }>,
  ) => Readonly<{
    priceTicks: bigint;
    effectiveGive: bigint;
    effectiveWant: bigint;
    unspentGiveAmount: bigint;
  }> | null;
  deriveSwapNetAuthorization: (
    wantAmount: bigint,
    feeBps: number,
  ) => Readonly<{ maxFee: bigint; minNetReceive: bigint }>;
  buildDeterministicSwapOfferId: (input: Readonly<{
    logicalTimestamp: number;
    logicalHeight: number;
    sourceEntityId: string;
    counterpartyEntityId: string;
    sellToken: number;
    buyToken: number;
    sellAmount: bigint;
    buyAmount: bigint;
    priceTicks: bigint;
    routeValue: string;
  }>) => string;
}>;

export const walletRuntimeReadErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error || 'Runtime projection read failed');

const remoteRuntimeConfig = (
  snapshot: RuntimeAdapterStorageSnapshot,
  signOwnerBinding: NonNullable<RuntimeAdapterConfig['ownerBindingSigner']>,
): RuntimeAdapterConfig => {
  const wsUrl = String(snapshot.wsUrl || '').trim();
  if (!wsUrl) throw new Error('Remote Runtime endpoint is missing.');
  const authKey = String(snapshot.sessionKey || '').trim();
  return {
    mode: 'remote',
    wsUrl,
    ...(authKey ? { authKey } : {}),
    ownerBindingSigner: signOwnerBinding,
  };
};

export const loadWalletRuntimeReadDependencies = async (
  config: RuntimeAdapterStorageSnapshot,
): Promise<WalletRuntimeReadDependencies> => {
  // Install the canonical browser process surface before loading any protocol
  // module that reads it during module initialization.
  await import('../../../../../core/support/process/runtime-process.ts');
  const mathPromise = loadWalletRuntimeMath();
  if (config.mode !== 'remote') {
    const [adapter, math] = await Promise.all([
      startWalletEmbeddedRuntime(),
      mathPromise,
    ]);
    return {
      adapter,
      release: () => {},
      math,
    };
  }

  const [remote, math, journal] = await Promise.all([
    import('../../../../../core/api/runtime-adapter/remote.ts'),
    mathPromise,
    import('../../../../packages/browser/src/commands/runtime-command-journal-keyring.ts'),
  ]);
  const adapter = new remote.RemoteRuntimeAdapter();
  try {
    await adapter.connect(remoteRuntimeConfig(config, ({ runtimeId, challenge, capability }) =>
      journal.isRuntimeCommandJournalUnlocked(runtimeId)
        ? journal.signRuntimeAdapterOwnerBinding(runtimeId, challenge, capability)
        : null));
  } catch (error: unknown) {
    adapter.disconnect();
    throw error;
  }
  return {
    adapter,
    release: () => { adapter.disconnect(); },
    math,
  };
};

export const loadWalletMarketMath = async (): Promise<WalletMarketMath> => {
  await import('../../../../../core/support/process/runtime-process.ts');
  const [orderbook, authorization, route] = await Promise.all([
    import('../../../../../core/orderbook/types.ts'),
    import('../../../../../core/account/swap/swap-net-authorization.ts'),
    import('../../../../../core/account/swap/swap-command-route.ts'),
  ]);
  return {
    canonicalPair: orderbook.canonicalPair,
    getStaticSwapTokenDimensions: orderbook.getStaticSwapTokenDimensions,
    prepareSwapOrderForDimensions: orderbook.prepareSwapOrderForDimensions,
    deriveSwapNetAuthorization: authorization.deriveSwapNetAuthorization,
    buildDeterministicSwapOfferId: route.buildDeterministicSwapOfferId,
  };
};

export const createWalletRuntimeQueryClient = (
  adapter: RuntimeAdapter,
): RuntimeQueryClient<RuntimeAdapterReadQuery, RuntimeQueryResultSchema & { viewFrame: RuntimeAdapterViewFrame }> => new RuntimeQueryClient({
  resolveAdapter: () => adapter,
  readRuntimeId: () => adapter.runtimeId,
  readCurrentHeight: () => adapter.currentHeight,
  createEmptyQuery: () => ({}),
});
