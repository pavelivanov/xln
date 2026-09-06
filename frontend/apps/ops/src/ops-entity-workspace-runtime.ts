import { readRuntimeAdapterStorageSnapshot } from '../../../packages/browser/src/runtime-adapter-session';
import { OpsWorkspaceSession } from './workspace/ops-workspace-session';
import { bootWorkspacePlayback, returnWorkspaceLive, selectWorkspaceStep, workspaceBoot, workspaceNetwork } from './workspace/ops-workspace-playback';
import { networkMachineRuntimeOperations } from '../../../src/lib/stores/network/networkMachineRuntimeStore';

export const opsWorkspaceSession = new OpsWorkspaceSession(
  workspaceBoot.kind === 'plain'
    ? readRuntimeAdapterStorageSnapshot({ durable: localStorage, session: sessionStorage })
    : { mode: null, wsUrl: null, access: null, sessionKey: null },
);
export const opsEntityWorkspaceSource = opsWorkspaceSession.createEntitySource();
opsWorkspaceSession.trackSource(opsEntityWorkspaceSource);
let previousStep = workspaceNetwork.get().selectedStep;
workspaceNetwork.subscribe(() => {
  const network = workspaceNetwork.get();
  if (network.selectedStep === previousStep) return;
  previousStep = network.selectedStep;
  const selected = network.selectedStep;
  const kind = networkMachineRuntimeOperations.readSelectedSourceKind();
  if (selected && !kind) throw new Error('OPS_NETWORK_SOURCE_KIND_MISSING');
  opsWorkspaceSession.setRecording(selected ? {
    kind: kind!,
    runtimeId: selected.activeRuntimeId, height: selected.event.height,
    snapshot: networkMachineRuntimeOperations.readSelectedSnapshot(),
    history: networkMachineRuntimeOperations.readSelectedSnapshotHistory(),
    selectHeight: async height => {
      const index = network.machine ? network.machine.steps.findIndex(step => step.activeRuntimeId === selected.activeRuntimeId && step.event.height === height) : -1;
      if (index < 0) throw new Error(`NETWORK_SCENARIO_FRAME_MISSING:${height}`);
      await selectWorkspaceStep(index); return true;
    }, returnLive: returnWorkspaceLive,
  } : null);
});

let pagehideInstalled = false;

const stopOnPageHide = (event: PageTransitionEvent): void => {
  if (!event.persisted) opsEntityWorkspaceSource.stop();
};

export const startOpsEntityWorkspaceRuntime = (): void => {
  if (!pagehideInstalled) {
    window.addEventListener('pagehide', stopOnPageHide);
    pagehideInstalled = true;
  }
  void bootWorkspacePlayback();
  if (workspaceBoot.kind === 'plain') void opsEntityWorkspaceSource.start();
};
