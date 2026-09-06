import { useSyncExternalStore } from 'react';
import { readWorkspaceLocale, subscribeWorkspaceLocale, t } from './workspace-localization';

// React subscribes to the same locale/catalog as the retained application.
export function useWorkspaceTranslation() {
  const locale = useSyncExternalStore(subscribeWorkspaceLocale, readWorkspaceLocale);
  return { locale, t };
}
