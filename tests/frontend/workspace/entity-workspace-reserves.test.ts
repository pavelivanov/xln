import { describe, expect, test } from 'bun:test';

import {
  emptyEntityWorkspaceReserves,
  projectEntityWorkspaceReserves,
} from '../../../frontend/packages/runtime-client/src/entity-workspace-reserves';
import { projectEntityWorkspaceContext } from '../../../frontend/packages/runtime-client/src/entity-workspace-context';

const FRAME = {
  height: 42,
  activeEntityId: '0xAABB',
  activeEntity: {
    summary: { entityId: '0xaabb', label: 'Treasury' },
    core: {
      entityId: '0xaabb',
      signerId: '0xbbbb',
      reserves: new Map<number, bigint>([[7, 0n], [1, 1_250_000n]]),
    },
    accounts: { items: [], totalItems: 0 },
  },
};

const CONTEXT = projectEntityWorkspaceContext({ runtimeId: 'runtime-a', frame: FRAME });

const projectReserves = (reserves: unknown) => projectEntityWorkspaceReserves({
  context: CONTEXT,
  frame: {
    ...FRAME,
    activeEntity: {
      ...FRAME.activeEntity,
      core: { ...FRAME.activeEntity.core, reserves },
    },
  },
});

describe('Entity workspace reserve projection', () => {
  test('preserves committed Map order and exact raw amounts', () => {
    expect(projectEntityWorkspaceReserves({ context: CONTEXT, frame: FRAME })).toEqual({
      status: 'selected',
      entityId: '0xaabb',
      items: [
        { tokenId: 7, amount: 0n },
        { tokenId: 1, amount: 1_250_000n },
      ],
    });
  });

  test('keeps an Entity-empty Runtime explicitly empty', () => {
    const context = projectEntityWorkspaceContext({
      runtimeId: 'runtime-a', frame: { height: 9, activeEntity: null },
    });
    expect(projectEntityWorkspaceReserves({ context, frame: { height: 9, activeEntity: null } }))
      .toEqual(emptyEntityWorkspaceReserves());
  });

  test('rejects noncanonical reserve containers, token ids, and amounts', () => {
    expect(() => projectReserves({ 1: 2n })).toThrow('ENTITY_WORKSPACE_RESERVES_MAP_INVALID');
    expect(() => projectReserves(new Map([[-1, 2n]])))
      .toThrow('ENTITY_WORKSPACE_RESERVE_TOKEN_ID_INVALID');
    expect(() => projectReserves(new Map([[1, '2']])))
      .toThrow('ENTITY_WORKSPACE_RESERVE_AMOUNT_INVALID');
    expect(() => projectReserves(new Map([[1, -2n]])))
      .toThrow('ENTITY_WORKSPACE_RESERVE_AMOUNT_INVALID');
  });

  test('rejects mismatched Entity authority and oversized projections', () => {
    expect(() => projectEntityWorkspaceReserves({
      context: CONTEXT,
      frame: {
        ...FRAME,
        activeEntity: {
          ...FRAME.activeEntity,
          core: { ...FRAME.activeEntity.core, entityId: '0xffff' },
        },
      },
    })).toThrow('ENTITY_WORKSPACE_RESERVES_ENTITY_ID_MISMATCH');
    const oversized = new Map(Array.from({ length: 101 }, (_, tokenId) => [tokenId, 0n] as const));
    expect(() => projectReserves(oversized)).toThrow('ENTITY_WORKSPACE_RESERVES_MAP_INVALID');
  });
});
