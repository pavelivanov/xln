import { safeStringify } from '@xln/core/protocol/serialization';
import { parseJsonUnknown } from '../boundary';
import { bytesToFullHex, type StorageKeyFields } from './indexed-db-inspector-key';

export const isPrintableText = (text: string): boolean => {
  if (!text) return false;
  let printable = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (
      code === 9 ||
      code === 10 ||
      code === 13 ||
      (code >= 32 && code <= 126) ||
      code >= 160
    ) {
      printable += 1;
    }
  }
  return printable / text.length > 0.9;
};

export const tryPrettyJson = (text: string): string | null => {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[') && !trimmed.startsWith('"')) {
    return null;
  }
  try {
    return safeStringify(parseJsonUnknown(trimmed, 'INDEXED_DB_INSPECTOR_JSON_INVALID'), 2);
  } catch {
    return null;
  }
};

export const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  !!value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Uint8Array)
);

export const inspectableValue = (value: unknown): unknown => {
  if (typeof value === 'bigint') return `${value.toString()}n`;
  if (value instanceof Uint8Array) return `0x${bytesToFullHex(value)}`;
  if (value instanceof ArrayBuffer) return `0x${bytesToFullHex(new Uint8Array(value))}`;
  if (ArrayBuffer.isView(value)) {
    return `0x${bytesToFullHex(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))}`;
  }
  if (value instanceof Map) {
    return Object.fromEntries(Array.from(value.entries()).map(([key, entryValue]) => [String(key), inspectableValue(entryValue)]));
  }
  if (value instanceof Set) return Array.from(value.values()).map(inspectableValue);
  if (Array.isArray(value)) return value.map(inspectableValue);
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(value)) out[key] = inspectableValue(entryValue);
    return out;
  }
  return value;
};

export const sameStorageValue = (left: unknown, right: unknown): boolean => (
  String(left ?? '').toLowerCase() === String(right ?? '').toLowerCase()
);

export const withoutKeyDerivedFields = (
  value: unknown,
  keyFields?: StorageKeyFields,
): { value: unknown; omitted: string[] } => {
  if (!keyFields || !isPlainObject(value)) return { value, omitted: [] };
  const out = { ...value };
  const omitted: string[] = [];
  const omitIfSame = (field: string, expected: unknown): void => {
    if (!(field in out)) return;
    if (!sameStorageValue(out[field], expected)) return;
    delete out[field];
    omitted.push(field);
  };
  if (keyFields.family === 'frame-db/account') {
    omitIfSame('kind', 'accountFrame');
    omitIfSame('entityId', keyFields.entityId);
    omitIfSame('counterpartyId', keyFields.counterpartyId);
    omitIfSame('accountHeight', keyFields.accountHeight);
  } else if (keyFields.family === 'frame-db/runtime-activity') {
    omitIfSame('kind', 'runtimeActivity');
    omitIfSame('height', keyFields.height);
  } else if (keyFields.family === 'frame-db/account-by-runtime') {
    omitIfSame('kind', 'accountFrame');
    omitIfSame('runtimeHeight', keyFields.runtimeHeight);
    omitIfSame('entityId', keyFields.entityId);
    omitIfSame('counterpartyId', keyFields.counterpartyId);
    omitIfSame('accountHeight', keyFields.accountHeight);
  }
  return { value: out, omitted };
};

export const prettyStringify = (value: unknown): string => safeStringify(value, 2) ?? String(value);

export const summarizeInline = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.length}]`;
  if (isPlainObject(value)) {
    if ('height' in value && 'accountTxs' in value && 'deltas' in value) {
      const txCount = Array.isArray(value['accountTxs']) ? value['accountTxs'].length : '?';
      const deltaCount = Array.isArray(value['deltas']) ? value['deltas'].length : '?';
      return `{height=${value['height']} txs=${txCount} deltas=${deltaCount}}`;
    }
    return `{${Object.keys(value).length} fields}`;
  }
  const text = String(value);
  return text.length > 72 ? `${text.slice(0, 72)}...` : text;
};

export const summarizeDecodedValue = (value: unknown, omitted: string[]): string => {
  if (!isPlainObject(value)) return summarizeInline(value);
  const parts = Object.entries(value)
    .slice(0, 8)
    .map(([key, entryValue]) => `${key}=${summarizeInline(entryValue)}`);
  if (omitted.length > 0) parts.push(`key-derived omitted: ${omitted.join(',')}`);
  return parts.join('  ');
};
