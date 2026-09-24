import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

describe('React settings panel diagnostics', () => {
  test('surfaces preference write failures without raw console output', () => {
    const panel = readFileSync('frontend/apps/ops/src/workspace/settings/ops-settings-panel.tsx', 'utf8');

    expect(panel).toContain("const [issue, setIssue] = useState('');");
    expect(panel).toContain('catch (cause) { setIssue(cause instanceof Error ? cause.message : String(cause)); }');
    expect(panel).toContain('<p role="alert">{issue || display.issue}</p>');
    expect(panel).not.toContain('console.error');
    expect(panel).not.toContain('console.warn');
  });

  test('loads persisted view settings once at source construction', () => {
    const preferences = readFileSync('frontend/apps/ops/src/workspace/graph/ops-graph-preferences.ts', 'utf8');

    expect(preferences).toContain('const savedView = storage?.getItem(VIEW_SETTINGS_STORAGE_KEY);');
    expect(preferences).toContain('savedView ? parseViewSettings(savedView) : createDefaultViewSettings()');
    expect(preferences.match(/getItem\(VIEW_SETTINGS_STORAGE_KEY\)/g)).toHaveLength(1);
  });

  test('persists updates through the same observable source consumed by Graph3D', () => {
    const preferences = readFileSync('frontend/apps/ops/src/workspace/graph/ops-graph-preferences.ts', 'utf8');

    expect(preferences).toContain('storage?.setItem(VIEW_SETTINGS_STORAGE_KEY, serializeViewSettings(next));');
    expect(preferences).toContain('opsGraphViewSettings.set(next);');
  });

  test('keeps WebGPU explicit opt-in because API presence does not prove adapter availability', () => {
    const panel = readFileSync('frontend/apps/ops/src/workspace/settings/ops-settings-panel.tsx', 'utf8');
    const shared = readFileSync('frontend/packages/runtime-client/src/panels/settings-panel-view.ts', 'utf8');

    expect(shared).toContain("rendererMode: 'webgl'");
    expect(panel).toContain('<option value="webgpu">WebGPU</option>');
    expect(panel).not.toContain("rendererMode = 'webgpu'");
    expect(panel).not.toContain('if (typeof navigator');
  });
});
