import { expect, test } from 'bun:test';
import { encodeBinaryPayload } from '../../../core/protocol/serialization/binary-codec';
import { decodeBlob, decodeKeyBlob, renderBlobPretty } from '../../../frontend/packages/runtime-client/src/storage/indexed-db-inspector-value';

test('inspector decodes a canonical storage key and binary payload without losing bigint values', () => {
  expect(decodeKeyBlob(new Uint8Array([0x20])).label).toBe('head');
  const blob = decodeBlob(encodeBinaryPayload({ amount: 9007199254740993n, tokens: new Map([[1, 5n]]) }));
  expect(blob.label).toBe('xln/codec');
  expect(renderBlobPretty(blob)).toContain('9007199254740993n');
  expect(renderBlobPretty(blob)).toContain('"1": "5n"');
});

test('inspector renders native IndexedDB bigint objects and keeps undecodable bytes inspectable', () => {
  expect(renderBlobPretty(decodeBlob({ amount: 9007199254740993n }))).toContain('9007199254740993n');
  const blob = decodeBlob(new Uint8Array([0xff, 0xfe, 0xfd]));
  expect(blob.byteLength).toBe(3);
  expect(renderBlobPretty(blob)).toContain('fffefd');
});
