import { keccak256, toUtf8Bytes } from 'ethers';

import { safeStringify } from '../../protocol/serialization';
import type { RuntimeActivityFilters } from '../views/activity-types';

export type RuntimeActivityCursorState = Readonly<{
  latestHeight: number;
  height: number;
  offset: number;
}>;

const cursorFingerprint = (
  runtimeId: string | undefined,
  filters: RuntimeActivityFilters,
): string => keccak256(toUtf8Bytes(safeStringify([
  String(runtimeId || '').trim().toLowerCase(),
  String(filters.entityId || '').trim().toLowerCase(),
  filters.kind ?? 'all',
  filters.types ?? [],
  String(filters.query || '').trim(),
  filters.fromTimestamp ?? null,
  filters.toTimestamp ?? null,
])));

const requireCursorInteger = (value: unknown, code: string, minimum: number): number => {
  if (!Number.isSafeInteger(value) || Number(value) < minimum) throw new Error(code);
  return Number(value);
};

export const encodeRuntimeActivityCursor = (
  state: RuntimeActivityCursorState,
  runtimeId: string | undefined,
  filters: RuntimeActivityFilters,
): string => encodeURIComponent(safeStringify([
  1,
  state.latestHeight,
  state.height,
  state.offset,
  cursorFingerprint(runtimeId, filters),
]));

export const decodeRuntimeActivityCursor = (
  raw: string,
  runtimeId: string | undefined,
  filters: RuntimeActivityFilters,
): RuntimeActivityCursorState => {
  if (!raw || raw.length > 512) throw new Error('RUNTIME_ACTIVITY_CURSOR_INVALID');
  let decoded: unknown;
  try {
    decoded = JSON.parse(decodeURIComponent(raw));
  } catch {
    throw new Error('RUNTIME_ACTIVITY_CURSOR_INVALID');
  }
  if (!Array.isArray(decoded) || decoded.length !== 5 || decoded[0] !== 1) {
    throw new Error('RUNTIME_ACTIVITY_CURSOR_INVALID');
  }
  const latestHeight = requireCursorInteger(decoded[1], 'RUNTIME_ACTIVITY_CURSOR_LATEST_INVALID', 1);
  const height = requireCursorInteger(decoded[2], 'RUNTIME_ACTIVITY_CURSOR_HEIGHT_INVALID', 1);
  const offset = requireCursorInteger(decoded[3], 'RUNTIME_ACTIVITY_CURSOR_OFFSET_INVALID', 0);
  if (height > latestHeight) throw new Error('RUNTIME_ACTIVITY_CURSOR_HEIGHT_INVALID');
  if (decoded[4] !== cursorFingerprint(runtimeId, filters)) {
    throw new Error('RUNTIME_ACTIVITY_CURSOR_CONTEXT_MISMATCH');
  }
  return { latestHeight, height, offset };
};
