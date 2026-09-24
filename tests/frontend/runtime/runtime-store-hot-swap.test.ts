import { expect, test } from 'bun:test';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';

const collectFrontendSources = (dir: string): string[] => {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = `${dir}/${entry}`;
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...collectFrontendSources(path));
    } else if (/\.(ts|tsx)$/.test(path)) {
      files.push(path);
    }
  }
  return files;
};

test('runtime selector hot-swaps adapters instead of reloading the app', () => {
  const runtimeStoreSource = readFileSync('frontend/bridges/runtime/runtime-store.ts', 'utf8');
  const xlnStoreSource = readFileSync('frontend/bridges/runtime/xln-store.ts', 'utf8');
  expect(runtimeStoreSource).toContain('registerRuntimeAdapterSwitcher');
  expect(runtimeStoreSource).toContain('RUNTIME_ADAPTER_SWITCHER_NOT_REGISTERED');
  expect(runtimeStoreSource).not.toContain("await import('./xlnStore')");
  expect(xlnStoreSource).toContain('registerRuntimeAdapterSwitcher(async (config) =>');
  expect(xlnStoreSource).toContain('await switchAppRuntimeAdapter(config)');
  expect(runtimeStoreSource).not.toContain('window.location.reload');
  expect(runtimeStoreSource).not.toContain('window.location.assign');
});

test('runtime controller is the single adapter lifecycle owner', () => {
  const controllerSource = readFileSync('frontend/bridges/runtime/runtime-controller-store.ts', 'utf8');
  const handleSource = readFileSync('frontend/packages/runtime-client/src/runtime/runtime-handle.ts', 'utf8');
  const xlnStoreSource = readFileSync('frontend/bridges/runtime/xln-store.ts', 'utf8');
  const contextSwitcherSource = readFileSync('frontend/apps/ops/src/workspace/runtime/ops-runtime-selection.ts', 'utf8');
  const runtimeStoreSource = readFileSync('frontend/bridges/runtime/runtime-store.ts', 'utf8');
  const queryClientSource = readFileSync('frontend/bridges/runtime/runtime-query-client.ts', 'utf8');

  expect(controllerSource).toContain('new RemoteRuntimeAdapter');
  expect(controllerSource).toContain('export const connectRuntimeAdapter');
  expect(controllerSource).toContain('export const runtimeControllerHandle');
  expect(handleSource).toContain('pendingRuntimeId: string');
  expect(controllerSource).toContain('export const setRuntimeControllerPendingRuntimeId');
  expect(handleSource).toContain('runtimeId: id');
  expect(queryClientSource).toContain('const adapter = getRuntimeControllerAdapter();');
  expect(queryClientSource).toContain('const handle = get(runtimeControllerHandle)');
  expect(queryClientSource).toContain('runtimeId: handle.runtimeId');
  expect(queryClientSource).toContain('mode: handle.mode');
  expect(queryClientSource).toContain('permissions: handle.permissions');
  expect(controllerSource).toContain('activeAdapter = null');
  expect(controllerSource).toContain('runtimeControllerConfig.set(null)');
  expect(existsSync('frontend/src/lib/stores/runtimeAdapterStore.ts')).toBe(false);
  expect(xlnStoreSource).toContain('getRuntimeControllerAdapter');
  expect(xlnStoreSource).toContain('getRuntimeControllerConfig');
  expect(xlnStoreSource).toContain('runtimeAdapterSend(input, { commandId: receipt.commandId })');
  expect(xlnStoreSource).not.toContain('remoteAdapter.send(input)');
  expect(xlnStoreSource).not.toContain('adapter.send(input)');
  expect(xlnStoreSource).not.toContain('activeRuntimeAdapterConfig');
  expect(xlnStoreSource).not.toContain('export const appRuntimeAdapterStatus');
  expect(xlnStoreSource).not.toContain('export const appRuntimeAdapterMode');
  expect(xlnStoreSource).not.toContain('export const appRuntimeAdapterEndpoint');
  expect(xlnStoreSource).not.toContain('appRuntimeAdapterStatus.set');
  expect(xlnStoreSource).not.toContain('appRuntimeAdapterMode.set');
  expect(xlnStoreSource).not.toContain('appRuntimeAdapterEndpoint.set');
  expect(controllerSource).not.toContain('runtimeAdapterAuthLevel');
  expect(contextSwitcherSource).toContain('await opsWorkspaceSession.select');
  expect(contextSwitcherSource).toContain('writeRemoteRuntimeAdapterSession');
  expect(contextSwitcherSource).toContain('readRuntimeAdapterStorageSnapshot');
  expect(contextSwitcherSource).not.toContain('appRuntimeAdapterMode');
  expect(contextSwitcherSource).not.toContain('appRuntimeAdapterStatus');
  expect(contextSwitcherSource).not.toContain('appRuntimeAdapterEndpoint');
  expect(runtimeStoreSource).toContain('export const activeRuntimeId = derived');
  expect(runtimeStoreSource).toContain('[runtimeControllerHandle, runtimes]');
  expect(runtimeStoreSource).toContain('$handle.pendingRuntimeId');
  expect(runtimeStoreSource).toContain('if (pendingId && $runtimes.has(pendingId))');
  expect(runtimeStoreSource).toContain('setRuntimeControllerPendingRuntimeId(id)');
  expect(runtimeStoreSource).toContain("controllerId && controllerId !== 'embedded' && $runtimes.has(controllerId)");
  expect(runtimeStoreSource).toContain("controllerId !== 'embedded'");
  expect(runtimeStoreSource).toContain('$runtimes.has(controllerId)');
  expect(runtimeStoreSource).not.toContain('export const activeRuntimeId = writable');
});

test('embedded RuntimeInput ingress rechecks the quiesce fence after every async boundary', () => {
  const source = readFileSync('frontend/bridges/runtime/xln-store.ts', 'utf8');
  const routeStart = source.indexOf('const routeRuntimeInput = async');
  const dispatchStart = source.indexOf('export async function dispatchRuntimeInputToRuntimeEnv');
  const dispatchEnd = source.indexOf('export async function submitActiveEntityInputs', dispatchStart);
  const routeSource = source.slice(routeStart, dispatchStart);
  const dispatchSource = source.slice(dispatchStart, dispatchEnd);

  expect(source).toContain('LOCAL_RUNTIME_INPUT_INGRESS_QUIESCING');
  expect(routeSource.match(/assertLocalRuntimeInputIngressOpen\(runtimeEnv\)/g)).toHaveLength(3);
  expect(routeSource.lastIndexOf('assertLocalRuntimeInputIngressOpen(runtimeEnv)'))
    .toBeLessThan(routeSource.indexOf('runtimeAdapterSend(input, { commandId: receipt.commandId })'));
  expect(dispatchSource.match(/assertLocalRuntimeInputIngressOpen\(runtimeEnv\)/g)).toHaveLength(3);
  expect(dispatchSource.lastIndexOf('assertLocalRuntimeInputIngressOpen(runtimeEnv)'))
    .toBeLessThan(dispatchSource.indexOf('xln.enqueueRuntimeInput(runtimeEnv, input)'));
});

test('embedded adapter binds to selected runtime env before bootstrap commands', () => {
  const source = readFileSync('frontend/bridges/runtime/xln-store.ts', 'utf8');

  expect(source).toContain('targetEnv?: RuntimeReplica | null');
  expect(source).toContain("const boundRuntimeId = normalizeRuntimeConfigId(boundEnv?.runtimeId || '')");
  expect(source).toContain('const runtimeEnv = get(runtimes).get(boundRuntimeId)?.env');
  expect(source).toContain('runtimeOperations.setActiveRuntimeId(envRuntimeId)');
  expect(source).toContain('createEmbeddedRuntimeAdapter(xln, normalizedConfig.seed ?? null, env)');
  expect(source).not.toContain('createEmbeddedRuntimeAdapter(xln, normalizedConfig.seed ?? null),');
});

test('selected embedded runtime never falls back to a mismatched bootstrap env', () => {
  const storeSource = readFileSync('frontend/bridges/runtime/xln-store.ts', 'utf8');
  const embeddedSource = readFileSync('frontend/bridges/runtime/embedded-runtime-store.ts', 'utf8');
  const derivedStart = embeddedSource.indexOf('export const xlnEnvironment = derived');
  const setEnvStart = embeddedSource.indexOf('export function setXlnEnvironment');
  const switchStart = storeSource.indexOf('export const switchAppRuntimeAdapter');
  const refreshStart = storeSource.indexOf('export const refreshCurrentRuntimeProjection', switchStart);

  expect(derivedStart).toBeGreaterThan(0);
  expect(setEnvStart).toBeGreaterThan(derivedStart);
  expect(switchStart).toBeGreaterThan(0);
  expect(refreshStart).toBeGreaterThan(switchStart);

  const derivedSource = embeddedSource.slice(derivedStart, setEnvStart);
  const setEnvSource = embeddedSource.slice(setEnvStart);
  const switchSource = storeSource.slice(switchStart, refreshStart);

  expect(storeSource).toContain("import { xlnEnvironment, setXlnEnvironment } from './embedded-runtime-store';");
  expect(storeSource).toContain("export { xlnEnvironment, setXlnEnvironment } from './embedded-runtime-store';");
  expect(storeSource).not.toContain('const bootstrapEnvironment = writable');
  expect(storeSource).not.toContain('export const xlnEnvironment = derived');
  expect(storeSource).not.toContain('export function setXlnEnvironment');
  expect(embeddedSource).toContain('const bootstrapEnvironment = writable<RuntimeReplica | null>(null);');
  expect(derivedSource).toContain('if (selectedRuntimeId) return $runtimes.get(selectedRuntimeId)?.env ?? null;');
  expect(derivedSource).toContain('return $bootstrapEnvironment;');
  expect(derivedSource).not.toContain('if (runtimeEntry) return runtimeEntry.env ?? null;');
  expect(embeddedSource).toContain("import { errorLog } from '../../packages/browser/src/logging/error-log-store';");
  expect(setEnvSource).toContain('const canPublishActiveEnv = !selectedRuntimeId || (envRuntimeId !== \'\' && envRuntimeId === selectedRuntimeId);');
  expect(setEnvSource).toContain('RUNTIME_STORE_ENV_OVERWRITE_REFUSED');
  expect(setEnvSource).toContain("errorLog.log(message, 'Runtime RuntimeReplica'");
  expect(setEnvSource).toContain('throw new Error(message)');
  expect(embeddedSource).not.toContain('console.error');
  expect(embeddedSource).not.toContain('console.warn');
  expect(embeddedSource).not.toContain('console.info');
  expect(switchSource).toContain('const currentRuntimeId = normalizeRuntimeConfigId(currentEnv?.runtimeId || \'\');');
  expect(switchSource).toContain('if (!selectedRuntimeId || currentRuntimeId === selectedRuntimeId)');
  expect(switchSource).toContain('await vaultOperations.prepareRuntimeForAdapterSwitch(selectedRuntimeId);');
  expect(switchSource).toContain('EMBEDDED_RUNTIME_ENV_RESTORE_FAILED');
  expect(switchSource).toContain('env = await xln.main(normalizedConfig.seed ?? null);');
  expect(switchSource).toContain('EMBEDDED_RUNTIME_ENV_MISMATCH');
  expect(switchSource).not.toContain('if (!env) env = await xln.main(normalizedConfig.seed ?? null);');
});

test('runtime store fails fast on cross-runtime env overwrite', () => {
  const source = readFileSync('frontend/bridges/runtime/runtime-store.ts', 'utf8');
  const updateStart = source.indexOf('updateLocalEnv(env: RuntimeReplica)');
  const metadataStart = source.indexOf('// Update active runtime metadata.', updateStart);
  expect(updateStart).toBeGreaterThan(0);
  expect(metadataStart).toBeGreaterThan(updateStart);
  const updateSource = source.slice(updateStart, metadataStart);

  expect(updateSource).toContain('RUNTIME_STORE_ENV_OVERWRITE_REFUSED');
  expect(updateSource).not.toContain('Refusing cross-runtime env overwrite');
  expect(updateSource).not.toContain('console.error');
});

test('remote time-machine history requires radapter batch reads', () => {
  const xlnStoreSource = readFileSync('frontend/bridges/runtime/xln-store.ts', 'utf8');
  const source = readFileSync('frontend/bridges/runtime/runtime-history-store.ts', 'utf8');
  const transportSource = readFileSync(
    'frontend/packages/runtime-client/src/scenario/time-machine-transport.ts',
    'utf8',
  );
  const querySource = readFileSync('frontend/bridges/runtime/runtime-query-client.ts', 'utf8');
  const queryBoundarySource = readFileSync(
    'frontend/packages/runtime-client/src/runtime/query/runtime-query-client.ts',
    'utf8',
  );
  const scanStart = source.indexOf('export const scanRuntimeAdapterHistoryAtHeight');
  expect(scanStart).toBeGreaterThan(0);
  const scanSource = source.slice(scanStart);
  expect(source).toContain('runtimeQueryClient.readHistoryFrameBatch');
  expect(queryBoundarySource).toContain("'history-frame-batch'");
  expect(querySource).toContain('extends RuntimeQueryClientBoundary<');
  expect(xlnStoreSource).not.toContain('export const scanRuntimeAdapterHistoryAtHeight');
  expect(source).not.toContain('unsupported adapter path: history-frame-batch');
  expect(source).not.toContain('buildRemoteAdapterEnvSnapshot');
  expect(source).not.toContain('remoteViewFrameToEnv');
  expect(source).toContain('REMOTE_HISTORY_VIEW_PAGE_SIZE');
  expect(scanSource).toContain('runtimeViewHistoryScan.set(createTimeMachineScanLoadingState({');
  expect(transportSource).toContain('heights: [height]');
  expect(transportSource).toContain('createTimeMachineScanFailureState');
  expect(scanSource).toContain('error: message');
  expect(scanSource).toContain('snapshot: { height: scannedHeight }');
  expect(scanSource).not.toContain('setXlnEnvironment');
  expect(scanSource).not.toContain('history.set');
});

test('remote adapter resolver restores active auth from the remote runtime registry', () => {
  const source = readFileSync('frontend/bridges/runtime/xln-store.ts', 'utf8');
  expect(source).toContain('resolveStoredRemoteRuntimeAuthKey');
  expect(source).toContain('const storedAuthKey = readStoredAdapterValue(RUNTIME_ADAPTER_AUTH_KEY).trim()');
  expect(source).toContain('restoredAuthKey = resolveStoredRemoteRuntimeAuthKey(normalizedWsUrl).trim()');
  expect(source).toContain("readRemoteRuntimeTokenAccess(storedAuthKey) !== 'admin'");
  expect(source).toContain('const authKey = restoredAuthKey || storedAuthKey;');
  expect(source).toContain('writeRemoteRuntimeAdapterAuth(');
});

test('direct remote runtime URL reuses saved capability before showing paste prompt', () => {
  const manager = readFileSync('frontend/apps/ops/src/workspace/runtime/ops-runtime-manager.tsx', 'utf8');
  const boundary = readFileSync('frontend/packages/runtime-client/src/runtime/remote-runtime-request.ts', 'utf8');
  expect(manager).toContain('readStoredRemoteRuntimeImports()');
  expect(manager).toContain('Admin capability token');
  expect(manager).toContain('parseRemoteRuntimeImportText');

  const decodeStart = boundary.indexOf('export const decodeRemoteRuntimeRequest =');
  const decodeEnd = boundary.indexOf('export const runtimeImportPayloadFromParams', decodeStart);
  expect(decodeStart).toBeGreaterThan(0);
  expect(decodeEnd).toBeGreaterThan(decodeStart);
  const decodeSource = boundary.slice(decodeStart, decodeEnd);
  expect(decodeSource).toContain("hash.get('token')");
  expect(decodeSource).toContain('dependencies.resolveStoredAuthKey(wsUrl).trim()');
  expect(decodeSource).toContain('const requiresAuthPaste = !authKey');
  expect(decodeSource).not.toContain('window');
  expect(decodeSource).not.toContain('Storage');
  expect(decodeSource.indexOf('dependencies.resolveStoredAuthKey(wsUrl).trim()'))
    .toBeLessThan(decodeSource.indexOf('const requiresAuthPaste = !authKey'));
});

test('remote projection never materializes fake RuntimeReplica snapshots', () => {
  const storeSource = readFileSync('frontend/bridges/runtime/xln-store.ts', 'utf8');
  expect(existsSync('frontend/src/lib/utils/runtimeViewEnv.ts')).toBe(false);
  expect(storeSource).not.toContain("$lib/utils/runtimeViewEnv");
  expect(storeSource).not.toContain('runtimeViewFrameToEnv');
  expect(storeSource).not.toContain('buildRemoteAdapterEnvSnapshot');
  expect(storeSource).not.toContain('buildRemoteAdapterHistory');
  expect(storeSource).not.toContain('remoteEnvToSnapshot');
});

test('remote runtime bulk import validates with bounded parallelism', () => {
  const source = readFileSync('frontend/bridges/runtime/remote/remote-runtime-import-flow.ts', 'utf8');
  const manager = readFileSync('frontend/apps/ops/src/workspace/runtime/ops-runtime-manager.tsx', 'utf8');
  expect(existsSync('frontend/apps/ops/src/workspace/runtime/ops-runtime-manager.tsx')).toBe(true);
  expect(existsSync('frontend/src/routes/radapter/manage/+page.svelte')).toBe(false);
  expect(source).toContain('const REMOTE_RUNTIME_IMPORT_CONCURRENCY = 4');
  expect(source).toContain('export const validateRemoteRuntimeImportEntries = async');
  expect(source).toContain('Array.from({ length: workerCount }');
  expect(source).toContain('await Promise.allSettled(workers)');
  expect(source).toContain('const results = await validateRemoteRuntimeImportEntries(entries, {');
  expect(source).toContain('failedCount: failed.length');
  expect(source).toContain('checked: RemoteRuntimeImportSummaryCheckedRow[]');
  expect(source).toContain('summarizeFailedRemoteRuntimeEntry');
  expect(manager).toContain('const result = await importRemoteRuntimeEntries(entries, { activateFirst: false');
  expect(manager).toContain('setFailed(result.failed.map(item => item.entry))');
  expect(source).not.toContain('for (const [index, entry] of entries.entries())');
});

test('remote runtime switch resets runtime-scoped view selection without dropping auth', () => {
  const source = readFileSync('frontend/bridges/runtime/xln-store.ts', 'utf8');
  const runtimeViewSource = readFileSync('frontend/bridges/runtime/runtime-view-store.ts', 'utf8');
  expect(source).toContain('shouldResetRuntimeAdapterViewSelection(previousConfig, normalizedConfig)');
  expect(source).toContain('resetRuntimeAdapterViewSelection');
  expect(source).toContain("import { clearRuntimeQueryCache } from './runtime-query-client';");
  expect(source).toContain('resetRuntimeView,');
  expect(source).toContain("const previousRuntimeId = normalizeRuntimeConfigId(previousConfig.runtimeId || '')");
  expect(source).toContain("const nextRuntimeId = normalizeRuntimeConfigId(nextConfig.runtimeId || '')");
  expect(source).toContain('if (previousRuntimeId || nextRuntimeId) return previousRuntimeId !== nextRuntimeId;');
  expect(source).toContain('clearRuntimeQueryCache();');
  expect(source).toContain('resetRuntimeView();');
  expect(source).toContain('resetRuntimeViewSelection();');
  expect(source).toContain('type RemoteProjectionRefreshInFlight =');
  expect(source).toContain('let remoteProjectionRefreshInFlight: RemoteProjectionRefreshInFlight | null = null');
  expect(source).toContain('let remoteProjectionRefreshGeneration = 0;');
  expect(source).toContain('const remoteProjectionRefreshKey =');
  expect(source).toContain('const selection = readRuntimeViewSelection();');
  expect(source).toContain('remoteProjectionRefreshKey(config, selection)');
  expect(source).toContain('remoteProjectionRefreshInFlight = null;');
  expect(source).toContain('if (remoteProjectionRefreshInFlight?.key === refreshKey)');
  expect(source).toContain('const generation = ++remoteProjectionRefreshGeneration;');
  expect(source).not.toContain('remoteHistoryCache');
  expect(runtimeViewSource).toContain('export const runtimeViewActiveEntityId');
  expect(runtimeViewSource).toContain('export const runtimeViewPageInfo');
  expect(runtimeViewSource).toContain('export const runtimeViewHistoryScan');
  expect(runtimeViewSource).toContain('export const resetRuntimeView = (): void =>');
  expect(runtimeViewSource).toContain('export const resetRuntimeViewSelection');
  expect(runtimeViewSource).toContain('runtimeViewHistoryScan.set(emptyRuntimeViewHistoryScan())');
  expect(source).toContain("!sameWsEndpoint(previousConfig.wsUrl || '', nextConfig.wsUrl || '')");
  expect(source).not.toContain("sessionStorage.removeItem('xln-runtime-adapter-key')");
  expect(source).not.toContain("localStorage.removeItem('xln-runtime-adapter-ws')");
});

test('stale remote entity selection fails loudly without resetting to another entity', () => {
  const source = readFileSync('frontend/bridges/runtime/xln-store.ts', 'utf8');
  expect(source).toContain('if (!publicationStillCurrent()) return null;');
  expect(source).toContain('runtimeViewPublicationMatches(');
  expect(source).toContain('remoteProjectionRefreshGeneration,');
  expect(source).toContain('const projection = await refreshRemoteRuntimeProjection(adapter, config, selection, generation);');
  expect(source.indexOf('if (!isCurrentRuntimeAdapterConfig(config)) return null;'))
    .toBeLessThan(source.indexOf('const adapter = getRuntimeControllerAdapter();'));
  expect(source).toContain('Remote entity summary not found: ${entityId}');
  expect(source).toContain("view.status !== 'connected'");
  expect(source).toContain('/not connected|socket closed|timed out/i.test(viewError)');
  expect(source).toContain('setRuntimeViewActiveEntityId(historyFrame.activeEntityId)');
  expect(source).toContain('const frame = await refreshView(requestedEntityId);');
  expect(source).not.toContain('isStaleRemoteEntitySelectionError');
  expect(source).not.toContain("refreshView('')");
});

test('remote RuntimeInput command waits for its observed frontier before projection refresh', () => {
  const source = readFileSync('frontend/bridges/runtime/xln-store.ts', 'utf8');
  expect(source).toContain('const waitForRemoteRuntimeProjectionAtHeight = async');
  expect(source).toContain('REMOTE_RUNTIME_PROJECTION_WAIT_TIMEOUT_MS');
  expect(source).toContain('REMOTE_RUNTIME_PROJECTION_TIMEOUT');
  expect(source).toContain('const observed = await waitForObservedRemoteCommand({ adapter, input, command, isCurrent, accepted: progress.accepted });');
  expect(source).toContain('const projectedHeight = await waitForRemoteRuntimeProjectionAtHeight(observed.height, isCurrent);');
  expect(source).toContain('await progress.observed(projectedHeight);');
  expect(source.indexOf('const observed = await waitForObservedRemoteCommand('))
    .toBeLessThan(source.indexOf('const projectedHeight = await waitForRemoteRuntimeProjectionAtHeight(observed.height, isCurrent);'));
  expect(source).not.toContain('waitForRemoteRuntimeCommit');
  expect(source).toContain('latestHeight = view.runtimeId === get(runtimeControllerHandle).id ? Number(view.frame?.height ?? 0) : 0;');
  expect(source).toContain("if (!isCurrent()) throw new Error('REMOTE_RUNTIME_COMMAND_OBSERVATION_SUPERSEDED');");
  expect(source).not.toContain('waitForRemoteRuntimeProjectionAtHeight(accepted.height + 1)');
  expect(source).not.toContain('waitForRemoteRuntimeReceiptObserved');
});

test('remote runtime refresh ignores unchanged ticks and debounces projection reads', () => {
  const remoteSource = readFileSync('core/api/runtime-adapter/remote.ts', 'utf8');
  const xlnStoreSource = readFileSync('frontend/bridges/runtime/xln-store.ts', 'utf8');
  const noteHeightStart = remoteSource.indexOf('private noteHeight(');
  const noteHeightEnd = remoteSource.indexOf('private async openSocket', noteHeightStart);
  expect(noteHeightStart).toBeGreaterThan(0);
  expect(noteHeightEnd).toBeGreaterThan(noteHeightStart);
  const noteHeightSource = remoteSource.slice(noteHeightStart, noteHeightEnd);
  expect(noteHeightSource).toContain('options.allowDecrease === true ? next === this.height : next <= this.height');
  expect(noteHeightSource).toContain('for (const cb of this.changeCbs) cb(this.height)');
  expect(remoteSource).not.toContain('notifyWhenUnchanged');

  const scheduleStart = xlnStoreSource.indexOf('const scheduleRuntimeProjectionRefresh = (): void => {');
  const scheduleEnd = xlnStoreSource.indexOf('const isCurrentRuntimeAdapterConfig', scheduleStart);
  expect(scheduleStart).toBeGreaterThan(0);
  expect(scheduleEnd).toBeGreaterThan(scheduleStart);
  const scheduleSource = xlnStoreSource.slice(scheduleStart, scheduleEnd);
  expect(scheduleSource).toContain('if (remoteProjectionRefreshTimer)');
  expect(scheduleSource).toContain('remoteProjectionRefreshQueued = true');
  expect(scheduleSource).toContain('}, 200)');
  expect(scheduleSource).toContain('if (shouldRunAgain) scheduleRuntimeProjectionRefresh();');
});

test('frontend remote discovery stays fail-fast while an attached Runtime allows historical reads', () => {
  const xlnStoreSource = readFileSync('frontend/bridges/runtime/xln-store.ts', 'utf8');
  const importValidationSource = readFileSync('frontend/bridges/runtime/remote/remote-runtime-validation.ts', 'utf8');

  // Graph-frame materialization may replay persisted state. The attached adapter is shared
  // by every docked surface, so its budget must cover that read without opening a second socket.
  expect(xlnStoreSource).toContain('const FRONTEND_REMOTE_REQUEST_TIMEOUT_MS = 30_000');
  expect(xlnStoreSource).toContain('const FRONTEND_REMOTE_RECONNECT_MAX_MS = 2_000');
  expect(xlnStoreSource).toContain('const REMOTE_RUNTIME_PROJECTION_WAIT_TIMEOUT_MS = 5_000');
  expect(xlnStoreSource).toContain('requestTimeoutMs: config.requestTimeoutMs ?? FRONTEND_REMOTE_REQUEST_TIMEOUT_MS');
  expect(xlnStoreSource).toContain('reconnectMaxMs: config.reconnectMaxMs ?? FRONTEND_REMOTE_RECONNECT_MAX_MS');

  expect(importValidationSource).toContain('options.openTimeoutMs ?? 5_000');
  expect(importValidationSource).toContain('options.requestTimeoutMs ?? 5_000');
  expect(importValidationSource).toContain('requestTimeoutMs: 5_000');
});

test('remote RuntimeView refresh stays projection-native without fake RuntimeReplica timestamps', () => {
  const storeSource = readFileSync('frontend/bridges/runtime/xln-store.ts', 'utf8');
  const runtimeViewSource = readFileSync('frontend/bridges/runtime/runtime-view-store.ts', 'utf8');
  const refreshStart = storeSource.indexOf('const refreshRemoteRuntimeProjection = async');
  const refreshEnd = storeSource.indexOf('const createEmbeddedRuntimeAdapter', refreshStart);
  expect(refreshStart).toBeGreaterThan(0);
  expect(refreshEnd).toBeGreaterThan(refreshStart);
  const refreshSource = storeSource.slice(refreshStart, refreshEnd);

  expect(existsSync('frontend/src/lib/utils/runtimeViewEnv.ts')).toBe(false);
  expect(storeSource).not.toContain('buildRemoteAdapterPlaceholderEnv');
  expect(storeSource).not.toContain('xln.createEmptyEnv(config.seed');
  expect(storeSource).not.toContain("throw new Error('REMOTE_RUNTIME_INITIAL_VIEW_MISSING')");
  expect(storeSource).toContain('const refreshRemoteRuntimeProjection = async');
  expect(refreshSource).toContain('const view = await refreshRuntimeView');
  expect(refreshSource).not.toContain('runtimeViewPageInfo.set');
  expect(runtimeViewSource).toContain('runtimeViewPageInfo.set(runtimeViewPageInfoFromFrame(frame));');
  expect(refreshSource).not.toContain('Date.now()');
  expect(refreshSource).not.toContain('createEmptyEnv');
});

test('localhost debug env surfaces expose RuntimeView with matching live runtime infrastructure', () => {
  const xlnStoreSource = readFileSync('frontend/bridges/runtime/xln-store.ts', 'utf8');
  const embeddedStoreSource = readFileSync('frontend/bridges/runtime/embedded-runtime-store.ts', 'utf8');
  const runtimeLoaderSource = readFileSync('frontend/bridges/runtime/xln-runtime-loader.ts', 'utf8');
  const debugSurface = readFileSync('frontend/packages/browser/src/runtime/debug-surface.ts', 'utf8');

  expect(xlnStoreSource).toContain("import { xlnEnvironment, setXlnEnvironment } from './embedded-runtime-store';");
  expect(embeddedStoreSource).toContain('const viewEnv = createRuntimeViewEnv(runtimeEnv);');
  expect(embeddedStoreSource).toContain("registerDebugSurface('env', () => localDebugEnv);");
  expect(embeddedStoreSource).toContain('localDebugEnv = createDetachedRuntimeViewEnv(runtimeEnv);');
  expect(xlnStoreSource).not.toContain('window.__xln_env =');
  expect(runtimeLoaderSource).toContain("registerDebugSurface('instance', () => XLN);");
  expect(runtimeLoaderSource).not.toContain('window.__xln_instance =');
  expect(debugSurface).toContain("LOCAL_DEBUG_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])");
  expect(debugSurface).toContain("Object.defineProperty(target, '__xln'");
  expect(debugSurface).not.toContain('__xln_env');
  expect(debugSurface).not.toContain('__xln_instance');
  expect(debugSurface).not.toContain('__xlnRuntimeAdapter');
});

test('embedded runtime store exposes only an ownership-safe detached debug snapshot', () => {
  const source = readFileSync('frontend/bridges/runtime/embedded-runtime-store.ts', 'utf8');
  expect(source).toContain("registerDebugSurface('env', () => localDebugEnv)");
  expect(source).toContain('localDebugEnv = createDetachedRuntimeViewEnv(runtimeEnv)');
  expect(source).not.toContain('window.isolatedEnv');
  expect(source).not.toContain("Object.defineProperty(window, 'isolatedEnv'");
});

test('local runtime selection persists embedded mode without deleting saved remote registry', () => {
  const source = readFileSync('frontend/bridges/runtime/runtime-store.ts', 'utf8');
  const activationSource = readFileSync(
    'frontend/packages/runtime-client/src/runtime/runtime-adapter-activation.ts',
    'utf8',
  );
  const switchStart = source.indexOf('const performRuntimeSelection =');
  expect(switchStart).toBeGreaterThan(0);
  expect(source).toContain(
    'writeEmbeddedRuntimeAdapterSession({ durable: localStorage, session: sessionStorage })',
  );
  expect(source).not.toContain('REMOTE_RUNTIME.IMPORT_STORAGE_KEY');
  expect(source.slice(switchStart)).toContain('registered: Boolean(runtime)');
  expect(source.slice(switchStart)).toContain('persistEmbedded: persistActiveEmbeddedRuntime');
  expect(source.slice(switchStart)).toContain('switchAdapter: switchToRuntimeAdapter');
  expect(activationSource).toContain('if (!target.registered || !dependencies.isCurrent(target))');
  expect(activationSource).toContain('dependencies.persistEmbedded();');
});

test('selecting the already connected runtime does not reconnect the adapter', () => {
  const source = readFileSync('frontend/bridges/runtime/runtime-store.ts', 'utf8');
  const activationSource = readFileSync(
    'frontend/packages/runtime-client/src/runtime/runtime-adapter-activation.ts',
    'utf8',
  );
  const helperStart = source.indexOf('const runtimeControllerAlreadyTargets =');
  const selectStart = source.indexOf('const performRuntimeSelection =');
  expect(helperStart).toBeGreaterThan(0);
  expect(selectStart).toBeGreaterThan(helperStart);
  const helperSource = source.slice(helperStart, selectStart);
  const selectSource = source.slice(selectStart, source.indexOf('// Operations', selectStart));

  expect(helperSource).toContain("handle.status !== 'connected'");
  expect(helperSource).toContain('handle.authLevel === expectedAuth');
  expect(helperSource).toContain('normalizeRemoteRuntimeWsUrl(config.wsUrl) === normalizeRemoteRuntimeWsUrl(runtime.wsUrl)');
  expect(selectSource).toContain('isCurrent: () => runtimeControllerAlreadyTargets(runtime, id)');
  expect(activationSource).toContain('if (!dependencies.isCurrent(target)) {');
  expect(activationSource).toContain('await dependencies.switchAdapter(activationConfig(target));');
});

test('runtime selection persists websocket before switch with rollback and reaffirms active endpoint after success', () => {
  const runtimeStoreSource = readFileSync('frontend/bridges/runtime/runtime-store.ts', 'utf8');
  const activationSource = readFileSync(
    'frontend/packages/runtime-client/src/runtime/runtime-adapter-activation.ts',
    'utf8',
  );
  const xlnStoreSource = readFileSync('frontend/bridges/runtime/xln-store.ts', 'utf8');
  const selectStart = runtimeStoreSource.indexOf('const performRuntimeSelection =');
  const activateStart = runtimeStoreSource.indexOf('// Operations', selectStart);
  expect(selectStart).toBeGreaterThan(0);
  expect(activateStart).toBeGreaterThan(selectStart);
  const selectSource = runtimeStoreSource.slice(selectStart, activateStart);

  expect(runtimeStoreSource).toContain('const readRuntimeAdapterStorageSnapshot =');
  expect(runtimeStoreSource).toContain('const restoreRuntimeAdapterStorageSnapshot =');
  expect(selectSource).toContain('readSessionSnapshot: readRuntimeAdapterStorageSnapshot');
  expect(selectSource).toContain('restoreSessionSnapshot: restoreRuntimeAdapterStorageSnapshot');
  expect(selectSource).toContain('persistRemote: () => persistActiveRemoteRuntime(runtime)');
  expect(selectSource).toContain('setPendingRuntimeId: setRuntimeControllerPendingRuntimeId');
  expect(selectSource).toContain('switchAdapter: switchToRuntimeAdapter');

  const remoteStart = activationSource.indexOf('export const activateRemoteRuntimeTarget =');
  const embeddedStart = activationSource.indexOf('export const activateEmbeddedRuntimeTarget =');
  const remoteSource = activationSource.slice(remoteStart, embeddedStart);
  const remotePersistIndex = remoteSource.indexOf('if (!dependencies.persistRemote(target))');
  const remotePendingIndex = remoteSource.indexOf('dependencies.setPendingRuntimeId(target.runtimeId)');
  const remoteSwitchIndex = remoteSource.indexOf('await dependencies.switchAdapter(activationConfig(target))');
  const remoteRollbackIndex = remoteSource.indexOf('dependencies.restoreSessionSnapshot(previousSession)');
  const remotePendingRollbackIndex = remoteSource.indexOf('dependencies.setPendingRuntimeId(previousPendingRuntimeId)');
  const remoteTargetAssertIndex = remoteSource.indexOf('REMOTE_RUNTIME_SWITCH_TARGET_MISMATCH');
  const remoteFinalPersistIndex = remoteSource.indexOf('return dependencies.persistRemote(target);');
  expect(remoteStart).toBeGreaterThan(0);
  expect(embeddedStart).toBeGreaterThan(remoteStart);
  expect(remoteSwitchIndex).toBeGreaterThan(0);
  expect(remotePersistIndex).toBeGreaterThan(0);
  expect(remotePersistIndex).toBeLessThan(remoteSwitchIndex);
  expect(remotePendingIndex).toBeGreaterThan(remotePersistIndex);
  expect(remotePendingIndex).toBeLessThan(remoteSwitchIndex);
  expect(remoteRollbackIndex).toBeGreaterThan(remoteSwitchIndex);
  expect(remotePendingRollbackIndex).toBeGreaterThan(remoteRollbackIndex);
  expect(remoteTargetAssertIndex).toBeGreaterThan(remoteSwitchIndex);
  expect(remoteFinalPersistIndex).toBeGreaterThan(remoteTargetAssertIndex);

  const embeddedSource = activationSource.slice(embeddedStart);
  const embeddedPendingIndex = embeddedSource.indexOf('dependencies.setPendingRuntimeId(target.runtimeId)');
  const embeddedSwitchIndex = embeddedSource.indexOf('await dependencies.switchAdapter(activationConfig(target))');
  const embeddedPendingRollbackIndex = embeddedSource.indexOf('dependencies.setPendingRuntimeId(previousPendingRuntimeId)');
  const embeddedPersistIndex = embeddedSource.indexOf('dependencies.persistEmbedded();');
  expect(embeddedPendingIndex).toBeGreaterThan(0);
  expect(embeddedPendingIndex).toBeLessThan(embeddedSwitchIndex);
  expect(embeddedPersistIndex).toBeGreaterThan(embeddedSwitchIndex);
  expect(embeddedPendingRollbackIndex).toBeGreaterThan(embeddedSwitchIndex);

  expect(xlnStoreSource).toContain("const requestedRuntimeId = normalizeRuntimeConfigId(normalizedConfig.runtimeId || '')");
  expect(xlnStoreSource).toContain("const selectedRuntimeId = requestedRuntimeId || String(get(activeRuntimeId) || '').toLowerCase();");
});

test('runtime controller handle carries selected runtime identity', () => {
  const controllerSource = readFileSync('frontend/bridges/runtime/runtime-controller-store.ts', 'utf8');
  const handleSource = readFileSync('frontend/packages/runtime-client/src/runtime/runtime-handle.ts', 'utf8');
  const activationSource = readFileSync(
    'frontend/packages/runtime-client/src/runtime/runtime-adapter-activation.ts',
    'utf8',
  );
  const runtimeStoreSource = readFileSync('frontend/bridges/runtime/runtime-store.ts', 'utf8');
  const xlnStoreSource = readFileSync('frontend/bridges/runtime/xln-store.ts', 'utf8');
  const activeStart = runtimeStoreSource.indexOf('export const activeRuntimeId = derived');
  const activeEnd = runtimeStoreSource.indexOf('// Derived: Get active runtime', activeStart);
  expect(activeStart).toBeGreaterThan(0);
  expect(activeEnd).toBeGreaterThan(activeStart);
  const activeSource = runtimeStoreSource.slice(activeStart, activeEnd);

  expect(handleSource).toContain('runtimeId: string');
  expect(handleSource).toContain('pendingRuntimeId: string');
  expect(handleSource).toContain('export const runtimeAdapterId =');
  expect(handleSource).toContain('normalizeRuntimeHandleId(adapter?.runtimeId) || runtimeAdapterConfigId(config)');
  expect(controllerSource).toContain('const handle = createRuntimeHandle({');
  expect(handleSource).toContain('currentRuntimeId === nextRuntimeId');
  expect(runtimeStoreSource).toContain('activateEmbeddedRuntimeTarget(target, {');
  expect(activationSource).toContain("{ mode: 'embedded', runtimeId: target.runtimeId }");
  expect(runtimeStoreSource).toContain('runtimeId: id');
  expect(activeSource).toContain('if (pendingId && $runtimes.has(pendingId))');
  expect(activeSource).toContain('controllerId && controllerId !== \'embedded\' && $runtimes.has(controllerId)');
  expect(activeSource).not.toContain("$handle.status === 'connected'");
  expect(xlnStoreSource).toContain('normalizeRuntimeConfigId(config.runtimeId)');
  expect(xlnStoreSource).toContain('remoteRuntimeIdFromConfig(normalizedConfig)');
});

test('authenticated remote admin authority survives transport reconnect while command readiness fail-closes', () => {
  const source = readFileSync('frontend/bridges/runtime/xln-store.ts', 'utf8');
  const remoteSource = readFileSync('core/api/runtime-adapter/remote.ts', 'utf8');
  const switchStart = source.indexOf('export const switchAppRuntimeAdapter =');
  const callbackStart = source.indexOf('unregisterRuntimeControllerStatus = onRuntimeControllerStatus', switchStart);
  const callbackEnd = source.indexOf("if (status === 'connected')", callbackStart);
  const callbackSource = source.slice(callbackStart, callbackEnd);

  expect(source).toContain('const authenticatedRemoteAccess = adapter.authLevel;');
  expect(source).toContain("if (authenticatedRemoteAccess !== 'admin') {");
  expect(callbackSource).toContain('authenticatedRemoteAccess, {');
  expect(callbackSource).not.toContain('adapter.authLevel, {');
  expect(remoteSource).toContain('disconnect(): void {');
  expect(remoteSource).toContain('this.level = null;');
  expect(remoteSource.slice(remoteSource.indexOf('private handleClose(): void'), remoteSource.indexOf('private scheduleReconnect(): void')))
    .not.toContain('this.level = null;');
});

test('vault restore rebinds RuntimeController to the restored embedded runtime', () => {
  const source = readFileSync('frontend/bridges/vault/vault-store.ts', 'utf8');
  const restoreStart = source.indexOf('const resolvedActive = findRuntimeByIdCaseInsensitive');
  const initializedStart = source.indexOf('initialized = true;', restoreStart);
  expect(restoreStart).toBeGreaterThan(0);
  expect(initializedStart).toBeGreaterThan(restoreStart);
  const restoreSource = source.slice(restoreStart, initializedStart);

  const activeSelectionIndex = restoreSource.indexOf('runtimeOperations.setActiveRuntimeId(activeId)');
  const pipelineIndex = restoreSource.indexOf('await ensureRuntimePipelineAlive(runtimeToSync as Runtime, activeXln)');
  const controllerIndex = restoreSource.indexOf('await runtimeOperations.selectRuntime(activeId)');
  const syncIndex = restoreSource.indexOf('this.syncRuntime(runtimeToSync)');
  expect(activeSelectionIndex).toBeGreaterThan(0);
  expect(pipelineIndex).toBeGreaterThan(activeSelectionIndex);
  expect(controllerIndex).toBeGreaterThan(pipelineIndex);
  expect(syncIndex).toBeGreaterThan(controllerIndex);
});

test('vault explicitly removes the persistence fence before resuming a drained runtime', () => {
  const source = readFileSync('frontend/bridges/vault/vault-store.ts', 'utf8');
  const helperStart = source.indexOf('function ensureRuntimeLoopRunning');
  const helperEnd = source.indexOf('async function buildOrRestoreRuntimeEnv', helperStart);
  expect(helperStart).toBeGreaterThan(0);
  expect(helperEnd).toBeGreaterThan(helperStart);
  const helperSource = source.slice(helperStart, helperEnd);

  expect(helperSource).toContain('xln.resumeRuntimeAfterPersistenceQuiesce(env)');
  expect(helperSource).not.toContain('xln.resumeRuntimeLoop(env)');
  expect(helperSource).not.toContain('xln.startRuntimeLoop(env)');
});

test('embedded env initialization publishes active runtime snapshot before app shell reads it', () => {
  const xlnStoreSource = readFileSync('frontend/bridges/runtime/xln-store.ts', 'utf8');
  const updateStart = xlnStoreSource.indexOf('const updateLocalEnvironmentStores =');
  const callbackStart = xlnStoreSource.indexOf('const registerLocalEnvironmentCallback =');
  expect(updateStart).toBeGreaterThan(0);
  expect(callbackStart).toBeGreaterThan(updateStart);
  const updateSlice = xlnStoreSource.slice(updateStart, callbackStart);

  expect(xlnStoreSource).toContain("const EMBEDDED_RUNTIME_SEED_STORAGE_KEY = 'xln-embedded-runtime-seed-v1';");
  expect(xlnStoreSource).toContain('const seed = await readOrCreateEmbeddedRuntimeSeed();');
  expect(xlnStoreSource).toContain("return seed ? { mode: 'embedded', seed } : { mode: 'embedded' };");
  expect(xlnStoreSource).toContain('env = await xln.main(adapterConfig.seed ?? null);');
  expect(xlnStoreSource).toContain('env = await xln.main(normalizedConfig.seed ?? null);');
  expect(xlnStoreSource).toContain('EMBEDDED_RUNTIME_ENV_MISMATCH');
  expect(xlnStoreSource).toContain('createEmbeddedAdapter: () => createEmbeddedRuntimeAdapter(xln, adapterConfig.seed ?? null, env)');
  expect(xlnStoreSource).toContain('createEmbeddedAdapter: () => createEmbeddedRuntimeAdapter(xln, normalizedConfig.seed ?? null, env)');
  expect(updateSlice).toContain("upsertRuntimeSnapshot(env, { mode: 'embedded', runtimeId: envRuntimeId }, 'connected')");
  expect(updateSlice.indexOf('upsertRuntimeSnapshot')).toBeLessThan(updateSlice.indexOf('runtimeOperations.updateLocalEnv(env)'));
  expect(updateSlice).not.toContain('buildRemoteAdapterPlaceholderEnv');
});

test('wallet embedded boot restores the canonical vault before default Runtime initialization', () => {
  const source = readFileSync('frontend/bridges/runtime/browser/browser-runtime-bootstrap.ts', 'utf8');
  const session = readFileSync('frontend/bridges/runtime/browser/browser-runtime-session.ts', 'utf8');
  const persisted = source.indexOf('if (hasPersistedWalletVault(localStorage))');
  const restore = source.indexOf('await canonical.restoreCanonicalWalletRuntime(setPageUnloadFence)');
  const defaultBoot = source.indexOf('return bootEmbeddedRuntimeAdapter(await runtimeLoader.load(), setPageUnloadFence)');

  expect(persisted).toBeGreaterThan(0);
  expect(restore).toBeGreaterThan(persisted);
  expect(defaultBoot).toBeGreaterThan(restore);
  expect(source).toContain('if (restored) return restored;');
  expect(session).toContain('createWalletEmbeddedRuntimeSession<RuntimeAdapter>({');
  expect(session).toContain('boot: async () => {');
  expect(session).toContain('return bootstrap.bootWalletEmbeddedRuntime(setPageUnloadFence);');
});

test('vault bootstrap commands submit explicit runtime env through command bus helper', () => {
  const source = readFileSync('frontend/bridges/vault/vault-store.ts', 'utf8');
  const enqueueStart = source.indexOf('async function enqueueAndAwait(');
  const helperEnd = source.indexOf('async function ensureRuntimePipelineAlive', enqueueStart);
  expect(enqueueStart).toBeGreaterThan(0);
  expect(helperEnd).toBeGreaterThan(enqueueStart);
  const enqueueSource = source.slice(enqueueStart, helperEnd);

  expect(source).toContain('dispatchRuntimeInputToRuntimeEnv');
  expect(enqueueSource).toContain('await dispatchRuntimeInputToRuntimeEnv(runtimeEnv, runtimeInput)');
  expect(enqueueSource).not.toContain('xln.enqueueRuntimeInput(runtimeEnv, runtimeInput)');
  expect(enqueueSource).not.toContain('xln.startRuntimeLoop(runtimeEnv)');
});

test('React Ops runtime selection activates in place instead of reloading', () => {
  const manager = readFileSync('frontend/apps/ops/src/workspace/runtime/ops-runtime-manager.tsx', 'utf8');
  const selection = readFileSync('frontend/apps/ops/src/workspace/runtime/ops-runtime-selection.ts', 'utf8');

  expect(manager).toContain('await selectWorkspaceRuntime(first);');
  expect(manager).toContain("void select('embedded')");
  expect(selection).toContain('pauseWorkspacePlayback();');
  expect(selection).toContain('networkMachineRuntimeOperations.dispose();');
  expect(selection).toContain('await opsWorkspaceSession.select(readRuntimeAdapterStorageSnapshot(stores));');
  expect(`${manager}\n${selection}`).not.toContain('window.location.reload');
});

test('React Ops remote capability validation completes before runtime activation', () => {
  const manager = readFileSync('frontend/apps/ops/src/workspace/runtime/ops-runtime-manager.tsx', 'utf8');
  const flow = readFileSync('frontend/bridges/runtime/remote/remote-runtime-import-flow.ts', 'utf8');
  const validation = manager.indexOf('const result = await importRemoteRuntimeEntries(entries, { activateFirst: false');
  const selection = manager.indexOf('await selectWorkspaceRuntime(first);', validation);

  expect(manager).toContain("if (!token.trim().startsWith('xlnra1.'))");
  expect(validation).toBeGreaterThan(0);
  expect(selection).toBeGreaterThan(validation);
  expect(flow).toContain('const results = await validateRemoteRuntimeImportEntries(entries, {');
  expect(flow).toContain('if (validated.length === 0)');
});

test('accepted remote runtime links persist into the shared runtime registry', () => {
  const flow = readFileSync('frontend/bridges/runtime/remote/remote-runtime-import-flow.ts', 'utf8');
  const selection = readFileSync('frontend/apps/ops/src/workspace/runtime/ops-runtime-selection.ts', 'utf8');

  expect(flow).toContain('const persisted = runtimeOperations.upsertRemoteRuntimeImports(validated);');
  expect(flow).toContain('writeRemoteRuntimeAdapterSession({ durable: localStorage, session: sessionStorage }, {');
  expect(flow).toContain('authKey: entry.token');
  expect(selection).toContain('writeRemoteRuntimeAdapterSession(stores, { wsUrl: entry.wsUrl, access: entry.access, authKey: entry.token });');
  expect(`${flow}\n${selection}`).not.toContain("localStorage.setItem('xln-runtime-adapter-key'");
});

test('direct remote adapter config carries token audience runtime identity', () => {
  const source = readFileSync('frontend/bridges/runtime/xln-store.ts', 'utf8');
  const resolveStart = source.indexOf('const resolveAppRuntimeAdapterConfig =');
  const nextHelperStart = source.indexOf('const upsertRuntimeSnapshot =', resolveStart);
  expect(resolveStart).toBeGreaterThan(0);
  expect(nextHelperStart).toBeGreaterThan(resolveStart);
  const resolveSource = source.slice(resolveStart, nextHelperStart);
  expect(resolveSource).toContain('const runtimeId = readRemoteRuntimeTokenAudience(authKey)');
  expect(resolveSource).toContain('...(runtimeId ? { runtimeId } : {})');
  expect(resolveSource).not.toContain('window.location.search');
});

test('remote app can page through full hub account and book projections', () => {
  const source = readFileSync('frontend/apps/wallet/src/portfolio/wallet-portfolio-source.ts', 'utf8');
  const view = readFileSync('frontend/apps/wallet/src/portfolio/wallet-portfolio.tsx', 'utf8');
  const runtimeViewModelSource = readFileSync(
    'frontend/packages/runtime-client/src/runtime/view/runtime-view-model.ts',
    'utf8',
  );

  expect(source).toContain('private accountsPage = 0;');
  expect(source).toContain('readonly selectAccountsPage = (page: number): void => {');
  expect(source).toContain('accountsLimit: 25, booksLimit: 1, accountsPage: this.accountsPage');
  expect(view).toContain('selectPage={source.selectAccountsPage}');
  expect(view).toContain('disabled={projection.accountsPage === 0}');
  expect(view).toContain('disabled={projection.accountsPage + 1 >= projection.accountsPageCount}');
  expect(view).toContain('Page {projection.accountsPage + 1} of {projection.accountsPageCount}');
  expect(runtimeViewModelSource).toContain('accountsPageIndex: number');
  expect(runtimeViewModelSource).toContain('accountsPageCount: number');
  expect(runtimeViewModelSource).toContain('accountsHasMore: boolean');
  expect(runtimeViewModelSource).toContain('export const runtimeViewPageNeedsNavigation');
});

test('retryable remote adapter refresh errors do not unmount the app shell', () => {
  const source = readFileSync('frontend/bridges/runtime/xln-store.ts', 'utf8');
  const handlerStart = source.indexOf('export const handleRuntimeProjectionRefreshError');
  const scheduleStart = source.indexOf('const scheduleRuntimeProjectionRefresh', handlerStart);
  expect(handlerStart).toBeGreaterThanOrEqual(0);
  expect(scheduleStart).toBeGreaterThan(handlerStart);

  const handlerSource = source.slice(handlerStart, scheduleStart);
  expect(handlerSource).toContain("errorLog.log(logMessage, 'Runtime Projection Refresh'");
  expect(handlerSource).toContain("getRuntimeControllerConfig()?.mode === 'remote'");
  expect(handlerSource).toContain('Remote runtime projection refresh failed; keeping current runtime view mounted');
  expect(handlerSource).toContain('toasts.warning');
  expect(handlerSource).not.toContain('console.warn');
  expect(handlerSource).not.toContain('console.error');
  expect(handlerSource.indexOf('return;')).toBeLessThan(handlerSource.lastIndexOf('error.set(message)'));
});

test('xlnStore boot diagnostics use persistent error log instead of raw console', () => {
  const source = readFileSync('frontend/bridges/runtime/xln-store.ts', 'utf8');
  const initializeStart = source.indexOf('export async function initializeXLN');
  const initializeEnd = source.indexOf('// Export XLN for direct component access.', initializeStart);
  const refreshStart = source.indexOf('const refreshRemoteRuntimeProjection = async');
  const createAdapterStart = source.indexOf('const createEmbeddedRuntimeAdapter = async', refreshStart);
  expect(initializeStart).toBeGreaterThan(0);
  expect(initializeEnd).toBeGreaterThan(initializeStart);
  expect(refreshStart).toBeGreaterThan(0);
  expect(createAdapterStart).toBeGreaterThan(refreshStart);

  const initializeSource = source.slice(initializeStart, initializeEnd);
  const refreshSource = source.slice(refreshStart, createAdapterStart);
  expect(initializeSource).toContain("errorLog.log(errorMessage, 'XLN Initialization', err)");
  expect(initializeSource).toContain("'Financial restore failure; refusing automatic local data reset'");
  expect(initializeSource).toContain("'Embedded runtime adapter failed to connect; local env remains usable'");
  expect(refreshSource).toContain('Remote entity summary not found: ${entityId}');
  expect(refreshSource).not.toContain('resetting to default entity');
  expect(`${initializeSource}\n${refreshSource}`).not.toContain('console.warn');
  expect(`${initializeSource}\n${refreshSource}`).not.toContain('console.error');
});

test('xlnStore payment gossip diagnostics use persistent error log instead of raw console', () => {
  const source = readFileSync('frontend/bridges/runtime/xln-store.ts', 'utf8');
  const debugStart = source.indexOf('export function sendRuntimeDebugEvent');
  const inputStart = source.indexOf('const embeddedAdapterTargetsRuntimeEnv', debugStart);
  expect(debugStart).toBeGreaterThan(0);
  expect(inputStart).toBeGreaterThan(debugStart);
  const gossipSource = source.slice(debugStart, inputStart);

  expect(gossipSource).toContain("errorLog.log('Runtime debug event dispatch failed', 'Runtime Debug Event', error)");
  expect(gossipSource).toContain("errorLog.log('Payment gossip profile fetch failed', 'Payment Gossip'");
  expect(gossipSource).toContain("errorLog.log('Payment gossip profile announce failed', 'Payment Gossip'");
  expect(gossipSource).toContain("errorLog.log('Payment gossip p2p sync failed', 'Payment Gossip', error)");
  expect(gossipSource).toContain("errorLog.log('Payment gossip targeted ensure failed', 'Payment Gossip'");
  expect(gossipSource).toContain("errorLog.log('Payment gossip runtime refresh failed', 'Payment Gossip', error)");
  expect(gossipSource).toContain("errorLog.log('Payment gossip p2p refresh failed', 'Payment Gossip', error)");
  expect(gossipSource).not.toContain('console.warn');
  expect(gossipSource).not.toContain('console.error');
});

test('xlnStore diagnostics avoid raw warn/error console output', () => {
  const source = readFileSync('frontend/bridges/runtime/xln-store.ts', 'utf8');

  expect(source).toContain("errorLog.log('P2P state poll failed', 'P2P State Poll', pollError)");
  expect(source).toContain("errorLog.log('FINTECH-SAFETY: Entity access failed', 'Entity Access', error)");
  expect(source).toContain("errorLog.log('FINTECH-SAFETY: Entity ID extraction failed', 'Entity Access', error)");
  expect(source).toContain("'Relay Settings'");
  expect(source).not.toContain('console.warn');
  expect(source).not.toContain('console.error');
});

test('local runtime creation marks the target before bootstrap and switches controller after persistence', () => {
  const source = readFileSync('frontend/bridges/vault/vault-store.ts', 'utf8');
  const createStart = source.indexOf('async createRuntime(');
  const deleteStart = source.indexOf('async deleteRuntime(', createStart);
  expect(createStart).toBeGreaterThan(0);
  expect(deleteStart).toBeGreaterThan(createStart);
  const createSource = source.slice(createStart, deleteStart);
  const earlyPendingSelect = createSource.indexOf('runtimeOperations.setActiveRuntimeId(runtimeId)');
  const firstRuntimeInput = createSource.indexOf('await enqueueAndAwait(');
  const persistedState = createSource.indexOf('runtimesState.update(state => ({');
  const controllerSelect = createSource.indexOf('await runtimeOperations.selectRuntime(runtimeId)');
  expect(earlyPendingSelect).toBeGreaterThan(0);
  expect(firstRuntimeInput).toBeGreaterThan(earlyPendingSelect);
  expect(persistedState).toBeGreaterThan(firstRuntimeInput);
  expect(controllerSelect).toBeGreaterThan(persistedState);
  expect(createSource).not.toContain("activeRuntimeId.set(runtimeId);");
});

test('vault runtime selection delegates adapter lifecycle to RuntimeController path', () => {
  const source = readFileSync('frontend/bridges/vault/vault-store.ts', 'utf8');
  const selectStart = source.indexOf('async selectRuntime(runtimeId: string, lease?: RuntimeSelectionLease)');
  const addSignerStart = source.indexOf('// Add signer to active runtime', selectStart);
  expect(selectStart).toBeGreaterThan(0);
  expect(addSignerStart).toBeGreaterThan(selectStart);
  const selectSource = source.slice(selectStart, addSignerStart);
  expect(selectSource).toContain('coordinateRuntimeSelection');
  expect(selectSource).toContain('runtimeOperations.selectRuntime(resolvedRuntimeId, lease)');
  expect(selectSource).toContain('if (!lease && initializePromise && !initialized)');
  expect(selectSource).toContain('if (lease && initializePromise && !initialized)');
  expect(selectSource).toContain('RUNTIME_SELECTION_DURING_VAULT_INITIALIZATION');
  expect(selectSource.indexOf('await initializePromise;'))
    .toBeLessThan(selectSource.indexOf('coordinateRuntimeSelection'));
  expect(selectSource).not.toContain('switchAppRuntimeAdapter');
  expect(selectSource).not.toContain('activeRuntimeId.set(resolvedRuntimeId)');
});

test('vault initialization preserves active shared runtime selection', () => {
  const source = readFileSync('frontend/bridges/vault/vault-store.ts', 'utf8');
  const initStart = source.indexOf('async initialize()');
  const clearStart = source.indexOf('// Clear all runtimes', initStart);
  expect(initStart).toBeGreaterThan(0);
  expect(clearStart).toBeGreaterThan(initStart);
  const initSource = source.slice(initStart, clearStart);

  expect(initSource).toContain('const sharedRuntimes = get(runtimes);');
  expect(initSource).toContain('const currentSharedRuntime = currentSelected ? sharedRuntimes.get(currentSelected) : null;');
  expect(initSource).toContain('latest.runtimes[currentSelected] ||');
  expect(initSource).toContain("currentSharedRuntime?.type === 'remote'");
  expect(initSource).not.toContain('latest.runtimes[currentSelected] || sharedRuntimes.has(currentSelected)');
  expect(initSource).toContain('const runtimeEntry = activeId ? sharedRuntimes.get(activeId) : null;');
  expect(initSource).toContain('if (runtimeToSync?.seed) this.syncRuntime(runtimeToSync);');
  expect(initSource).toContain('else if (runtimeToSync) this.syncRuntime(null);');
  expect(initSource).toContain('else if (!activeId) this.syncRuntime(null);');
  expect(initSource).not.toContain('this.syncRuntime(runtimeToSync ?? null);');
});

test('React frontend surfaces do not bypass the explicit Runtime session owner', () => {
  const selectionSource = readFileSync('frontend/apps/ops/src/workspace/runtime/ops-runtime-selection.ts', 'utf8');
  expect(selectionSource).toContain('await opsWorkspaceSession.select');
  expect(selectionSource).not.toContain('activeRuntimeId.set');

  const bypasses = collectFrontendSources('frontend/apps')
    .filter((file) => /\bactiveRuntimeId\.set\(/.test(readFileSync(file, 'utf8')));

  expect(bypasses).toEqual([]);
});

test('active Runtime ownership uses Web Locks and releases only after quiesce', () => {
  const lockSource = readFileSync('frontend/packages/browser/src/active-tab-lock.ts', 'utf8');
  const browserSource = readFileSync('frontend/packages/browser/src/active-tab-lock-support.ts', 'utf8');
  const sessionSource = readFileSync('frontend/packages/browser/src/runtime/wallet-embedded-runtime-session.ts', 'utf8');
  const browserSessionSource = readFileSync('frontend/bridges/runtime/browser/browser-runtime-session.ts', 'utf8');
  const loseStart = lockSource.indexOf('const loseWebLockTo');
  const loseEnd = lockSource.indexOf('const handleHardResetRequest', loseStart);
  const loseSource = lockSource.slice(loseStart, loseEnd);
  const sessionLossStart = sessionSource.indexOf('const handleLockLoss =');
  const sessionLossEnd = sessionSource.indexOf('const installResource =', sessionLossStart);
  const sessionLossSource = sessionSource.slice(sessionLossStart, sessionLossEnd);

  expect(browserSource).toContain('navigator.locks.request(name, options, callback)');
  expect(lockSource).toContain("browser.requestLock(ACTIVE_TAB_WEB_LOCK_NAME, { mode: 'exclusive' }");
  expect(lockSource).not.toContain("localStorage.getItem('xln-active-tab-lock')");
  expect(lockSource).not.toContain('ACTIVE_TAB_ID_KEY');
  expect(loseSource.indexOf('await state.onLoseLockHandler?.()')).toBeGreaterThan(0);
  expect(loseSource.indexOf('releaseWebLock(state)')).toBeGreaterThan(
    loseSource.indexOf('await state.onLoseLockHandler?.()'),
  );
  expect(browserSessionSource).toContain('acquireLock: handler => activeTabLock.initializeActiveTabLock(handler)');
  expect(sessionLossSource.indexOf('await releaseResource()')).toBeLessThan(
    sessionLossSource.indexOf('releaseLock = null'),
  );
  expect(sessionLossSource).toContain("status: 'standby'");
});

test('projection routes never evict or duplicate an active embedded Runtime', () => {
  const lockSource = readFileSync('frontend/packages/browser/src/active-tab-lock.ts', 'utf8');
  const connectionSource = readFileSync('frontend/apps/wallet/src/runtime/wallet-runtime-read-boundary.ts', 'utf8');
  const shellSource = readFileSync('frontend/apps/wallet/src/app-shell.tsx', 'utf8');

  expect(lockSource).toContain("{ mode: 'exclusive', ifAvailable: true }");
  expect(lockSource).toContain('if (!acquiredLock) attempted.reject(error);');
  expect(lockSource).toContain('await state.lossInFlight;');
  expect(lockSource).toContain('state.acquireInFlight = true;');
  expect(lockSource).toContain('state.activeChannel && !state.acquireInFlight && !state.releaseHeldLock && !state.ownsWebLock');
  expect(connectionSource).toContain('return { adapter: await startWalletEmbeddedRuntime(), release: () => {} };');
  expect(connectionSource).toContain('const adapter = new remote.RemoteRuntimeAdapter();');
  expect(connectionSource).toContain('release: () => { adapter.disconnect(); }');
  expect(shellSource).toContain('const initializeEmbeddedRuntimeOnce = (): void => {');
  expect(shellSource).toContain('void startWalletEmbeddedRuntime()');
  expect(shellSource).not.toContain('stopWalletEmbeddedRuntime');
  const fastGateSource = readFileSync('core/scripts/e2e/runners/run-e2e-fast.ts', 'utf8');
  expect(fastGateSource).toContain("title: 'projection route cannot evict an active embedded Runtime owner'");
});
