import { readStoreValue } from '../../../packages/runtime-client/src/observable-store';
import type {
  RuntimeAdapter,
  RuntimeAdapterSettlementWorkspaceRead,
  RuntimeAdapterViewFrame,
} from '@xln/core/api/public/runtime-module';
import { getXLN, xlnEnvironment, resolveConfiguredApiBase } from '../../runtime/xln-store';
import { buildEntityPanelView } from '../entity/entity-panel-model';
import { buildPaymentPanelView, buildPaymentPanelViewFromRuntimeView } from '../payment-panel-view';
import { buildSwapPanelRuntimeView } from '../swap-panel-helpers';
import { unwrapLiveRuntimeEnv } from '../../../packages/browser/src/runtime/live-runtime-env';
import { decodeWalletSettlementWorkspace } from '../../../apps/wallet/src/portfolio/wallet-portfolio-model';
import {
  normalizeRequiredRuntimeEntityId,
  requireRuntimeInteger,
  requireRuntimeRecord,
  requireRuntimeString,
} from '../../../apps/wallet/src/runtime/wallet-runtime-decode';

export async function readCanonicalAccountContext(adapter: RuntimeAdapter, entityId: string, frame: RuntimeAdapterViewFrame) {
  const xln = await getXLN();
  const local = readStoreValue(xlnEnvironment);
  const bound = adapter.mode === 'embedded' && local && local.runtimeId === adapter.runtimeId ? local : null;
  if (adapter.mode === 'embedded' && !bound) throw new Error('ACCOUNT_CONTEXT_RUNTIME_CHANGED');
  const env = bound ? unwrapLiveRuntimeEnv(bound) : null;
  if (bound && !env) throw new Error('ACCOUNT_CONTEXT_LIVE_RUNTIME_UNAVAILABLE');
  const panel = buildEntityPanelView(bound, entityId, '', '', bound ? undefined : frame);
  if (!panel.replica || panel.replica.state.entityId.toLowerCase() !== entityId) throw new Error('ACCOUNT_CONTEXT_ENTITY_CHANGED');
  return {
    entityId, runtimeId: adapter.runtimeId, frame, replica: panel.replica, names: panel.entityNames,
    xln, env, jurisdiction: panel.activeJurisdictionName || '', apiBase: resolveConfiguredApiBase(window.location.origin),
    commandsReady: adapter.commandReady, commandReason: adapter.commandReadyReason || '',
    paymentView: env ? buildPaymentPanelView({ entityId, replicas: panel.replicas, profiles: panel.profiles,
      networkGraph: env.gossip.getNetworkGraph() }) : buildPaymentPanelViewFromRuntimeView({ entityId, frame }),
    swapView: buildSwapPanelRuntimeView({ profiles: panel.profiles, networkProfiles: panel.profiles,
      entityNames: panel.entityNames, replicas: panel.replicas }),
  };
}

export type WalletAccountContext = Awaited<ReturnType<typeof readCanonicalAccountContext>>;

const participantForSide = (left: string, right: string, isLeft: boolean): string =>
  isLeft ? left : right;

export async function readCanonicalWalletSettlementWorkspaces(
  adapter: RuntimeAdapter,
  entityId: string,
  frame: RuntimeAdapterViewFrame,
) {
  const value = await adapter.read<RuntimeAdapterSettlementWorkspaceRead>(
    `entity/${entityId}/settlement-workspaces`,
    { atHeight: frame.height },
  );
  const root = requireRuntimeRecord(value, 'WALLET_SETTLEMENT_READ');
  if (root['ok'] !== true) throw new Error('WALLET_SETTLEMENT_READ_NOT_OK');
  const runtimeId = requireRuntimeString(root['runtimeId'], 'WALLET_SETTLEMENT_READ_RUNTIME').toLowerCase();
  const activeEntityId = normalizeRequiredRuntimeEntityId(root['entityId'], 'WALLET_SETTLEMENT_READ_ENTITY');
  const signerId = normalizeRequiredRuntimeEntityId(root['signerId'], 'WALLET_SETTLEMENT_READ_SIGNER');
  const activeSignerId = frame.activeEntity?.core.signerId?.toLowerCase() || '';
  if (runtimeId !== adapter.runtimeId.toLowerCase()
    || activeEntityId !== entityId.toLowerCase()
    || frame.activeEntityId?.toLowerCase() !== activeEntityId
    || activeSignerId !== signerId
    || requireRuntimeInteger(root['height'], 'WALLET_SETTLEMENT_READ_HEIGHT', 1) !== frame.height) {
    throw new Error('WALLET_SETTLEMENT_READ_CONTEXT_MISMATCH');
  }
  if (!Array.isArray(root['workspaces'])) throw new Error('WALLET_SETTLEMENT_READ_ITEMS_INVALID');
  const returned = requireRuntimeInteger(root['returned'], 'WALLET_SETTLEMENT_READ_RETURNED');
  const maxItems = requireRuntimeInteger(root['maxItems'], 'WALLET_SETTLEMENT_READ_LIMIT', 1);
  if (returned !== root['workspaces'].length || returned > maxItems) {
    throw new Error('WALLET_SETTLEMENT_READ_BOUND_INVALID');
  }

  return new Map(root['workspaces'].map((value): [string, ReturnType<typeof decodeWalletSettlementWorkspace>] => {
    const item = requireRuntimeRecord(value, 'WALLET_SETTLEMENT_READ_ITEM');
    const counterpartyEntityId = normalizeRequiredRuntimeEntityId(
      item['counterpartyEntityId'],
      'WALLET_SETTLEMENT_READ_COUNTERPARTY',
    );
    if (counterpartyEntityId === activeEntityId) throw new Error('WALLET_SETTLEMENT_READ_SELF_ACCOUNT');
    const leftEntity = activeEntityId < counterpartyEntityId ? activeEntityId : counterpartyEntityId;
    const rightEntity = leftEntity === activeEntityId ? counterpartyEntityId : activeEntityId;
    const lastModifiedByLeft = item['lastModifiedByLeft'];
    const executorIsLeft = item['executorIsLeft'];
    if (typeof lastModifiedByLeft !== 'boolean' || typeof executorIsLeft !== 'boolean') {
      throw new Error('WALLET_SETTLEMENT_READ_ROLE_INVALID');
    }
    const expectedProposer = participantForSide(leftEntity, rightEntity, lastModifiedByLeft);
    const expectedApprover = participantForSide(leftEntity, rightEntity, !lastModifiedByLeft);
    const expectedExecutor = participantForSide(leftEntity, rightEntity, executorIsLeft);
    if (normalizeRequiredRuntimeEntityId(item['proposerEntityId'], 'WALLET_SETTLEMENT_READ_PROPOSER') !== expectedProposer
      || normalizeRequiredRuntimeEntityId(item['approverEntityId'], 'WALLET_SETTLEMENT_READ_APPROVER') !== expectedApprover
      || normalizeRequiredRuntimeEntityId(item['executorEntityId'], 'WALLET_SETTLEMENT_READ_EXECUTOR') !== expectedExecutor
      || typeof item['leftHankoPresent'] !== 'boolean'
      || typeof item['rightHankoPresent'] !== 'boolean') {
      throw new Error('WALLET_SETTLEMENT_READ_AUTHORITY_MISMATCH');
    }
    const workspace = decodeWalletSettlementWorkspace({
      workspaceHash: item['workspaceHash'],
      ops: item['ops'],
      lastModifiedByLeft,
      status: item['status'],
      memo: item['memo'],
      revision: item['revision'],
      executorIsLeft,
      ...(item['leftHankoPresent'] ? { leftHanko: 'present' } : {}),
      ...(item['rightHankoPresent'] ? { rightHanko: 'present' } : {}),
    });
    if (!workspace) throw new Error('WALLET_SETTLEMENT_READ_WORKSPACE_MISSING');
    return [counterpartyEntityId, workspace];
  }));
}
