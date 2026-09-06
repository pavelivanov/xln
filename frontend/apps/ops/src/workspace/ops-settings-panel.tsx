import { useState, useSyncExternalStore } from 'react';
import type { ViewSettings } from '../../../../packages/runtime-client/src/settings-panel-view';
import { opsDisplayPreferencesSource } from '../ops-display-preferences';
import { opsGraphViewSettings, updateOpsGraphViewSettings } from './ops-graph-preferences';
import { OpsRuntimePolicies } from './ops-runtime-policies';
import { SettingsRange } from './ops-settings-range';
import { OpsSettingsCamera } from './ops-settings-camera';
import { OpsConsolePanel } from './ops-console-panel';
import { OpsStackManager } from './ops-stack-manager';
import { OpsSettingsPresentation } from './ops-settings-presentation';

const categories = ['Storage', 'Stack Manager', 'Scene', 'Camera', 'Entities', 'Performance', 'Console', 'Presentation'] as const;
type Category = typeof categories[number];
type NumericKey = { [K in keyof ViewSettings]: ViewSettings[K] extends number ? K : never }[keyof ViewSettings];

export function OpsSettingsPanel() {
  const [category, setCategory] = useState<Category>('Storage');
  const [issue, setIssue] = useState('');
  const view = useSyncExternalStore(opsGraphViewSettings.subscribe, opsGraphViewSettings.get);
  const display = useSyncExternalStore(opsDisplayPreferencesSource.subscribe, opsDisplayPreferencesSource.getSnapshot);
  const apply = (action: () => void): void => {
    try { action(); setIssue(''); } catch (cause) { setIssue(cause instanceof Error ? cause.message : String(cause)); }
  };
  const update = (patch: Partial<ViewSettings>): void => apply(() => updateOpsGraphViewSettings(patch));
  const range = (key: NumericKey, label: string, min: number, max: number, step: number) =>
    <SettingsRange label={label} value={view[key]} min={min} max={max} step={step} onChange={value => update({ [key]: value })} />;
  return <section className="ops-settings-panel" data-testid="workspace-settings">
    <header><h2>Settings</h2><p>Workspace appearance and local operator policy</p></header>
    <nav aria-label="Settings categories">{categories.map(name => <button key={name} type="button" aria-pressed={category === name} onClick={() => setCategory(name)}>{name}</button>)}</nav>
    {issue || display.issue ? <p role="alert">{issue || display.issue}</p> : null}
    <div className="ops-settings-content" key={category}>
      {category === 'Storage' ? <OpsRuntimePolicies kind="storage" /> : null}
      {category === 'Stack Manager' ? <OpsStackManager /> : null}
      {category === 'Scene' ? <>
        <h3>Scene</h3><label className="ops-settings-toggle"><input type="checkbox" checked={display.preferences.showXlnMascot} onChange={event => apply(() => opsDisplayPreferencesSource.setXlnGuideVisibility(event.currentTarget.checked))} /> Show xln guide</label>
        {range('gridSize', 'Grid size', 100, 2000, 50)}{range('gridDivisions', 'Grid divisions', 1, 200, 1)}{range('gridOpacity', 'Grid opacity', 0, 1, 0.05)}
        <label className="ops-settings-color">Grid color<input type="color" value={view.gridColor} onChange={event => update({ gridColor: event.currentTarget.value })} /></label>
      </> : null}
      {category === 'Camera' ? <OpsSettingsCamera view={view} update={update} /> : null}
      {category === 'Entities' ? <><h3>Entities</h3>{range('entityLabelScale', 'Entity label scale', 0.5, 4, 0.1)}{range('entitySizeMultiplier', 'Entity size multiplier', 0.5, 3, 0.1)}</> : null}
      {category === 'Performance' ? <>
        <h3>Graph performance</h3><label className="ops-settings-toggle"><input type="checkbox" checked={view.forceLayoutEnabled} onChange={event => update({ forceLayoutEnabled: event.currentTarget.checked })} /> Force layout</label>
        <label className="ops-settings-toggle"><input type="checkbox" checked={view.antiAlias} onChange={event => update({ antiAlias: event.currentTarget.checked })} /> Antialiasing</label><p>Antialiasing applies when Graph3D is closed and reopened.</p>
        <label className="ops-settings-toggle"><input type="checkbox" checked={view.showFpsOverlay} onChange={event => update({ showFpsOverlay: event.currentTarget.checked })} /> Show FPS and render stats</label>
        <label className="ops-settings-toggle"><input type="checkbox" checked={view.verboseLogging} onChange={event => update({ verboseLogging: event.currentTarget.checked })} /> Frontend debug logging</label>
        <OpsRuntimePolicies kind="performance" />
      </> : null}
      {category === 'Console' ? <OpsConsolePanel /> : null}
      {category === 'Presentation' ? <OpsSettingsPresentation /> : null}
    </div>
  </section>;
}
