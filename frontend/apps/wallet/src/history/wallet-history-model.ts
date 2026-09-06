import { decodeWalletMarketActivity } from '../markets/wallet-market-activity';
import type { WalletPortfolioMath } from '../portfolio/wallet-portfolio-model';
import { optionalRuntimeString, requireRuntimeInteger, requireRuntimeRecord, requireRuntimeString } from '../runtime/wallet-runtime-decode';
import { dedupeHistoryEvents } from '../../../../src/lib/components/Entity/account/activity/activity-history-events';

export const HISTORY_TYPES = [
  ['payment', 'Payments'], ['swap', 'Swaps'], ['cross_swap', 'Cross-j'], ['htlc', 'HTLC'],
  ['settlement', 'Settlement'], ['account', 'Accounts'], ['j_event', 'J-events'], ['j_batch', 'Batches'], ['error', 'Errors'],
] as const;

export function decodeWalletHistory(value: unknown, math: WalletPortfolioMath) {
  const root = requireRuntimeRecord(value, 'HISTORY_PAGE');
  const page = decodeWalletMarketActivity(value, math);
  const rawEvents = root['events'];
  if (!Array.isArray(rawEvents)) throw new Error('HISTORY_EVENTS_INVALID');
  const events = page.events.map((event, index) => {
    const raw = requireRuntimeRecord(rawEvents[index], 'HISTORY_EVENT');
    const identity = Object.fromEntries(['runtimeId', 'source', 'entityId', 'hash', 'amount'].flatMap(key => {
      const value = optionalRuntimeString(raw[key], `HISTORY_${key}`);
      return value === undefined ? [] : [[key, value]];
    }));
    const enriched = { ...event, ...identity, ...(raw['tokenId'] === undefined ? {} : { tokenId: requireRuntimeInteger(raw['tokenId'], 'HISTORY_TOKEN', 1) }) };
    if (event.amountLabel || raw['quoteAmount'] === undefined) return enriched;
    const amount = requireRuntimeString(raw['quoteAmount'], 'HISTORY_QUOTE_AMOUNT');
    if (!/^-?\d+$/.test(amount)) throw new Error('HISTORY_QUOTE_AMOUNT_INVALID');
    const token = requireRuntimeInteger(raw['quoteTokenId'], 'HISTORY_QUOTE_TOKEN', 1);
    return { ...enriched, amountLabel: math.formatTokenAmount(token, BigInt(amount)) };
  });
  const failures = root['failures'] === undefined ? [] : root['failures'];
  if (!Array.isArray(failures)) throw new Error('HISTORY_FAILURES_INVALID');
  return { ...page, events: dedupeHistoryEvents(events), latestHeight: requireRuntimeInteger(root['latestHeight'], 'HISTORY_HEIGHT'),
    scannedFrames: requireRuntimeInteger(root['scannedFrames'], 'HISTORY_SCANNED'),
    failures: failures.map(value => requireRuntimeString(requireRuntimeRecord(value, 'HISTORY_FAILURE')['error'], 'HISTORY_FAILURE_ERROR')) };
}

export function appendHistoryEvents(previous: ReturnType<typeof decodeWalletHistory>['events'], next: ReturnType<typeof decodeWalletHistory>['events']) {
  return dedupeHistoryEvents([...previous, ...next]);
}

export function historyTimeRange(from: string, to: string) {
  const fromTimestamp = from ? new Date(from).getTime() : undefined;
  const toTimestamp = to ? new Date(to).getTime() : undefined;
  if ((fromTimestamp !== undefined && !Number.isFinite(fromTimestamp)) || (toTimestamp !== undefined && !Number.isFinite(toTimestamp))) throw new Error('Invalid history date.');
  if (fromTimestamp !== undefined && toTimestamp !== undefined && fromTimestamp > toTimestamp) throw new Error('History start must precede end.');
  return { fromTimestamp, toTimestamp };
}
