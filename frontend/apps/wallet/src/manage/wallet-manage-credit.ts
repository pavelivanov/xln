import { safeStringify } from '@xln/core/protocol/serialization';
import { requireRuntimeRecord } from '../runtime/wallet-runtime-decode';

export async function requestWalletCredit(apiBase: string, entityId: string, hub: string, tokenId: number, amount: bigint) {
  if (amount <= 0n) throw new Error('Credit request must be positive.');
  const response = await fetch(new URL('/api/credit/request', apiBase), { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: safeStringify({ userEntityId: entityId, hubEntityId: hub, tokenId, amount: amount.toString() }) });
  const raw: unknown = await response.json();
  const result = requireRuntimeRecord(raw, 'CREDIT_REQUEST_RESPONSE');
  if (!response.ok || result['success'] !== true) throw new Error(typeof result['error'] === 'string' ? result['error'] : `Credit request failed (${response.status})`);
  return result['status'] === 'already_satisfied' ? 'Requested credit is already available.' : 'Credit request queued.';
}
