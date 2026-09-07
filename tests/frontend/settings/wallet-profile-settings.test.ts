import { describe, expect, test } from 'bun:test';

import { projectWalletProfileFrame } from '../../../frontend/apps/wallet/src/settings/wallet-profile-model';

const ENTITY = `0x${'a'.repeat(64)}`;
const PEER = `0x${'b'.repeat(64)}`;
const frame = (activeEntityId = ENTITY) => ({
  height: 12,
  entities: [
    { entityId: ENTITY, label: 'Primary identity' },
    { entityId: PEER, label: 'Peer identity' },
  ],
  activeEntityId,
  activeEntity: {
    summary: { entityId: activeEntityId, label: 'Primary identity', jurisdiction: { name: 'H1' } },
    core: {
      entityId: activeEntityId,
      signerId: `0x${'c'.repeat(40)}`,
      config: { jurisdiction: { name: 'H1' } },
      profile: {
        entityId: activeEntityId,
        name: 'Primary identity',
        isHub: false,
        avatar: '',
        bio: 'Committed profile',
        website: 'https://wallet.example',
      },
      reserves: new Map([[1, 20n]]),
    },
    accounts: { items: [], totalItems: 0 },
  },
});

describe('Wallet committed profile settings projection', () => {
  test('binds the public profile and choices to one selected Runtime Entity', () => {
    const projection = projectWalletProfileFrame('runtime-a', frame() as never);
    expect(projection.entities).toEqual([
      { entityId: ENTITY, label: 'Primary identity' },
      { entityId: PEER, label: 'Peer identity' },
    ]);
    expect(projection.context).toMatchObject({
      status: 'selected', runtimeId: 'runtime-a', entityId: ENTITY, height: 12,
    });
    expect(projection.profile).toMatchObject({
      status: 'selected', entityId: ENTITY, name: 'Primary identity', bio: 'Committed profile',
    });
    expect(projection.reserves).toEqual({
      status: 'selected', entityId: ENTITY, items: [{ tokenId: 1, amount: 20n }],
    });
    expect(projection.hubPolicy).toEqual({ status: 'absent', entityId: ENTITY });
  });

  test('rejects malformed choices and cross-Entity active projections', () => {
    expect(() => projectWalletProfileFrame('runtime-a', {
      ...frame(), entities: [{ entityId: ' ', label: 'Broken' }],
    } as never)).toThrow('WALLET_PROFILE_ENTITY_ID_INVALID');
    expect(() => projectWalletProfileFrame('runtime-a', {
      ...frame(), activeEntityId: PEER,
    } as never)).toThrow('ENTITY_WORKSPACE_ENTITY_ID_MISMATCH');
  });
});
