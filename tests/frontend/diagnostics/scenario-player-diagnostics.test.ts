import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

describe('React scenario player diagnostics', () => {
  test('surfaces scenario failures and teardown diagnostics in UI', () => {
    const player = readFileSync('frontend/apps/ops/src/scenarios/ops-scenarios.tsx', 'utf8');
    const source = readFileSync('frontend/packages/browser/src/runtime/session/runtime-scenario-source.ts', 'utf8');

    expect(player).toContain('data-testid="scenario-error"');
    expect(player).toContain('data-testid="scenario-diagnostics"');
    expect(player).toContain('role="alert"');
    expect(source).toContain("status: 'error', statusText: 'Scenario failed', error: formatScenarioError(error)");
    expect(source).toContain("stopScenarioPreviewInfra(environment, 'scenario teardown')");
    expect(player).not.toContain('console.error');
    expect(player).not.toContain('console.warn');
  });

  test('does not expose retired BrowserVM runners', () => {
    const model = readFileSync('frontend/packages/runtime-client/src/scenario/scenario-player-model.ts', 'utf8');
    const player = readFileSync('frontend/apps/ops/src/scenarios/ops-scenarios.tsx', 'utf8');

    expect(model).not.toContain("id: 'lock-ahb'");
    expect(player).not.toContain('startHTLCTutorial');
  });

  test('records previews in an isolated Runtime environment', () => {
    const runtime = readFileSync('frontend/packages/runtime-client/src/scenario/scenario-runtime.ts', 'utf8');
    const preview = readFileSync('frontend/apps/wallet/src/scenario-preview/wallet-scenario-preview.tsx', 'utf8');

    expect(runtime).toContain('runtime.createEmptyEnv(`scenario-preview:${option.id}`)');
    expect(runtime).toContain('prepareScenarioPreviewEnv');
    expect(preview).toContain('No live wallet state is replaced.');
    expect(preview).toContain("snapshot.status === 'error'");
    expect(preview).toContain('role="alert"');
  });
});
