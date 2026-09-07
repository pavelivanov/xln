import { decodeBinaryPayload } from '@xln/core/protocol/serialization/binary-codec';
import { STORAGE_ACCOUNT_FIELD_BY_TAG } from '@xln/core/storage/schema/account-field-tags';
import { bytesToFullHex, bytesToHex, decodeStorageKey, formatBytes, readU16, readU32, type DecodedBlob, type StorageKeyFields } from './indexed-db-inspector-key';
import { inspectableValue, isPrintableText, prettyStringify, summarizeDecodedValue, tryPrettyJson, withoutKeyDerivedFields } from './indexed-db-inspector-object';

const strictTextDecoder = new TextDecoder('utf-8', { fatal: true });
const printableBytes = (bytes: Uint8Array): string | null => {
  try {
    const text = strictTextDecoder.decode(bytes);
    return isPrintableText(text) ? text : null;
  } catch {
    // Unknown binary data must retain its exact bytes, not lossy UTF-8 replacements.
    return null;
  }
};

export const compactValuePreview = (blob: DecodedBlob): string => {
  const text = blob.pretty || blob.preview;
  return text.length > 900 ? `${text.slice(0, 900)}...` : text;
};

export const renderBlobPretty = (blob: DecodedBlob): string => (
  blob.pretty ?? blob.prettyFactory?.() ?? blob.preview
);
export const tryDecodeXlnBinaryPayload = (bytes: Uint8Array): unknown | null => {
  try {
    return decodeBinaryPayload(bytes);
  } catch {
    return null;
  }
};

export const asUint8Array = (value: unknown): Uint8Array | null => {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return null;
};

export const startsWith = (bytes: Uint8Array, prefix: readonly number[]): boolean => (
  bytes.byteLength >= prefix.length && prefix.every((byte, index) => bytes[index] === byte)
);

export const storageEnvelope = (bytes: Uint8Array, keyFields?: StorageKeyFields): DecodedBlob | null => {
  const accountMagic = [0x58, 0x4c, 0x4e, 0x41, 0x46, 0x01] as const;
  if (startsWith(bytes, accountMagic)) {
    const logicalBytes = readU32(bytes, 6);
    const fieldCount = readU16(bytes, 42);
    const valid = logicalBytes !== null && fieldCount !== null && bytes.byteLength === 44 + fieldCount * 33;
    const fields = valid
      ? Array.from({ length: fieldCount }, (_, index) => {
          const offset = 44 + index * 33;
          const tag = bytes[offset] ?? -1;
          return {
            tag,
            field: STORAGE_ACCOUNT_FIELD_BY_TAG.get(tag) ?? `unknown-${tag}`,
            hash: `0x${bytesToFullHex(bytes.slice(offset + 1, offset + 33))}`,
          };
        })
      : [];
    const value = {
      format: 'typed Account fields',
      valid,
      logicalBytes,
      logicalHash: `0x${bytesToFullHex(bytes.slice(10, 42))}`,
      fieldCount,
      fields,
    };
    return {
      label: valid ? 'xln/account-fields' : 'CORRUPT account-fields',
      preview: `logical=${formatBytes(logicalBytes ?? 0)} fields=${fieldCount ?? '?'} valid=${valid}`,
      pretty: prettyStringify(value),
      byteLength: bytes.byteLength,
    };
  }

  const rebranchMagic = [0x58, 0x4c, 0x4e, 0x52, 0x42, 0x01] as const;
  if (startsWith(bytes, rebranchMagic)) {
    const totalBytes = readU32(bytes, 6);
    const leafCount = readU32(bytes, 10);
    const rootKind = bytes[14] === 1 ? 'leaf' : bytes[14] === 2 ? 'branch' : 'invalid';
    const pathBytes = bytes[15] ?? 0xff;
    const hashOffset = 16 + pathBytes;
    const valid = pathBytes <= 4 && bytes.byteLength === hashOffset + 48;
    const value = {
      format: 'mutable rebranch manifest',
      valid,
      totalBytes,
      leafCount,
      rootKind,
      rootPath: bytesToFullHex(bytes.slice(16, hashOffset)),
      rootHash: `0x${bytesToFullHex(bytes.slice(hashOffset, hashOffset + 32))}`,
      checksum: `0x${bytesToFullHex(bytes.slice(hashOffset + 32, hashOffset + 48))}`,
    };
    return {
      label: valid ? 'xln/rebranch-manifest' : 'CORRUPT rebranch-manifest',
      preview: `${formatBytes(totalBytes ?? 0)} leaves=${leafCount ?? '?'} root=${rootKind} valid=${valid}`,
      pretty: prettyStringify(value),
      byteLength: bytes.byteLength,
    };
  }

  if (keyFields?.family === 'generic' && keyFields.valueFormat === 'rebranch-branch') {
    const pathBytes = bytes[1] ?? 0xff;
    const childCount = readU16(bytes, 2 + pathBytes);
    const value = {
      format: 'mutable rebranch branch',
      valid: bytes[0] === 1 && pathBytes <= 4 && childCount !== null,
      path: bytesToFullHex(bytes.slice(2, 2 + pathBytes)),
      childCount,
      physicalBytes: bytes.byteLength,
    };
    return {
      label: value.valid ? 'xln/rebranch-branch' : 'CORRUPT rebranch-branch',
      preview: `path=${value.path || 'root'} children=${childCount ?? '?'} valid=${value.valid}`,
      pretty: prettyStringify(value),
      byteLength: bytes.byteLength,
    };
  }
  return null;
};

export const decodeBlob = (value: unknown, keyFields?: StorageKeyFields): DecodedBlob => {
  if (typeof value === 'string') {
    const pretty = tryPrettyJson(value);
    return {
      label: value.length > 160 ? `${value.slice(0, 160)}...` : value,
      preview: value,
      pretty,
      byteLength: value.length,
    };
  }
  if (typeof value === 'number' || typeof value === 'boolean' || value === null || value === undefined) {
    const text = String(value);
    return {
      label: text,
      preview: text,
      pretty: null,
      byteLength: text.length,
    };
  }
  const bytes = asUint8Array(value);
  if (!bytes) {
    const text = prettyStringify(inspectableValue(value));
    return {
      label: text.length > 160 ? `${text.slice(0, 160)}...` : text,
      preview: text,
      pretty: text,
      byteLength: text.length,
    };
  }
  const envelope = storageEnvelope(bytes, keyFields);
  if (envelope) return envelope;
  const decodedPayload = tryDecodeXlnBinaryPayload(bytes);
  if (decodedPayload !== null) {
    const inspectable = inspectableValue(decodedPayload);
    const compacted = withoutKeyDerivedFields(inspectable, keyFields);
    return {
      label: 'xln/codec',
      preview: summarizeDecodedValue(compacted.value, compacted.omitted),
      pretty: null,
      prettyFactory: () => prettyStringify(compacted.value),
      byteLength: bytes.byteLength,
    };
  }
  const decodedText = printableBytes(bytes);
  if (decodedText !== null) {
    const pretty = tryPrettyJson(decodedText);
    const label = pretty ? 'json' : (decodedText.length > 160 ? `${decodedText.slice(0, 160)}...` : decodedText);
    return {
      label,
      preview: decodedText,
      pretty,
      byteLength: bytes.byteLength,
    };
  }
  const hex = bytesToHex(bytes);
  return {
    label: `binary ${bytes.byteLength}b`,
    preview: hex,
    pretty: null,
    byteLength: bytes.byteLength,
  };
};

export const decodeKeyBlob = (value: unknown): DecodedBlob => {
  const bytes = asUint8Array(value);
  if (bytes) {
    const decoded = decodeStorageKey(bytes);
    if (!decoded) {
      const decodedText = printableBytes(bytes);
      if (decodedText !== null) {
        const hex = bytesToFullHex(bytes);
        return {
          label: decodedText,
          preview: hex,
          pretty: hex,
          byteLength: bytes.byteLength,
        };
      }
    }
    const hex = bytesToFullHex(bytes);
    const base = {
      label: decoded ? decoded.label : hex,
      preview: hex,
      pretty: decoded ? hex : null,
      byteLength: bytes.byteLength,
    };
    if (decoded) return { ...base, keyFields: decoded.fields };
    return {
      ...base,
    };
  }
  const decoded = decodeBlob(value);
  return {
    ...decoded,
    label: decoded.preview,
  };
};
