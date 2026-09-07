import { expect, test } from 'bun:test';
import type { RuntimeAdapterViewFrame } from '../../../core/api/public/runtime-module';
import { buildFormationRuntimeViewProjection } from '../../../frontend/src/lib/components/Entity/onboarding/formation/formation-runtime-projection';

const id = (byte: string) => `0x${byte.repeat(64)}`;
const jurisdiction = {
  name: 'Remote J', address: '0xdeposit', depositoryAddress: '0xdeposit',
  entityProviderAddress: '0xprovider', chainId: 31_337,
};

test('remote Formation projection keeps exact committed Entity and jurisdiction evidence', () => {
  const frame = {
    entities: [
      { entityId: id('1'), label: 'One', height: 4, jurisdiction },
      { entityId: id('2'), label: 'Two', height: 4, jurisdiction: { ...jurisdiction, chainId: '31337' } },
    ],
    activeEntity: { core: { config: { jurisdiction: { ...jurisdiction, registrationBlock: 9 } } } },
  } as unknown as RuntimeAdapterViewFrame;
  expect(buildFormationRuntimeViewProjection(frame)).toEqual({
    jurisdictions: [{ ...jurisdiction, registrationBlock: 9 }],
    existingEntityIds: [id('1'), id('2')],
  });
});

test('remote Formation ignores incomplete advertised jurisdictions', () => {
  const frame = {
    entities: [{ entityId: id('3'), label: 'Incomplete', height: 1, jurisdiction: { name: 'Missing contracts' } }],
    activeEntity: null,
  } as unknown as RuntimeAdapterViewFrame;
  expect(buildFormationRuntimeViewProjection(frame)).toEqual({ jurisdictions: [], existingEntityIds: [id('3')] });
});
