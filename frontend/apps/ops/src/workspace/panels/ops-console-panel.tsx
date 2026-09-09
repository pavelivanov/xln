import { useEffect, useMemo, useRef, useState } from 'react';
import { safeStringify } from '@xln/core/protocol/serialization';
import { CONSOLE_MAX_LOGS, consoleCommandCompletions, consoleLevelColor, createConsoleCommands, evalConsoleCommand, filterConsoleLogs, formatConsoleLogText, projectConsoleFrameLogs, type ConsoleEntry, type ConsoleFilterLevel } from '../../../../../packages/runtime-client/src/panels/console-panel-view';
import { networkMachineRuntimeOperations } from '../../../../../src/lib/stores/network/networkMachineRuntimeStore';
import { getXLN } from '../../../../../src/lib/stores/bootstrap/xlnRuntimeLoader';
import { loadWorkspaceScenario } from '../session/ops-workspace-playback';
import { useWorkspaceEnvironment } from '../session/use-workspace-environment';
import { useWorkspaceTranslation } from '../../../../../bridges/workspace-localization-react';

const levels: readonly ConsoleFilterLevel[] = ['all', 'debug', 'log', 'info', 'warn', 'error'];
export function OpsConsolePanel() {
  const { t } = useWorkspaceTranslation();
  const context = useWorkspaceEnvironment();
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [results, setResults] = useState<ConsoleEntry[]>([]);
  const [clearedAt, setClearedAt] = useState<object | null>(null);
  const [level, setLevel] = useState<ConsoleFilterLevel>('all');
  const [search, setSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [issue, setIssue] = useState('');
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  const logId = useRef(0);
  const logView = useRef<HTMLDivElement>(null);
  const logs = useMemo(() => context.network === clearedAt ? [] : projectConsoleFrameLogs(networkMachineRuntimeOperations.readSelectedSnapshotHistory(), -1), [context.network, clearedAt]);
  const filtered = filterConsoleLogs([...logs, ...results].slice(-CONSOLE_MAX_LOGS), level, search);
  const clear = (): void => { setResults([]); setClearedAt(context.network); };
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { if (autoScroll) logView.current?.scrollTo({ top: logView.current.scrollHeight }); }, [logs, results, autoScroll]);
  const append = (message: string, severity: ConsoleEntry['level'] = 'info'): void => {
    setResults(current => [...current, { id: --logId.current, level: severity, timestamp: new Date().toLocaleTimeString(), message }].slice(-CONSOLE_MAX_LOGS));
  };
  const execute = async (): Promise<void> => {
    if (busy || !command.trim()) return;
    const input = command.trim();
    setCommand(''); setHistory(current => [...current, input]); setHistoryIndex(-1); setBusy(true);
    append(`> ${input}`);
    try {
      const runtime = await getXLN();
      const commands = createConsoleCommands({ readEnv: () => context.frame, clear });
      commands.scenario = {
        list: () => runtime.scenarioKeys,
        load: async key => {
          const count = await loadWorkspaceScenario(key);
          return `Loaded ${key}: ${count} network steps`;
        },
      };
      const result = await evalConsoleCommand(commands, input);
      if (alive.current && result !== undefined) append(typeof result === 'string' ? result : safeStringify(result, 2));
    } catch (cause) { if (alive.current) append(cause instanceof Error ? cause.message : String(cause), 'error'); }
    finally { if (alive.current) setBusy(false); }
  };
  const exportLogs = (download: boolean): void => {
    setIssue('');
    const text = formatConsoleLogText(filtered);
    if (!download) { void navigator.clipboard.writeText(text).catch(cause => setIssue(String(cause))); return; }
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'xln-console.txt'; anchor.click(); URL.revokeObjectURL(url);
  };
  return <section className="ops-evidence-panel ops-console" data-testid="workspace-console">
    <header><h2>{t('workspace.console')}</h2><span>{filtered.length} / {CONSOLE_MAX_LOGS} logs</span></header>
    {context.error || context.restriction ? <p role={context.error ? 'alert' : 'status'}>{context.error || context.restriction}</p> : <>
      <div className="ops-panel-controls"><label>Level <select aria-label="Console log level" value={level} onChange={event => { const next = levels.find(value => value === event.currentTarget.value); if (next) setLevel(next); }}>{levels.map(value => <option key={value}>{value}</option>)}</select></label><input aria-label={`${t('common.search')} console logs`} type="search" value={search} onChange={event => setSearch(event.currentTarget.value)} /><label><input type="checkbox" checked={autoScroll} onChange={event => setAutoScroll(event.currentTarget.checked)} /> Auto-scroll</label><button onClick={clear} type="button">Clear</button><button onClick={() => exportLogs(false)} type="button">{t('common.copy')}</button><button onClick={() => exportLogs(true)} type="button">Download</button></div>
      <div className="ops-console-logs" ref={logView} role="log">{filtered.map(log => <pre key={log.id} style={{ color: consoleLevelColor(log.level) }}>[{log.timestamp}] [{log.level.toUpperCase()}] {log.message}</pre>)}</div>
      <form className="ops-console-command" onSubmit={event => { event.preventDefault(); void execute(); }}><label htmlFor="ops-console-command">&gt;</label><input id="ops-console-command" aria-label="Console command" placeholder="help()" disabled={busy} value={command} onChange={event => setCommand(event.currentTarget.value)} onKeyDown={event => {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); const next = event.key === 'ArrowUp' ? Math.min(history.length - 1, historyIndex + 1) : Math.max(-1, historyIndex - 1); setHistoryIndex(next); setCommand(next < 0 ? '' : history[history.length - 1 - next] ?? ''); }
        if (event.key === 'Tab') { const completions = consoleCommandCompletions(command); if (completions.length) { event.preventDefault(); if (completions.length === 1) setCommand(`${completions[0]}()`); else append(completions.join('  ')); } }
      }} /><button type="submit" disabled={busy || !command.trim()}>Run</button></form>
    </>}
    {issue ? <p role="alert">{issue}</p> : null}
  </section>;
}
