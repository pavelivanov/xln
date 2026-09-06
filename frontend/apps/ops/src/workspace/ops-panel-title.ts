import { workspaceTranslationsForKey } from '../../../../bridges/workspace-localization';

type Translate = (key: string) => string;
const keys: Readonly<Record<string, string>> = {
  'entity-workspace': 'view.labels.entity',
  'wallet-main': 'workspace.wallet', architect: 'workspace.architect', jurisdiction: 'workspace.jurisdiction',
  gossip: 'workspace.gossip', solvency: 'workspace.solvency', 'runtime-diagnostics': 'workspace.diagnostics',
  'entity-audit': 'workspace.audit', console: 'workspace.console', 'leveldb-inspector': 'workspace.database',
  'runtime-manager': 'workspace.runtimes', 'runtime-io': 'workspace.runtimeIo',
  'jmachine-inspector': 'workspace.jInspector', settings: 'settings.title',
};

export const workspacePanelTitle = (id: string, title: string, t: Translate, publicEmbed: boolean): string => {
  if (id === 'wallet-main' && publicEmbed) return t('workspace.mainWallet');
  if (id === 'jurisdiction' && publicEmbed) return 'J-Machine';
  const key = keys[id];
  return key ? t(key) : title;
};

export const isWorkspaceDefaultPanelTitle = (id: string, title: string | undefined, original: string, publicEmbed: boolean): boolean => {
  if (title === undefined) return false;
  if (title === original) return true;
  const key = id === 'wallet-main' && publicEmbed ? 'workspace.mainWallet' : keys[id];
  return Boolean(key && workspaceTranslationsForKey(key).includes(title));
};
