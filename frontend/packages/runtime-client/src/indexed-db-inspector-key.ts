import { STORAGE_ACCOUNT_FIELD_BY_TAG } from '@xln/core/storage/schema/account-field-tags';

// Retained read-only storage-key presentation; no storage writes.
export type DbKindFilter = 'all' | 'core' | 'infra';

export type DecodedBlob = {
  label: string;
  preview: string;
  pretty: string | null;
  prettyFactory?: () => string | null;
  byteLength: number;
  keyFields?: StorageKeyFields;
};

export type DbEntryView = {
  index: number;
  key: DecodedBlob;
  value: DecodedBlob;
};

export type IndexedDbMeta = {
  name: string;
  version?: number;
};

export type StorageKeyFields =
  | {
      family: 'frame-db/account';
      entityId: string;
      counterpartyId: string;
      accountHeight: number;
    }
  | {
      family: 'frame-db/runtime-activity';
      height: number;
    }
  | {
      family: 'frame-db/account-by-runtime';
      runtimeHeight: number;
      entityId: string;
      counterpartyId: string;
      accountHeight: number;
    }
  | {
      family: 'generic';
      valueFormat?: 'rebranch-branch';
    };

export const textDecoder = new TextDecoder();
export const formatBytes = (byteLength: number): string => {
  if (!Number.isFinite(byteLength) || byteLength < 0) return '-';
  if (byteLength < 1024) return `${byteLength}b`;
  if (byteLength < 1024 * 1024) return `${(byteLength / 1024).toFixed(1)}KB`;
  return `${(byteLength / (1024 * 1024)).toFixed(2)}MB`;
};

export const bytesToHex = (bytes: Uint8Array, maxBytes = 64): string => {
  const slice = bytes.slice(0, maxBytes);
  const hex = Array.from(slice, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return bytes.length > maxBytes ? `${hex}...` : hex;
};

export const bytesToFullHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

export const readU64 = (bytes: Uint8Array, offset = 1): number | null => {
  if (bytes.byteLength < offset + 8) return null;
  return Number(new DataView(bytes.buffer, bytes.byteOffset + offset, 8).getBigUint64(0, false));
};

export const readU16 = (bytes: Uint8Array, offset: number): number | null => (
  bytes.byteLength < offset + 2
    ? null
    : new DataView(bytes.buffer, bytes.byteOffset + offset, 2).getUint16(0, false)
);

export const readU32 = (bytes: Uint8Array, offset: number): number | null => (
  bytes.byteLength < offset + 4
    ? null
    : new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, false)
);

export const readEntityId = (bytes: Uint8Array, offset: number): string | null => {
  if (bytes.byteLength < offset + 32) return null;
  return `0x${bytesToFullHex(bytes.slice(offset, offset + 32))}`;
};

export const readTextAt = (bytes: Uint8Array, offset: number): string | null => {
  if (bytes.byteLength < offset + 2) return null;
  const len = new DataView(bytes.buffer, bytes.byteOffset + offset, 2).getUint16(0, false);
  if (bytes.byteLength < offset + 2 + len) return null;
  return textDecoder.decode(bytes.slice(offset + 2, offset + 2 + len));
};

export const decodeStorageKey = (bytes: Uint8Array): { label: string; fields: StorageKeyFields } | null => {
  const tag = bytes[0];
  const height = readU64(bytes, 1);
  const generic = (label: string) => ({ label, fields: { family: 'generic' } as const });
  if (tag === 0x20 && bytes.byteLength === 1) return generic('head');
  if (tag === 0x10 && height !== null) return generic(`frame/${height}`);
  if (tag === 0x11 && height !== null) return generic(`diff/${height}`);
  if (tag === 0x12 && height !== null && bytes.byteLength === 9) return generic(`snapshot/manifest/${height}`);
  if (tag === 0x21) return generic(`live/entity/${readEntityId(bytes, 1) ?? bytesToFullHex(bytes)}`);
  if (tag === 0x22) {
    const entityId = readEntityId(bytes, 1);
    const counterpartyId = readEntityId(bytes, 33);
    if (entityId && counterpartyId) return generic(`live/account/${entityId}/${counterpartyId}`);
  }
  if (tag === 0x24 && bytes.byteLength === 66) {
    const entityId = readEntityId(bytes, 1);
    const counterpartyId = readEntityId(bytes, 33);
    const field = STORAGE_ACCOUNT_FIELD_BY_TAG.get(bytes[65] ?? -1);
    if (entityId && counterpartyId && field) return generic(`live/account-field/${entityId}/${counterpartyId}/${field}`);
  }
  if (tag === 0x23) {
    const entityId = readEntityId(bytes, 1);
    const pairId = readTextAt(bytes, 33);
    if (entityId && pairId) return generic(`live/book/${entityId}/${pairId}`);
  }
  if (tag === 0x26 && bytes.byteLength === 65) {
    return generic(`live/replica-meta/${readEntityId(bytes, 1)}/${readEntityId(bytes, 33)}`);
  }
  if ((tag === 0x2a || tag === 0x2b || tag === 0x2c) && bytes.byteLength === 33) {
    const family = tag === 0x2a ? 'certified-board' : tag === 0x2b ? 'consumption' : 'account-j-claim';
    return generic(`${family}/${readEntityId(bytes, 1)}`);
  }
  if (tag === 0x31 || tag === 0x32 || tag === 0x33 || tag === 0x34) {
    const family = tag === 0x31 ? 'snapshot/entity' : tag === 0x32 ? 'snapshot/account' : 'snapshot/book';
    const entityId = readEntityId(bytes, 9);
    const resolvedFamily = tag === 0x34 ? 'snapshot/replica-meta' : family;
    if (height !== null && entityId) return generic(`${resolvedFamily}/${height}/${entityId}`);
  }
  if (tag === 0x7e) {
    const logicalKeyBytes = readU16(bytes, 1);
    if (logicalKeyBytes === null || bytes.byteLength < 3 + logicalKeyBytes + 1) return null;
    const logicalKey = bytes.slice(3, 3 + logicalKeyBytes);
    const decodedLogical = decodeStorageKey(logicalKey);
    const logicalLabel = decodedLogical?.label ?? bytesToFullHex(logicalKey);
    const kindOffset = 3 + logicalKeyBytes;
    const kind = bytes[kindOffset];
    if (kind === 0 && bytes.byteLength === kindOffset + 5) {
      const page = readU32(bytes, kindOffset + 1);
      return generic(`rebranch/${logicalLabel}/leaf/${page}`);
    }
    if (kind === 1 && bytes.byteLength >= kindOffset + 2) {
      const pathBytes = bytes[kindOffset + 1] ?? 0;
      if (bytes.byteLength !== kindOffset + 2 + pathBytes) return null;
      return {
        label: `rebranch/${logicalLabel}/branch/${bytesToFullHex(bytes.slice(kindOffset + 2)) || 'root'}`,
        fields: { family: 'generic', valueFormat: 'rebranch-branch' },
      };
    }
  }
  if (tag === 0x00 && bytes.byteLength === 1) return generic('frame-db/head');
  if (tag === 0x01 && bytes.byteLength >= 73) {
    const entityId = readEntityId(bytes, 1);
    const counterpartyId = readEntityId(bytes, 33);
    const accountHeight = readU64(bytes, 65);
    if (entityId && counterpartyId && accountHeight !== null) {
      return {
        label: `frame-db/account/${entityId}/${counterpartyId}/${accountHeight}`,
        fields: { family: 'frame-db/account', entityId, counterpartyId, accountHeight },
      };
    }
  }
  if (tag === 0x02 && height !== null) {
    return {
      label: `frame-db/runtime-activity/${height}`,
      fields: { family: 'frame-db/runtime-activity', height },
    };
  }
  if (tag === 0x04 && bytes.byteLength >= 81) {
    const entityId = readEntityId(bytes, 9);
    const counterpartyId = readEntityId(bytes, 41);
    const accountHeight = readU64(bytes, 73);
    if (height !== null && entityId && counterpartyId && accountHeight !== null) {
      return {
        label: `frame-db/account-by-core/${height}/${entityId}/${counterpartyId}/${accountHeight}`,
        fields: { family: 'frame-db/account-by-runtime', runtimeHeight: height, entityId, counterpartyId, accountHeight },
      };
    }
  }
  return null;
};
