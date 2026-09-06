<script lang="ts">
  import { onMount } from 'svelte';
  import { compareStableText } from '$lib/utils/stableSort';

  import { formatBytes, type DbKindFilter, type DbEntryView, type IndexedDbMeta } from '../../../../packages/runtime-client/src/indexed-db-inspector-key';
  import { compactValuePreview, renderBlobPretty, decodeBlob, decodeKeyBlob } from '../../../../packages/runtime-client/src/indexed-db-inspector-value';

  export let databaseNames: string[] = [];
  export let databaseNamePrefixes: string[] = ['level-js-db-'];
  export let pageSize = 50;

  const getIndexedDb = (): (IDBFactory & {
    databases?: () => Promise<Array<{ name?: string; version?: number }>>;
  }) | null => (typeof indexedDB === 'undefined' ? null : indexedDB);

  let loadingDatabases = false;
  let loadingEntries = false;
  let inspectorError = '';
  let discoveredDatabases: IndexedDbMeta[] = [];
  let selectedKind: DbKindFilter = 'all';
  let selectedDatabaseName = '';
  let objectStoreNames: string[] = [];
  let selectedObjectStore = '';
  let entries: DbEntryView[] = [];
  let loadedCount = 0;
  let hasMoreEntries = false;
  let expandedValueEntries = new Set<number>();

  const normalizeName = (value: string): string => value.trim();

  const setValueExpanded = (index: number, expanded: boolean): void => {
    const next = new Set(expandedValueEntries);
    if (expanded) next.add(index);
    else next.delete(index);
    expandedValueEntries = next;
  };

  const formatDatabaseKind = (name: string): 'core' | 'infra' => (
    name.endsWith('-infra') ? 'infra' : 'core'
  );

  const matchesPrefix = (name: string): boolean => (
    databaseNamePrefixes.length === 0 || databaseNamePrefixes.some((prefix) => name.startsWith(prefix))
  );

  const openDatabase = (name: string): Promise<IDBDatabase> => new Promise((resolve, reject) => {
    const idb = getIndexedDb();
    if (!idb) {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const request = idb.open(name);
    request.onerror = () => reject(request.error || new Error(`Failed to open IndexedDB ${name}`));
    request.onsuccess = () => resolve(request.result);
  });

  const listIndexedDatabases = async (): Promise<IndexedDbMeta[]> => {
    const provided = databaseNames
      .map(normalizeName)
      .filter(Boolean)
      .map((name) => ({ name }));
    const idb = getIndexedDb();
    const discovered = idb?.databases
      ? (await idb.databases())
          .filter((entry): entry is { name: string; version?: number } => typeof entry.name === 'string' && !!entry.name)
          .map((entry) => ({ name: entry.name, version: entry.version }))
      : [];
    const merged = new Map<string, IndexedDbMeta>();
    for (const entry of [...provided, ...discovered]) {
      if (!matchesPrefix(entry.name)) continue;
      merged.set(entry.name, entry);
    }
    return Array.from(merged.values()).sort((a, b) => compareStableText(a.name, b.name));
  };

  async function refreshDatabaseList(): Promise<void> {
    loadingDatabases = true;
    inspectorError = '';
    try {
      discoveredDatabases = await listIndexedDatabases();
      if (!selectedDatabaseName || !discoveredDatabases.some((db) => db.name === selectedDatabaseName)) {
        selectedDatabaseName = filteredDatabases[0]?.name || '';
      }
    } catch (error) {
      inspectorError = error instanceof Error ? error.message : String(error);
      discoveredDatabases = [];
      selectedDatabaseName = '';
    } finally {
      loadingDatabases = false;
    }
  }

  async function loadObjectStores(databaseName: string): Promise<void> {
    if (!databaseName) {
      objectStoreNames = [];
      selectedObjectStore = '';
      return;
    }
    const db = await openDatabase(databaseName);
    try {
      objectStoreNames = Array.from(db.objectStoreNames).sort(compareStableText);
      if (!selectedObjectStore || !objectStoreNames.includes(selectedObjectStore)) {
        selectedObjectStore = objectStoreNames[0] || '';
      }
    } finally {
      db.close();
    }
  }

  async function loadEntries(reset = false): Promise<void> {
    if (!selectedDatabaseName || !selectedObjectStore) {
      entries = [];
      loadedCount = 0;
      hasMoreEntries = false;
      expandedValueEntries = new Set();
      return;
    }
    loadingEntries = true;
    inspectorError = '';
    const startIndex = reset ? 0 : loadedCount;
    try {
      const db = await openDatabase(selectedDatabaseName);
      try {
        const transaction = db.transaction(selectedObjectStore, 'readonly');
        const store = transaction.objectStore(selectedObjectStore);
        const request = store.openCursor();
        const pageEntries: DbEntryView[] = [];
        let cursorIndex = 0;

        await new Promise<void>((resolve, reject) => {
          request.onerror = () => reject(request.error || new Error('Failed to read IndexedDB entries'));
          request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor) {
              resolve();
              return;
            }
            if (cursorIndex >= startIndex && pageEntries.length < pageSize) {
              const key = decodeKeyBlob(cursor.key);
              pageEntries.push({
                index: cursorIndex,
                key,
                value: decodeBlob(cursor.value, key.keyFields),
              });
            }
            cursorIndex += 1;
            if (pageEntries.length >= pageSize) {
              hasMoreEntries = true;
              resolve();
              return;
            }
            cursor.continue();
          };
        });

        if (reset) {
          entries = pageEntries;
          expandedValueEntries = new Set();
        } else {
          entries = [...entries, ...pageEntries];
        }
        loadedCount = startIndex + pageEntries.length;
        if (pageEntries.length < pageSize) {
          hasMoreEntries = false;
        }
      } finally {
        db.close();
      }
    } catch (error) {
      inspectorError = error instanceof Error ? error.message : String(error);
      if (reset) {
        entries = [];
        loadedCount = 0;
      }
      hasMoreEntries = false;
    } finally {
      loadingEntries = false;
    }
  }

  $: filteredDatabases = discoveredDatabases.filter((db) => (
    selectedKind === 'all' || formatDatabaseKind(db.name) === selectedKind
  ));

  $: if (selectedDatabaseName && !filteredDatabases.some((db) => db.name === selectedDatabaseName)) {
    selectedDatabaseName = filteredDatabases[0]?.name || '';
  }

  $: if (selectedDatabaseName) {
    void loadObjectStores(selectedDatabaseName);
  } else {
    objectStoreNames = [];
    selectedObjectStore = '';
    entries = [];
    loadedCount = 0;
    hasMoreEntries = false;
    expandedValueEntries = new Set();
  }

  $: if (selectedDatabaseName && selectedObjectStore) {
    void loadEntries(true);
  }

  onMount(() => {
    void refreshDatabaseList();
  });
</script>

<div class="db-inspector" data-testid="leveldb-inspector">
  <div class="toolbar">
    <div class="filter-group">
      <button class:selected={selectedKind === 'all'} on:click={() => selectedKind = 'all'}>All</button>
      <button class:selected={selectedKind === 'core'} on:click={() => selectedKind = 'core'}>Core</button>
      <button class:selected={selectedKind === 'infra'} on:click={() => selectedKind = 'infra'}>Infra</button>
    </div>
    <button class="refresh-btn" on:click={() => void refreshDatabaseList()} disabled={loadingDatabases}>
      {loadingDatabases ? 'Refreshing...' : 'Refresh DBs'}
    </button>
  </div>

  {#if inspectorError}
    <p class="error-text">{inspectorError}</p>
  {/if}

  <div class="inspector-grid">
    <div class="db-list">
      <h4>Databases</h4>
      {#if filteredDatabases.length === 0}
        <p class="muted">No matching IndexedDB databases found.</p>
      {:else}
        {#each filteredDatabases as database}
          <button
            class="db-item"
            class:active={database.name === selectedDatabaseName}
            on:click={() => selectedDatabaseName = database.name}
          >
            <span class="db-name">{database.name}</span>
            <span class="db-kind">{formatDatabaseKind(database.name)}</span>
          </button>
        {/each}
      {/if}
    </div>

    <div class="db-content">
      {#if !selectedDatabaseName}
        <div class="empty-state">Select a database to inspect.</div>
      {:else}
        <div class="db-header">
          <div>
            <h4>{selectedDatabaseName}</h4>
          </div>
          <label class="store-select">
            <span>Store</span>
            <select bind:value={selectedObjectStore} disabled={objectStoreNames.length === 0}>
              {#each objectStoreNames as storeName}
                <option value={storeName}>{storeName}</option>
              {/each}
            </select>
          </label>
        </div>

        {#if loadingEntries && entries.length === 0}
          <div class="empty-state">Loading entries...</div>
        {:else if entries.length === 0}
          <div class="empty-state">No entries in this object store.</div>
        {:else}
          <div class="entry-list">
            {#each entries as entry}
              <article class="entry-card">
                <div class="entry-row">
                  <span class="entry-index">#{entry.index}</span>
                  <code class="entry-key">{entry.key.label}</code>
                  <span class="entry-bytes">({formatBytes(entry.value.byteLength)})</span>
                </div>
                <pre class="entry-preview">{compactValuePreview(entry.value)}</pre>
                {#if entry.key.pretty}
                  <details class="entry-expand key-expand">
                    <summary>Raw key</summary>
                    <pre>{entry.key.pretty}</pre>
                  </details>
                {/if}
                <details
                  class="entry-expand"
                  on:toggle={(event) => setValueExpanded(entry.index, (event.currentTarget as HTMLDetailsElement).open)}
                >
                  <summary>Expand value fully</summary>
                  {#if expandedValueEntries.has(entry.index)}
                    <pre>{renderBlobPretty(entry.value)}</pre>
                  {/if}
                </details>
              </article>
            {/each}
          </div>

          {#if hasMoreEntries}
            <button class="load-more-btn" on:click={() => void loadEntries(false)} disabled={loadingEntries}>
              {loadingEntries ? 'Loading...' : `Load ${pageSize} more`}
            </button>
          {/if}
        {/if}
      {/if}
    </div>
  </div>
</div>

<style>
  .db-inspector {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .filter-group {
    display: flex;
    gap: 8px;
  }

  .filter-group button,
  .refresh-btn,
  .load-more-btn,
  .db-item {
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.82);
    border-radius: 8px;
    cursor: pointer;
  }

  .filter-group button,
  .refresh-btn,
  .load-more-btn {
    padding: 8px 12px;
    font-size: 12px;
  }

  .filter-group button.selected,
  .db-item.active {
    border-color: rgba(255, 200, 100, 0.5);
    background: rgba(255, 200, 100, 0.12);
    color: rgba(255, 220, 170, 0.98);
  }

  .inspector-grid {
    display: grid;
    grid-template-columns: 240px minmax(0, 1fr);
    gap: 16px;
  }

  .db-list,
  .db-content {
    min-height: 240px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.025);
    padding: 12px;
  }

  .db-list h4,
  .db-content h4 {
    margin: 0;
    color: rgba(255, 255, 255, 0.92);
  }

  .db-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .db-item {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    padding: 10px 12px;
    text-align: left;
  }

  .db-name {
    font-size: 12px;
    line-height: 1.4;
    word-break: break-word;
  }

  .db-kind,
  .muted {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.48);
  }

  .db-header {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  .store-select {
    min-width: 180px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.56);
  }

  .store-select select {
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(0, 0, 0, 0.24);
    color: rgba(255, 255, 255, 0.9);
  }

  .entry-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .entry-card {
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.2);
    overflow: hidden;
  }

  .entry-row {
    display: grid;
    grid-template-columns: 56px minmax(0, 1fr) auto;
    gap: 10px;
    align-items: start;
    padding: 10px 12px;
  }

  .entry-index,
  .entry-bytes {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.55);
    white-space: nowrap;
  }

  .entry-key {
    min-width: 0;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.88);
    white-space: normal;
    word-break: break-all;
  }

  .entry-preview,
  .entry-expand pre {
    margin: 0;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.84);
    font-size: 11px;
    line-height: 1.5;
    overflow: auto;
    max-height: 320px;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .entry-preview {
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    max-height: 160px;
  }

  .entry-expand {
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .entry-expand summary {
    padding: 8px 12px;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.62);
    font-size: 11px;
  }

  .entry-expand pre {
    max-height: none;
  }

  .empty-state,
  .error-text {
    padding: 12px;
    border-radius: 10px;
    font-size: 12px;
  }

  .empty-state {
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.56);
  }

  .error-text {
    background: rgba(255, 90, 90, 0.12);
    color: rgba(255, 160, 160, 0.94);
  }

  @media (max-width: 900px) {
    .inspector-grid {
      grid-template-columns: 1fr;
    }

    .db-header,
    .toolbar {
      grid-template-columns: 1fr;
      flex-direction: column;
      align-items: stretch;
    }

    .store-select {
      min-width: 0;
    }
  }
</style>
