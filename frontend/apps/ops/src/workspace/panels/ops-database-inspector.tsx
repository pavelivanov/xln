import { useEffect, useRef, useState } from 'react';
import { listInspectableDatabases, listInspectableStores, readInspectableEntries } from '../../../../../packages/browser/src/indexed-db-inspector';
import { formatBytes, type DbEntryView, type DbKindFilter, type IndexedDbMeta } from '../../../../../packages/runtime-client/src/storage/indexed-db-inspector-key';
import { compactValuePreview, renderBlobPretty } from '../../../../../packages/runtime-client/src/storage/indexed-db-inspector-value';

const kindOf = (name: string) => name.endsWith('-infra') ? 'infra' : 'core';
function DatabaseEntry({ entry }: Readonly<{ entry: DbEntryView }>) {
  const [expanded, setExpanded] = useState(false);
  return <article className="ops-db-entry"><header><code>#{entry.index} · {entry.key.label}</code><small>{formatBytes(entry.value.byteLength)}</small></header><pre>{compactValuePreview(entry.value)}</pre>{entry.key.pretty ? <details><summary>Raw key</summary><pre>{entry.key.pretty}</pre></details> : null}<details onToggle={event => setExpanded(event.currentTarget.open)}><summary>Expand value fully</summary>{expanded ? <pre>{renderBlobPretty(entry.value)}</pre> : null}</details></article>;
}
export function OpsDatabaseInspector() {
  const [databases, setDatabases] = useState<IndexedDbMeta[]>([]);
  const [kind, setKind] = useState<DbKindFilter>('all');
  const [database, setDatabase] = useState('');
  const [stores, setStores] = useState<string[]>([]);
  const [store, setStore] = useState('');
  const [storesFor, setStoresFor] = useState('');
  const [entriesFor, setEntriesFor] = useState('');
  const [entries, setEntries] = useState<DbEntryView[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [issue, setIssue] = useState('');
  const [search, setSearch] = useState('');
  const generation = useRef(0);
  const discovery = useRef(0);
  const storeDiscovery = useRef(0);
  const activeStore = storesFor === database ? store : '';
  const selectedKey = `${database}:${activeStore}`;
  const currentEntries = entriesFor === selectedKey ? entries : [];
  const filteredDatabases = databases.filter(db => kind === 'all' || kindOf(db.name) === kind);
  const refresh = async (): Promise<void> => {
    const request = ++discovery.current;
    setDiscovering(true); setIssue('');
    try {
      const found = await listInspectableDatabases();
      if (request !== discovery.current) return;
      setDatabases(found);
      setDatabase(current => found.some(db => db.name === current) ? current : '');
    } catch (cause) { if (request === discovery.current) setIssue(cause instanceof Error ? cause.message : String(cause)); }
    finally { if (request === discovery.current) setDiscovering(false); }
  };
  useEffect(() => { void refresh(); return () => { discovery.current += 1; generation.current += 1; storeDiscovery.current += 1; }; }, []);
  useEffect(() => {
    const request = ++storeDiscovery.current;
    setStores([]); setStore(''); setStoresFor(''); setEntries([]); setHasMore(false); setIssue('');
    if (!database) return;
    setLoading(true);
    void listInspectableStores(database).then(next => {
      if (request !== storeDiscovery.current) return;
      setStores(next); setStoresFor(database); setStore(next[0] ?? '');
    }).catch(cause => { if (request === storeDiscovery.current) setIssue(String(cause)); })
      .finally(() => { if (request === storeDiscovery.current) setLoading(false); });
  }, [database]);
  const load = async (reset: boolean): Promise<void> => {
    const request = ++generation.current;
    setLoading(true); setIssue('');
    try {
      const page = await readInspectableEntries(database, activeStore, reset ? 0 : currentEntries.length);
      if (request !== generation.current) return;
      setEntries(current => reset ? page.entries : [...current, ...page.entries]); setEntriesFor(selectedKey); setHasMore(page.hasMore);
    } catch (cause) { if (request === generation.current) setIssue(cause instanceof Error ? cause.message : String(cause)); }
    finally { if (request === generation.current) setLoading(false); }
  };
  useEffect(() => {
    setEntries([]); setHasMore(false);
    if (database && activeStore) void load(true);
    return () => { generation.current += 1; };
  }, [database, activeStore]);
  const visible = currentEntries.filter(entry => `${entry.key.label} ${compactValuePreview(entry.value)}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="ops-evidence-panel" data-testid="leveldb-inspector">
    <header><h2>Browser database inspector</h2><button disabled={discovering} onClick={() => { void refresh(); }} type="button">{discovering ? 'Refreshing…' : 'Refresh DBs'}</button></header>
    <div className="ops-panel-controls">{(['all', 'core', 'infra'] as const).map(value => <button key={value} aria-pressed={kind === value} onClick={() => { setKind(value); if (database && value !== 'all' && kindOf(database) !== value) setDatabase(''); }} type="button">{value}</button>)}</div>
    {issue ? <p role="alert">{issue}</p> : null}
    <div className="ops-db-layout"><nav aria-label="Browser databases">{filteredDatabases.length ? filteredDatabases.map(db => <button aria-pressed={database === db.name} key={db.name} onClick={() => setDatabase(db.name)} type="button">{db.name}<small>{kindOf(db.name)}</small></button>) : <p>No matching IndexedDB databases found.</p>}</nav><div>
      {!database ? <p>Select a database to inspect.</p> : <><header><code>{database}</code><label>Store <select aria-label="Database object store" disabled={!stores.length} value={activeStore} onChange={event => setStore(event.currentTarget.value)}>{stores.map(name => <option key={name}>{name}</option>)}</select></label></header><div className="ops-panel-controls"><input type="search" aria-label="Search loaded database entries" placeholder="Search loaded entries" value={search} onChange={event => setSearch(event.currentTarget.value)} /><button disabled={loading || !activeStore} onClick={() => { void load(true); }} type="button">Refresh entries</button><span>{visible.length} shown · {currentEntries.length} loaded</span></div>
        {loading && !currentEntries.length ? <p>Loading entries…</p> : visible.length ? visible.map(entry => <DatabaseEntry key={`${database}:${store}:${entry.index}`} entry={entry} />) : <p>{currentEntries.length ? 'No loaded entries match the search.' : 'No entries in this object store.'}</p>}
        {entriesFor === selectedKey && hasMore ? <button disabled={loading} onClick={() => { void load(false); }} type="button">{loading ? 'Loading…' : 'Load 50 more'}</button> : null}</>}
    </div></div>
  </section>;
}
