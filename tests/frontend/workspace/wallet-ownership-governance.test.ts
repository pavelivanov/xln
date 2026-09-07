import { describe, expect, test } from 'bun:test';
import { projectControlTakeoverTargets } from '../../../core/api/server/control/control-board-governance';

const shareholder = `0x${'01'.repeat(32)}`;
const signer = `0x${'02'.repeat(20)}`;
const provider = `0x${'03'.repeat(20)}`;
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
    const target = candidate('77', { name: '' });
    expect(projectControlTakeoverTargets({
      shareholderEntityId: shareholder,
      signerId: signer.toUpperCase(),
      entityProviderAddress: provider.toUpperCase(),
      candidates: [target, { ...target, name: 'Ignored duplicate' }],
    })).toEqual([{ entityId: target.entityId, name: target.entityId }]);
  });
});
