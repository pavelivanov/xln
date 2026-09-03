import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const read = (path: string): string => readFileSync(path, 'utf8');

describe('React wallet push-wake controls', () => {
  test('keeps raw device tokens and owner signing inside the canonical bridge', () => {
    const bridge = read('frontend/bridges/wallet-canonical-push-wake.ts');
    expect(bridge).toContain('requestPushWakeDeviceToken()');
    expect(bridge).toContain("runtimes as runtimeRegistry");
    expect(bridge).toContain('PUSH_WAKE_RUNTIME_ENV_MISMATCH');
    expect(bridge).toContain('vaultOperations.signRuntimeOwnerMessage(');
    expect(bridge).toContain('buildPushWakeRegistrationRequest(');
    expect(bridge).toContain("'/api/push/register'");
    expect(bridge).toContain("'/api/push/unregister'");
    expect(bridge).toContain('PUSH_WAKE_RUNTIME_CHANGED');
    expect(bridge).toContain('PUSH_WAKE_ENTITY_CHANGED');
  });

  test('projects only redacted registration state into React', () => {
    const projection = read('frontend/packages/browser/src/wallet-push-wake.ts');
    const react = [
      read('frontend/apps/wallet/src/wallet-push-wake.tsx'),
      read('frontend/apps/wallet/src/wallet-push-wake-source.ts'),
    ].join('\n');
    expect(projection).toContain('registered: boolean');
    expect(projection).toContain('platform: WalletPushWakePlatform | null');
    expect(projection).not.toContain('token:');
    expect(projection).not.toContain('ownerSignature');
    expect(react).not.toContain('frontend/src/lib');
    expect(react).not.toContain("from '../../../src/lib");
    expect(react).not.toContain('requestPushWakeDeviceToken');
    expect(react).toContain("import('../../../bridges/wallet-canonical-push-wake')");
    expect(react).toContain('role="alert">{error}');
  });

  test('keeps enable and disable controls adjacent to saved recovery services', () => {
    const recovery = read('frontend/apps/wallet/src/wallet-recovery-services.tsx');
    const push = read('frontend/apps/wallet/src/wallet-push-wake.tsx');
    expect(recovery).toContain('<WalletPushWake');
    expect(recovery).toContain('setSavedRevision((revision) => revision + 1)');
    expect(push).toContain('Register this device');
    expect(push).toContain('Disable device wake');
    expect(push).toContain('view.services.length === 0');
  });
});
