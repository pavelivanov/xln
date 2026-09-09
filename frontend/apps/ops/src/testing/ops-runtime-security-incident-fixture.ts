import {
  recordRuntimeSecurityIncident,
  resolveRuntimeSecurityIncident,
} from '@xln/core/runtime/observability/security-incidents';

import { readBrowserRuntimeEnvironment } from '../../../../bridges/runtime/browser-runtime-context';
import { opsEntityWorkspaceSource } from '../entity-workspace/ops-entity-workspace-runtime';

type IncidentIdentity = Parameters<typeof recordRuntimeSecurityIncident>[1];

export const mutateOpsRuntimeSecurityIncidentFixture = (
  action: 'record' | 'resolve',
  identity: IncidentIdentity,
): void => {
  const adapter = opsEntityWorkspaceSource.getAdapter();
  if (!adapter) throw new Error('OPS_INCIDENT_FIXTURE_ADAPTER_UNAVAILABLE');
  const env = readBrowserRuntimeEnvironment(adapter);
  if (!env) throw new Error('OPS_INCIDENT_FIXTURE_RUNTIME_UNAVAILABLE');
  if (action === 'record') recordRuntimeSecurityIncident(env, identity);
  else resolveRuntimeSecurityIncident(env, identity);
};
