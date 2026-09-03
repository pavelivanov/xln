import { describe, expect, test } from 'bun:test';

import {
  projectEntityWorkspaceContext,
} from '../../../frontend/packages/runtime-client/src/entity-workspace-context';
import {
  emptyEntityWorkspaceHubPolicy,
  projectEntityWorkspaceHubPolicy,
} from '../../../frontend/packages/runtime-client/src/entity-workspace-hub-policy';

const CONTEXT_FRAME = {
  height: 18,
  activeEntityId: '0xaaaa',
  activeEntity: {
    summary: { entityId: '0xaaaa', label: 'Treasury' },
    core: { entityId: '0xaaaa', signerId: '0xbbbb' },
    accounts: { items: [], totalItems: 0 },
  },
};

const SELECTED_CONTEXT = projectEntityWorkspaceContext({
  runtimeId: 'runtime-a',
  frame: CONTEXT_FRAME,
});

const POLICY = {
  hubName: 'Treasury Hub',
  matchingStrategy: 'fee',
  policyVersion: 7,
  routingFeePPM: 250,
  baseFee: 4n,
  swapTakerFeeBps: 9,
  disputeAutoFinalizeMode: 'auto',
  minCollateralThreshold: 100n,
  rebalanceLiquidityFeeBps: 12n,
  rebalanceTimeoutMs: 90_000,
};

const frameWithPolicy = (policy: unknown, entityId = '0xaaaa') => ({
  ...CONTEXT_FRAME,
  activeEntity: {
    ...CONTEXT_FRAME.activeEntity,
    core: {
      ...CONTEXT_FRAME.activeEntity.core,
      entityId,
      ...(policy === undefined ? {} : { hubRebalanceConfig: policy }),
    },
  },
});

describe('React Entity workspace Hub policy projection', () => {
  test('preserves the committed raw Hub policy without deriving fees', () => {
    expect(projectEntityWorkspaceHubPolicy({
      context: SELECTED_CONTEXT,
      frame: frameWithPolicy(POLICY),
    })).toEqual({
      status: 'selected',
      entityId: '0xaaaa',
      matchingStrategy: 'fee',
      policyVersion: 7,
      routingFeePPM: 250,
      baseFee: 4n,
      rebalanceLiquidityFeeBps: 12n,
      rebalanceTimeoutMs: 90_000,
    });
  });

  test('distinguishes no Entity from a selected non-Hub Entity', () => {
    expect(projectEntityWorkspaceHubPolicy({
      context: { status: 'empty', runtimeId: 'runtime-a', entityId: null, height: 18 },
    })).toEqual(emptyEntityWorkspaceHubPolicy());
    expect(projectEntityWorkspaceHubPolicy({
      context: SELECTED_CONTEXT,
      frame: frameWithPolicy(undefined),
    })).toEqual({ status: 'absent', entityId: '0xaaaa' });
  });

  test('fails loudly on Entity drift and malformed policy evidence', () => {
    expect(() => projectEntityWorkspaceHubPolicy({
      context: SELECTED_CONTEXT,
      frame: frameWithPolicy(POLICY, '0xcccc'),
    })).toThrow('ENTITY_WORKSPACE_HUB_POLICY_ENTITY_ID_MISMATCH');
    expect(() => projectEntityWorkspaceHubPolicy({
      context: SELECTED_CONTEXT,
      frame: frameWithPolicy({ ...POLICY, inventedFee: 1 }),
    })).toThrow('ENTITY_WORKSPACE_HUB_POLICY_FIELDS_INVALID');
    expect(() => projectEntityWorkspaceHubPolicy({
      context: SELECTED_CONTEXT,
      frame: frameWithPolicy({ ...POLICY, matchingStrategy: 'random' }),
    })).toThrow('ENTITY_WORKSPACE_HUB_POLICY_STRATEGY_INVALID');
    expect(() => projectEntityWorkspaceHubPolicy({
      context: SELECTED_CONTEXT,
      frame: frameWithPolicy({ ...POLICY, policyVersion: 0 }),
    })).toThrow('ENTITY_WORKSPACE_HUB_POLICY_VERSION_INVALID');
    expect(() => projectEntityWorkspaceHubPolicy({
      context: SELECTED_CONTEXT,
      frame: frameWithPolicy({ ...POLICY, baseFee: '4' }),
    })).toThrow('ENTITY_WORKSPACE_HUB_POLICY_BASE_FEE_INVALID');
  });

  test('keeps rendering and source wiring read-only', async () => {
    const [panel, page, projection, source] = await Promise.all([
      Bun.file('frontend/packages/ui/src/entity-workspace-profile-panel.tsx').text(),
      Bun.file('frontend/apps/ops/src/ops-entity-workspace.tsx').text(),
      Bun.file('frontend/apps/ops/src/ops-entity-workspace-projection.ts').text(),
      Bun.file('frontend/apps/ops/src/ops-entity-workspace-source.ts').text(),
    ]);
    expect(panel).toContain('settings-hub-policy');
    expect(panel).toContain('policy.baseFee.toString()');
    expect(page).toContain('hubPolicy={runtimeSnapshot.hubPolicy}');
    expect(projection).toContain('projectEntityWorkspaceHubPolicy({ context, frame })');
    expect(source).not.toContain('.send(');
    expect(panel).not.toContain('calculate');
  });
});
