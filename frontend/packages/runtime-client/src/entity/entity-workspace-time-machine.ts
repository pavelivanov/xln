import { getLocationHashParams, getLocationHashRoute } from './entity-workspace-navigation';

export const ENTITY_WORKSPACE_TIME_MACHINE_HASH = {
  height: 'tmHeight',
  entity: 'tmEntity',
  runtime: 'tmRuntime',
} as const;

export type EntityWorkspaceTimeMachineState = Readonly<{
  error: string | null;
  latestHeight: number;
  loading: boolean;
  mode: 'live' | 'history';
  selectedHeight: number;
}>;

type HashLocation = Readonly<{ hash: string; search: string }>;

export type EntityWorkspaceTimeMachineLink = Readonly<{
  entityId: string;
  height: number;
  runtimeId: string;
}>;

const normalizeHeight = (value: unknown): number => {
  const height = Math.floor(Number(value));
  return Number.isSafeInteger(height) && height >= 0 ? height : 0;
};

export const requireEntityWorkspaceHistoryHeight = (
  value: unknown,
  latestHeight: unknown,
): number => {
  const requested = normalizeHeight(value);
  const latest = normalizeHeight(latestHeight);
  if (requested < 1 || requested > latest) {
    throw new Error(`ENTITY_WORKSPACE_HISTORY_HEIGHT_INVALID:${String(value)}:${String(latest)}`);
  }
  return requested;
};

export const createEntityWorkspaceLiveState = (
  latestHeight: unknown,
): EntityWorkspaceTimeMachineState => {
  const latest = normalizeHeight(latestHeight);
  return {
    error: null,
    latestHeight: latest,
    loading: false,
    mode: 'live',
    selectedHeight: latest,
  };
};

export const createEntityWorkspaceHistoryState = (input: Readonly<{
  error?: string | null;
  latestHeight: unknown;
  loading?: boolean;
  selectedHeight: unknown;
}>): EntityWorkspaceTimeMachineState => ({
  error: input.error ?? null,
  latestHeight: normalizeHeight(input.latestHeight),
  loading: input.loading ?? false,
  mode: 'history',
  selectedHeight: requireEntityWorkspaceHistoryHeight(
    input.selectedHeight,
    input.latestHeight,
  ),
});

export const updateEntityWorkspaceLatestHeight = (
  state: EntityWorkspaceTimeMachineState,
  latestHeight: unknown,
): EntityWorkspaceTimeMachineState => {
  const latest = normalizeHeight(latestHeight);
  return state.mode === 'live'
    ? createEntityWorkspaceLiveState(latest)
    : { ...state, latestHeight: Math.max(state.selectedHeight, latest) };
};

export const readEntityWorkspaceTimeMachineLink = (
  location: HashLocation,
): EntityWorkspaceTimeMachineLink | null => {
  const params = getLocationHashParams(location);
  const rawHeight = params?.get(ENTITY_WORKSPACE_TIME_MACHINE_HASH.height);
  if (!rawHeight) return null;
  const height = normalizeHeight(rawHeight);
  if (height < 1) return null;
  return {
    entityId: String(params?.get(ENTITY_WORKSPACE_TIME_MACHINE_HASH.entity) || '').trim().toLowerCase(),
    height,
    runtimeId: String(params?.get(ENTITY_WORKSPACE_TIME_MACHINE_HASH.runtime) || '').trim().toLowerCase(),
  };
};

export const buildEntityWorkspaceTimeMachineHash = (
  location: HashLocation,
  link: EntityWorkspaceTimeMachineLink | null,
): string => {
  const route = getLocationHashRoute(location) ?? '';
  const params = getLocationHashParams(location) ?? new URLSearchParams();
  for (const key of [
    ENTITY_WORKSPACE_TIME_MACHINE_HASH.height,
    ENTITY_WORKSPACE_TIME_MACHINE_HASH.entity,
    ENTITY_WORKSPACE_TIME_MACHINE_HASH.runtime,
  ]) params.delete(key);
  if (link) {
    params.set(ENTITY_WORKSPACE_TIME_MACHINE_HASH.height, String(link.height));
    if (link.entityId) params.set(ENTITY_WORKSPACE_TIME_MACHINE_HASH.entity, link.entityId);
    if (link.runtimeId) params.set(ENTITY_WORKSPACE_TIME_MACHINE_HASH.runtime, link.runtimeId);
  }
  const query = params.toString();
  return `#${route}${query ? `?${query}` : ''}`;
};
