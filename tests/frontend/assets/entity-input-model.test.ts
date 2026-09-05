import { expect, test } from 'bun:test';
import { getShortIdFromHex, parseEntityInput } from '../../../frontend/src/lib/components/shared/entity-input-model';

const ALICE = `0xabcd${'11'.repeat(30)}`;
const BOB = `0x9876${'22'.repeat(30)}`;
const options = { entities: [ALICE, BOB], profiles: [{ entityId: ALICE, name: 'Alice' }] };

test('Entity input keeps full ID and invoice suffix resolution', () => {
  for (const text of [ALICE, ` ${ALICE.toUpperCase().replace('0X', '0x')} `, `${ALICE}?amount=10`]) {
    expect(parseEntityInput(text, options)).toEqual({ entityId: ALICE, shortId: 'ABCD', resolved: true });
  }
});

test('Entity input resolves projected names and short IDs without a Runtime lookup', () => {
  for (const text of ['Alice', '@ALICE', '#abcd', 'abcd']) expect(parseEntityInput(text, options).entityId).toBe(ALICE);
  expect(parseEntityInput('#9876', options).entityId).toBe(BOB);
  expect(parseEntityInput('@missing', options)).toEqual({ entityId: '', shortId: 'missing', resolved: false });
});

test('Entity input retains short-ID precedence over four-digit numbered input', () => {
  expect(parseEntityInput('#1234', options)).toEqual({ entityId: '', shortId: '1234', resolved: false });
  expect(parseEntityInput('#5', options)).toEqual({ entityId: `0x${'5'.padStart(64, '0')}`, shortId: '5', resolved: true });
  expect(parseEntityInput('281474976710656', options).resolved).toBe(false);
});

test('strict input and malformed input do not fabricate resolved identities', () => {
  expect(parseEntityInput('Alice', { ...options, strictValueInput: true })).toEqual({ entityId: 'Alice', shortId: '', resolved: false });
  expect(parseEntityInput('0xabcd', options)).toEqual({ entityId: '0xabcd', shortId: 'ABCD', resolved: false });
  expect(parseEntityInput('  ', options)).toEqual({ entityId: '', shortId: '', resolved: false });
  expect(getShortIdFromHex(`0x${'5'.padStart(64, '0')}`)).toBe('5');
});
