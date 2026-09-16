import { expect, test } from 'bun:test';
import { createEmptyBatch } from '../../../core/jurisdiction/machine/batch';
import { safeStringify } from '../../../core/protocol/serialization';
import {
  buildPendingBatchPreview,
  formatBatchReserveIssue,
  getPendingBatchReserveIssue,
} from '../../../frontend/bridges/wallet/payments/pending-batch-preview';

const entityId = `0x${'11'.repeat(32)}`;
const peerId = `0x${'22'.repeat(32)}`;
const labels = { selfEntityId: entityId, activeEnv: null, activeXlnFunctions: null };

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
