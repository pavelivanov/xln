import { compareStableText } from '../../../packages/ui/src/stable-compare';
import {
  optionalRuntimeInteger,
  optionalRuntimeString,
  requireRuntimeInteger,
  requireRuntimeRecord,
} from './wallet-runtime-decode';

export const WALLET_ADDRESS_ENTITY_ID_PATTERN = /^0x[0-9a-f]{64}$/;

export type WalletAddressEntity = Readonly<{
  entityId: string;
  runtimeId: string;
  name: string;
  isHub: boolean;
  online: boolean;
  lastUpdated: number;
  capabilities: readonly string[];
  jurisdictionName: string;
}>;

export type WalletAddressDetail = WalletAddressEntity & Readonly<{
  profile: Readonly<{ bio: string; website: string }>;
  jurisdiction: Readonly<{
    name: string;
    address: string;
    chainId: string;
    depositoryAddress: string;
    entityProviderAddress: string;
  }>;
  accounts: Readonly<{ shown: number; total: number; hasMore: boolean }>;
  books: Readonly<{ shown: number; total: number; hasMore: boolean }>;
}>;

export type WalletAddressRuntimeContext = Readonly<{
  runtimeId: string;
  online: boolean;
  height: number;
}>;

export const normalizeWalletAddressEntityId = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

export const isWalletAddressEntityId = (value: unknown): boolean =>
  WALLET_ADDRESS_ENTITY_ID_PATTERN.test(normalizeWalletAddressEntityId(value));

const optionalJurisdiction = (value: unknown): Record<string, unknown> | null => {
  if (value === undefined || value === null) return null;
  return requireRuntimeRecord(value, 'WALLET_ADDRESS_JURISDICTION');
};

const jurisdictionText = (
  value: Record<string, unknown> | null,
  key: string,
  label: string,
): string => optionalRuntimeString(value?.[key], label) ?? '';

const decodeSummary = (
  value: unknown,
  context: WalletAddressRuntimeContext,
): WalletAddressEntity => {
  const summary = requireRuntimeRecord(value, 'WALLET_ADDRESS_SUMMARY');
  const entityId = normalizeWalletAddressEntityId(summary['entityId']);
  if (!WALLET_ADDRESS_ENTITY_ID_PATTERN.test(entityId)) {
    throw new Error(`WALLET_ADDRESS_ENTITY_ID_INVALID:${entityId || 'missing'}`);
  }
  const runtimeId = (optionalRuntimeString(summary['runtimeId'], 'WALLET_ADDRESS_RUNTIME_ID')
    ?? context.runtimeId).toLowerCase();
  const jurisdiction = optionalJurisdiction(summary['jurisdiction']);
  const name = optionalRuntimeString(summary['label'], 'WALLET_ADDRESS_LABEL') ?? entityId;
  const isHub = summary['isHub'] === true;
  const lastUpdated = optionalRuntimeInteger(
    summary['height'],
    context.height,
    'WALLET_ADDRESS_HEIGHT',
  );
  return {
    entityId,
    runtimeId,
    name,
    isHub,
    online: context.online,
    lastUpdated,
    capabilities: isHub ? ['entity', 'hub', 'routing'] : ['entity'],
    jurisdictionName: jurisdictionText(jurisdiction, 'name', 'WALLET_ADDRESS_JURISDICTION_NAME'),
  };
};

const compareDirectoryEntities = (left: WalletAddressEntity, right: WalletAddressEntity): number => {
  if (left.isHub !== right.isHub) return left.isHub ? -1 : 1;
  if (left.online !== right.online) return left.online ? -1 : 1;
  if (left.lastUpdated !== right.lastUpdated) return right.lastUpdated - left.lastUpdated;
  return compareStableText(left.entityId, right.entityId);
};

export const decodeWalletAddressDirectory = (
  value: unknown,
  context: WalletAddressRuntimeContext,
): readonly WalletAddressEntity[] => {
  if (!Array.isArray(value)) throw new Error('WALLET_ADDRESS_DIRECTORY_INVALID');
  const entities = value.map((summary) => decodeSummary(summary, context));
  const ids = entities.map(({ entityId }) => entityId);
  if (new Set(ids).size !== ids.length) throw new Error('WALLET_ADDRESS_DIRECTORY_DUPLICATE');
  return entities.sort(compareDirectoryEntities);
};

export const filterWalletAddressDirectory = (
  entities: readonly WalletAddressEntity[],
  search: string,
): readonly WalletAddressEntity[] => {
  const query = search.trim().toLowerCase();
  if (!query) return [...entities];
  return entities.filter((entity) => [
    entity.entityId,
    entity.runtimeId,
    entity.name,
    entity.jurisdictionName,
    ...entity.capabilities,
  ].some((field) => field.toLowerCase().includes(query)));
};

const pageFacts = (
  value: unknown,
  label: string,
): Readonly<{ shown: number; total: number; hasMore: boolean }> => {
  const page = requireRuntimeRecord(value, label);
  if (!Array.isArray(page['items'])) throw new Error(`${label}_ITEMS_INVALID`);
  const shown = page['items'].length;
  const total = optionalRuntimeInteger(page['totalItems'], shown, `${label}_TOTAL`);
  if (total < shown) throw new Error(`${label}_TOTAL_INVALID`);
  return { shown, total, hasMore: Boolean(page['nextCursor']) };
};

export const buildWalletAddressSummaryDetail = (
  summary: WalletAddressEntity,
): WalletAddressDetail => ({
  ...summary,
  profile: { bio: '', website: '' },
  jurisdiction: {
    name: summary.jurisdictionName,
    address: '',
    chainId: '',
    depositoryAddress: '',
    entityProviderAddress: '',
  },
  accounts: { shown: 0, total: 0, hasMore: false },
  books: { shown: 0, total: 0, hasMore: false },
});

export const decodeWalletAddressDetail = (
  value: unknown,
  requestedEntityId: string,
  fallback: WalletAddressEntity | null,
  context: WalletAddressRuntimeContext,
): WalletAddressDetail | null => {
  const normalized = normalizeWalletAddressEntityId(requestedEntityId);
  if (!WALLET_ADDRESS_ENTITY_ID_PATTERN.test(normalized)) {
    throw new Error(`WALLET_ADDRESS_ENTITY_ID_INVALID:${normalized || 'missing'}`);
  }
  const frame = requireRuntimeRecord(value, 'WALLET_ADDRESS_FRAME');
  const active = frame['activeEntity'];
  if (active === null || active === undefined) return fallback ? buildWalletAddressSummaryDetail(fallback) : null;
  const activeEntity = requireRuntimeRecord(active, 'WALLET_ADDRESS_ACTIVE_ENTITY');
  const summary = decodeSummary(activeEntity['summary'], {
    ...context,
    height: requireRuntimeInteger(frame['height'], 'WALLET_ADDRESS_FRAME_HEIGHT'),
  });
  if (summary.entityId !== normalized) throw new Error('WALLET_ADDRESS_ACTIVE_ENTITY_MISMATCH');
  const core = requireRuntimeRecord(activeEntity['core'], 'WALLET_ADDRESS_CORE');
  const profile = requireRuntimeRecord(core['profile'], 'WALLET_ADDRESS_PROFILE');
  const jurisdiction = optionalJurisdiction(requireRuntimeRecord(activeEntity['summary'], 'WALLET_ADDRESS_SUMMARY')['jurisdiction']);
  const accounts = pageFacts(activeEntity['accounts'], 'WALLET_ADDRESS_ACCOUNTS');
  const books = pageFacts(activeEntity['books'], 'WALLET_ADDRESS_BOOKS');
  const isHub = summary.isHub || profile['isHub'] === true || Boolean(core['orderbookHubProfile']);
  const capabilities = [
    'entity',
    ...(isHub ? ['hub', 'routing'] : []),
    ...(accounts.total > 0 ? ['accounts'] : []),
    ...(books.total > 0 ? ['books'] : []),
  ];
  return {
    ...summary,
    name: optionalRuntimeString(profile['name'], 'WALLET_ADDRESS_PROFILE_NAME') ?? summary.name,
    isHub,
    capabilities,
    profile: {
      bio: optionalRuntimeString(profile['bio'], 'WALLET_ADDRESS_PROFILE_BIO') ?? '',
      website: optionalRuntimeString(profile['website'], 'WALLET_ADDRESS_PROFILE_WEBSITE') ?? '',
    },
    jurisdiction: {
      name: jurisdictionText(jurisdiction, 'name', 'WALLET_ADDRESS_JURISDICTION_NAME'),
      address: jurisdictionText(jurisdiction, 'address', 'WALLET_ADDRESS_JURISDICTION_ADDRESS'),
      chainId: jurisdiction?.['chainId'] === undefined ? '' : String(jurisdiction['chainId']),
      depositoryAddress: jurisdictionText(jurisdiction, 'depositoryAddress', 'WALLET_ADDRESS_DEPOSITORY'),
      entityProviderAddress: jurisdictionText(jurisdiction, 'entityProviderAddress', 'WALLET_ADDRESS_PROVIDER'),
    },
    accounts,
    books,
  };
};
