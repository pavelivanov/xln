import type {
  RuntimeAdapterBatchOperationCounts,
  RuntimeAdapterBatchPreflight,
} from '../../../../../../core/api/runtime-adapter/types';
import { requireExactKeys } from '../../../../../packages/runtime-client/src/boundary';
import {
  normalizeRequiredRuntimeEntityId,
  requireRuntimeBigInt,
  requireRuntimeEnum,
  requireRuntimeInteger,
  requireRuntimeRecord,
  requireRuntimeString,
} from '../../runtime/wallet-runtime-decode';

type RuntimeAdapterBatchReserveIssue = NonNullable<RuntimeAdapterBatchPreflight['draft']['issue']>;

const COUNT_FIELDS = [
  'total',
  'reserveToReserve',
  'reserveToCollateral',
  'reserveToCollateralPairs',
  'collateralToReserve',
  'settlements',
  'settlementDiffs',
  'disputeStarts',
  'counterDisputes',
  'disputeFinalizations',
  'externalTokenToReserve',
  'reserveToExternalToken',
  'revealSecrets',
  'hashLadderRegistrations',
] as const satisfies readonly (keyof RuntimeAdapterBatchOperationCounts)[];

const ISSUE_FIELDS = [
  'tokenId',
  'opType',
  'opIndex',
  'failureMode',
  'requiredAmount',
  'availableAfterDebt',
  'debtClaimPaid',
  'remainingDebtAfterSweep',
  'unrepaidDeficit',
] as const;

const requireIdentity = (value: unknown, code: string): string => {
  const identity = requireRuntimeString(value, code).toLowerCase();
  if (!/^0x[0-9a-f]{64}$/u.test(identity)) throw new Error(`${code}_INVALID`);
  return identity;
};

const decodeCounts = (value: unknown): RuntimeAdapterBatchOperationCounts => {
  const counts = requireRuntimeRecord(value, 'WALLET_BATCH_PREFLIGHT_COUNTS');
  requireExactKeys(counts, COUNT_FIELDS, [], 'WALLET_BATCH_PREFLIGHT_COUNTS_FIELDS_INVALID');
  const read = (field: typeof COUNT_FIELDS[number]): number =>
    requireRuntimeInteger(counts[field], `WALLET_BATCH_PREFLIGHT_COUNT_${field.toUpperCase()}`);
  return {
    total: read('total'),
    reserveToReserve: read('reserveToReserve'),
    reserveToCollateral: read('reserveToCollateral'),
    reserveToCollateralPairs: read('reserveToCollateralPairs'),
    collateralToReserve: read('collateralToReserve'),
    settlements: read('settlements'),
    settlementDiffs: read('settlementDiffs'),
    disputeStarts: read('disputeStarts'),
    counterDisputes: read('counterDisputes'),
    disputeFinalizations: read('disputeFinalizations'),
    externalTokenToReserve: read('externalTokenToReserve'),
    reserveToExternalToken: read('reserveToExternalToken'),
    revealSecrets: read('revealSecrets'),
    hashLadderRegistrations: read('hashLadderRegistrations'),
  };
};

const decodeIssue = (value: unknown): RuntimeAdapterBatchReserveIssue | null => {
  if (value === null) return null;
  const issue = requireRuntimeRecord(value, 'WALLET_BATCH_PREFLIGHT_ISSUE');
  requireExactKeys(issue, ISSUE_FIELDS, [], 'WALLET_BATCH_PREFLIGHT_ISSUE_FIELDS_INVALID');
  return {
    tokenId: requireRuntimeInteger(issue['tokenId'], 'WALLET_BATCH_PREFLIGHT_ISSUE_TOKEN', 1),
    opType: requireRuntimeEnum(issue['opType'], [
      'reserveToReserve', 'settlement', 'reserveToCollateral', 'reserveToExternalToken',
    ], 'WALLET_BATCH_PREFLIGHT_ISSUE_OPERATION'),
    opIndex: requireRuntimeInteger(issue['opIndex'], 'WALLET_BATCH_PREFLIGHT_ISSUE_INDEX'),
    failureMode: requireRuntimeEnum(issue['failureMode'], ['batchRevert'], 'WALLET_BATCH_PREFLIGHT_ISSUE_MODE'),
    requiredAmount: requireRuntimeBigInt(issue['requiredAmount'], 'WALLET_BATCH_PREFLIGHT_ISSUE_REQUIRED'),
    availableAfterDebt: requireRuntimeBigInt(issue['availableAfterDebt'], 'WALLET_BATCH_PREFLIGHT_ISSUE_AVAILABLE'),
    debtClaimPaid: requireRuntimeBigInt(issue['debtClaimPaid'], 'WALLET_BATCH_PREFLIGHT_ISSUE_DEBT_PAID'),
    remainingDebtAfterSweep: requireRuntimeBigInt(issue['remainingDebtAfterSweep'], 'WALLET_BATCH_PREFLIGHT_ISSUE_DEBT_REMAINING'),
    unrepaidDeficit: requireRuntimeBigInt(issue['unrepaidDeficit'], 'WALLET_BATCH_PREFLIGHT_ISSUE_DEFICIT'),
  };
};

const decodeDraft = (value: unknown): RuntimeAdapterBatchPreflight['draft'] => {
  const draft = requireRuntimeRecord(value, 'WALLET_BATCH_PREFLIGHT_DRAFT');
  requireExactKeys(draft, ['identity', 'counts', 'issue'], [], 'WALLET_BATCH_PREFLIGHT_DRAFT_FIELDS_INVALID');
  return {
    identity: requireIdentity(draft['identity'], 'WALLET_BATCH_PREFLIGHT_DRAFT_IDENTITY'),
    counts: decodeCounts(draft['counts']),
    issue: decodeIssue(draft['issue']),
  };
};

const decodeSent = (value: unknown): RuntimeAdapterBatchPreflight['sent'] => {
  if (value === null) return null;
  const sent = requireRuntimeRecord(value, 'WALLET_BATCH_PREFLIGHT_SENT');
  requireExactKeys(
    sent,
    ['identity', 'batchHash', 'entityNonce', 'counts'],
    [],
    'WALLET_BATCH_PREFLIGHT_SENT_FIELDS_INVALID',
  );
  return {
    identity: requireIdentity(sent['identity'], 'WALLET_BATCH_PREFLIGHT_SENT_IDENTITY'),
    batchHash: requireIdentity(sent['batchHash'], 'WALLET_BATCH_PREFLIGHT_SENT_HASH'),
    entityNonce: requireRuntimeInteger(sent['entityNonce'], 'WALLET_BATCH_PREFLIGHT_SENT_NONCE', 1),
    counts: decodeCounts(sent['counts']),
  };
};

export const decodeWalletBatchPreflight = (
  value: unknown,
  expected: Readonly<{ runtimeId: string; height: number; entityId: string }>,
): RuntimeAdapterBatchPreflight => {
  const root = requireRuntimeRecord(value, 'WALLET_BATCH_PREFLIGHT');
  requireExactKeys(root, [
    'ok', 'runtimeId', 'height', 'entityId', 'status', 'reserveTokenCount',
    'openDebtTokenCount', 'draft', 'sent',
  ], [], 'WALLET_BATCH_PREFLIGHT_FIELDS_INVALID');
  if (root['ok'] !== true) throw new Error('WALLET_BATCH_PREFLIGHT_NOT_OK');
  const runtimeId = requireRuntimeString(root['runtimeId'], 'WALLET_BATCH_PREFLIGHT_RUNTIME').toLowerCase();
  const height = requireRuntimeInteger(root['height'], 'WALLET_BATCH_PREFLIGHT_HEIGHT', 1);
  const entityId = normalizeRequiredRuntimeEntityId(root['entityId'], 'WALLET_BATCH_PREFLIGHT_ENTITY');
  if (runtimeId !== expected.runtimeId.trim().toLowerCase()) throw new Error('WALLET_BATCH_PREFLIGHT_RUNTIME_CHANGED');
  if (height !== expected.height) throw new Error('WALLET_BATCH_PREFLIGHT_HEIGHT_CHANGED');
  if (entityId !== normalizeRequiredRuntimeEntityId(expected.entityId, 'WALLET_BATCH_PREFLIGHT_EXPECTED_ENTITY')) {
    throw new Error('WALLET_BATCH_PREFLIGHT_ENTITY_CHANGED');
  }
  return {
    ok: true,
    runtimeId,
    height,
    entityId,
    status: requireRuntimeEnum(root['status'], ['empty', 'accumulating', 'sent', 'failed'], 'WALLET_BATCH_PREFLIGHT_STATUS'),
    reserveTokenCount: requireRuntimeInteger(root['reserveTokenCount'], 'WALLET_BATCH_PREFLIGHT_RESERVE_TOKENS'),
    openDebtTokenCount: requireRuntimeInteger(root['openDebtTokenCount'], 'WALLET_BATCH_PREFLIGHT_DEBT_TOKENS'),
    draft: decodeDraft(root['draft']),
    sent: decodeSent(root['sent']),
  };
};

const operationLabel = (opType: RuntimeAdapterBatchReserveIssue['opType']): string => {
  if (opType === 'settlement') return 'Settlement';
  if (opType === 'reserveToExternalToken') return 'Reserve withdrawal';
  if (opType === 'reserveToCollateral') return 'Reserve → Account';
  return 'Reserve → Reserve';
};

export const formatWalletBatchReserveIssue = (
  issue: RuntimeAdapterBatchReserveIssue,
  formatAmount: (tokenId: number, amount: bigint) => string,
): string => {
  const operation = operationLabel(issue.opType);
  const required = formatAmount(issue.tokenId, issue.requiredAmount);
  if (issue.unrepaidDeficit > 0n) {
    return `Batch will revert: ${operation} spends ${required} ahead of holding it and the batch ends ${formatAmount(issue.tokenId, issue.unrepaidDeficit)} short (implicit flash credit must be repaid before the batch ends).`;
  }
  return `${operation} will be skipped: debt sweep consumes ${formatAmount(issue.tokenId, issue.debtClaimPaid)} first, leaving only ${formatAmount(issue.tokenId, issue.availableAfterDebt)} spendable.`;
};
