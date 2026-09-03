import { get } from 'svelte/store';

import type {
  WalletPushWakeOperation,
  WalletPushWakeReadyView,
  WalletPushWakeServiceView,
  WalletPushWakeView,
} from '../packages/browser/src/wallet-push-wake';
import {
  runtimesState,
  vaultOperations,
  type RecoveryTowerConfig,
  type Runtime,
} from '../src/lib/stores/vault/vaultStore';
import { runtimes as runtimeRegistry } from '../src/lib/stores/runtimeStore';
import { unwrapLiveRuntimeEnv } from '../src/lib/utils/runtime/liveRuntimeEnv';
import {
  buildPushWakeRegistrationPayload,
  buildPushWakeRegistrationRequest,
  buildPushWakeUnregisterPayload,
  buildPushWakeUnregisterRequest,
  buildWatchtowerPushRequestUrl,
  readPushWakeRegistrationRecords,
  removePushWakeRegistrationRecord,
  requestPushWakeDeviceToken,
  resolvePushWakeTarget,
  upsertPushWakeRegistrationRecord,
  type PushWakeRegistrationRecord,
} from '../src/lib/utils/recovery/pushWakeRegistration';
import {
  normalizeRecoveryDraft,
  normalizeTowerMode,
} from '../src/lib/utils/recovery/recoverySettings';
import { parseJsonUnknown, requireUnknownRecord } from '../src/lib/utils/boundary';

const normalizeRuntimeId = (value: string): string => value.trim().toLowerCase();

const activeRuntime = (): Runtime | null => {
  const state = get(runtimesState);
  const activeId = normalizeRuntimeId(String(state.activeRuntimeId || ''));
  return Object.values(state.runtimes)
    .find((runtime) => normalizeRuntimeId(runtime.id) === activeId) ?? null;
};

const activeEntityId = (runtime: Runtime): string => {
  const activeSigner = runtime.signers[runtime.activeSignerIndex || 0];
  const selected = String(activeSigner?.entityId || '').trim().toLowerCase();
  if (/^0x[0-9a-f]{64}$/.test(selected)) return selected;
  const fallback = runtime.signers
    .map((signer) => String(signer.entityId || '').trim().toLowerCase())
    .find((entityId) => /^0x[0-9a-f]{64}$/.test(entityId));
  return fallback || '';
};

const activeTowers = (runtime: Runtime): RecoveryTowerConfig[] =>
  normalizeRecoveryDraft(runtime.recovery?.towers);

const towerBinding = (towers: readonly RecoveryTowerConfig[]): string =>
  towers.map((tower) => tower.url).sort().join('\n');

const assertTowerBinding = (
  runtime: Runtime,
  expectedTowers: readonly RecoveryTowerConfig[],
): void => {
  if (towerBinding(activeTowers(runtime)) !== towerBinding(expectedTowers)) {
    throw new Error('PUSH_WAKE_RECOVERY_SERVICES_CHANGED');
  }
};

const requireRuntime = (expectedRuntimeId: string): Runtime => {
  const runtime = activeRuntime();
  if (!runtime) throw new Error('PUSH_WAKE_ACTIVE_RUNTIME_REQUIRED');
  const expected = normalizeRuntimeId(expectedRuntimeId);
  const actual = normalizeRuntimeId(runtime.id);
  if (!expected || expected !== actual) {
    throw new Error(`PUSH_WAKE_RUNTIME_CHANGED:${expected}:${actual}`);
  }
  return runtime;
};

const requireEntity = (runtime: Runtime, expectedEntityId?: string): string => {
  const entityId = activeEntityId(runtime);
  if (!entityId) throw new Error('PUSH_WAKE_ACTIVE_ENTITY_REQUIRED');
  if (expectedEntityId && entityId !== expectedEntityId) {
    throw new Error(`PUSH_WAKE_ENTITY_CHANGED:${expectedEntityId}:${entityId}`);
  }
  return entityId;
};

const liveRuntimeEnv = (runtime: Runtime): unknown | null => {
  const runtimeId = normalizeRuntimeId(runtime.id);
  const entry = get(runtimeRegistry).get(runtimeId);
  if (!entry || entry.type !== 'local' || !entry.env) return null;
  const env = unwrapLiveRuntimeEnv(entry.env) ?? entry.env;
  const envRuntimeId = normalizeRuntimeId(String(env.runtimeId || ''));
  if (envRuntimeId !== runtimeId) {
    throw new Error(`PUSH_WAKE_RUNTIME_ENV_MISMATCH:${runtimeId}:${envRuntimeId}`);
  }
  return env;
};

const parseResponse = async (response: Response): Promise<Record<string, unknown>> => {
  const text = await response.text();
  if (!text.trim()) return {};
  return requireUnknownRecord(
    parseJsonUnknown(text, 'PUSH_WAKE_RESPONSE_JSON_INVALID'),
    'PUSH_WAKE_RESPONSE_INVALID',
  );
};

const serviceView = (
  tower: RecoveryTowerConfig,
  records: readonly PushWakeRegistrationRecord[],
): WalletPushWakeServiceView => {
  const record = records.find((candidate) => candidate.towerUrl === tower.url) ?? null;
  return {
    url: tower.url,
    role: normalizeTowerMode(tower.towerMode),
    registered: record !== null,
    platform: record?.platform ?? null,
    updatedAt: record?.updatedAt ?? null,
  };
};

const projectRuntime = (runtime: Runtime): WalletPushWakeView => {
  const env = liveRuntimeEnv(runtime);
  if (!env) return { state: 'unavailable', reason: 'Open a live local Runtime before registering device wake.' };
  const entityId = activeEntityId(runtime);
  if (!entityId) return { state: 'unavailable', reason: 'Create or select a live entity before registering device wake.' };
  const towers = activeTowers(runtime);
  const records = readPushWakeRegistrationRecords(runtime.id, entityId);
  const services = towers.map((tower) => serviceView(tower, records));
  let blockedReason = '';
  try {
    vaultOperations.assertRuntimeAuthority(runtime.id);
  } catch (error: unknown) {
    blockedReason = error instanceof Error ? error.message : String(error);
  }
  return {
    state: 'ready',
    runtimeId: normalizeRuntimeId(runtime.id),
    entityId,
    registeredCount: services.filter((service) => service.registered).length,
    services,
    writable: blockedReason === '',
    blockedReason,
  };
};

const requireReadyView = (runtime: Runtime): WalletPushWakeReadyView => {
  const view = projectRuntime(runtime);
  if (view.state !== 'ready') throw new Error(`PUSH_WAKE_UNAVAILABLE:${view.reason}`);
  return view;
};

export const readCanonicalWalletPushWake = (): WalletPushWakeView => {
  const runtime = activeRuntime();
  return runtime
    ? projectRuntime(runtime)
    : { state: 'unavailable', reason: 'Open a local wallet before registering device wake.' };
};

export const registerCanonicalWalletPushWake = async (
  expectedRuntimeId: string,
): Promise<WalletPushWakeOperation> => {
  const initial = requireRuntime(expectedRuntimeId);
  vaultOperations.assertRuntimeAuthority(initial.id);
  const entityId = requireEntity(initial);
  const env = liveRuntimeEnv(initial);
  if (!env) throw new Error('PUSH_WAKE_RUNTIME_ENV_REQUIRED');
  const towers = activeTowers(initial);
  if (towers.length === 0) throw new Error('PUSH_WAKE_RECOVERY_SERVICE_REQUIRED');
  const target = resolvePushWakeTarget(env, {
    runtimeId: initial.id,
    entityId,
    ...(initial.signers[initial.activeSignerIndex || 0]?.jurisdiction
      ? { jurisdictionName: initial.signers[initial.activeSignerIndex || 0]!.jurisdiction }
      : {}),
  });
  const device = await requestPushWakeDeviceToken();
  const current = requireRuntime(expectedRuntimeId);
  requireEntity(current, entityId);
  assertTowerBinding(current, towers);
  vaultOperations.assertRuntimeAuthority(current.id);
  const signedAt = Date.now();
  const payload = buildPushWakeRegistrationPayload(target, device, signedAt);
  const ownerSignature = await vaultOperations.signRuntimeOwnerMessage(current.id, payload.message);
  const signedCurrent = requireRuntime(expectedRuntimeId);
  requireEntity(signedCurrent, entityId);
  assertTowerBinding(signedCurrent, towers);
  vaultOperations.assertRuntimeAuthority(signedCurrent.id);
  const request = buildPushWakeRegistrationRequest(target, device, signedAt, ownerSignature);
  const errors: string[] = [];
  let accepted = 0;
  for (const tower of towers) {
    try {
      const response = await fetch(buildWatchtowerPushRequestUrl(tower.url, '/api/push/register'), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
      });
      const responseBody = await parseResponse(response);
      if (!response.ok || responseBody['ok'] !== true) {
        throw new Error(String(responseBody['error'] || `HTTP_${response.status}`));
      }
      upsertPushWakeRegistrationRecord({
        ...target,
        towerUrl: tower.url,
        tokenHash: payload.tokenHash,
        platform: device.platform,
        updatedAt: Math.max(0, Math.floor(Number(responseBody['updatedAt'] || Date.now()))),
      });
      accepted += 1;
    } catch (error: unknown) {
      errors.push(`${tower.url}:${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (accepted === 0) throw new Error(errors.join(' | ') || 'PUSH_REGISTER_REJECTED');
  return { view: requireReadyView(requireRuntime(expectedRuntimeId)), accepted, attempted: towers.length, errors };
};

export const unregisterCanonicalWalletPushWake = async (
  expectedRuntimeId: string,
): Promise<WalletPushWakeOperation> => {
  const runtime = requireRuntime(expectedRuntimeId);
  vaultOperations.assertRuntimeAuthority(runtime.id);
  const entityId = requireEntity(runtime);
  const towers = activeTowers(runtime);
  const towerUrls = new Set(towers.map((tower) => tower.url));
  const records = readPushWakeRegistrationRecords(runtime.id, entityId)
    .filter((record) => towerUrls.has(record.towerUrl));
  if (records.length === 0) throw new Error('PUSH_WAKE_REGISTRATION_REQUIRED');
  const errors: string[] = [];
  let accepted = 0;
  for (const record of records) {
    try {
      const current = requireRuntime(expectedRuntimeId);
      requireEntity(current, entityId);
      assertTowerBinding(current, towers);
      vaultOperations.assertRuntimeAuthority(current.id);
      const signedAt = Date.now();
      const payload = buildPushWakeUnregisterPayload(current.id, record.tokenHash, signedAt);
      const signature = await vaultOperations.signRuntimeOwnerMessage(current.id, payload.message);
      const signedCurrent = requireRuntime(expectedRuntimeId);
      requireEntity(signedCurrent, entityId);
      assertTowerBinding(signedCurrent, towers);
      vaultOperations.assertRuntimeAuthority(signedCurrent.id);
      const request = buildPushWakeUnregisterRequest(current.id, record.tokenHash, signedAt, signature);
      const response = await fetch(buildWatchtowerPushRequestUrl(record.towerUrl, '/api/push/unregister'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
      });
      const responseBody = await parseResponse(response);
      if (!response.ok || responseBody['ok'] !== true) {
        throw new Error(String(responseBody['error'] || `HTTP_${response.status}`));
      }
      removePushWakeRegistrationRecord(record);
      accepted += 1;
    } catch (error: unknown) {
      errors.push(`${record.towerUrl}:${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (accepted === 0) throw new Error(errors.join(' | ') || 'PUSH_UNREGISTER_REJECTED');
  return { view: requireReadyView(requireRuntime(expectedRuntimeId)), accepted, attempted: records.length, errors };
};
