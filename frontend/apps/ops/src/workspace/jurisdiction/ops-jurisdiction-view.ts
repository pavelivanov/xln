import type { EntityReplica, JReplica } from '@xln/core/api/public/runtime-module';

// Select by the configured stack, never by a display name or the currently
// active provider. Each validator remains a separate observation in the UI.
export const belongsToJurisdiction = (replica: EntityReplica, machine: JReplica): boolean => {
  const jurisdiction = replica.state.config.jurisdiction;
  return jurisdiction !== undefined && machine.contracts !== undefined
    && jurisdiction.chainId === machine.chainId
    && jurisdiction.depositoryAddress.toLowerCase() === machine.contracts.depository?.toLowerCase()
    && jurisdiction.entityProviderAddress.toLowerCase() === machine.contracts.entityProvider?.toLowerCase();
};

export const jurisdictionTokenIds = (replica: EntityReplica): number[] => {
  const state = replica.state;
  const ids = new Set(state.reserves.keys());
  for (const account of state.accounts.values()) for (const id of account.state.deltas.keys()) ids.add(id);
  for (const id of state.outDebtsByToken?.keys() ?? []) ids.add(id);
  for (const owners of state.externalWallet?.balances.values() ?? []) {
    for (const balance of owners.values()) if (balance.tokenId !== undefined) ids.add(balance.tokenId);
  }
  return [...ids].sort((a, b) => a - b);
};
