type HistoryIdentity = Readonly<{
  id: string; timestamp: number; height: number; rawType: string; direction: string;
  runtimeId?: string | undefined; source?: string | undefined; entityId?: string | undefined; counterpartyId?: string | undefined;
  hash?: string | undefined; amount?: string | undefined; tokenId?: number | undefined;
}>;

function semanticKey(event: HistoryIdentity): string {
  if (event.source === 'runtime_log' && event.rawType.startsWith('Htlc') && event.hash) {
    return [event.runtimeId || '', event.source, event.rawType, event.entityId || '',
      event.counterpartyId || '', event.direction, event.hash, event.amount || '', event.tokenId ?? ''].join('|');
  }
  return event.id;
}

// Retained History semantics: repeated HTLC log observations represent the same
// event; keep its earliest occurrence, then display newest events first.
export function dedupeHistoryEvents<T extends HistoryIdentity>(input: readonly T[]): T[] {
  const byKey = new Map<string, T>();
  for (const event of input) {
    const key = semanticKey(event), previous = byKey.get(key);
    if (!previous || event.timestamp < previous.timestamp ||
      (event.timestamp === previous.timestamp && event.height < previous.height)) byKey.set(key, event);
  }
  return [...byKey.values()].sort((a, b) => b.timestamp - a.timestamp || b.height - a.height);
}
