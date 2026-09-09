// Retained Lending selection: use the Account's assets, or the three default
// assets before token deltas exist. Symbol ties keep a stable numeric order.
export function buildLendingTokenOptions(tokenIds: Iterable<number>, symbol: (tokenId: number) => string) {
  const ids = [...new Set(tokenIds)].filter(id => Number.isInteger(id) && id > 0);
  return (ids.length ? ids : [1, 2, 3])
    .map(id => ({ id, symbol: symbol(id) }))
    .sort((left, right) => left.symbol.localeCompare(right.symbol) || left.id - right.id);
}
