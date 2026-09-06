<script lang="ts">
  import type { Writable } from 'svelte/store';
  import type { RuntimeReplica } from '@xln/core/runtime/types';
  import { buildStoragePolicy, readStoragePolicyFields, displayStorageGiB } from '../../../../packages/runtime-client/src/operator-policy-settings';
  export let runtimeFrameEnv: Writable<RuntimeReplica | null>;
  let loadedRuntimeId = '', commonGiB = '', walEpochGiB = '', historyViewGiB = '', historyRetainFrames = '';
  let status = '', error = '';
  const loadRuntime = (env: RuntimeReplica | null): void => {
    const runtimeId = String(env?.runtimeId || env?.dbNamespace || '');
    if (!env || runtimeId === loadedRuntimeId) return;
    loadedRuntimeId = runtimeId;
    ({ commonGiB, walEpochGiB, historyViewGiB, historyRetainFrames } = readStoragePolicyFields(env.runtimeConfig?.storage));
    status = ''; error = '';
  };
  function applyLimits(): void {
    try {
      runtimeFrameEnv.update(env => {
        if (!env) throw new Error('No Runtime is selected');
        const storage = buildStoragePolicy(env.runtimeConfig?.storage, { commonGiB, walEpochGiB, historyViewGiB, historyRetainFrames });
        env.runtimeConfig = { ...env.runtimeConfig, storage };
        walEpochGiB = displayStorageGiB(storage.epochMaxBytes);
        historyViewGiB = displayStorageGiB(storage.historyViewMaxBytes);
        return env;
      });
      commonGiB = ''; error = '';
      status = 'Storage policy saved. It applies from the next Runtime frame.';
    } catch (cause) {
      status = ''; error = cause instanceof Error ? cause.message : String(cause);
    }
  }
  $: loadRuntime($runtimeFrameEnv);
</script>

<section class="storage-limits" data-testid="runtime-storage-limits">
  <header>
    <div>
      <h4>Runtime storage policy</h4>
      <p>Blank means unlimited. Limits are local operator policy, never consensus state.</p>
    </div>
  </header>

  <div class="limit-grid">
    <label>
      <span>Common limit per archival store</span>
      <input bind:value={commonGiB} inputmode="decimal" placeholder="Unlimited" data-testid="storage-common-gib" />
      <small>GiB · fills both blank limits below</small>
    </label>
    <label>
      <span>WAL epoch rollover</span>
      <input bind:value={walEpochGiB} inputmode="decimal" placeholder="Unlimited" data-testid="storage-wal-gib" />
      <small>GiB · closes the epoch at a durable checkpoint</small>
    </label>
    <label>
      <span>Materialized history view</span>
      <input bind:value={historyViewGiB} inputmode="decimal" placeholder="Unlimited" data-testid="storage-history-gib" />
      <small>GiB · rebuildable from WAL</small>
    </label>
    <label>
      <span>Runtime history frames</span>
      <input bind:value={historyRetainFrames} inputmode="numeric" placeholder="Unlimited" data-testid="storage-history-frames" />
      <small>1 = latest only · 2 = latest plus one previous</small>
    </label>
  </div>

  <p class="storage-note">
    Hot state always keeps the latest complete Runtime state. A quota never deletes a partial financial frame.
  </p>
  <button type="button" on:click={applyLimits} data-testid="storage-limits-save">Save storage policy</button>
  {#if status}<p class="status" data-testid="storage-limits-status">{status}</p>{/if}
  {#if error}<p class="error" role="alert" data-testid="storage-limits-error">{error}</p>{/if}
</section>

<style>
  .storage-limits {
    display: grid;
    gap: 14px;
    margin-bottom: 18px;
    padding: 16px;
    border: 1px solid var(--border-color, #30343b);
    border-radius: 12px;
    background: color-mix(in srgb, var(--panel-bg, #15171b) 92%, white 8%);
  }
  h4, p { margin: 0; }
  header p, small, .storage-note { color: #9299a5; font-size: 12px; }
  .limit-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; }
  label { display: grid; gap: 6px; font-size: 13px; }
  input {
    min-width: 0;
    padding: 9px 10px;
    color: inherit;
    border: 1px solid #3a3f48;
    border-radius: 8px;
    background: #111318;
  }
  button {
    justify-self: start;
    padding: 9px 14px;
    color: #fff;
    border: 0;
    border-radius: 8px;
    background: #315cff;
    cursor: pointer;
  }
  .status { color: #5fd39a; font-size: 12px; }
  .error { color: #ff7171; font-size: 12px; }
</style>
