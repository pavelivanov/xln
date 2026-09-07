import { describe, expect, test } from 'bun:test';
import { projectControlTakeoverTargets } from '../../../core/api/server/control/control-board-governance';
import { getWalletControlActivationState } from '../../../frontend/bridges/wallet/wallet-canonical-ownership-governance';
import { buildControlBoardActivationInputs } from '../../../frontend/src/lib/components/Entity/ownership/ownership-flow';

const shareholder = `0x${'01'.repeat(32)}`;
const signer = `0x${'02'.repeat(20)}`;
const provider = `0x${'03'.repeat(20)}`;
const target = `0x${'04'.repeat(32)}`;
const oldBoard = `0x${'05'.repeat(32)}`;
const successorBoard = `0x${'06'.repeat(32)}`;
const candidate = (suffix: string, overrides: Partial<Parameters<typeof projectControlTakeoverTargets>[0]['candidates'][number]> = {}) => ({
  entityId: `0x${suffix.repeat(64 / suffix.length)}`,
  name: `Target ${suffix}`,
  signerId: signer,
  validators: [signer],
  entityProviderAddress: provider,
  ...overrides,
});

describe('Wallet Ownership CONTROL governance', () => {
  test('keeps only same-signer validator replicas on the same EntityProvider', () => {
    const eligible = candidate('11', { name: 'Beta' });
    const second = candidate('22', { name: 'Alpha' });
    const result = projectControlTakeoverTargets({
      shareholderEntityId: shareholder,
      signerId: signer,
      entityProviderAddress: provider,
      candidates: [
        candidate('01'),
        eligible,
        second,
        candidate('33', { signerId: `0x${'04'.repeat(20)}` }),
        candidate('44', { validators: [`0x${'05'.repeat(20)}`] }),
        candidate('55', { entityProviderAddress: `0x${'06'.repeat(20)}` }),
      ],
    });
    expect(result).toEqual([
      { entityId: second.entityId, name: 'Alpha' },
      { entityId: eligible.entityId, name: 'Beta' },
    ]);
  });

  test('deduplicates targets and falls back to the canonical Entity ID label', () => {
    const unnamed = candidate('77', { name: '' });
    expect(projectControlTakeoverTargets({
      shareholderEntityId: shareholder,
      signerId: signer.toUpperCase(),
      entityProviderAddress: provider.toUpperCase(),
      candidates: [unnamed, { ...unnamed, name: 'Ignored duplicate' }],
    })).toEqual([{ entityId: unnamed.entityId, name: unnamed.entityId }]);
  });

  test('enables activation only for the exact synchronized proposal after its full delay', () => {
    const status = {
      targetEntityId: target,
      currentBoardHash: oldBoard,
      proposedBoardHash: successorBoard,
      successorBoardHash: successorBoard,
      runtimeBoardHash: oldBoard,
      actionNonce: 1n,
      currentUnix: 99n,
      activateAt: 100n,
      activationAvailableAt: 100n,
    };
    expect(getWalletControlActivationState(status)).toBe('waiting');
    expect(getWalletControlActivationState({ ...status, currentUnix: 100n })).toBe('ready');
    expect(getWalletControlActivationState({ ...status, runtimeBoardHash: successorBoard })).toBe('unavailable');
    expect(getWalletControlActivationState({ ...status, proposedBoardHash: oldBoard })).toBe('unavailable');
    expect(getWalletControlActivationState({
      ...status,
      currentBoardHash: successorBoard,
      runtimeBoardHash: successorBoard,
      proposedBoardHash: `0x${'00'.repeat(32)}`,
    })).toBe('active');
  });

  test('builds the target handover before the shareholder activation', () => {
    const inputs = buildControlBoardActivationInputs({
      shareholderEntityId: shareholder,
      targetEntityId: target,
      signerId: signer,
      board: { mode: 'proposer-based', threshold: 1n, validators: [signer], shares: { [signer]: 1n } },
    });
    expect(inputs).toEqual([
      {
        entityId: target,
        signerId: signer,
        entityTxs: [{
          type: 'boardHandover',
          data: {
            board: {
              mode: 'proposer-based',
              threshold: 1n,
              validators: [signer],
              shares: { [signer]: 1n },
            },
          },
        }],
      },
      {
        entityId: shareholder,
        signerId: signer,
        entityTxs: [{ type: 'entityProviderActivateBoard', data: { targetEntityId: target } }],
      },
    ]);
  });
});
