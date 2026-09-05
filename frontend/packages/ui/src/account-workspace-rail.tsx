import { useRef, type MouseEvent } from 'react';
import type { AccountWorkspaceTab } from '../../runtime-client/src/entity-workspace-navigation';
import './account-workspace-rail.css';

type RailTab = Readonly<{ id: AccountWorkspaceTab; label: string; href: string }>;

const iconPaths: Readonly<Record<AccountWorkspaceTab, string>> = {
  open: 'M12 8v8m-4-4h8M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  send: 'M7 17 17 7M7 7h10v10', receive: 'M17 7 7 17M7 7v10h10',
  swap: 'm17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3',
  move: 'm3 10 9-7 9 7H3m1 11h16M6 10v8m6-8v8m6-8v8',
  lending: 'M2 6h20v12H2V6m14 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  history: 'M3 12h4l3-8 4 16 3-8h4', activity: 'M3 12h4l3-8 4 16 3-8h4',
  configure: 'M4 7h16M4 17h16M8 4v6m8 4v6',
  appearance: 'M4 7h16M4 17h16M8 4v6m8 4v6',
};

function RailIcon({ id }: Readonly<{ id: AccountWorkspaceTab }>) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={iconPaths[id]} /></svg>;
}

export function AccountWorkspaceRail({ tabs, activeTab, onNavigate }: Readonly<{
  tabs: readonly RailTab[]; activeTab: AccountWorkspaceTab | null; onNavigate: (href: string) => void;
}>) {
  const fold = useRef<HTMLDetailsElement>(null);
  const current = tabs.find(tab => tab.id === activeTab) ?? tabs[0];
  const navigate = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (fold.current?.open) {
      fold.current.open = false;
      fold.current.querySelector('summary')?.focus();
    }
    onNavigate(href);
  };
  const links = tabs.map(tab => <a key={tab.id} href={tab.href} aria-current={activeTab === tab.id ? 'page' : undefined}
    data-testid={`account-workspace-tab-${tab.id}`} onClick={event => navigate(event, tab.href)}>
    <RailIcon id={tab.id} /><span>{tab.label}</span>
  </a>);
  return <div className="react-account-workspace-rail">
    <nav className="account-rail-desktop" aria-label="Account workspace">{links}</nav>
    {current ? <details className="account-rail-mobile" ref={fold} onKeyDown={event => {
      if (event.key === 'Escape' && fold.current) { fold.current.open = false; fold.current.querySelector('summary')?.focus(); }
    }}>
      <summary data-testid="account-workspace-mobile-toggle"><span><RailIcon id={current.id} />{current.label}</span><span aria-hidden="true">☰⌄</span></summary>
      <nav aria-label="Account workspace">{links}</nav>
    </details> : null}
  </div>;
}
