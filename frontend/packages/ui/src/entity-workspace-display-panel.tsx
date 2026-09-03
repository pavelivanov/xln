import {
  getThemeCoreColors,
  getThemeOptions,
  type ThemeName,
} from './theme-model';
import './entity-workspace-display-panel.css';

const THEME_OPTIONS = getThemeOptions();

export type EntityWorkspaceDisplayPreferences = Readonly<{
  showTimeMachine: boolean;
  showXlnMascot: boolean;
  theme: ThemeName;
}>;

type EntityWorkspaceDisplayPanelProps = Readonly<{
  issue: string | null;
  onSelectTheme: (theme: ThemeName) => void;
  preferences: EntityWorkspaceDisplayPreferences;
}>;

export function EntityWorkspaceDisplayPanel({
  issue,
  onSelectTheme,
  preferences,
}: EntityWorkspaceDisplayPanelProps) {
  const theme = getThemeCoreColors(preferences.theme);
  return (
    <section className="entity-workspace-display" data-testid="settings-display-panel">
      <header>
        <div>
          <span>Display preferences</span>
          <strong>{theme.name} palette</strong>
        </div>
        <div className="entity-workspace-display-swatches" aria-label={`${theme.name} palette preview`}>
          <i style={{ background: theme.background }} />
          <i style={{ background: theme.surface }} />
          <i style={{ background: theme.accentColor }} />
        </div>
      </header>
      <label className="entity-workspace-display-theme">
        <span>
          <strong>Theme</strong>
          <small>Applied immediately and saved to the shared browser preference record.</small>
        </span>
        <select
          aria-label="Theme"
          data-testid="settings-theme-select"
          onChange={event => onSelectTheme(event.currentTarget.value as ThemeName)}
          value={preferences.theme}
        >
          {THEME_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
      <dl className="entity-workspace-display-boundaries">
        <div>
          <dt>Time Machine</dt>
          <dd><b>{preferences.showTimeMachine ? 'Shown' : 'Hidden'}</b><span>Canonical workspace control</span></dd>
        </div>
        <div>
          <dt>xln guide</dt>
          <dd><b>{preferences.showXlnMascot ? 'Shown' : 'Hidden'}</b><span>Canonical workspace control</span></dd>
        </div>
      </dl>
      {issue ? <p className="entity-workspace-display-issue" role="alert">{issue}</p> : null}
      <footer>
        <span>Shared storage</span>
        <strong>xln-settings · theme write only</strong>
      </footer>
    </section>
  );
}
