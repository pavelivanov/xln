import { useEffect, useSyncExternalStore } from 'react';
import { LOCALES, readWorkspaceLocale, setWorkspaceLocale, subscribeWorkspaceLocale, t } from '../../../../bridges/workspace-localization';

export function OpsLocaleSelector() {
  const locale = useSyncExternalStore(subscribeWorkspaceLocale, readWorkspaceLocale);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  return <label className="ops-locale-selector">{t('settings.language')} <select aria-label={t('workspace.languageLabel')} value={locale} onChange={event => setWorkspaceLocale(event.currentTarget.value)}>{Object.entries(LOCALES).map(([id, language]) => <option key={id} value={id}>{language.flag} {language.name}</option>)}</select></label>;
}
