import { useSyncExternalStore } from 'react';
import { jmachineOperations, jmachineState } from '../../../../packages/browser/src/jurisdiction/jmachine-store';

export function ConfiguredStacks() {
  const state = useSyncExternalStore(jmachineState.subscribe, jmachineState.get);
  const selected = state.configs.find(config => config.name === state.activeJMachine) ?? null;
  return (
    <section className="ops-runtime-policy" data-testid="configured-stack-selection">
      <h4>Configured stacks</h4>
      <label className="ops-settings-input">
        Shared stack selection
        <select
          aria-label="Configured jurisdiction stack"
          value={selected?.name ?? ''}
          disabled={!state.configs.length}
          onChange={event => jmachineOperations.setActive(event.currentTarget.value)}
        >
          {!state.configs.length ? (
            <option value="">No configured stacks</option>
          ) : (
            state.configs.map(config => <option key={config.name}>{config.name}</option>)
          )}
        </select>
      </label>
      {selected ? (
        <dl className="ops-audit-metrics" data-testid="configured-stack-inspection">
          <div>
            <dt>Mode</dt>
            <dd>{selected.mode}</dd>
          </div>
          <div>
            <dt>Chain ID</dt>
            <dd>{selected.chainId}</dd>
          </div>
          <div>
            <dt>RPC</dt>
            <dd>{selected.rpcs[0] ?? 'BrowserVM'}</dd>
          </div>
          <div>
            <dt>EntityProvider block</dt>
            <dd>{selected.entityProviderDeploymentBlock ?? 'Local deployment'}</dd>
          </div>
        </dl>
      ) : (
        <p>No stack configuration has been registered in this browser.</p>
      )}
    </section>
  );
}
