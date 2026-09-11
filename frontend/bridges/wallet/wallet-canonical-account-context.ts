import { readStoreValue } from '../../packages/runtime-client/src/observable-store';
import type { RuntimeAdapter, RuntimeAdapterViewFrame } from '@xln/core/api/public/runtime-module';
import { getXLN, xlnEnvironment, resolveConfiguredApiBase } from '../runtime/xln-store';
import { buildEntityPanelView } from './entity-panel-model';
import { buildPaymentPanelView, buildPaymentPanelViewFromRuntimeView } from './payment-panel-view';
import { buildSwapPanelRuntimeView } from './swap-panel-helpers';
import { unwrapLiveRuntimeEnv } from '../../packages/browser/src/runtime/live-runtime-env';

export async function readCanonicalAccountContext(adapter: RuntimeAdapter, entityId: string, frame: RuntimeAdapterViewFrame) {
  const xln = await getXLN();
  const local = readStoreValue(xlnEnvironment);
  const bound = adapter.mode === 'embedded' && local && local.runtimeId === adapter.runtimeId ? local : null;
  if (adapter.mode === 'embedded' && !bound) throw new Error('ACCOUNT_CONTEXT_RUNTIME_CHANGED');
  const env = bound ? unwrapLiveRuntimeEnv(bound) : null;
  if (bound && !env) throw new Error('ACCOUNT_CONTEXT_LIVE_RUNTIME_UNAVAILABLE');
  const panel = buildEntityPanelView(bound, entityId, '', '', bound ? undefined : frame);
  if (!panel.replica || panel.replica.state.entityId.toLowerCase() !== entityId) throw new Error('ACCOUNT_CONTEXT_ENTITY_CHANGED');
  return {
    entityId, runtimeId: adapter.runtimeId, frame, replica: panel.replica, names: panel.entityNames,
    xln, env, jurisdiction: panel.activeJurisdictionName || '', apiBase: resolveConfiguredApiBase(window.location.origin),
    commandsReady: adapter.commandReady, commandReason: adapter.commandReadyReason || '',
    paymentView: env ? buildPaymentPanelView({ entityId, replicas: panel.replicas, profiles: panel.profiles,
      networkGraph: env.gossip.getNetworkGraph() }) : buildPaymentPanelViewFromRuntimeView({ entityId, frame }),
    swapView: buildSwapPanelRuntimeView({ profiles: panel.profiles, networkProfiles: panel.profiles,
      entityNames: panel.entityNames, replicas: panel.replicas }),
  };
}

export type WalletAccountContext = Awaited<ReturnType<typeof readCanonicalAccountContext>>;
