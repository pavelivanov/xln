import {
  getThemeCoreColors,
  getThemeOptions,
  type ThemeName,
} from '../../theme-model';
import './entity-workspace-display-panel.css';

const THEME_OPTIONS = getThemeOptions();
const DEFAULT_DISPLAY_COPY: Readonly<Record<string, string>> = {
  'settings.theme': 'Theme',
  'settings.themes.dark': 'Dark',
  'settings.themes.light': 'Light',
};

export type EntityWorkspaceDisplayPreferences = Readonly<{
  showTimeMachine: boolean;
  showXlnMascot: boolean;
  theme: ThemeName;
}>;

type EntityWorkspaceDisplayPanelProps = Readonly<{
  issue: string | null;
  onSelectTheme: (theme: ThemeName) => void;
  onToggleTimeMachine: (show: boolean) => void;
  onToggleXlnGuide: (show: boolean) => void;
  preferences: EntityWorkspaceDisplayPreferences;
  showWorkspaceControls?: boolean;
  translate?: (key: string) => string;
}>;

export function EntityWorkspaceDisplayPanel({
  issue,
  onSelectTheme,
  onToggleTimeMachine,
  onToggleXlnGuide,
  preferences,
  showWorkspaceControls = true,
  translate = key => DEFAULT_DISPLAY_COPY[key] ?? key,
}: EntityWorkspaceDisplayPanelProps) {
  const theme = getThemeCoreColors(preferences.theme);
  const themeName = preferences.theme === 'dark'
    ? translate('settings.themes.dark')
    : preferences.theme === 'light' ? translate('settings.themes.light') : theme.name;
  return (
    <section className={`entity-workspace-display${showWorkspaceControls ? '' : ' is-theme-only'}`} data-testid="settings-display-panel">
      <header>
        <div>
          <span>Display preferences</span>
          <strong>{themeName} palette</strong>
        </div>
        <div className="entity-workspace-display-swatches" aria-label={`${themeName} palette preview`}>
          <i style={{ background: theme.background }} />
          <i style={{ background: theme.surface }} />
          <i style={{ background: theme.accentColor }} />
        </div>
      </header>
      <label className="entity-workspace-display-theme">
        <span>
          <strong>{translate('settings.theme')}</strong>
          <small>Applied immediately and saved to the shared browser preference record.</small>
        </span>
        <select
          aria-label={translate('settings.theme')}
          data-testid="settings-theme-select"
          onChange={event => onSelectTheme(event.currentTarget.value as ThemeName)}
          value={preferences.theme}
        >
          {THEME_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.value === 'dark'
              ? translate('settings.themes.dark') : option.value === 'light'
                ? translate('settings.themes.light') : option.label}</option>
          ))}
        </select>
      </label>
      {showWorkspaceControls ? <label className="entity-workspace-display-toggle">
        <span>
          <strong>Time Machine</strong>
          <small>Show exact committed Runtime history below the workspace.</small>
        </span>
        <input
          checked={preferences.showTimeMachine}
          data-testid="settings-time-machine-toggle"
          onChange={event => onToggleTimeMachine(event.currentTarget.checked)}
          type="checkbox"
        />
      </label> : null}
      {showWorkspaceControls ? <label className="entity-workspace-display-toggle">
        <span>
          <strong>xln guide</strong>
          <small>Show the draggable logo and local AI mini-chat on the canonical workspace.</small>
        </span>
        <input
          checked={preferences.showXlnMascot}
          data-testid="settings-xln-mascot-toggle"
          onChange={event => onToggleXlnGuide(event.currentTarget.checked)}
          type="checkbox"
        />
      </label> : null}
      {issue ? <p className="entity-workspace-display-issue" role="alert">{issue}</p> : null}
      <footer>
        <span>Shared storage</span>
        <strong>xln-settings · field-scoped writes</strong>
      </footer>
    </section>
  );
}
