import {
  requireExactKeys,
  requireUnknownRecord,
} from './boundary';
import type { EntityWorkspaceContext } from './entity-workspace-context';

export type EntityWorkspaceHubStrategy = 'amount' | 'time' | 'fee';

type EmptyEntityWorkspaceHubPolicy = Readonly<{
  status: 'empty';
}>;

type AbsentEntityWorkspaceHubPolicy = Readonly<{
  status: 'absent';
  entityId: string;
}>;

type SelectedEntityWorkspaceHubPolicy = Readonly<{
  status: 'selected';
  entityId: string;
  matchingStrategy: EntityWorkspaceHubStrategy;
  policyVersion: number;
  routingFeePPM: number;
  baseFee: bigint;
  rebalanceLiquidityFeeBps: bigint;
  rebalanceTimeoutMs: number | null;
}>;

export type EntityWorkspaceHubPolicy =
  | EmptyEntityWorkspaceHubPolicy
  | AbsentEntityWorkspaceHubPolicy
  | SelectedEntityWorkspaceHubPolicy;

export type EntityWorkspaceHubPolicyInput = Readonly<{
  context: EntityWorkspaceContext;
  frame?: unknown;
}>;

const REQUIRED_POLICY_FIELDS = [
  'matchingStrategy',
  'policyVersion',
  'routingFeePPM',
  'baseFee',
  'rebalanceLiquidityFeeBps',
] as const;

const OPTIONAL_POLICY_FIELDS = [
  'hubName',
  'swapTakerFeeBps',
  'disputeAutoFinalizeMode',
  'minCollateralThreshold',
  'c2rWithdrawSoftLimit',
  'rebalanceBaseFee',
  'rebalanceGasFee',
  'rebalanceTimeoutMs',
] as const;

export const emptyEntityWorkspaceHubPolicy = (): EmptyEntityWorkspaceHubPolicy => ({ status: 'empty' });

const requireEntityId = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('ENTITY_WORKSPACE_HUB_POLICY_ENTITY_ID_INVALID');
  }
  return value.trim().toLowerCase();
};

const requireSafeInteger = (value: unknown, minimum: number, code: string): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    throw new Error(code);
  }
  return value;
};

const requireBigInt = (value: unknown, code: string): bigint => {
  if (typeof value !== 'bigint') throw new Error(code);
  return value;
};

const requireStrategy = (value: unknown): EntityWorkspaceHubStrategy => {
  if (value !== 'amount' && value !== 'time' && value !== 'fee') {
    throw new Error('ENTITY_WORKSPACE_HUB_POLICY_STRATEGY_INVALID');
  }
  return value;
};

const optionalTimeout = (value: unknown): number | null => value === undefined
  ? null
  : requireSafeInteger(value, 0, 'ENTITY_WORKSPACE_HUB_POLICY_TIMEOUT_INVALID');

export function projectEntityWorkspaceHubPolicy(
  input: EntityWorkspaceHubPolicyInput,
): EntityWorkspaceHubPolicy {
  if (input.context.status === 'empty') return emptyEntityWorkspaceHubPolicy();
  const frame = requireUnknownRecord(input.frame, 'ENTITY_WORKSPACE_HUB_POLICY_FRAME_INVALID');
  const active = requireUnknownRecord(frame['activeEntity'], 'ENTITY_WORKSPACE_HUB_POLICY_ACTIVE_ENTITY_INVALID');
  const core = requireUnknownRecord(active['core'], 'ENTITY_WORKSPACE_HUB_POLICY_CORE_INVALID');
  const entityId = requireEntityId(core['entityId']);
  if (entityId !== input.context.entityId) {
    throw new Error('ENTITY_WORKSPACE_HUB_POLICY_ENTITY_ID_MISMATCH');
  }
  if (core['hubRebalanceConfig'] === undefined) return { status: 'absent', entityId };
  const policy = requireUnknownRecord(
    core['hubRebalanceConfig'],
    'ENTITY_WORKSPACE_HUB_POLICY_INVALID',
  );
  requireExactKeys(
    policy,
    REQUIRED_POLICY_FIELDS,
    OPTIONAL_POLICY_FIELDS,
    'ENTITY_WORKSPACE_HUB_POLICY_FIELDS_INVALID',
  );
  return {
    status: 'selected',
    entityId,
    matchingStrategy: requireStrategy(policy['matchingStrategy']),
    policyVersion: requireSafeInteger(
      policy['policyVersion'],
      1,
      'ENTITY_WORKSPACE_HUB_POLICY_VERSION_INVALID',
    ),
    routingFeePPM: requireSafeInteger(
      policy['routingFeePPM'],
      0,
      'ENTITY_WORKSPACE_HUB_POLICY_ROUTING_FEE_INVALID',
    ),
    baseFee: requireBigInt(policy['baseFee'], 'ENTITY_WORKSPACE_HUB_POLICY_BASE_FEE_INVALID'),
    rebalanceLiquidityFeeBps: requireBigInt(
      policy['rebalanceLiquidityFeeBps'],
      'ENTITY_WORKSPACE_HUB_POLICY_LIQUIDITY_FEE_INVALID',
    ),
    rebalanceTimeoutMs: optionalTimeout(policy['rebalanceTimeoutMs']),
  };
}
