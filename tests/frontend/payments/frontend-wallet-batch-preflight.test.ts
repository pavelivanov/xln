import { expect, test } from 'bun:test';
import type { RuntimeAdapterBatchPreflight } from '../../../core/api/runtime-adapter/types';
import { formatTokenAmount } from '../../../core/account/financial-utils';
import { createEmptyBatch } from '../../../core/jurisdiction/machine/batch';
import { safeStringify } from '../../../core/protocol/serialization';
import {
  decodeWalletBatch,
  mergeWalletBatchPreflight,
  submitWalletBatchActionWithPreflight,
} from '../../../frontend/apps/wallet/src/commands/wallet-batch-model';
import {
  decodeWalletBatchPreflight,
  formatWalletBatchReserveIssue,
} from '../../../frontend/apps/wallet/src/payments/commands/wallet-batch-preflight-model';
import {
  buildPendingBatchPreview,
  formatBatchReserveIssue,
  getPendingBatchReserveIssue,
} from '../../../frontend/bridges/wallet/payments/pending-batch-preview';

const entityId = `0x${'11'.repeat(32)}`;
const peerId = `0x${'22'.repeat(32)}`;
const labels = { selfEntityId: entityId, activeEnv: null, activeXlnFunctions: null };
const runtimeId = 'runtime-1';

const counts = (total = 1) => ({
  total,
  reserveToReserve: total,
  reserveToCollateral: 0,
  reserveToCollateralPairs: 0,
  collateralToReserve: 0,
  settlements: 0,
  settlementDiffs: 0,
  disputeStarts: 0,
  counterDisputes: 0,
  disputeFinalizations: 0,
  externalTokenToReserve: 0,
  reserveToExternalToken: 0,
  revealSecrets: 0,
  hashLadderRegistrations: 0,
});

const preflightPayload = (
  identity: string,
  issue: RuntimeAdapterBatchPreflight['draft']['issue'] = null,
) => ({
  ok: true,
  runtimeId,
  height: 7,
  entityId,
  status: 'accumulating',
  reserveTokenCount: 1,
  openDebtTokenCount: 0,
  draft: { identity, counts: counts(), issue },
  sent: null,
});

const decodePreflight = (
  identity = `0x${'aa'.repeat(32)}`,
  issue: RuntimeAdapterBatchPreflight['draft']['issue'] = null,
): RuntimeAdapterBatchPreflight => decodeWalletBatchPreflight(
  preflightPayload(identity, issue),
  { runtimeId, height: 7, entityId },
);

test('shared preflight accounts for debt before reserve withdrawals without mutating inputs', () => {
  const batch = createEmptyBatch();
  batch.reserveToExternalToken.push({ receivingEntity: peerId, tokenId: 1, amount: 60n });
  const onchainReserves = new Map([[1, 100n]]);
  const openDebtByToken = new Map([[1, 50n]]);
  const before = safeStringify({ batch, onchainReserves, openDebtByToken });
  const issue = getPendingBatchReserveIssue({ entityId, batch, onchainReserves, openDebtByToken });
  expect(issue).toMatchObject({
    opType: 'reserveToExternalToken',
    requiredAmount: 60n,
    availableAfterDebt: 50n,
    debtClaimPaid: 50n,
    unrepaidDeficit: 10n,
  });
  expect(formatBatchReserveIssue(issue, labels)).toContain('Batch will revert: Reserve withdrawal');
  expect(safeStringify({ batch, onchainReserves, openDebtByToken })).toBe(before);
  expect(
    getPendingBatchReserveIssue({ entityId, batch, onchainReserves: new Map([[1, 110n]]), openDebtByToken }),
  ).toBeNull();
});

test('shared preflight permits a repaid implicit deficit and reports an unrepaid one', () => {
  const batch = createEmptyBatch();
  batch.reserveToReserve.push({ receivingEntity: peerId, tokenId: 1, amount: 10n });
  const input = {
    entityId,
    batch,
    onchainReserves: new Map<number, bigint>(),
    openDebtByToken: new Map<number, bigint>(),
  };
  expect(getPendingBatchReserveIssue(input)).toMatchObject({ opType: 'reserveToReserve', unrepaidDeficit: 10n });
  batch.collateralToReserve.push({ counterparty: peerId, tokenId: 1, amount: 10n, nonce: 1, sig: '0x' });
  expect(getPendingBatchReserveIssue(input)).toBeNull();
});

test('shared settlement preflight preserves the selected Entity perspective', () => {
  const batch = createEmptyBatch();
  batch.settlements.push({
    leftEntity: entityId,
    rightEntity: peerId,
    diffs: [{ tokenId: 1, leftDiff: -20n, rightDiff: 20n, collateralDiff: 0n, ondeltaDiff: 0n }],
    forgiveDebtsInTokenIds: [],
    nonce: 1,
    sig: '0x',
  });
  const input = { batch, onchainReserves: new Map([[1, 30n]]), openDebtByToken: new Map([[1, 20n]]) };
  expect(getPendingBatchReserveIssue({ ...input, entityId })).toMatchObject({
    opType: 'settlement',
    requiredAmount: 20n,
    availableAfterDebt: 10n,
    debtClaimPaid: 20n,
  });
  expect(getPendingBatchReserveIssue({ ...input, entityId: peerId })).toBeNull();
});

test('shared preview orders presentation without changing batch operation order', () => {
  const batch = createEmptyBatch();
  batch.reserveToReserve.push({ receivingEntity: peerId, tokenId: 1, amount: 2n });
  batch.collateralToReserve.push({ counterparty: peerId, tokenId: 1, amount: 3n, nonce: 1, sig: '0x' });
  const before = safeStringify(batch);
  const preview = buildPendingBatchPreview(batch, labels);
  expect(preview.map(item => item.title)).toEqual(['Account → Reserve', 'Reserve → Reserve']);
  expect(preview.map(item => item.subtitle)).toEqual([`3 Token #1 from ${peerId}`, `2 Token #1 to ${peerId}`]);
  expect(safeStringify(batch)).toBe(before);
});

test('wallet decoder binds complete preflight evidence to Runtime height and Entity', () => {
  const issue = {
    tokenId: 1,
    opType: 'reserveToExternalToken' as const,
    opIndex: 50,
    failureMode: 'batchRevert' as const,
    requiredAmount: 60n,
    availableAfterDebt: 50n,
    debtClaimPaid: 50n,
    remainingDebtAfterSweep: 0n,
    unrepaidDeficit: 10n,
  };
  const decoded = decodePreflight(`0x${'ab'.repeat(32)}`, issue);
  expect(decoded.draft.issue).toEqual(issue);
  expect(formatWalletBatchReserveIssue(decoded.draft.issue!, (tokenId, amount) => `${amount} T${tokenId}`))
    .toContain('batch ends 10 T1 short');
  expect(() => decodeWalletBatchPreflight(
    { ...preflightPayload(`0x${'ab'.repeat(32)}`), unexpected: true },
    { runtimeId, height: 7, entityId },
  )).toThrow('WALLET_BATCH_PREFLIGHT_FIELDS_INVALID');
  expect(() => decodeWalletBatchPreflight(
    preflightPayload(`0x${'ab'.repeat(32)}`),
    { runtimeId, height: 8, entityId },
  )).toThrow('WALLET_BATCH_PREFLIGHT_HEIGHT_CHANGED');
  expect(() => decodeWalletBatchPreflight(
    preflightPayload(`0x${'ab'.repeat(32)}`),
    { runtimeId: 'runtime-2', height: 7, entityId },
  )).toThrow('WALLET_BATCH_PREFLIGHT_RUNTIME_CHANGED');
  expect(() => decodeWalletBatchPreflight(
    preflightPayload(`0x${'ab'.repeat(32)}`),
    { runtimeId, height: 7, entityId: peerId },
  )).toThrow('WALLET_BATCH_PREFLIGHT_ENTITY_CHANGED');
});

test('action-time preflight rejects changed, unsafe and unresolved drafts before submission', async () => {
  const state = createEmptyBatch();
  state.reserveToReserve.push({ receivingEntity: peerId, tokenId: 1, amount: 1n });
  const compact = decodeWalletBatch({ batch: state, status: 'accumulating' }, { formatTokenAmount });
  const reviewed = mergeWalletBatchPreflight(compact, decodePreflight(`0x${'aa'.repeat(32)}`));
  let submissions = 0;
  const submit = async () => { submissions += 1; };
  await expect(submitWalletBatchActionWithPreflight(
    'broadcast', compact, reviewed,
    async () => decodePreflight(`0x${'bb'.repeat(32)}`),
    () => 'unsafe', submit,
  )).rejects.toThrow('Batch changed');
  const issue = {
    tokenId: 1,
    opType: 'reserveToReserve' as const,
    opIndex: 0,
    failureMode: 'batchRevert' as const,
    requiredAmount: 1n,
    availableAfterDebt: 0n,
    debtClaimPaid: 0n,
    remainingDebtAfterSweep: 0n,
    unrepaidDeficit: 1n,
  };
  await expect(submitWalletBatchActionWithPreflight(
    'broadcast', compact, reviewed,
    async () => decodePreflight(`0x${'aa'.repeat(32)}`, issue),
    () => 'authoritative reserve failure', submit,
  )).rejects.toThrow('authoritative reserve failure');
  await expect(submitWalletBatchActionWithPreflight(
    'broadcast', compact, reviewed,
    async () => { throw new Error('preflight offline'); },
    () => 'unsafe', submit,
  )).rejects.toThrow('preflight offline');
  expect(submissions).toBe(0);
});

test('action-time preflight submits one valid exact draft', async () => {
  const state = createEmptyBatch();
  state.reserveToReserve.push({ receivingEntity: peerId, tokenId: 1, amount: 1n });
  const compact = decodeWalletBatch({ batch: state, status: 'accumulating' }, { formatTokenAmount });
  const preflight = decodePreflight();
  const reviewed = mergeWalletBatchPreflight(compact, preflight);
  const submitted: unknown[] = [];
  await submitWalletBatchActionWithPreflight(
    'broadcast', compact, reviewed,
    async () => preflight,
    () => 'unsafe',
    async tx => { submitted.push(tx); },
  );
  expect(submitted).toEqual([{ type: 'j_broadcast', data: {} }]);
});
