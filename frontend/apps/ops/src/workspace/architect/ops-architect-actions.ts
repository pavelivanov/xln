import type { JReplica, RuntimeAdapter, RuntimeInput, RuntimeReplica, XLNModule } from '@xln/core/api/public/runtime-module';
import { computeAddress, hexlify } from 'ethers';

import { readBrowserRuntimeEnvironment } from '../../../../../bridges/runtime/browser-runtime-context';
import {
  buildJMachineImportRuntimeInput,
  buildPersistedJMachineConfig,
  normalizeJMachineCreateDetail,
  type JMachineCreateDetail,
} from '../../../../../src/lib/components/Jurisdiction/import-jmachine-runtime';
import { jmachineOperations } from '../../../../../src/lib/stores/network/jmachineStore';
import {
  OPS_DEMO_ENTITY_COUNT,
  architectDemoPosition,
  architectEntityIds,
  architectJurisdictionConfig,
  architectReplica,
} from './ops-architect-model';

export type OpsArchitectActionContext = Readonly<{
  adapter: RuntimeAdapter | null;
  historical: boolean;
  refresh?: () => void;
}>;

const liveEnv = (context: OpsArchitectActionContext): RuntimeReplica => {
  if (context.historical) throw new Error('RUNTIME_COMMAND_REQUIRES_LIVE_VIEW');
  if (!context.adapter || context.adapter.mode !== 'embedded') {
    throw new Error('ARCHITECT_ACTION_REQUIRES_LOCAL_RUNTIME');
  }
  const env = readBrowserRuntimeEnvironment(context.adapter);
  if (!env) throw new Error('ARCHITECT_RUNTIME_UNAVAILABLE');
  return env;
};

const waitFor = (
  adapter: RuntimeAdapter,
  predicate: () => boolean,
  code: string,
  timeoutMs = 20_000,
): Promise<void> => new Promise((resolve, reject) => {
  if (predicate()) { resolve(); return; }
  const interval = setInterval(() => finish(), 50);
  const unsubscribe = adapter.onChange(() => finish());
  const timeout = setTimeout(() => done(new Error(code)), timeoutMs);
  const done = (error?: Error): void => {
    clearInterval(interval); clearTimeout(timeout); unsubscribe();
    if (error) reject(error); else resolve();
  };
  const finish = (): void => { if (predicate()) done(); };
});

const submit = async (
  context: OpsArchitectActionContext,
  input: RuntimeInput,
  predicate: (env: RuntimeReplica) => boolean,
  code: string,
): Promise<RuntimeReplica> => {
  const beforeHeight = liveEnv(context).state.height;
  const adapter = context.adapter!;
  await adapter.send(input);
  await waitFor(adapter, () => {
    const current = liveEnv(context);
    return current.state.height > beforeHeight && predicate(current);
  }, code);
  context.refresh?.();
  return liveEnv(context);
};

export const selectArchitectJurisdiction = (
  context: OpsArchitectActionContext,
  name: string,
): void => {
  const env = liveEnv(context);
  if (!env.state.jReplicas.has(name)) throw new Error(`ARCHITECT_JURISDICTION_UNKNOWN:${name}`);
  env.activeJurisdiction = name;
  if (jmachineOperations.getByName(name)) jmachineOperations.setActive(name);
  context.refresh?.();
};

export const createArchitectJurisdiction = async (
  context: OpsArchitectActionContext,
  detail: JMachineCreateDetail,
): Promise<JReplica> => {
  const env = liveEnv(context);
  const normalized = normalizeJMachineCreateDetail(detail);
  if (env.state.jReplicas.has(normalized.name)) throw new Error(`ARCHITECT_JURISDICTION_EXISTS:${normalized.name}`);
  const next = await submit(context, buildJMachineImportRuntimeInput(normalized),
    current => current.state.jReplicas.has(normalized.name), `ARCHITECT_JURISDICTION_COMMIT_TIMEOUT:${normalized.name}`);
  const machine = next.state.jReplicas.get(normalized.name);
  if (!machine) throw new Error(`ARCHITECT_JURISDICTION_MISSING:${normalized.name}`);
  jmachineOperations.upsert(buildPersistedJMachineConfig(normalized, next));
  jmachineOperations.setActive(normalized.name);
  next.activeJurisdiction = normalized.name;
  context.refresh?.();
  return machine;
};

export const createArchitectDemoGrid = async (
  context: OpsArchitectActionContext,
  xln: XLNModule,
  machineName: string,
): Promise<readonly string[]> => {
  const env = liveEnv(context);
  const machine = env.state.jReplicas.get(machineName);
  if (!machine) throw new Error(`ARCHITECT_JURISDICTION_UNKNOWN:${machineName}`);
  const seed = env.runtimeSeed;
  if (!seed) throw new Error('ENTITY_IMPORT_RUNTIME_SEED_REQUIRED');
  const jurisdiction = architectJurisdictionConfig(machine);
  const entities = Array.from({ length: OPS_DEMO_ENTITY_COUNT }, (_, index) => {
    const label = `architect-hub-${index}`;
    const privateKey = xln.deriveSignerKeySync(seed, label);
    const signerId = computeAddress(hexlify(privateKey)).toLowerCase();
    const entityId = xln.generateLazyEntityId([signerId], 1n).toLowerCase();
    return { entityId, signerId, privateKey, tx: xln.importEntity({
      entityId, signerId, entitySeed: seed,
      data: {
        isProposer: true, profileName: label,
        config: { mode: 'proposer-based', threshold: 1n, validators: [signerId], shares: { [signerId]: 1n }, jurisdiction },
        position: architectDemoPosition(machine, index),
      },
    }) };
  });
  if (entities.some(entity => architectReplica(env, entity.entityId))) throw new Error('ARCHITECT_DEMO_ALREADY_EXISTS');
  // These validators are owned by this exact Runtime seed. Prewarming their
  // derived EOAs lets later J-event and Entity-frame signatures prove the same
  // authority; an unrelated seed cannot produce a key matching signerId.
  for (const entity of entities) xln.registerSignerKey(env, entity.signerId, entity.privateKey);
  await submit(context, { runtimeTxs: entities.map(entity => entity.tx), entityInputs: [] },
    current => entities.every(entity => architectReplica(current, entity.entityId)), 'ARCHITECT_DEMO_COMMIT_TIMEOUT');
  return entities.map(entity => entity.entityId);
};

const selectedLiveStack = (context: OpsArchitectActionContext, machineName: string) => {
  const env = liveEnv(context);
  const machine = env.state.jReplicas.get(machineName);
  if (!machine) throw new Error(`ARCHITECT_JURISDICTION_UNKNOWN:${machineName}`);
  const adapter = env.infrastructure?.liveJAdapters?.get(machineName);
  if (!adapter) throw new Error(`ARCHITECT_JURISDICTION_ADAPTER_UNAVAILABLE:${machineName}`);
  return { env, machine, adapter };
};

export const fundArchitectEntities = async (
  context: OpsArchitectActionContext,
  machineName: string,
  entityIds: readonly string[],
  tokenId: number,
  amount: bigint,
): Promise<readonly bigint[]> => {
  const selected = selectedLiveStack(context, machineName);
  if (selected.adapter.mode !== 'browservm') throw new Error('ARCHITECT_FUNDING_REQUIRES_BROWSERVM');
  await selected.adapter.debugFundReservesBatch(entityIds.map(entityId => ({ entityId, tokenId, amount })));
  const balances = await Promise.all(entityIds.map(entityId => selected.adapter.getReserves(entityId, tokenId)));
  if (balances.some(balance => balance < amount)) throw new Error('ARCHITECT_FUNDING_NOT_OBSERVED');
  context.refresh?.();
  return balances;
};

export const sendArchitectR2R = async (
  context: OpsArchitectActionContext,
  machineName: string,
  from: string,
  to: string,
  tokenId: number,
  amount: bigint,
): Promise<number> => {
  if (from === to) throw new Error('ARCHITECT_R2R_DISTINCT_ENTITIES_REQUIRED');
  const selected = selectedLiveStack(context, machineName);
  const source = architectReplica(selected.env, from);
  if (!source || !architectReplica(selected.env, to)) throw new Error('ARCHITECT_R2R_ENTITY_UNAVAILABLE');
  const before = await selected.adapter.getReserves(from, tokenId);
  if (before < amount) throw new Error(`ARCHITECT_R2R_INSUFFICIENT_RESERVE:${before}:${amount}`);
  const next = await submit(context, { runtimeTxs: [], entityInputs: [{
    entityId: source.entityId, signerId: source.signerId,
    entityTxs: [{ type: 'r2r', data: { toEntityId: to, tokenId, amount } }],
  }] }, () => true, 'ARCHITECT_R2R_COMMIT_TIMEOUT');
  return next.state.height;
};

export const listArchitectStackEntityIds = (context: OpsArchitectActionContext, machineName: string): string[] => {
  const env = liveEnv(context);
  const machine = env.state.jReplicas.get(machineName);
  return machine ? architectEntityIds(env, machine) : [];
};
