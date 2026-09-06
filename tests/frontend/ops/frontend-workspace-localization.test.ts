import { afterEach, expect, test } from 'bun:test';
import en from '../../../frontend/src/lib/i18n/locales/en.json';
import ru from '../../../frontend/src/lib/i18n/locales/ru.json';
import zh from '../../../frontend/src/lib/i18n/locales/zh.json';
import es from '../../../frontend/src/lib/i18n/locales/es.json';
import ja from '../../../frontend/src/lib/i18n/locales/ja.json';
import ko from '../../../frontend/src/lib/i18n/locales/ko.json';
import pt from '../../../frontend/src/lib/i18n/locales/pt.json';
import de from '../../../frontend/src/lib/i18n/locales/de.json';
import fr from '../../../frontend/src/lib/i18n/locales/fr.json';
import tr from '../../../frontend/src/lib/i18n/locales/tr.json';
import { readWorkspaceLocale, setWorkspaceLocale, t } from '../../../frontend/bridges/workspace-localization';
import { buildCommandPaletteSuggestions, localizeCommandPaletteSuggestion } from '../../../frontend/packages/ui/src/command-palette-suggestions';
import { isWorkspaceDefaultPanelTitle, workspacePanelTitle } from '../../../frontend/apps/ops/src/workspace/ops-panel-title';
import { WALLET_APP_LINKS } from '../../../frontend/apps/wallet/src/app-shell-model';

afterEach(() => setWorkspaceLocale('en'));

test('all ten workspace catalogs retain keys and interpolation parameters', () => {
  const parameters = (value: string) => [...value.matchAll(/\{\w+\}/g)].map(match => match[0]).sort();
  for (const catalog of [en, ru, zh, es, ja, ko, pt, de, fr, tr]) {
    expect(Object.keys(catalog.walletNavigation).sort()).toEqual(WALLET_APP_LINKS.map(link => link.label).sort());
    for (const link of WALLET_APP_LINKS) expect(catalog.walletNavigation[link.label].trim()).not.toBe('');
    expect(Object.keys(catalog.workspace).sort()).toEqual(Object.keys(en.workspace).sort());
    for (const key of Object.keys(en.workspace) as (keyof typeof en.workspace)[]) {
      expect(catalog.workspace[key].trim()).not.toBe('');
      expect(parameters(catalog.workspace[key])).toEqual(parameters(en.workspace[key]));
    }
  }
});

test('locale changes presentation while preserving command authority and user names', () => {
  const entityId = `0x${'ab'.repeat(32)}`;
  const commands = buildCommandPaletteSuggestions('pay 2.5 usdc to Alice', { entities: [{ id: entityId, name: 'Alice', isHub: false }] });
  expect(commands).toHaveLength(1);
  setWorkspaceLocale('ru');
  const translated = commands.map(command => localizeCommandPaletteSuggestion(command, t));
  expect(translated[0]?.action).toEqual(commands[0]?.action);
  expect(translated[0]?.label).toContain('Alice');
  expect(translated[0]?.label).not.toEqual(commands[0]?.label);
  expect(workspacePanelTitle('wallet-main', 'Main Wallet', t, true)).toBe(ru.workspace.mainWallet);
  expect(workspacePanelTitle('entity-panel:alice', 'Alice', t, true)).toBe('Alice');
  expect(workspacePanelTitle('entity-workspace', 'Entity', t, false)).toBe(ru.view.labels.entity);
  expect(isWorkspaceDefaultPanelTitle('wallet-main', ru.workspace.mainWallet, 'Main Wallet', true)).toBe(true);
  expect(isWorkspaceDefaultPanelTitle('wallet-main', 'My savings', 'Main Wallet', true)).toBe(false);
  expect(() => setWorkspaceLocale('unsupported')).toThrow('WORKSPACE_LOCALE_UNSUPPORTED');
  expect(readWorkspaceLocale()).toBe('ru');
});
