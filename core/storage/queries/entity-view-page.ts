import type { EntityReplica } from '../../entity/types';
import { compareAscii, sortedStringMapKeys, sortedStringMapStartIndex } from '../../support/collections/sorted-map-index';
import { normalizeEntityId } from '../keys';
import { projectAccountDoc, projectEntityCoreDoc } from '../read/projections';
import type { StorageEntityViewPage } from '../read/read';

export type StorageEntityViewQuery = {
  cursor?: string;
  limit?: number;
  accountsCursor?: string;
  booksCursor?: string;
  accountsLimit?: number;
  booksLimit?: number;
  accountsPage?: number;
  booksPage?: number;
  sortDir?: 'asc' | 'desc';
};

const EMPTY_BOOKS_MAP: ReadonlyMap<string, unknown> = new Map();

const pageLimit = (value: number | undefined): number => {
  const raw = Number(value ?? 10);
  return Number.isFinite(raw) ? Math.max(1, Math.min(500, Math.floor(raw))) : 10;
};

/**
 * Cursor pagination over a hub-scale map (hundreds to thousands of accounts)
 * used to resort the full key set from scratch on every single page — an
 * O(N log N) sort plus an O(N) cursor scan per page, so draining one full
 * listing at the default page size cost O(N^2 log N). sortedStringMapKeys
 * caches the ascending key order on the map itself (invalidated only when a
 * key is added/removed), and the ascending path uses a binary-search cursor
 * seek — turning a full drain from O(N^2 log N) into O(N log N) total.
 */
const pageKeys = (
  map: ReadonlyMap<string, unknown>,
  cursor: string,
  limit: number,
  sortDir: 'asc' | 'desc',
  pageIndex: number,
): { ordered: readonly string[]; start: number; visible: string[]; nextCursor: string | null } => {
  const ascending = sortedStringMapKeys(map);
  if (sortDir === 'asc') {
    const start = sortedStringMapStartIndex(ascending, cursor, pageIndex, limit);
    const visible = ascending.slice(start, start + limit);
    return {
      ordered: ascending,
      start,
      visible,
      nextCursor: start + limit < ascending.length ? visible[visible.length - 1] ?? null : null,
    };
  }
  const ordered = [...ascending].reverse();
  const cursorStart = cursor ? ordered.findIndex(key => compareAscii(key, cursor) < 0) : 0;
  const start = pageIndex >= 0
    ? Math.min(ordered.length, pageIndex * limit)
    : cursorStart < 0 ? ordered.length : cursorStart;
  const visible = ordered.slice(start, start + limit);
  return {
    ordered,
    start,
    visible,
    nextCursor: start + limit < ordered.length ? visible[visible.length - 1] ?? null : null,
  };
};

const pageMetadata = (
  ordered: readonly string[],
  start: number,
  limit: number,
  visible: readonly string[],
): Omit<StorageEntityViewPage['accounts'], 'items' | 'nextCursor'> => ({
  prevCursor: start > 0 ? ordered[Math.max(0, start - limit)] ?? null : null,
  firstCursor: visible[0] ?? null,
  lastCursor: visible[visible.length - 1] ?? null,
  pageIndex: Math.floor(start / limit),
  pageCount: Math.ceil(ordered.length / limit),
  totalItems: ordered.length,
  limit,
});

const requestedPage = (value: number | undefined): number => {
  if (value === undefined) return -1;
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('STORAGE_ENTITY_VIEW_PAGE_INVALID');
  return value;
};

export const findReplicaForEntityId = (
  replicas: Iterable<EntityReplica>,
  entityId: string,
): EntityReplica | undefined => {
  const normalized = normalizeEntityId(entityId);
  for (const replica of replicas) {
    if (normalizeEntityId(replica.entityId) === normalized) return replica;
  }
  return undefined;
};

const pageAccounts = (
  replica: EntityReplica,
  query: StorageEntityViewQuery | undefined,
): StorageEntityViewPage['accounts'] => {
  const accounts = replica.state.accounts;
  const limit = pageLimit(query?.accountsLimit ?? query?.limit);
  const page = pageKeys(
    accounts,
    normalizeEntityId(String(query?.accountsCursor ?? query?.cursor ?? '')),
    limit,
    query?.sortDir === 'desc' ? 'desc' : 'asc',
    requestedPage(query?.accountsPage),
  );
  return {
    items: page.visible.map(id => {
      const account = accounts.get(id);
      if (!account) throw new Error(`STORAGE_REPLAY_ACCOUNT_MISSING:${id}`);
      return projectAccountDoc(account);
    }),
    nextCursor: page.nextCursor,
    ...pageMetadata(page.ordered, page.start, limit, page.visible),
  };
};

const pageBooks = (
  replica: EntityReplica,
  query: StorageEntityViewQuery | undefined,
): StorageEntityViewPage['books'] => {
  const books = replica.state.orderbookExt?.books;
  const limit = pageLimit(query?.booksLimit ?? query?.limit);
  const page = pageKeys(
    books ?? EMPTY_BOOKS_MAP,
    String(query?.booksCursor ?? (query?.accountsCursor ? '' : query?.cursor ?? '')).trim(),
    limit,
    'asc',
    requestedPage(query?.booksPage),
  );
  return {
    items: page.visible.map(pairId => {
      const book = books?.get(pairId);
      if (!book) throw new Error(`STORAGE_REPLAY_BOOK_MISSING:${pairId}`);
      return { pairId, book };
    }),
    nextCursor: page.nextCursor,
    ...pageMetadata(page.ordered, page.start, limit, page.visible),
  };
};

export const projectEntityViewPageFromReplica = (
  replica: EntityReplica,
  query?: StorageEntityViewQuery,
): StorageEntityViewPage => ({
  core: projectEntityCoreDoc(replica.state),
  accounts: pageAccounts(replica, query),
  books: pageBooks(replica, query),
});
