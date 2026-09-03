import type { RuntimeAdapterReadQuery } from '@xln/core/api/public/runtime-module';
import {
  optionalString,
  requireFiniteNumber,
  requireString,
  requireUnknownRecord,
} from './boundary';
import type { EntityWorkspaceContext } from './entity-workspace-context';

const ACTIVITY_LIMIT = 8;
const ACTIVITY_SCAN_LIMIT = 160;
const ACTIVITY_KINDS = ['onchain', 'offchain'] as const;
const ACTIVITY_TYPES = [
  'payment', 'swap', 'cross_swap', 'htlc', 'settlement',
  'account', 'j_event', 'j_batch', 'system', 'error',
] as const;
const ACTIVITY_SOURCES = ['runtime_input', 'runtime_log', 'j_input'] as const;
const ACTIVITY_DIRECTIONS = ['in', 'out', 'neutral'] as const;

type ActivityKind = typeof ACTIVITY_KINDS[number];
type ActivityType = typeof ACTIVITY_TYPES[number];
type ActivitySource = typeof ACTIVITY_SOURCES[number];
type ActivityDirection = typeof ACTIVITY_DIRECTIONS[number];

export type EntityWorkspaceActivityEvent = Readonly<{
  id: string;
  height: number;
  timestamp: number;
  kind: ActivityKind;
  type: ActivityType;
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
  requestedBeforeHeight: number;
  isLatestPage: boolean;
  latestHeight: number;
  fromHeight: number;
  toHeight: number;
  scannedFrames: number;
  nextBeforeHeight: number | null;
  events: readonly EntityWorkspaceActivityEvent[];
}>;

export type EntityWorkspaceActivity =
  | EmptyEntityWorkspaceActivity
  | SelectedEntityWorkspaceActivity;

export const emptyEntityWorkspaceActivity = (): EmptyEntityWorkspaceActivity => ({ status: 'empty' });

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

const projectEvent = (
  value: unknown,
  context: Extract<EntityWorkspaceContext, { status: 'selected' }>,
  fromHeight: number,
  toHeight: number,
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
  return {
    id: nonemptyText(event['id'], 'ENTITY_WORKSPACE_ACTIVITY_EVENT_ID_INVALID'),
    height,
    timestamp: integer(event['timestamp'], 'ENTITY_WORKSPACE_ACTIVITY_EVENT_TIMESTAMP_INVALID'),
    kind: enumValue(event['kind'], ACTIVITY_KINDS, 'ENTITY_WORKSPACE_ACTIVITY_EVENT_KIND_INVALID'),
    type: enumValue(event['type'], ACTIVITY_TYPES, 'ENTITY_WORKSPACE_ACTIVITY_EVENT_TYPE_INVALID'),
    source: enumValue(event['source'], ACTIVITY_SOURCES, 'ENTITY_WORKSPACE_ACTIVITY_EVENT_SOURCE_INVALID'),
    direction: enumValue(event['direction'], ACTIVITY_DIRECTIONS, 'ENTITY_WORKSPACE_ACTIVITY_EVENT_DIRECTION_INVALID'),
    title: nonemptyText(event['title'], 'ENTITY_WORKSPACE_ACTIVITY_EVENT_TITLE_INVALID'),
    subtitle: nonemptyText(event['subtitle'], 'ENTITY_WORKSPACE_ACTIVITY_EVENT_SUBTITLE_INVALID'),
    status: nonemptyText(event['status'], 'ENTITY_WORKSPACE_ACTIVITY_EVENT_STATUS_INVALID'),
    counterpartyId: optionalId(event['counterpartyId'], 'ENTITY_WORKSPACE_ACTIVITY_EVENT_COUNTERPARTY_INVALID'),
    rawType: nonemptyText(event['rawType'], 'ENTITY_WORKSPACE_ACTIVITY_EVENT_RAW_TYPE_INVALID'),
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
): void => {
  const filters = requireUnknownRecord(value, 'ENTITY_WORKSPACE_ACTIVITY_FILTERS_INVALID');
  if (optionalString(filters['entityId'], 'ENTITY_WORKSPACE_ACTIVITY_FILTER_ENTITY_INVALID')?.trim().toLowerCase() !== context.entityId) {
    throw new Error('ENTITY_WORKSPACE_ACTIVITY_FILTER_ENTITY_MISMATCH');
  }
  if (filters['kind'] !== 'all') throw new Error('ENTITY_WORKSPACE_ACTIVITY_FILTER_KIND_MISMATCH');
  if (filters['beforeHeight'] !== beforeHeight) throw new Error('ENTITY_WORKSPACE_ACTIVITY_FILTER_HEIGHT_MISMATCH');
  if (filters['limit'] !== ACTIVITY_LIMIT || filters['scanLimit'] !== ACTIVITY_SCAN_LIMIT) {
    throw new Error('ENTITY_WORKSPACE_ACTIVITY_FILTER_BOUNDS_MISMATCH');
  }
};

const requireBeforeHeight = (value: unknown, contextHeight: number): number => {
  const beforeHeight = integer(value, 'ENTITY_WORKSPACE_ACTIVITY_BEFORE_HEIGHT_INVALID', 1);
  if (beforeHeight > contextHeight) throw new Error('ENTITY_WORKSPACE_ACTIVITY_BEFORE_HEIGHT_INVALID');
  return beforeHeight;
};

export const buildEntityWorkspaceActivityQuery = (
  context: EntityWorkspaceContext,
  beforeHeight: number = context.height,
): RuntimeAdapterReadQuery => {
  if (context.status !== 'selected' || context.height < 1) {
    throw new Error('ENTITY_WORKSPACE_ACTIVITY_CONTEXT_REQUIRED');
  }
  const requestedBeforeHeight = requireBeforeHeight(beforeHeight, context.height);
  return {
    beforeHeight: requestedBeforeHeight,
    entityId: context.entityId,
    kind: 'all',
    limit: ACTIVITY_LIMIT,
    scanLimit: ACTIVITY_SCAN_LIMIT,
  };
};

export function projectEntityWorkspaceActivity(input: Readonly<{
  beforeHeight?: number;
  context: EntityWorkspaceContext;
  page?: unknown;
}>): EntityWorkspaceActivity {
  if (input.context.status === 'empty') return emptyEntityWorkspaceActivity();
  const context = input.context;
  const requestedBeforeHeight = requireBeforeHeight(input.beforeHeight ?? context.height, context.height);
  const page = requireUnknownRecord(input.page, 'ENTITY_WORKSPACE_ACTIVITY_PAGE_INVALID');
  if (page['ok'] !== true) throw new Error('ENTITY_WORKSPACE_ACTIVITY_READ_FAILED');
  matchingRuntimeId(page['runtimeId'], context, 'ENTITY_WORKSPACE_ACTIVITY_RUNTIME_MISMATCH');
  requireFilters(page['filters'], context, requestedBeforeHeight);

  const latestHeight = integer(page['latestHeight'], 'ENTITY_WORKSPACE_ACTIVITY_LATEST_HEIGHT_INVALID');
  const fromHeight = integer(page['fromHeight'], 'ENTITY_WORKSPACE_ACTIVITY_FROM_HEIGHT_INVALID');
  const toHeight = integer(page['toHeight'], 'ENTITY_WORKSPACE_ACTIVITY_TO_HEIGHT_INVALID');
  const scannedFrames = integer(page['scannedFrames'], 'ENTITY_WORKSPACE_ACTIVITY_SCANNED_INVALID');
  const returned = integer(page['returned'], 'ENTITY_WORKSPACE_ACTIVITY_RETURNED_INVALID');
  const limit = integer(page['limit'], 'ENTITY_WORKSPACE_ACTIVITY_LIMIT_INVALID', 1);
  const scanLimit = integer(page['scanLimit'], 'ENTITY_WORKSPACE_ACTIVITY_SCAN_LIMIT_INVALID', 1);
  if (limit !== ACTIVITY_LIMIT || scanLimit !== ACTIVITY_SCAN_LIMIT) {
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
      status: 'selected', entityId: context.entityId, requestedBeforeHeight,
      isLatestPage: requestedBeforeHeight === context.height, latestHeight,
      fromHeight, toHeight, scannedFrames, nextBeforeHeight: null, events: [],
    };
  }

  const expectedToHeight = Math.min(latestHeight, requestedBeforeHeight);
  if (fromHeight < 1 || fromHeight > toHeight || toHeight !== expectedToHeight) {
    throw new Error('ENTITY_WORKSPACE_ACTIVITY_HEIGHT_RANGE_MISMATCH');
  }
  if (scannedFrames !== toHeight - fromHeight + 1 || scannedFrames > scanLimit) {
    throw new Error('ENTITY_WORKSPACE_ACTIVITY_SCAN_RANGE_MISMATCH');
  }
  const events = page['events'].map((event) => projectEvent(event, context, fromHeight, toHeight));
  if (new Set(events.map(({ id }) => id)).size !== events.length) {
    throw new Error('ENTITY_WORKSPACE_ACTIVITY_EVENT_ID_DUPLICATE');
  }
  return {
    status: 'selected', entityId: context.entityId, requestedBeforeHeight,
    isLatestPage: requestedBeforeHeight === context.height, latestHeight,
    fromHeight, toHeight, scannedFrames,
    nextBeforeHeight: requireCursor(page['nextBeforeHeight'], fromHeight),
    events,
  };
}
