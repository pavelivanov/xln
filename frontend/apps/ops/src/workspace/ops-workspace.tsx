import { useWorkspaceTranslation } from '../../../../bridges/workspace-localization-react';
import { isWorkspaceDefaultPanelTitle, workspacePanelTitle } from './ops-panel-title';
import { OpsCommandPalette } from './ops-command-palette';
import type { CommandPaletteCommand } from '../../../../packages/ui/src/command-palette-suggestions';
import { opsEntityWorkspaceSource } from '../ops-entity-workspace-runtime';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { themeDark, type DockviewApi } from 'dockview';
import { components, panels, createInternalWorkspacePanels, createFullWorkspacePanels } from './ops-workspace-panels';

import { WorkspaceDock } from '../../../../packages/ui/src/workspace-dock';
import { OpsWorkspaceNavigation, OpsWorkspaceJurisdictionNavigation, OpsWorkspaceIdentityNavigation, OpsWorkspaceWalletNavigation } from './ops-workspace-navigation';
import { OpsShell } from '../ops-shell';
import { OpsWorkspaceTimeline } from './ops-workspace-timeline';
import { workspaceBoot, workspaceNetwork } from './ops-workspace-playback';
import { OpsOwnerUnlock } from './ops-owner-unlock';
import { OpsLocaleSelector } from './ops-locale-selector';
import { OpsWorkspaceGuide } from './ops-workspace-guide';
import { opsDisplayPreferencesSource } from '../ops-display-preferences';
import { OpsPinnedTab } from './ops-pinned-tab';
import './ops-workspace.css';

const navigatePanel = (api: DockviewApi, navigate: () => void): void => {
  const focused = api.hasMaximizedGroup();
  if (focused) api.exitMaximizedGroup();
  navigate();
  if (focused && api.activePanel) api.maximizeGroup(api.activePanel);
};

const openPanel = (api: DockviewApi, id: string): void => navigatePanel(api, () => {
  const existing = api.getPanel(id);
  if (existing) { existing.api.setActive(); return; }
  const definition = panels.find(panel => panel.id === id);
  if (!definition) throw new Error(`OPS_WORKSPACE_PANEL_UNKNOWN:${id}`);
  const activePanel = api.activePanel;
  api.addPanel({
    ...definition,
    ...(activePanel ? { position: { direction: 'within', referencePanel: activePanel.id } } : {}),
  });
});

export function OpsWorkspacePage({ publicEmbed = false }: Readonly<{ publicEmbed?: boolean }>) {
  const { locale, t } = useWorkspaceTranslation();
  const display = useSyncExternalStore(opsDisplayPreferencesSource.subscribe, opsDisplayPreferencesSource.getSnapshot);
  const [api, setApi] = useState<DockviewApi | null>(null);
  const [issue, setIssue] = useState('');
  const [focused, setFocused] = useState(false);
  const [initialPanels] = useState(() => publicEmbed
    ? createFullWorkspacePanels(true, window.innerWidth, window.innerHeight)
    : createInternalWorkspacePanels(workspaceBoot.kind === 'plain'));
  const translatedTitles = useRef(new Map<string, string>());
  const panelTitle = (id: string, title: string): string => workspacePanelTitle(id, title, t, publicEmbed);
  const navigationId = useRef(0);
  const openIdentity = (): void => {
    if (!api) throw new Error('OPS_WORKSPACE_DOCK_UNAVAILABLE');
    openPanel(api, 'brainvault');
  };
  const openWallet = (href: string): void => {
    if (!api) throw new Error('OPS_WORKSPACE_DOCK_UNAVAILABLE');
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin || url.pathname !== '/app') throw new Error('OPS_WALLET_NAVIGATION_INVALID');
    openPanel(api, 'wallet-main');
    const wallet = api.getPanel('wallet-main');
    if (!wallet) throw new Error('OPS_WALLET_PANEL_MISSING');
    wallet.api.updateParameters({ navigation: { id: ++navigationId.current, href } });
  };
  const openJurisdiction = (name: string): void => {
    if (!api) throw new Error('OPS_WORKSPACE_DOCK_UNAVAILABLE');
    if (!name.trim()) throw new Error('OPS_WORKSPACE_JURISDICTION_NAME_INVALID');
    const id = `jurisdiction:${name}`;
    navigatePanel(api, () => {
    const existing = api.getPanel(id);
    if (existing) { existing.api.setActive(); return; }
    api.addPanel({ id, component: 'jurisdiction', title: name, params: { jurisdictionName: name },
      ...(api.activePanel ? { position: { direction: 'within', referencePanel: api.activePanel.id } } : {}),
    });
    });
  };
  const openEntity = (entityId: string, title: string): void => {
    if (!api) throw new Error('OPS_WORKSPACE_DOCK_UNAVAILABLE');
    if (!/^0x[0-9a-f]{64}$/i.test(entityId)) throw new Error('OPS_WORKSPACE_ENTITY_ID_INVALID');
    const id = `entity-panel:${entityId.toLowerCase()}`;
    navigatePanel(api, () => {
    const existing = api.getPanel(id);
    if (existing) { existing.api.setActive(); return; }
    api.addPanel({ id, component: 'entity-panel', title, params: { entityId },
      ...(api.activePanel ? { position: { direction: window.innerWidth <= 760 ? 'within' : 'right', referencePanel: api.activePanel.id } } : {}),
    });
    });
  };
  const paletteCommand = (command: CommandPaletteCommand): void => {
    if (!api) throw new Error('Workspace panels are still loading.');
    if (command.type === 'explore') { openEntity(command.args.entityId, `Entity ${command.args.entityId.slice(0, 10)}`); return; }
    if (command.type === 'navigate' && command.args.tab === 'settings') { openPanel(api, 'settings'); return; }
    if (workspaceNetwork.get().selectedStep) throw new Error('Return to Live to open a Wallet draft.');
    const adapter = opsEntityWorkspaceSource.getAdapter();
    if (!adapter) throw new Error('Select a Runtime and unlock its owner to open the Wallet.');
    if (command.type === 'navigate') { openWallet('/app?portfolio=1'); return; }
    openPanel(api, 'wallet-main');
    const wallet = api.getPanel('wallet-main');
    if (!wallet) throw new Error('OPS_WALLET_PANEL_MISSING');
    const id = ++navigationId.current;
    const href = command.type === 'pay' ? '/app#accounts/send' : command.type === 'swap' ? '/app#accounts/swap' : '/app#accounts/open';
    wallet.api.updateParameters({ navigation: { id, href, runtimeId: adapter.runtimeId, command: { ...command, id } } });
  };
  useEffect(() => {
    if (!api) return;
    const focusEntity = (): void => openPanel(api, 'entity-workspace');
    window.addEventListener('hashchange', focusEntity);
    return () => window.removeEventListener('hashchange', focusEntity);
  }, [api]);
  useEffect(() => {
    if (!api) return;
    setFocused(api.hasMaximizedGroup());
    const subscription = api.onDidMaximizedGroupChange(() => setFocused(api.hasMaximizedGroup()));
    return () => subscription.dispose();
  }, [api]);
  useEffect(() => {
    if (!api) return;
    const translatePanels = (): void => {
    for (const definition of panels) {
      const panel = api.getPanel(definition.id);
      if (!panel) continue;
      const initial = initialPanels.find(item => item.id === definition.id)?.title ?? definition.title;
      const previous = translatedTitles.current.get(definition.id);
      const title = panelTitle(definition.id, initial);
      // Persisted user titles and dynamically named Entity panels remain owned by the user.
      if (panel.title === previous || isWorkspaceDefaultPanelTitle(definition.id, panel.title, initial, publicEmbed)) panel.api.setTitle(title);
      translatedTitles.current.set(definition.id, title);
    }
    };
    translatePanels();
    const subscription = api.onDidAddPanel(translatePanels);
    return () => subscription.dispose();
  }, [api, locale]);
  const resetLayout = (): void => {
    if (!api) return;
    api.exitMaximizedGroup(); api.clear();
    for (const panel of initialPanels) api.addPanel(panel);
    setIssue('');
  };
  const workspace = (
      <section className={`ops-workspace${publicEmbed ? ' is-public-embed' : ''}${focused ? ' is-focused' : ''}`} data-testid="ops-workspace" data-host={publicEmbed ? 'public' : 'internal'}>
        <header className="ops-workspace-toolbar">
          <strong>{t('workspace.title')}</strong>
          <OpsOwnerUnlock />
          <OpsLocaleSelector />
          <OpsCommandPalette onCommand={paletteCommand} />
          {publicEmbed ? <nav aria-label={t('workspace.panelsLabel')}><select aria-label={t('workspace.panelMenu')} disabled={api === null} value="" onChange={event => { if (api && event.currentTarget.value) {
            openPanel(api, event.currentTarget.value);
          } }}><option value="">{t('nav.panels')}</option>{panels.map(panel => <option key={panel.id} value={panel.id}>{panelTitle(panel.id, panel.title)}</option>)}</select>
            <button disabled={!api} aria-pressed={focused} type="button" onClick={() => { if (!api) return; if (api.hasMaximizedGroup()) api.exitMaximizedGroup(); else if (api.activePanel) api.maximizeGroup(api.activePanel); }}>{focused ? t('workspace.fullLayout') : t('workspace.focusPanel')}</button>
            <button disabled={!api} onClick={resetLayout} type="button">{t('workspace.resetLayout')}</button>
          </nav> : <nav aria-label={t('workspace.panelsLabel')}>
            {panels.map(panel => (
              <button aria-label={t('workspace.openPanel', { title: panelTitle(panel.id, panel.title) })} disabled={api === null} key={panel.id} onClick={() => { if (api) openPanel(api, panel.id); }} type="button">{panelTitle(panel.id, panel.title)}</button>
            ))}
          </nav>}
        </header>
        {issue ? <p className="workspace-read-state is-error" role="alert">{issue}</p> : null}
        <div className="ops-workspace-dock" data-testid="ops-workspace-dock">
          <OpsWorkspaceNavigation.Provider value={openEntity}><OpsWorkspaceJurisdictionNavigation.Provider value={openJurisdiction}><OpsWorkspaceWalletNavigation.Provider value={openWallet}><OpsWorkspaceIdentityNavigation.Provider value={openIdentity}><WorkspaceDock
            className="ops-workspace-layout"
            components={components}
            onDiagnostic={diagnostic => setIssue(diagnostic.cause instanceof Error ? diagnostic.cause.message : String(diagnostic.cause))}
            onReady={event => {
              setApi(event.api);
              if (publicEmbed && (workspaceBoot.kind !== 'plain' || window.innerWidth <= 760)) {
                const graph = event.api.getPanel('graph3d');
                if (graph) { graph.api.setActive(); event.api.maximizeGroup(graph); }
              }
            }}
            panels={initialPanels}
            // The complete canonical registry owns its persisted layout. This
            // in-progress internal host must not overwrite it with a partial registry.
            {...(publicEmbed ? {} : { storage: null })}
            tabComponents={{ 'pinned-tab': OpsPinnedTab }}
            theme={themeDark}
          /></OpsWorkspaceIdentityNavigation.Provider></OpsWorkspaceWalletNavigation.Provider></OpsWorkspaceJurisdictionNavigation.Provider></OpsWorkspaceNavigation.Provider>
        </div>
        <OpsWorkspaceTimeline />
        {display.preferences.showXlnMascot ? <OpsWorkspaceGuide /> : null}
      </section>
  );
  return publicEmbed ? <main className="ops-public-embed">{workspace}</main> : <OpsShell activePath="/embed">{workspace}</OpsShell>;
}
