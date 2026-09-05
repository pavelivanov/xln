import { safeStringify } from '@xln/core/protocol/serialization';
import { OFFCHAIN_FAUCET_REQUEST_TIMEOUT_MS, readFaucetApiResult } from './account-faucet';

export type AccountFaucetRequest = Readonly<{
  apiBase: string;
  entityId: string;
  runtimeId: string;
  hubEntityId: string;
  tokenId: number;
  symbol: string;
  commandsReady: boolean;
  sameJurisdiction: boolean;
  signal?: AbortSignal;
}>;

/** The faucet response acknowledges a request. Only Runtime commitment changes balances. */
export async function requestAccountFaucet(input: AccountFaucetRequest): Promise<string> {
  if (!input.commandsReady) throw new Error('Runtime is not ready for financial actions');
  if (!input.entityId) throw new Error('Active entity missing for offchain faucet');
  if (!input.sameJurisdiction) throw new Error('Switch to the matching jurisdiction entity before funding that account.');
  if (!input.runtimeId) throw new Error('Runtime is not ready yet (missing runtimeId). Re-open runtime and retry.');
  if (!input.hubEntityId) throw new Error('Offchain faucet requires a target hub account.');
  input.signal?.throwIfAborted();
  const amount = input.symbol === 'WETH' || input.symbol === 'ETH' ? '0.2' : '100';
  const controller = new AbortController();
  const abort = () => controller.abort();
  input.signal?.addEventListener('abort', abort, { once: true });
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, OFFCHAIN_FAUCET_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${input.apiBase}/api/faucet/offchain`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
      body: safeStringify({ userEntityId: input.entityId, userRuntimeId: input.runtimeId,
        hubEntityId: input.hubEntityId, tokenId: input.tokenId, amount }),
    });
    const result = await readFaucetApiResult(response);
    if (!response.ok || !result?.success) throw new Error(result?.error || `Faucet failed (${response.status})`);
    return `Faucet accepted: ${amount} ${input.symbol}.`;
  } catch (error) {
    if (timedOut) throw new Error(`Faucet request timed out after ${OFFCHAIN_FAUCET_REQUEST_TIMEOUT_MS}ms`);
    throw error;
  } finally {
    clearTimeout(timeout);
    input.signal?.removeEventListener('abort', abort);
  }
}
