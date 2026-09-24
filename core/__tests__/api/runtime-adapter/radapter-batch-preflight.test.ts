import { expect, test } from 'bun:test';

import { EmbeddedRuntimeAdapter } from '../../../api/runtime-adapter/embedded';
import { resolveRuntimeAdapterRead, type RuntimeAdapterViewFrame } from '../../../api/runtime-adapter/resolve';
import type { RuntimeAdapterBatchPreflight } from '../../../api/runtime-adapter/types';
import {
  createEmptyBatch,
  getOpenOutgoingDebtTotals,
  simulateDraftBatchReserveAvailability,
} from '../../../jurisdiction/machine/batch';
import { createEmptyEnv } from '../../../runtime';
import type { EntityReplica, RuntimeReplica } from '../../../runtime/types';
import type { DebtEntry } from '../../../types/finance/debt';
import { makeJurisdiction, makeState } from '../../helpers/cross-j';

const entityId = `0x${'aa'.repeat(32)}`;
const counterpartyId = `0x${'bb'.repeat(32)}`;
const runtimeId = `0x${'33'.repeat(32)}`;

const makeEnv = (): RuntimeReplica => {
  const env = createEmptyEnv('radapter-batch-preflight');
  const jurisdiction = makeJurisdiction('Radapter preflight', 31_337, '12', '13');
  const state = makeState(entityId, 'signer', jurisdiction, counterpartyId);
  state.height = 7;
  state.timestamp = 700;
  state.reserves = new Map([[1, 100n]]);
  const replica = {
    entityId,
    signerId: 'signer',
    entityEncPubKey: state.entityEncryptionPublicKey,
    mempool: [],
    isProposer: true,
    state,
  } as EntityReplica;
  env.runtimeId = runtimeId;
  env.state.height = 7;
  env.state.timestamp = 700;
  env.state.eReplicas = new Map([[`${entityId}:signer`, replica]]);
  return env;
};

const makeOpenDebt = (index: number, tokenId: number, amount: bigint): DebtEntry => ({
  debtId: `${entityId}:${tokenId}:${index}`,
  tokenId,
  debtor: entityId,
  creditor: counterpartyId,
  counterparty: counterpartyId,
  direction: 'out',
  createdAmount: amount,
  paidAmount: 0n,
  remainingAmount: amount,
  createdDebtIndex: index,
  currentDebtIndex: index,
  status: 'open',
  createdAtBlock: 1,
  createdTxHash: `0x${'01'.repeat(32)}`,
  lastUpdatedBlock: 1,
  lastUpdatedTxHash: `0x${'01'.repeat(32)}`,
  lastEventType: 'DebtCreated',
});

test('batch preflight includes the 21st open debt hidden by compact Entity reads', async () => {
  const env = makeEnv();
  const replica = Array.from(env.state.eReplicas.values())[0]!;
  const batch = createEmptyBatch();
  batch.reserveToExternalToken.push({ receivingEntity: counterpartyId, tokenId: 1, amount: 60n });
  replica.state.jBatchState = {
    batch, jurisdiction: null, lastBroadcast: 0, broadcastCount: 0, failedAttempts: 0, status: 'accumulating',
  };
  replica.state.reserves = new Map([[1, 100n]]);
  replica.state.outDebtsByToken = new Map([[
    1,
    new Map(Array.from({ length: 21 }, (_, index) => {
      const debt = makeOpenDebt(index, 1, index === 20 ? 50n : 0n);
      return [debt.debtId, debt];
    })),
  ]]);

  const frame = await resolveRuntimeAdapterRead<RuntimeAdapterViewFrame>({ env }, 'view-frame', { entityId });
  const compact = frame.activeEntity!.core;
  const compactIssue = simulateDraftBatchReserveAvailability(
    entityId,
    compact.reserves,
    compact.jBatchState?.batch,
    getOpenOutgoingDebtTotals(compact.outDebtsByToken),
  ).issues[0] ?? null;
  const preflight = await resolveRuntimeAdapterRead<RuntimeAdapterBatchPreflight>(
    { env }, `entity/${entityId}/batch-preflight`, { atHeight: 7 },
  );

  expect(compactIssue).toBeNull();
  expect(preflight.runtimeId).toBe(runtimeId);
  expect(preflight.draft.issue).toMatchObject({
    tokenId: 1, opType: 'reserveToExternalToken', debtClaimPaid: 50n, unrepaidDeficit: 10n,
  });
  expect(preflight.openDebtTokenCount).toBe(1);
});

test('batch preflight uses the 101st reserve token hidden by compact Entity reads', async () => {
  const env = makeEnv();
  const replica = Array.from(env.state.eReplicas.values())[0]!;
  const batch = createEmptyBatch();
  batch.reserveToExternalToken.push({ receivingEntity: counterpartyId, tokenId: 101, amount: 60n });
  replica.state.jBatchState = {
    batch, jurisdiction: null, lastBroadcast: 0, broadcastCount: 0, failedAttempts: 0, status: 'accumulating',
  };
  replica.state.reserves = new Map(Array.from({ length: 101 }, (_, index) => [index + 1, index === 100 ? 100n : 0n]));

  const frame = await resolveRuntimeAdapterRead<RuntimeAdapterViewFrame>({ env }, 'view-frame', { entityId });
  const compact = frame.activeEntity!.core;
  const compactIssue = simulateDraftBatchReserveAvailability(
    entityId,
    compact.reserves,
    compact.jBatchState?.batch,
    getOpenOutgoingDebtTotals(compact.outDebtsByToken),
  ).issues[0] ?? null;
  const preflight = await resolveRuntimeAdapterRead<RuntimeAdapterBatchPreflight>(
    { env }, `entity/${entityId}/batch-preflight`, { atHeight: 7 },
  );

  expect(compact.reserves.has(101)).toBe(false);
  expect(compactIssue).toMatchObject({ tokenId: 101, unrepaidDeficit: 60n });
  expect(preflight.draft.issue).toBeNull();
  expect(preflight.reserveTokenCount).toBe(101);
});

test('batch preflight reports the 51st spend and exact operation count', async () => {
  const env = makeEnv();
  const replica = Array.from(env.state.eReplicas.values())[0]!;
  const batch = createEmptyBatch();
  batch.reserveToReserve = Array.from({ length: 51 }, () => ({
    receivingEntity: counterpartyId, tokenId: 1, amount: 1n,
  }));
  replica.state.jBatchState = {
    batch, jurisdiction: null, lastBroadcast: 0, broadcastCount: 0, failedAttempts: 0, status: 'accumulating',
  };
  replica.state.reserves = new Map([[1, 50n]]);

  const frame = await resolveRuntimeAdapterRead<RuntimeAdapterViewFrame>({ env }, 'view-frame', { entityId });
  const compact = frame.activeEntity!.core;
  expect(simulateDraftBatchReserveAvailability(
    entityId, compact.reserves, compact.jBatchState?.batch, new Map(),
  ).issues).toEqual([]);
  const preflight = await resolveRuntimeAdapterRead<RuntimeAdapterBatchPreflight>(
    { env }, `entity/${entityId}/batch-preflight`, { atHeight: 7 },
  );

  expect(compact.jBatchState?.batch.reserveToReserve).toHaveLength(50);
  expect(preflight.draft.counts.total).toBe(51);
  expect(preflight.draft.issue).toMatchObject({ opType: 'reserveToReserve', opIndex: 50, unrepaidDeficit: 1n });
});

test('batch preflight includes nested collateral pairs and settlement diffs beyond view bounds', async () => {
  const pairEnv = makeEnv();
  const pairReplica = Array.from(pairEnv.state.eReplicas.values())[0]!;
  const pairBatch = createEmptyBatch();
  pairBatch.reserveToCollateral.push({
    receivingEntity: entityId,
    tokenId: 1,
    pairs: Array.from({ length: 51 }, () => ({ entity: counterpartyId, amount: 1n })),
  });
  pairReplica.state.jBatchState = {
    batch: pairBatch, jurisdiction: null, lastBroadcast: 0, broadcastCount: 0, failedAttempts: 0, status: 'accumulating',
  };
  pairReplica.state.reserves = new Map([[1, 50n]]);
  const pairPreflight = await resolveRuntimeAdapterRead<RuntimeAdapterBatchPreflight>(
    { env: pairEnv }, `entity/${entityId}/batch-preflight`, { atHeight: 7 },
  );

  const diffEnv = makeEnv();
  const diffReplica = Array.from(diffEnv.state.eReplicas.values())[0]!;
  const diffBatch = createEmptyBatch();
  diffBatch.settlements.push({
    leftEntity: entityId,
    rightEntity: counterpartyId,
    diffs: [
      { tokenId: 1, leftDiff: -60n, rightDiff: 60n, collateralDiff: 0n, ondeltaDiff: 0n },
      ...Array.from({ length: 100 }, () => ({
        tokenId: 1, leftDiff: 0n, rightDiff: 0n, collateralDiff: 0n, ondeltaDiff: 0n,
      })),
    ],
    forgiveDebtsInTokenIds: [],
    sig: '0x',
    nonce: 1,
  });
  diffReplica.state.jBatchState = {
    batch: diffBatch, jurisdiction: null, lastBroadcast: 0, broadcastCount: 0, failedAttempts: 0, status: 'accumulating',
  };
  diffReplica.state.reserves = new Map([[1, 100n]]);
  diffReplica.state.outDebtsByToken = new Map([[1, new Map([['debt', makeOpenDebt(1, 1, 50n)]])]]);
  const diffPreflight = await resolveRuntimeAdapterRead<RuntimeAdapterBatchPreflight>(
    { env: diffEnv }, `entity/${entityId}/batch-preflight`, { atHeight: 7 },
  );

  expect(pairPreflight.draft.counts.reserveToCollateralPairs).toBe(51);
  expect(pairPreflight.draft.issue).toMatchObject({ opType: 'reserveToCollateral', unrepaidDeficit: 1n });
  expect(diffPreflight.draft.counts.settlementDiffs).toBe(101);
  expect(diffPreflight.draft.issue).toMatchObject({ opType: 'settlement', requiredAmount: 60n });
});

test('batch preflight binds exact draft and sent identities to current height', async () => {
  const env = makeEnv();
  const replica = Array.from(env.state.eReplicas.values())[0]!;
  const draft = createEmptyBatch();
  draft.reserveToReserve.push({ receivingEntity: counterpartyId, tokenId: 1, amount: 1n });
  const sent = createEmptyBatch();
  sent.reserveToExternalToken.push({ receivingEntity: counterpartyId, tokenId: 1, amount: 2n });
  replica.state.jBatchState = {
    batch: draft,
    jurisdiction: null,
    lastBroadcast: 0,
    broadcastCount: 1,
    failedAttempts: 0,
    status: 'sent',
    sentBatch: {
      batch: sent,
      batchHash: `0x${'ab'.repeat(32)}`,
      encodedBatch: '0x',
      entityNonce: 4,
      firstSubmittedAt: 1,
      lastSubmittedAt: 1,
      submitAttempts: 1,
    },
  };
  const first = await resolveRuntimeAdapterRead<RuntimeAdapterBatchPreflight>(
    { env }, `entity/${entityId}/batch-preflight`, { atHeight: 7 },
  );
  draft.reserveToReserve[0]!.amount = 2n;
  const changed = await resolveRuntimeAdapterRead<RuntimeAdapterBatchPreflight>(
    { env }, `entity/${entityId}/batch-preflight`, { atHeight: 7 },
  );

  expect(first.entityId).toBe(entityId);
  expect(first.height).toBe(7);
  expect(first.draft.identity).not.toBe(changed.draft.identity);
  expect(first.sent).toMatchObject({ batchHash: `0x${'ab'.repeat(32)}`, entityNonce: 4 });
  await expect(resolveRuntimeAdapterRead(
    { env }, `entity/${entityId}/batch-preflight`, { atHeight: 6 },
  )).rejects.toThrow('historical batch preflight reads are unavailable');
});

test('embedded adapter transports authoritative batch preflight', async () => {
  const env = makeEnv();
  const replica = Array.from(env.state.eReplicas.values())[0]!;
  const batch = createEmptyBatch();
  batch.reserveToReserve.push({ receivingEntity: counterpartyId, tokenId: 1, amount: 2n });
  replica.state.jBatchState = {
    batch, jurisdiction: null, lastBroadcast: 0, broadcastCount: 0, failedAttempts: 0, status: 'accumulating',
  };
  replica.state.reserves = new Map([[1, 1n]]);
  const adapter = new EmbeddedRuntimeAdapter({
    getEnv: () => env,
    validateRuntimeInputAdmission: () => {},
    enqueueRuntimeInput: () => {},
    submitCrossJurisdictionIntent: async () => ({ delivered: true }),
    registerRuntimePublishedCallback: () => () => {},
  });
  await adapter.connect({ mode: 'embedded' });
  const preflight = await adapter.read<RuntimeAdapterBatchPreflight>(
    `entity/${entityId}/batch-preflight`,
    { atHeight: 7 },
  );

  expect(preflight).toMatchObject({ runtimeId, height: 7, entityId });
  expect(preflight.draft.counts.total).toBe(1);
  expect(preflight.draft.issue).toMatchObject({ opType: 'reserveToReserve', unrepaidDeficit: 1n });
  adapter.disconnect();
});
