import type { RuntimeAdapter, RuntimeReplica } from '../../core/api/public/runtime-module';
import { createRuntimeViewEnv, unwrapLiveRuntimeEnv } from '../src/lib/utils/runtime/liveRuntimeEnv';
import { snapshotRuntimeDiagnosticsIncidents, type RuntimeDiagnosticsIncident } from '../packages/runtime-client/src/runtime-diagnostics-panel-view';

// Local inspection is a capability of the already-owned browser session. A
// panel cannot resolve another Runtime by name or cause a new Runtime to boot.
const readers = new WeakMap<RuntimeAdapter, () => RuntimeReplica | null>();
export const registerBrowserRuntimeEnvironment = (adapter: RuntimeAdapter, read: () => RuntimeReplica | null): void => {
  if (adapter.mode !== 'embedded') throw new Error('BROWSER_RUNTIME_CONTEXT_REQUIRES_EMBEDDED');
  readers.set(adapter, read);
};
export const readBrowserRuntimeEnvironment = (adapter: RuntimeAdapter): RuntimeReplica | null => {
  const read = readers.get(adapter);
  if (!read) throw new Error('BROWSER_RUNTIME_CONTEXT_UNREGISTERED');
  const value = read();
  if (!value) return null;
  const env = unwrapLiveRuntimeEnv(value) ?? value;
  // The canonical embedded adapter identifies a seedless browser environment
  // as "embedded" until an owner Runtime exists. Keep that exact identity.
  const runtimeId = String(env.runtimeId || '').trim().toLowerCase() || 'embedded';
  if (runtimeId !== adapter.runtimeId.toLowerCase()) throw new Error(`BROWSER_RUNTIME_CONTEXT_MISMATCH:${runtimeId}:${adapter.runtimeId}`);
  return env;
};
export const readBrowserRuntimeView = (adapter: RuntimeAdapter): RuntimeReplica | null => {
  const env = readBrowserRuntimeEnvironment(adapter);
  if (env?.infrastructure?.stateMutationInFlight) throw new Error('BROWSER_RUNTIME_VIEW_REQUIRES_COMMITTED_STATE');
  return env ? createRuntimeViewEnv(env) : null;
};

export type BrowserRuntimeViewSnapshot = Readonly<{ env: RuntimeReplica | null; error: string; securityIncidents: readonly RuntimeDiagnosticsIncident[] }>;
type ViewSession = {
  snapshot: BrowserRuntimeViewSnapshot;
  listeners: Set<() => void>;
  readers: number;
  unsubscribe: () => void;
  refresh: () => void;
};
const views = new WeakMap<RuntimeAdapter, ViewSession>();

/** One detached post-commit projection per adapter, shared by all local panels. */
export const openBrowserRuntimeView = (adapter: RuntimeAdapter) => {
  let view = views.get(adapter);
  if (!view) {
    const current: ViewSession = { snapshot: { env: null, error: '', securityIncidents: [] }, listeners: new Set(), readers: 0, unsubscribe: () => {}, refresh: () => {} };
    const publish = () => {
      try {
        const env = readBrowserRuntimeView(adapter);
        // Live incident observations are separate from the detached committed
        // Runtime view. They never become history or expose mutable infrastructure.
        const incidents = readBrowserRuntimeEnvironment(adapter)?.infrastructure?.securityIncidents;
        current.snapshot = { env, error: '', securityIncidents: snapshotRuntimeDiagnosticsIncidents(incidents?.values() ?? []) };
      }
      catch (cause) { current.snapshot = { env: null, securityIncidents: [], error: cause instanceof Error ? cause.message : String(cause) }; }
      for (const listener of current.listeners) listener();
    };
    current.refresh = publish;
    publish();
    current.unsubscribe = adapter.onChange(publish);
    views.set(adapter, current);
    view = current;
  }
  const owned = view;
  owned.readers += 1;
  let released = false;
  return {
    getSnapshot: () => owned.snapshot,
    refresh: (): void => { if (!released) owned.refresh(); },
    subscribe: (listener: () => void): (() => void) => { owned.listeners.add(listener); return () => owned.listeners.delete(listener); },
    release: (): void => {
      if (released) return;
      released = true;
      owned.readers -= 1;
      if (owned.readers > 0) return;
      owned.unsubscribe();
      owned.listeners.clear();
      views.delete(adapter);
    },
  };
};
