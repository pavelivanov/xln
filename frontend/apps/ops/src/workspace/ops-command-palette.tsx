import { useWorkspaceTranslation } from '../../../../bridges/workspace-localization-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { buildCommandPaletteSuggestions, localizeCommandPaletteSuggestion, type CommandPaletteCommand, type CommandPaletteSuggestion } from '../../../../packages/ui/src/workspace/command-palette-suggestions';
import { readOpsGossipDirectory } from './session/ops-workspace-query';
import { useWorkspaceQuery } from './session/use-workspace-query';
import { workspaceNetwork } from './session/ops-workspace-playback';

export function OpsCommandPalette({ onCommand }: Readonly<{ onCommand: (command: CommandPaletteCommand) => void }>) {
  const { t } = useWorkspaceTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [issue, setIssue] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const network = useSyncExternalStore(workspaceNetwork.subscribe, workspaceNetwork.get);
  const live = useWorkspaceQuery(readOpsGossipDirectory, open && !network.selectedStep);
  const frame = network.selectedStep ? network.frames.get(network.selectedStep.activeRuntimeId) : null;
  const entities = network.selectedStep
    ? (frame?.entities ?? []).map(entity => ({ id: entity.summary.entityId, name: entity.summary.label, isHub: entity.summary.isHub === true }))
    : (live.snapshot.data?.directory.profiles ?? []).map(profile => ({ id: profile.entityId, name: profile.name || profile.entityId, isHub: profile.isHub }));
  const suggestions = buildCommandPaletteSuggestions(query, { entities }).map(suggestion => localizeCommandPaletteSuggestion(suggestion, t));
  const active = Math.min(selected, Math.max(0, suggestions.length - 1));
  const close = (): void => { setOpen(false); };
  useEffect(() => {
    const key = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
      const target = event.target;
      if (!open && target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select'))) return;
      event.preventDefault(); setOpen(value => !value);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [open]);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open) { setQuery(''); setSelected(0); setIssue(''); element.showModal(); input.current?.focus(); }
    else if (element.open) { element.close(); trigger.current?.focus(); }
  }, [open]);
  const choose = (suggestion: CommandPaletteSuggestion): void => {
    const action = suggestion.action;
    if (action.type === 'input') { setQuery(action.value); setSelected(0); input.current?.focus(); return; }
    if (action.type !== 'command') return;
    try { onCommand(action.command); close(); }
    catch (cause) { setIssue(cause instanceof Error ? cause.message : String(cause)); }
  };
  return <>
    <button ref={trigger} type="button" aria-label={t('workspace.openPalette')} onClick={() => setOpen(true)}>{t('workspace.commands')} <kbd>⌘K</kbd></button>
    <dialog className="ops-command-palette" ref={dialog} aria-label={t('workspace.paletteTitle')} onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <section>
        <header><label htmlFor="workspace-command-input">{t('workspace.paletteTitle')}</label><button type="button" onClick={close} aria-label={t('workspace.closePalette')}>Esc</button></header>
        <input id="workspace-command-input" ref={input} role="combobox" aria-expanded={open} aria-controls="workspace-command-results" aria-activedescendant={suggestions[active] ? `workspace-command-${suggestions[active].id}` : undefined} value={query} placeholder={t('workspace.palettePlaceholder')} autoComplete="off"
          onChange={event => { setQuery(event.currentTarget.value); setSelected(0); setIssue(''); }}
          onKeyDown={event => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setSelected(Math.max(0, Math.min(suggestions.length - 1, active + (event.key === 'ArrowDown' ? 1 : -1)))); }
            if (event.key === 'Enter') { event.preventDefault(); const suggestion = suggestions[active]; if (suggestion) choose(suggestion); }
          }} />
        <div id="workspace-command-results" role="listbox" aria-label={t('workspace.suggestions')}>{suggestions.map((suggestion, index) => <button id={`workspace-command-${suggestion.id}`} role="option" aria-selected={index === active} key={suggestion.id} type="button" onClick={() => choose(suggestion)}><span aria-hidden="true">{suggestion.icon}</span><span><strong>{suggestion.label}</strong><small>{suggestion.sublabel}</small></span></button>)}</div>
        {!suggestions.length ? <p>{t('workspace.noMatches')}</p> : null}
        {issue || live.snapshot.error ? <p role="alert">{issue || live.snapshot.error}</p> : null}
        <footer>{network.selectedStep ? t('workspace.recordedHint') : t('workspace.liveHint')}</footer>
      </section>
    </dialog>
  </>;
}
