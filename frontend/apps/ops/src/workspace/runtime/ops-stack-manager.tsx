import { useSyncExternalStore } from 'react';
import {
  getRuntimeControllerConfig,
  getRuntimeControllerAdapter,
  runtimeControllerConfig,
} from '../../../../../bridges/runtime/runtime-controller-store';
import { runtimeHttpOriginFromWsUrl } from '../../../../../packages/runtime-client/src/runtime/ws-url';
import { StackManager } from '../../../../../packages/ui/src/stack-manager/stack-manager';
import { workspaceNetwork } from '../session/ops-workspace-playback';

export function OpsStackManager() {
  const config = useSyncExternalStore(runtimeControllerConfig.subscribe, getRuntimeControllerConfig);
  const network = useSyncExternalStore(workspaceNetwork.subscribe, workspaceNetwork.get);
  const origin = config?.mode === 'remote' && config.wsUrl ? runtimeHttpOriginFromWsUrl(config.wsUrl) : '';
  const capability = config?.mode === 'remote' ? (config.authKey ?? '') : '';
  const runtimeId = getRuntimeControllerAdapter()?.runtimeId ?? '';
  const isCurrent = () =>
    getRuntimeControllerConfig() === config &&
    getRuntimeControllerAdapter()?.runtimeId === runtimeId &&
    !workspaceNetwork.get().selectedStep;
  const restriction = network.selectedStep
    ? 'Stack Manager requires Live. Recorded scenarios do not query or mutate deployment state.'
    : !origin
      ? 'Stack Manager requires a daemon Runtime. In-browser Runtimes cannot inspect daemon deployment state.'
      : !capability
        ? 'STACK_MANAGER_ADMIN_CAPABILITY_REQUIRED'
        : '';
  return (
    <StackManager
      origin={origin}
      capability={capability}
      restriction={restriction}
      contextKey={runtimeId}
      isCurrent={isCurrent}
    />
  );
}
