import { describe, expect, test } from 'bun:test';
import type { RuntimeInput } from '@xln/core/api/public/runtime-module';
import * as THREE from '../../../../frontend/node_modules/three';
import { createDefaultViewSettings } from '../../../../frontend/packages/runtime-client/src/panels/settings-panel-view';
import type { GraphEntityVisualData } from '../../../../frontend/packages/ui/src/graph/graph3d-entity-visuals';
import { createOpsGraphEffects, projectOpsGraphEffects } from '../../../../frontend/apps/ops/src/workspace/graph/ops-graph-effects';

describe('Ops Graph3D selected-frame effects', () => {
  test('projects exact Account lightning and reserve broadcasts in input order', () => {
    const input = {
      runtimeTxs: [],
      entityInputs: [{
        entityId: ' 0xALICE ',
        entityTxs: [{
          type: 'accountInput',
          data: {
            fromEntityId: ' 0xALICE ',
            toEntityId: ' 0xBOB ',
            accountTx: { type: 'payment', data: { amount: 42n } },
          },
        }, { type: 'withdraw_reserve' }],
      }],
      jInputs: [],
    } as unknown as RuntimeInput;

    expect(projectOpsGraphEffects(input)).toEqual([
      {
        kind: 'lightning', fromEntityId: '0xalice', toEntityId: '0xbob',
        transaction: { type: 'payment', amount: 42n, data: { amount: 42n } },
      },
      { kind: 'broadcast', entityId: '0xalice', txType: 'withdraw_reserve' },
    ]);
  });

  test('projects real jurisdiction batches and ignores empty or unrelated work', () => {
    const input = {
      runtimeTxs: [{ type: 'noop' }],
      entityInputs: [{ entityId: '0xalice', entityTxs: [{ type: 'profileUpdate' }, { type: 'payFromReserve' }] }],
      jInputs: [
        { jurisdictionName: 'Sepolia', jTxs: [{ type: 'deposit' }, { type: 'withdraw' }] },
        { jurisdictionName: 'Empty', jTxs: [] },
      ],
    } as unknown as RuntimeInput;

    expect(projectOpsGraphEffects(input)).toEqual([{
      kind: 'jurisdiction-broadcast', jurisdictionName: 'Sepolia',
      txType: 'deposit', transactionCount: 2,
    }]);
    expect(projectOpsGraphEffects(null)).toEqual([]);
  });

  test('applies exact speed, style and enable controls and disposes replaced meshes', () => {
    const container = { dataset: {} } as unknown as HTMLElement;
    const effects = createOpsGraphEffects(container);
    const world = new THREE.Group();
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(10, 0, 0),
    ]), new THREE.LineBasicMaterial());
    const entities: GraphEntityVisualData[] = [
      { id: 'alice', position: new THREE.Vector3(0, 0, 0), mesh: new THREE.Mesh() },
      { id: 'bob', position: new THREE.Vector3(10, 0, 0), mesh: new THREE.Mesh() },
    ];
    const connection = { accountId: 'alice:bob', from: 'alice', to: 'bob', line, mempoolBoxes: [] };
    const view = { ...createDefaultViewSettings(), lightningEnabled: true, lightningSpeed: 400, broadcastEnabled: true, broadcastStyle: 'raycast' as const };

    effects.replace(world, [
      { kind: 'lightning', fromEntityId: 'alice', toEntityId: 'bob' },
      { kind: 'broadcast', entityId: 'alice', txType: 'deposit_reserve' },
    ], view, entities, [], [connection]);
    expect(container.dataset).toMatchObject({ effectCount: '2', effectKinds: 'lightning,raycast', effectEmittedKinds: 'lightning,raycast' });
    expect(world.children).toHaveLength(2);

    effects.frame(performance.now() + view.lightningSpeed + 1);
    expect(container.dataset).toMatchObject({ effectCount: '1', effectKinds: 'raycast', effectEmittedKinds: 'lightning,raycast' });

    effects.replace(world, [{ kind: 'broadcast', entityId: 'alice', txType: 'deposit_reserve' }], {
      ...view, lightningEnabled: false, broadcastEnabled: false,
    }, entities, [], [connection]);
    expect(container.dataset).toMatchObject({ effectCount: '0', effectKinds: '', effectEmittedKinds: '' });
    expect(world.children).toHaveLength(0);

    effects.replace(world, [{ kind: 'broadcast', entityId: 'alice', txType: 'deposit_reserve' }], {
      ...view, broadcastStyle: 'particles',
    }, entities, [], [connection]);
    const particle = world.children[0] as THREE.Mesh;
    let disposals = 0;
    particle.geometry.addEventListener('dispose', () => { disposals += 1; });
    expect(container.dataset).toMatchObject({ effectCount: '1', effectKinds: 'particles', effectEmittedKinds: 'particles' });
    effects.clear();
    expect({ disposals, children: world.children.length, ...container.dataset }).toEqual({
      disposals: 1, children: 0, effectCount: '0', effectKinds: '', effectEmittedKinds: '',
    });
  });
});
