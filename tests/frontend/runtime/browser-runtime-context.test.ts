import { describe, expect, test } from 'bun:test';
import type { RuntimeAdapter } from '../../../core/api/public/runtime-module';
import {
  openBrowserRuntimeView,
  readBrowserRuntimeEnvironment,
  registerBrowserRuntimeEnvironment,
} from '../../../frontend/bridges/runtime/browser/browser-runtime-context';

const unavailable = async (): Promise<never> => {
  throw new Error('TEST_ADAPTER_OPERATION_UNAVAILABLE');
};

const createAdapter = (onUnsubscribe: () => void): RuntimeAdapter => ({
  mode: 'embedded',
  runtimeId: 'runtime-context-test',
  serverFingerprint: null,
  status: 'connected',
  currentHeight: 0,
  nextCommandSequence: null,
  commandLaneKind: null,
  authLevel: 'admin',
  commandReady: true,
  commandReadyReason: null,
  connect: async () => {},
  disconnect: () => {},
  ensureOwnerCommandLane: async () => {},
  read: unavailable,
  send: unavailable,
  submitCrossJurisdictionIntent: unavailable,
  registerNumberedEntities: unavailable,
  deriveBrainVault: unavailable,
  revealBrainVaultMnemonic: unavailable,
  control: unavailable,
  onChange: () => onUnsubscribe,
  onStatus: () => () => {},
});

describe('browser Runtime context lifecycle', () => {
  test('releases explicit environment and shared view ownership', () => {
    let unsubscribeCount = 0;
    const adapter = createAdapter(() => { unsubscribeCount += 1; });
    const unregister = registerBrowserRuntimeEnvironment(adapter, () => null);
    const first = openBrowserRuntimeView(adapter);
    const second = openBrowserRuntimeView(adapter);

    expect(first.getSnapshot()).toEqual({ env: null, error: '', securityIncidents: [] });
    first.release();
    expect(unsubscribeCount).toBe(0);
    second.release();
    expect(unsubscribeCount).toBe(1);

    unregister();
    expect(() => readBrowserRuntimeEnvironment(adapter))
      .toThrow('BROWSER_RUNTIME_CONTEXT_UNREGISTERED');
  });
});
