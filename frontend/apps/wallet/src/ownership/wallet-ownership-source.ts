import type { RuntimeAdapter } from '@xln/core/api/public/runtime-module';
import type { WalletOwnership } from '../../../../bridges/wallet/wallet-canonical-ownership';
import { RuntimeQueryObserver } from '../../../../packages/runtime-client/src/runtime/query/runtime-query-observer';
import { createWalletRuntimeQueryClient } from '../runtime/wallet-runtime-read-boundary';

export function createWalletOwnershipSource(adapter: RuntimeAdapter, entityId: string, apiBase: string) {
  const runtimeId = adapter.runtimeId;
  const client = createWalletRuntimeQueryClient(adapter);
  return new RuntimeQueryObserver<WalletOwnership>(async () => {
    const frame = await client.readViewFrame({ entityId, accountsLimit: 1, booksLimit: 1 });
    if (adapter.runtimeId !== runtimeId) throw new Error('OWNERSHIP_RUNTIME_CHANGED');
    const { readCanonicalWalletOwnership } = await import('../../../../bridges/wallet/wallet-canonical-ownership');
    return readCanonicalWalletOwnership(frame, entityId, apiBase);
  }, {
    readHeight: () => adapter.currentHeight,
    subscribeHeight: listener => adapter.onChange(listener),
    subscribeAdapter: listener => adapter.onStatus(listener),
  });
}
