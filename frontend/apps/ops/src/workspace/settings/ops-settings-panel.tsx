import { useState, useSyncExternalStore } from 'react';
import type { ViewSettings } from '../../../../../packages/runtime-client/src/panels/settings-panel-view';
import { opsDisplayPreferencesSource } from '../../ops-display-preferences';
import { opsGraphViewSettings, updateOpsGraphViewSettings } from '../graph/ops-graph-preferences';
import { OpsRuntimePolicies } from '../runtime/ops-runtime-policies';
import { SettingsRange } from './ops-settings-range';
import { OpsSettingsCamera } from './ops-settings-camera';
import { OpsConsolePanel } from '../panels/ops-console-panel';
import { OpsStackManager } from '../runtime/ops-stack-manager';
import { OpsSettingsPresentation } from './ops-settings-presentation';
import { useWorkspaceTranslation } from '../../../../../bridges/workspace-localization-react';

const categories = ['Storage', 'Stack Manager', 'Scene', 'Camera', 'Entities', 'Effects', 'Performance', 'Console', 'Presentation'] as const;
type Category = typeof categories[number];
type NumericKey = { [K in keyof ViewSettings]: ViewSettings[K] extends number ? K : never }[keyof ViewSettings];

export function OpsSettingsPanel() {
  const { t } = useWorkspaceTranslation();
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
    <header><h2>{t('settings.title')}</h2><p>{t('workspace.title')} appearance and local operator policy</p></header>
    <nav aria-label={`${t('settings.title')} categories`}>{categories.map(name => <button key={name} type="button" aria-pressed={category === name} onClick={() => setCategory(name)}>{name === 'Entities' ? t('network.entities') : name === 'Console' ? t('workspace.console') : name}</button>)}</nav>
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
      {category === 'Entities' ? <><h3>{t('network.entities')}</h3>{range('entityLabelScale', `${t('view.labels.entity')} label scale`, 0.5, 4, 0.1)}{range('entitySizeMultiplier', `${t('view.labels.entity')} size multiplier`, 0.5, 3, 0.1)}</> : null}
      {category === 'Effects' ? <><h3>Visual effects</h3>
        <label className="ops-settings-toggle"><input type="checkbox" checked={view.lightningEnabled} onChange={event => update({ lightningEnabled: event.currentTarget.checked })} /> Enable lightning animation</label>
        {range('lightningSpeed', 'Lightning duration (ms)', 50, 500, 10)}
        <label className="ops-settings-toggle"><input type="checkbox" checked={view.broadcastEnabled} onChange={event => update({ broadcastEnabled: event.currentTarget.checked })} /> Enable jurisdiction broadcast</label>
        <fieldset><legend>Broadcast style</legend>{(['raycast', 'wave', 'particles'] as const).map(style => <label key={style} className="ops-settings-toggle"><input type="radio" name="ops-broadcast-style" checked={view.broadcastStyle === style} onChange={() => update({ broadcastStyle: style })} /> {style}</label>)}</fieldset>
      </> : null}
      {category === 'Performance' ? <>
        <h3>{t('view.title')} performance</h3><label className="ops-settings-input">Renderer<select aria-label="Renderer" value={view.rendererMode} onChange={event => update({ rendererMode: event.currentTarget.value === 'webgpu' ? 'webgpu' : 'webgl' })}><option value="webgl">WebGL (compatible)</option><option value="webgpu">WebGPU</option></select></label>
        <label className="ops-settings-toggle"><input type="checkbox" checked={view.forceLayoutEnabled} onChange={event => update({ forceLayoutEnabled: event.currentTarget.checked })} /> {t('workspace.forceLayout')}</label>
        {range('vrScaleMultiplier', 'XR graph scale', 0.25, 4, 0.25)}
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
