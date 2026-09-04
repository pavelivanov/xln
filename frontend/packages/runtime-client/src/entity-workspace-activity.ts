import type { RuntimeAdapterReadQuery } from '@xln/core/api/public/runtime-module';
import {
  optionalString,
  requireFiniteNumber,
  requireString,
  requireUnknownRecord,
} from './boundary';
import type { EntityWorkspaceContext } from './entity-workspace-context';

export const ENTITY_WORKSPACE_ACTIVITY_PAGE_SIZES = [8, 40, 80, 160] as const;
export type EntityWorkspaceActivityPageSize = typeof ENTITY_WORKSPACE_ACTIVITY_PAGE_SIZES[number];
const DEFAULT_ACTIVITY_PAGE_SIZE: EntityWorkspaceActivityPageSize = 8;
const ACTIVITY_SCAN_LIMIT = 160;
const ACTIVITY_TIMEFRAME_SCAN_LIMIT = 1_000;
const ACTIVITY_MODES = ['paged', 'infinite', 'timeframe'] as const;
const ACTIVITY_FILTER_KINDS = ['all', 'onchain', 'offchain'] as const;
const ACTIVITY_KINDS = ['onchain', 'offchain'] as const;
const ACTIVITY_TYPES = [
  'payment', 'swap', 'cross_swap', 'htlc', 'settlement',
  'account', 'j_event', 'j_batch', 'system', 'error',
] as const;
const ACTIVITY_FILTER_TYPES = ACTIVITY_TYPES.filter((type) => type !== 'system');
const ACTIVITY_SOURCES = ['runtime_input', 'runtime_log', 'j_input'] as const;
const ACTIVITY_DIRECTIONS = ['in', 'out', 'neutral'] as const;

type ActivityKind = typeof ACTIVITY_KINDS[number];
export type EntityWorkspaceActivityMode = typeof ACTIVITY_MODES[number];
export type EntityWorkspaceActivityKind = typeof ACTIVITY_FILTER_KINDS[number];
export type EntityWorkspaceActivityType = typeof ACTIVITY_TYPES[number];
export type EntityWorkspaceActivityFilterType = Exclude<EntityWorkspaceActivityType, 'system'>;
type ActivitySource = typeof ACTIVITY_SOURCES[number];
type ActivityDirection = typeof ACTIVITY_DIRECTIONS[number];

export type EntityWorkspaceActivityEvent = Readonly<{
  id: string;
  height: number;
  timestamp: number;
  kind: ActivityKind;
  type: EntityWorkspaceActivityType;
  source: ActivitySource;
  direction: ActivityDirection;
  title: string;
  subtitle: string;
  status: string;
  counterpartyId: string | null;
  rawType: string;
}>;

type EmptyEntityWorkspaceActivity = Readonly<{ status: 'empty' }>;

type SelectedEntityWorkspaceActivity = Readonly<{
  status: 'selected';
  entityId: string;
  fromTimestamp: number | null;
  kind: EntityWorkspaceActivityKind;
  loadedPages: number;
  mode: EntityWorkspaceActivityMode;
  pageSize: EntityWorkspaceActivityPageSize;
  query: string;
  types: readonly EntityWorkspaceActivityFilterType[];
  requestedBeforeHeight: number;
  isLatestPage: boolean;
  latestHeight: number;
  fromHeight: number;
  toHeight: number;
  scannedFrames: number;
  toTimestamp: number | null;
  nextBeforeHeight: number | null;
  events: readonly EntityWorkspaceActivityEvent[];
}>;

export type EntityWorkspaceActivity =
  | EmptyEntityWorkspaceActivity
  | SelectedEntityWorkspaceActivity;

export const emptyEntityWorkspaceActivity = (): EmptyEntityWorkspaceActivity => ({ status: 'empty' });

export type EntityWorkspaceActivityQueryOptions = Readonly<{
  beforeHeight?: number;
  fromTimestamp?: number | null;
  kind?: EntityWorkspaceActivityKind;
  mode?: EntityWorkspaceActivityMode;
  pageSize?: EntityWorkspaceActivityPageSize;
  search?: string;
  toTimestamp?: number | null;
  types?: readonly EntityWorkspaceActivityFilterType[];
}>;

const integer = (value: unknown, code: string, minimum = 0): number => {
  const parsed = requireFiniteNumber(value, code);
  if (!Number.isSafeInteger(parsed) || parsed < minimum) throw new Error(code);
  return parsed;
};

const nonemptyText = (value: unknown, code: string): string => {
  const parsed = requireString(value, code).trim();
  if (!parsed) throw new Error(code);
  return parsed;
};

const enumValue = <Value extends string>(
  value: unknown,
  allowed: readonly Value[],
  code: string,
): Value => {
  if (typeof value !== 'string' || !allowed.includes(value as Value)) throw new Error(code);
  return value as Value;
};

const matchingRuntimeId = (value: unknown, context: EntityWorkspaceContext, code: string): void => {
  if (value === undefined) return;
  const runtimeId = nonemptyText(value, code);
  if (runtimeId && context.runtimeId && runtimeId !== context.runtimeId) throw new Error(code);
};

const optionalId = (value: unknown, code: string): string | null => {
  if (value === undefined) return null;
  return nonemptyText(value, code).toLowerCase();
};

const requireTimestamp = (value: unknown, code: string): number => {
  const timestamp = integer(value, code);
  if (timestamp > 8_640_000_000_000_000) {
    throw new Error(code);
  }
  return timestamp;
};

const requireOptionalTimestamp = (value: unknown, code: string): number | null =>
  value === null || value === undefined ? null : requireTimestamp(value, code);

export const requireEntityWorkspaceActivityMode = (value: unknown): EntityWorkspaceActivityMode =>
  enumValue(value, ACTIVITY_MODES, 'ENTITY_WORKSPACE_ACTIVITY_MODE_INVALID');

export const requireEntityWorkspaceActivityTimeframe = (input: Readonly<{
  fromTimestamp: unknown;
  mode: unknown;
  toTimestamp: unknown;
}>): Readonly<{ fromTimestamp: number | null; mode: EntityWorkspaceActivityMode; toTimestamp: number | null }> => {
  const mode = requireEntityWorkspaceActivityMode(input.mode);
  const fromTimestamp = requireOptionalTimestamp(input.fromTimestamp, 'ENTITY_WORKSPACE_ACTIVITY_FROM_TIMESTAMP_INVALID');
  const toTimestamp = requireOptionalTimestamp(input.toTimestamp, 'ENTITY_WORKSPACE_ACTIVITY_TO_TIMESTAMP_INVALID');
  if (mode !== 'timeframe' && (fromTimestamp !== null || toTimestamp !== null)) {
    throw new Error('ENTITY_WORKSPACE_ACTIVITY_MODE_FILTER_MISMATCH');
  }
  if (fromTimestamp !== null && toTimestamp !== null && fromTimestamp > toTimestamp) {
    throw new Error('ENTITY_WORKSPACE_ACTIVITY_TIMEFRAME_INVALID');
  }
  return { fromTimestamp, mode, toTimestamp };
};

const projectEvent = (
  value: unknown,
  context: Extract<EntityWorkspaceContext, { status: 'selected' }>,
  fromHeight: number,
  toHeight: number,
  requestedKind: EntityWorkspaceActivityKind,
  requestedTypes: readonly EntityWorkspaceActivityFilterType[],
  requestedQuery: string,
  fromTimestamp: number | null,
  toTimestamp: number | null,
): EntityWorkspaceActivityEvent => {
  const event = requireUnknownRecord(value, 'ENTITY_WORKSPACE_ACTIVITY_EVENT_INVALID');
  const height = integer(event['height'], 'ENTITY_WORKSPACE_ACTIVITY_EVENT_HEIGHT_INVALID');
  if (height < fromHeight || height > toHeight) {
    throw new Error('ENTITY_WORKSPACE_ACTIVITY_EVENT_HEIGHT_MISMATCH');
  }
  const entityId = nonemptyText(
    event['entityId'],
    'ENTITY_WORKSPACE_ACTIVITY_EVENT_ENTITY_INVALID',
  ).toLowerCase();
  if (entityId !== context.entityId) throw new Error('ENTITY_WORKSPACE_ACTIVITY_EVENT_ENTITY_MISMATCH');
  matchingRuntimeId(event['runtimeId'], context, 'ENTITY_WORKSPACE_ACTIVITY_EVENT_RUNTIME_MISMATCH');
  const kind = enumValue(event['kind'], ACTIVITY_KINDS, 'ENTITY_WORKSPACE_ACTIVITY_EVENT_KIND_INVALID');
  if (requestedKind !== 'all' && kind !== requestedKind) {
    throw new Error('ENTITY_WORKSPACE_ACTIVITY_EVENT_KIND_MISMATCH');
  }
  const type = enumValue(event['type'], ACTIVITY_TYPES, 'ENTITY_WORKSPACE_ACTIVITY_EVENT_TYPE_INVALID');
  if (requestedTypes.length > 0 && !requestedTypes.includes(type as EntityWorkspaceActivityFilterType)) {
    throw new Error('ENTITY_WORKSPACE_ACTIVITY_EVENT_TYPE_MISMATCH');
  }
  const title = nonemptyText(event['title'], 'ENTITY_WORKSPACE_ACTIVITY_EVENT_TITLE_INVALID');
  const subtitle = nonemptyText(event['subtitle'], 'ENTITY_WORKSPACE_ACTIVITY_EVENT_SUBTITLE_INVALID');
  const status = nonemptyText(event['status'], 'ENTITY_WORKSPACE_ACTIVITY_EVENT_STATUS_INVALID');
  const counterpartyId = optionalId(event['counterpartyId'], 'ENTITY_WORKSPACE_ACTIVITY_EVENT_COUNTERPARTY_INVALID');
  const rawType = nonemptyText(event['rawType'], 'ENTITY_WORKSPACE_ACTIVITY_EVENT_RAW_TYPE_INVALID');
  const searchEvidence = [
    title, subtitle, status, entityId, counterpartyId,
    optionalString(event['amount'], 'ENTITY_WORKSPACE_ACTIVITY_EVENT_AMOUNT_INVALID'),
    optionalString(event['orderId'], 'ENTITY_WORKSPACE_ACTIVITY_EVENT_ORDER_INVALID'),
    optionalString(event['hash'], 'ENTITY_WORKSPACE_ACTIVITY_EVENT_HASH_INVALID'),
    rawType,
  ].join(' ').toLowerCase();
  if (requestedQuery && !searchEvidence.includes(requestedQuery.toLowerCase())) {
    throw new Error('ENTITY_WORKSPACE_ACTIVITY_EVENT_QUERY_MISMATCH');
  }
  const timestamp = requireTimestamp(
    event['timestamp'],
    'ENTITY_WORKSPACE_ACTIVITY_EVENT_TIMESTAMP_INVALID',
  );
  if ((fromTimestamp !== null && timestamp < fromTimestamp)
    || (toTimestamp !== null && timestamp > toTimestamp)) {
    throw new Error('ENTITY_WORKSPACE_ACTIVITY_EVENT_TIMEFRAME_MISMATCH');
  }
  return {
    id: nonemptyText(event['id'], 'ENTITY_WORKSPACE_ACTIVITY_EVENT_ID_INVALID'),
    height,
    timestamp,
    kind,
    type,
    source: enumValue(event['source'], ACTIVITY_SOURCES, 'ENTITY_WORKSPACE_ACTIVITY_EVENT_SOURCE_INVALID'),
    direction: enumValue(event['direction'], ACTIVITY_DIRECTIONS, 'ENTITY_WORKSPACE_ACTIVITY_EVENT_DIRECTION_INVALID'),
    title,
    subtitle,
    status,
    counterpartyId,
    rawType,
  };
};

const requireCursor = (value: unknown, fromHeight: number): number | null => {
  if (value === null) {
    if (fromHeight > 1) throw new Error('ENTITY_WORKSPACE_ACTIVITY_CURSOR_MISMATCH');
    return null;
  }
  const cursor = integer(value, 'ENTITY_WORKSPACE_ACTIVITY_CURSOR_INVALID', 1);
  if (cursor !== fromHeight - 1) throw new Error('ENTITY_WORKSPACE_ACTIVITY_CURSOR_MISMATCH');
  return cursor;
};

const requireFilters = (
  value: unknown,
  context: Extract<EntityWorkspaceContext, { status: 'selected' }>,
  beforeHeight: number,
  kind: EntityWorkspaceActivityKind,
  pageSize: EntityWorkspaceActivityPageSize,
  types: readonly EntityWorkspaceActivityFilterType[],
  query: string,
  fromTimestamp: number | null,
  toTimestamp: number | null,
  scanLimit: number,
): void => {
  const filters = requireUnknownRecord(value, 'ENTITY_WORKSPACE_ACTIVITY_FILTERS_INVALID');
  if (optionalString(filters['entityId'], 'ENTITY_WORKSPACE_ACTIVITY_FILTER_ENTITY_INVALID')?.trim().toLowerCase() !== context.entityId) {
    throw new Error('ENTITY_WORKSPACE_ACTIVITY_FILTER_ENTITY_MISMATCH');
  }
  if (filters['kind'] !== kind) throw new Error('ENTITY_WORKSPACE_ACTIVITY_FILTER_KIND_MISMATCH');
  const returnedTypes = filters['types'] === undefined
    ? []
    : requireEntityWorkspaceActivityTypes(filters['types']);
  if (returnedTypes.length !== types.length || returnedTypes.some((type, index) => type !== types[index])) {
    throw new Error('ENTITY_WORKSPACE_ACTIVITY_FILTER_TYPES_MISMATCH');
  }
  const returnedQuery = optionalString(filters['query'], 'ENTITY_WORKSPACE_ACTIVITY_FILTER_QUERY_INVALID')?.trim() ?? '';
  if (returnedQuery !== query) throw new Error('ENTITY_WORKSPACE_ACTIVITY_FILTER_QUERY_MISMATCH');
  const returnedFromTimestamp = requireOptionalTimestamp(
    filters['fromTimestamp'], 'ENTITY_WORKSPACE_ACTIVITY_FILTER_FROM_TIMESTAMP_INVALID',
  );
  const returnedToTimestamp = requireOptionalTimestamp(
    filters['toTimestamp'], 'ENTITY_WORKSPACE_ACTIVITY_FILTER_TO_TIMESTAMP_INVALID',
  );
  if (returnedFromTimestamp !== fromTimestamp || returnedToTimestamp !== toTimestamp) {
    throw new Error('ENTITY_WORKSPACE_ACTIVITY_FILTER_TIMEFRAME_MISMATCH');
  }
  if (filters['beforeHeight'] !== beforeHeight) throw new Error('ENTITY_WORKSPACE_ACTIVITY_FILTER_HEIGHT_MISMATCH');
  if (filters['limit'] !== pageSize || filters['scanLimit'] !== scanLimit) {
    throw new Error('ENTITY_WORKSPACE_ACTIVITY_FILTER_BOUNDS_MISMATCH');
  }
};

const requireBeforeHeight = (value: unknown, contextHeight: number): number => {
  const beforeHeight = integer(value, 'ENTITY_WORKSPACE_ACTIVITY_BEFORE_HEIGHT_INVALID', 1);
  if (beforeHeight > contextHeight) throw new Error('ENTITY_WORKSPACE_ACTIVITY_BEFORE_HEIGHT_INVALID');
  return beforeHeight;
};

export const requireEntityWorkspaceActivityKind = (
  value: unknown,
): EntityWorkspaceActivityKind =>
  enumValue(value, ACTIVITY_FILTER_KINDS, 'ENTITY_WORKSPACE_ACTIVITY_KIND_INVALID');

export const requireEntityWorkspaceActivityFilterType = (
  value: unknown,
): EntityWorkspaceActivityFilterType =>
  enumValue(value, ACTIVITY_FILTER_TYPES, 'ENTITY_WORKSPACE_ACTIVITY_TYPE_INVALID');

export const requireEntityWorkspaceActivitySearch = (value: unknown): string =>
  requireString(value, 'ENTITY_WORKSPACE_ACTIVITY_QUERY_INVALID').trim();

export const requireEntityWorkspaceActivityPageSize = (
  value: unknown,
): EntityWorkspaceActivityPageSize => {
  const pageSize = integer(value, 'ENTITY_WORKSPACE_ACTIVITY_PAGE_SIZE_INVALID', 1);
  if (!ENTITY_WORKSPACE_ACTIVITY_PAGE_SIZES.includes(pageSize as EntityWorkspaceActivityPageSize)) {
    throw new Error('ENTITY_WORKSPACE_ACTIVITY_PAGE_SIZE_INVALID');
  }
  return pageSize as EntityWorkspaceActivityPageSize;
};

const requireEntityWorkspaceActivityTypes = (
  value: unknown,
): readonly EntityWorkspaceActivityFilterType[] => {
  if (!Array.isArray(value) || value.length > ACTIVITY_FILTER_TYPES.length) {
    throw new Error('ENTITY_WORKSPACE_ACTIVITY_TYPES_INVALID');
  }
  const types = value.map(requireEntityWorkspaceActivityFilterType);
  if (new Set(types).size !== types.length) throw new Error('ENTITY_WORKSPACE_ACTIVITY_TYPES_INVALID');
  return types;
};

const requireActivityQuery = (
  context: Extract<EntityWorkspaceContext, { status: 'selected' }>,
  input: EntityWorkspaceActivityQueryOptions,
) => {
  const timeframe = requireEntityWorkspaceActivityTimeframe({
    fromTimestamp: input.fromTimestamp ?? null,
    mode: input.mode ?? 'paged',
    toTimestamp: input.toTimestamp ?? null,
  });
  return {
    beforeHeight: requireBeforeHeight(input.beforeHeight ?? context.height, context.height),
    kind: requireEntityWorkspaceActivityKind(input.kind ?? 'all'),
    pageSize: requireEntityWorkspaceActivityPageSize(input.pageSize ?? DEFAULT_ACTIVITY_PAGE_SIZE),
    query: requireEntityWorkspaceActivitySearch(input.search ?? ''),
    scanLimit: timeframe.mode === 'timeframe' ? ACTIVITY_TIMEFRAME_SCAN_LIMIT : ACTIVITY_SCAN_LIMIT,
    timeframe,
    types: requireEntityWorkspaceActivityTypes(input.types ?? []),
  };
};

export const buildEntityWorkspaceActivityQuery = (
  context: EntityWorkspaceContext,
  input: EntityWorkspaceActivityQueryOptions = {},
): RuntimeAdapterReadQuery => {
  if (context.status !== 'selected' || context.height < 1) {
    throw new Error('ENTITY_WORKSPACE_ACTIVITY_CONTEXT_REQUIRED');
  }
  const request = requireActivityQuery(context, input);
  return {
    beforeHeight: request.beforeHeight,
    entityId: context.entityId,
    kind: request.kind,
    limit: request.pageSize,
    scanLimit: request.scanLimit,
    ...(request.types.length === 0 ? {} : { types: [...request.types] }),
    ...(request.query ? { q: request.query } : {}),
    ...(request.timeframe.fromTimestamp === null ? {} : { fromTimestamp: request.timeframe.fromTimestamp }),
    ...(request.timeframe.toTimestamp === null ? {} : { toTimestamp: request.timeframe.toTimestamp }),
  };
};

export function projectEntityWorkspaceActivity(input: Readonly<{
  beforeHeight?: number;
  context: EntityWorkspaceContext;
  fromTimestamp?: number | null;
  kind?: EntityWorkspaceActivityKind;
  mode?: EntityWorkspaceActivityMode;
  page?: unknown;
  pageSize?: EntityWorkspaceActivityPageSize;
  search?: string;
  toTimestamp?: number | null;
  types?: readonly EntityWorkspaceActivityFilterType[];
}>): EntityWorkspaceActivity {
  if (input.context.status === 'empty') return emptyEntityWorkspaceActivity();
  const context = input.context;
  const request = requireActivityQuery(context, input);
  const page = requireUnknownRecord(input.page, 'ENTITY_WORKSPACE_ACTIVITY_PAGE_INVALID');
  if (page['ok'] !== true) throw new Error('ENTITY_WORKSPACE_ACTIVITY_READ_FAILED');
  matchingRuntimeId(page['runtimeId'], context, 'ENTITY_WORKSPACE_ACTIVITY_RUNTIME_MISMATCH');
  requireFilters(
    page['filters'], context, request.beforeHeight, request.kind,
    request.pageSize, request.types, request.query,
    request.timeframe.fromTimestamp, request.timeframe.toTimestamp, request.scanLimit,
  );

  const latestHeight = integer(page['latestHeight'], 'ENTITY_WORKSPACE_ACTIVITY_LATEST_HEIGHT_INVALID');
  const fromHeight = integer(page['fromHeight'], 'ENTITY_WORKSPACE_ACTIVITY_FROM_HEIGHT_INVALID');
  const toHeight = integer(page['toHeight'], 'ENTITY_WORKSPACE_ACTIVITY_TO_HEIGHT_INVALID');
  const scannedFrames = integer(page['scannedFrames'], 'ENTITY_WORKSPACE_ACTIVITY_SCANNED_INVALID');
  const returned = integer(page['returned'], 'ENTITY_WORKSPACE_ACTIVITY_RETURNED_INVALID');
  const limit = integer(page['limit'], 'ENTITY_WORKSPACE_ACTIVITY_LIMIT_INVALID', 1);
  const scanLimit = integer(page['scanLimit'], 'ENTITY_WORKSPACE_ACTIVITY_SCAN_LIMIT_INVALID', 1);
  if (limit !== request.pageSize || scanLimit !== request.scanLimit) {
    throw new Error('ENTITY_WORKSPACE_ACTIVITY_BOUNDS_MISMATCH');
  }
  if (!Array.isArray(page['events']) || returned !== page['events'].length || returned > limit) {
    throw new Error('ENTITY_WORKSPACE_ACTIVITY_RETURNED_MISMATCH');
  }

  if (latestHeight === 0) {
    if (fromHeight !== 0 || toHeight !== 0 || scannedFrames !== 0 || returned !== 0 || page['nextBeforeHeight'] !== null) {
      throw new Error('ENTITY_WORKSPACE_ACTIVITY_EMPTY_METADATA_MISMATCH');
    }
    return {
      status: 'selected', entityId: context.entityId, kind: request.kind,
      fromTimestamp: request.timeframe.fromTimestamp, mode: request.timeframe.mode,
      loadedPages: 1, pageSize: request.pageSize,
      query: request.query, toTimestamp: request.timeframe.toTimestamp,
      types: request.types, requestedBeforeHeight: request.beforeHeight,
      isLatestPage: request.beforeHeight === context.height, latestHeight,
      fromHeight, toHeight, scannedFrames, nextBeforeHeight: null, events: [],
    };
  }

  const expectedToHeight = Math.min(latestHeight, request.beforeHeight);
  if (fromHeight < 1 || fromHeight > toHeight || toHeight !== expectedToHeight) {
    throw new Error('ENTITY_WORKSPACE_ACTIVITY_HEIGHT_RANGE_MISMATCH');
  }
  if (scannedFrames !== toHeight - fromHeight + 1 || scannedFrames > scanLimit) {
    throw new Error('ENTITY_WORKSPACE_ACTIVITY_SCAN_RANGE_MISMATCH');
  }
  const events = page['events'].map((event) =>
    projectEvent(
      event, context, fromHeight, toHeight, request.kind, request.types,
      request.query, request.timeframe.fromTimestamp, request.timeframe.toTimestamp,
    ));
  if (new Set(events.map(({ id }) => id)).size !== events.length) {
    throw new Error('ENTITY_WORKSPACE_ACTIVITY_EVENT_ID_DUPLICATE');
  }
  return {
    status: 'selected', entityId: context.entityId, kind: request.kind,
    fromTimestamp: request.timeframe.fromTimestamp, mode: request.timeframe.mode,
    loadedPages: 1, pageSize: request.pageSize,
    query: request.query, toTimestamp: request.timeframe.toTimestamp,
    types: request.types, requestedBeforeHeight: request.beforeHeight,
    isLatestPage: request.beforeHeight === context.height, latestHeight,
    fromHeight, toHeight, scannedFrames,
    nextBeforeHeight: requireCursor(page['nextBeforeHeight'], fromHeight),
    events,
  };
}

const sameActivityRequest = (
  left: SelectedEntityWorkspaceActivity,
  right: SelectedEntityWorkspaceActivity,
): boolean => left.entityId === right.entityId
  && left.kind === right.kind
  && left.mode === 'infinite'
  && right.mode === 'infinite'
  && left.pageSize === right.pageSize
  && left.query === right.query
  && left.fromTimestamp === right.fromTimestamp
  && left.toTimestamp === right.toTimestamp
  && left.types.length === right.types.length
  && left.types.every((type, index) => type === right.types[index]);

export function appendEntityWorkspaceActivityPage(
  previous: EntityWorkspaceActivity,
  next: EntityWorkspaceActivity,
): EntityWorkspaceActivity {
  if (previous.status !== 'selected' || next.status !== 'selected' || !sameActivityRequest(previous, next)) {
    throw new Error('ENTITY_WORKSPACE_ACTIVITY_APPEND_CONTEXT_MISMATCH');
  }
  if (previous.nextBeforeHeight === null || next.requestedBeforeHeight !== previous.nextBeforeHeight
    || next.toHeight !== previous.fromHeight - 1 || next.latestHeight !== previous.latestHeight) {
    throw new Error('ENTITY_WORKSPACE_ACTIVITY_APPEND_CURSOR_MISMATCH');
  }
  const events = [...previous.events, ...next.events];
  if (new Set(events.map(({ id }) => id)).size !== events.length) {
    throw new Error('ENTITY_WORKSPACE_ACTIVITY_APPEND_EVENT_DUPLICATE');
  }
  return {
    ...next,
    events,
    loadedPages: previous.loadedPages + 1,
    scannedFrames: previous.scannedFrames + next.scannedFrames,
    toHeight: previous.toHeight,
  };
}
