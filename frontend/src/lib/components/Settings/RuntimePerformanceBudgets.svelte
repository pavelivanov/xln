<script lang="ts">
  import type { Writable } from 'svelte/store';
  import type { RuntimeReplica } from '@xln/core/runtime/types';
  import { buildPerformancePolicy, readPerformancePolicyFields } from '../../../../packages/runtime-client/src/operator-policy-settings';
  export let runtimeFrameEnv: Writable<RuntimeReplica | null>;
  let loadedRuntimeId = '', cloneMiB = '', cloneMs = '', reducerMs = '', walMs = '';
  let status = '', error = '';
  const loadRuntime = (env: RuntimeReplica | null): void => {
    const runtimeId = String(env?.runtimeId || env?.dbNamespace || '');
    if (!env || runtimeId === loadedRuntimeId) return;
    loadedRuntimeId = runtimeId;
    ({ cloneMiB, cloneMs, reducerMs, walMs } = readPerformancePolicyFields(env.runtimeConfig?.performance));
    status = ''; error = '';
  };
  function saveBudgets(): void {
    try {
      const performance = buildPerformancePolicy({ cloneMiB, cloneMs, reducerMs, walMs });
      runtimeFrameEnv.update(env => {
        if (!env) throw new Error('No Runtime is selected');
        env.runtimeConfig = { ...env.runtimeConfig, performance };
        return env;
      });
      error = '';
      status = 'Performance budgets saved. Blank metrics remain observation-only.';
    } catch (cause) {
      status = ''; error = cause instanceof Error ? cause.message : String(cause);
    }
  }
  $: loadRuntime($runtimeFrameEnv);
</script>

<section class="perf-budgets" data-testid="runtime-performance-budgets">
  <header>
    <h4>Runtime frame budgets</h4>
    <p>Local alarms only. A slow frame is still committed according to protocol.</p>
  </header>
  <div class="budget-grid">
    <label><span>Clone payload</span><input bind:value={cloneMiB} placeholder="Observe" inputmode="decimal" data-testid="perf-clone-mib" /><small>MiB</small></label>
    <label><span>Clone latency</span><input bind:value={cloneMs} placeholder="Observe" inputmode="decimal" data-testid="perf-clone-ms" /><small>ms</small></label>
    <label><span>Reducer latency</span><input bind:value={reducerMs} placeholder="Observe" inputmode="decimal" data-testid="perf-reducer-ms" /><small>ms</small></label>
    <label><span>Durable WAL write</span><input bind:value={walMs} placeholder="Observe" inputmode="decimal" data-testid="perf-wal-ms" /><small>ms</small></label>
  </div>
  <button type="button" on:click={saveBudgets} data-testid="perf-budgets-save">Save frame budgets</button>
  {#if status}<p class="status" data-testid="perf-budgets-status">{status}</p>{/if}
  {#if error}<p class="error" role="alert" data-testid="perf-budgets-error">{error}</p>{/if}
</section>

<style>
  .perf-budgets { display: grid; gap: 14px; margin-bottom: 18px; padding: 16px; border: 1px solid #30343b; border-radius: 12px; background: #15171b; }
  h4, p { margin: 0; }
  header p, small { color: #9299a5; font-size: 12px; }
  .budget-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
  label { display: grid; grid-template-columns: 1fr auto; gap: 6px; align-items: center; font-size: 13px; }
  label span { grid-column: 1 / -1; }
  input { min-width: 0; padding: 9px 10px; color: inherit; border: 1px solid #3a3f48; border-radius: 8px; background: #111318; }
  button { justify-self: start; padding: 9px 14px; color: #fff; border: 0; border-radius: 8px; background: #315cff; cursor: pointer; }
  .status { color: #5fd39a; font-size: 12px; }
  .error { color: #ff7171; font-size: 12px; }
</style>
