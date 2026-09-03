import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { inferRecoveryTowerSetupMode } from '../../../frontend/src/lib/utils/recovery/recoverySettings';

describe('React wallet recovery-service onboarding', () => {
  test('infers every canonical setup mode from persisted tower configuration', () => {
    const officialUrl = 'https://xln.finance';
    expect(inferRecoveryTowerSetupMode({ towers: [{
      url: officialUrl, towerMode: 'delayed_last_resort', enabled: true,
    }] }, officialUrl)).toBe('official');
    expect(inferRecoveryTowerSetupMode({ towers: [{
      url: officialUrl, towerMode: 'blind_backup', enabled: true,
    }] }, officialUrl)).toBe('backup_only');
    expect(inferRecoveryTowerSetupMode({ towers: [{
      url: 'https://manual.example.com', towerMode: 'blind_backup', enabled: true,
    }] }, officialUrl)).toBe('local_only');
    expect(inferRecoveryTowerSetupMode({ towers: [] }, null)).toBe('local_only');
  });

  test('keeps Runtime authority and persistence in the canonical bridge', () => {
    const bridge = readFileSync('frontend/bridges/wallet-canonical-recovery-services.ts', 'utf8');
    expect(bridge).toContain('RECOVERY_SERVICES_RUNTIME_CHANGED');
    expect(bridge).toContain('vaultOperations.assertRuntimeAuthority(runtime.id)');
    expect(bridge).toContain('vaultOperations.updateRuntimeRecovery(');
    expect(bridge).toContain('buildRuntimeRecoveryConfigForMode(');
    expect(bridge).toContain('normalizeRecoveryUrl(service.url)');
  });

  test('keeps React on public projections without importing the Svelte application', () => {
    const source = [
      readFileSync('frontend/apps/wallet/src/wallet-recovery-services.tsx', 'utf8'),
      readFileSync('frontend/apps/wallet/src/wallet-recovery-services-source.ts', 'utf8'),
    ].join('\n');
    expect(source).not.toContain('frontend/src/lib');
    expect(source).not.toContain("from '../../../src/lib");
    expect(source).not.toContain('runtime.seed');
    expect(source).not.toContain('mnemonic');
    expect(source).toContain("import('../../../bridges/wallet-canonical-recovery-services')");
    expect(source).toContain('role="alert">{error}');
  });
});
