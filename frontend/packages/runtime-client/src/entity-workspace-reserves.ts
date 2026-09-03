import { requireUnknownRecord } from './boundary';
import type { EntityWorkspaceContext } from './entity-workspace-context';

export type EntityWorkspaceReserveItem = Readonly<{
  tokenId: number;
  amount: bigint;
}>;

type EmptyEntityWorkspaceReserves = Readonly<{
  status: 'empty';
}>;

type SelectedEntityWorkspaceReserves = Readonly<{
  status: 'selected';
  entityId: string;
  items: readonly EntityWorkspaceReserveItem[];
}>;

export type EntityWorkspaceReserves =
  | EmptyEntityWorkspaceReserves
  | SelectedEntityWorkspaceReserves;

export type EntityWorkspaceReservesInput = Readonly<{
  context: EntityWorkspaceContext;
  frame?: unknown;
}>;

const MAX_COMMITTED_RESERVES = 100;

export const emptyEntityWorkspaceReserves = (): EmptyEntityWorkspaceReserves => ({ status: 'empty' });

const requiredEntityId = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('ENTITY_WORKSPACE_RESERVES_ENTITY_ID_INVALID');
  }
  return value.trim().toLowerCase();
};

const reserveItem = (tokenId: unknown, amount: unknown): EntityWorkspaceReserveItem => {
  if (typeof tokenId !== 'number' || !Number.isSafeInteger(tokenId) || tokenId < 0) {
    throw new Error('ENTITY_WORKSPACE_RESERVE_TOKEN_ID_INVALID');
  }
  if (typeof amount !== 'bigint' || amount < 0n) {
    throw new Error('ENTITY_WORKSPACE_RESERVE_AMOUNT_INVALID');
  }
  return { tokenId, amount };
};

export function projectEntityWorkspaceReserves(
  input: EntityWorkspaceReservesInput,
): EntityWorkspaceReserves {
  if (input.context.status === 'empty') return emptyEntityWorkspaceReserves();
  const frame = requireUnknownRecord(input.frame, 'ENTITY_WORKSPACE_RESERVES_FRAME_INVALID');
  const active = requireUnknownRecord(frame['activeEntity'], 'ENTITY_WORKSPACE_RESERVES_ACTIVE_ENTITY_INVALID');
  const core = requireUnknownRecord(active['core'], 'ENTITY_WORKSPACE_RESERVES_CORE_INVALID');
  const entityId = requiredEntityId(core['entityId']);
  if (entityId !== input.context.entityId) {
    throw new Error('ENTITY_WORKSPACE_RESERVES_ENTITY_ID_MISMATCH');
  }
  const reserves = core['reserves'];
  if (!(reserves instanceof Map) || reserves.size > MAX_COMMITTED_RESERVES) {
    throw new Error('ENTITY_WORKSPACE_RESERVES_MAP_INVALID');
  }
  // Map insertion order is committed evidence. Never sort financial state.
  const items = [...reserves].map(([tokenId, amount]) => reserveItem(tokenId, amount));
  return { status: 'selected', entityId, items };
}
