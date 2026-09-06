import { locale, LOCALES, t, translateForLocale, type Locale } from '../src/lib/i18n';
import { readStoreValue } from '../src/lib/utils/observableStore';

export { LOCALES, t };
export const workspaceTranslationsForKey = (key: string): readonly string[] =>
  (Object.keys(LOCALES) as Locale[]).map(value => translateForLocale(value, key));
export const readWorkspaceLocale = (): Locale => readStoreValue(locale);
export const subscribeWorkspaceLocale = (listener: () => void): (() => void) => locale.subscribe(listener);
export const setWorkspaceLocale = (value: string): void => {
  const supported = Object.keys(LOCALES).find((key): key is Locale => key === value);
  if (!supported) throw new Error(`WORKSPACE_LOCALE_UNSUPPORTED:${value}`);
  locale.set(supported);
};
