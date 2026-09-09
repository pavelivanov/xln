import { useCallback, useEffect, useRef, useState } from 'react';
import type { BrowserVMTokenInfo, EntityReplica, JReplica, RuntimeAdapter } from '@xln/core/api/public/runtime-module';

import { readBrowserRuntimeEnvironment } from '../../../../../bridges/runtime/browser-runtime-context';
import { loadJurisdictionTokenRegistry } from '../../../../../src/lib/view/panels/jurisdiction-token-registry';

export type OpsExternalBalance = Readonly<{
  entityId: string;
  label: string;
  signerId: string;
  token: bigint | null;
  native: bigint | null;
}>;

export type OpsChainDebt = Readonly<{
  debtor: string;
  debtorLabel: string;
  creditor: string;
  amount: bigint;
}>;

type LiveJurisdictionState = Readonly<{
  registry: readonly BrowserVMTokenInfo[];
  balances: readonly OpsExternalBalance[];
  debts: readonly OpsChainDebt[];
  registryIssue: string;
  readIssue: string;
  loading: boolean;
}>;

const empty: LiveJurisdictionState = {
  registry: [], balances: [], debts: [], registryIssue: '', readIssue: '', loading: false,
};

const message = (cause: unknown): string => cause instanceof Error ? cause.message : String(cause);

const exactStackAdapter = (adapter: RuntimeAdapter, machine: JReplica) => {
  if (adapter.mode !== 'embedded') throw new Error('JURISDICTION_LIVE_READ_REQUIRES_LOCAL_RUNTIME');
  const env = readBrowserRuntimeEnvironment(adapter);
  if (!env) throw new Error('JURISDICTION_LIVE_RUNTIME_UNAVAILABLE');
  const live = env.infrastructure?.liveJAdapters?.get(machine.name);
  if (!live) throw new Error(`JURISDICTION_LIVE_ADAPTER_UNAVAILABLE:${machine.name}`);
  const replica = env.state.jReplicas.get(machine.name);
  if (!replica || replica.chainId !== machine.chainId) {
    throw new Error(`JURISDICTION_LIVE_STACK_CHANGED:${machine.name}`);
  }
  return live;
};

const entityRows = (replicas: readonly EntityReplica[]) => {
  const seen = new Set<string>();
  return replicas.flatMap(replica => {
    const signerId = replica.signerId.toLowerCase();
    if (seen.has(signerId)) return [];
    seen.add(signerId);
    return [{
      entityId: replica.entityId.toLowerCase(), signerId,
      label: replica.state.profile.name || replica.entityId,
    }];
  });
};

export function useOpsJurisdictionLive(
  adapter: RuntimeAdapter | null,
  machine: JReplica | undefined,
  replicas: readonly EntityReplica[],
  tokenId: number | null,
  historical: boolean,
) {
  const [state, setState] = useState<LiveJurisdictionState>(empty);
  const [refresh, setRefresh] = useState(0);
  const generation = useRef(0);
  const machineName = machine?.name ?? '';
  const replicaKey = replicas.map(replica => `${replica.entityId}:${replica.signerId}`).join('|');
  const reload = useCallback(() => setRefresh(value => value + 1), []);

  useEffect(() => {
    const request = ++generation.current;
    if (!adapter || !machine || historical) { setState(empty); return; }
    setState(current => ({ ...current, loading: true, readIssue: '' }));
    void (async () => {
      const live = exactStackAdapter(adapter, machine);
      let registry: readonly BrowserVMTokenInfo[] = [];
      let registryIssue = '';
      try { registry = await loadJurisdictionTokenRegistry(live); }
      catch (cause) { registryIssue = message(cause); }
      const token = tokenId === null ? null : registry.find(entry => entry.tokenId === tokenId) ?? null;
      const rows = entityRows(replicas);
      const balances = await Promise.all(rows.map(async row => ({
        ...row,
        token: token?.address ? await live.getErc20Balance(token.address, row.signerId) : null,
        native: live.getEthBalance ? await live.getEthBalance(row.signerId) : null,
      })));
      const getDebts = live.getDebts;
      const debts = tokenId === null || !getDebts ? [] : (await Promise.all(rows.map(async row =>
        (await getDebts(row.entityId, tokenId)).map(debt => ({
          debtor: row.entityId, debtorLabel: row.label,
          creditor: debt.creditor.toLowerCase(), amount: debt.amount,
        }))))).flat();
      if (request === generation.current) setState({ registry, balances, debts, registryIssue, readIssue: '', loading: false });
    })().catch(cause => {
      if (request === generation.current) setState(current => ({ ...current, balances: [], debts: [], readIssue: message(cause), loading: false }));
    });
    return () => { generation.current += 1; };
  }, [adapter, historical, machine, machineName, replicaKey, tokenId, refresh]);

  return { ...state, reload };
}
