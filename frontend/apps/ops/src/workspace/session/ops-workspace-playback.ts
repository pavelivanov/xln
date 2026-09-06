import { parseEmbedBootRequest } from '../../../../../packages/runtime-client/src/scenario/embed-boot-model';
import { clampDemoSpeed } from '../../../../../packages/runtime-client/src/scenario/demo-playback-intent';
import { createObservableStore } from '../../../../../src/lib/utils/observableStore';
import { networkMachineRuntime, networkMachineRuntimeOperations } from '../../../../../src/lib/stores/network/networkMachineRuntimeStore';
import { adapterNetworkTimelineSource, decodeNetworkTrailFromHash, encodeNetworkTrailForHash } from '../../../../../src/lib/network3d/timeline/networkTimelineSource';
import type { RuntimeAdapter } from '@xln/core/api/public/runtime-module';
import { networkMachineOperations } from '../../../../../src/lib/stores/network/networkMachineStore';
import type { NetworkMachineConfig } from '../../../../../src/lib/network3d/networkMachine';

export const workspaceBoot = parseEmbedBootRequest(new URL(window.location.href));
export const workspaceNetwork = networkMachineRuntime;
export const workspacePlayback = createObservableStore({ playing: false, speed: workspaceBoot.kind === 'plain' ? 1 : clampDemoSpeed(workspaceBoot.speed), error: '' });
let bootPromise: Promise<void> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let generation = 0;

const fail = (cause: unknown): void => {
  pauseWorkspacePlayback();
  workspacePlayback.update(state => ({ ...state, error: cause instanceof Error ? cause.message : String(cause) }));
};

export const pauseWorkspacePlayback = (): void => {
  generation += 1;
  if (timer !== null) clearTimeout(timer);
  timer = null;
  workspacePlayback.update(state => ({ ...state, playing: false }));
};

export const selectWorkspaceStep = async (index: number): Promise<void> => {
  pauseWorkspacePlayback();
  workspacePlayback.update(state => ({ ...state, error: '' }));
  try { await networkMachineRuntimeOperations.selectStep(index); }
  catch (cause) { fail(cause); }
};

export const playWorkspace = (): void => {
  if (workspacePlayback.get().playing) return;
  const ownedGeneration = ++generation;
  workspacePlayback.update(state => ({ ...state, playing: true, error: '' }));
  const advance = async (): Promise<void> => {
    if (ownedGeneration !== generation) return;
    const state = workspaceNetwork.get();
    const next = state.selectedStepIndex + 1;
    if (!state.machine || next >= state.machine.steps.length) { pauseWorkspacePlayback(); return; }
    try {
      await networkMachineRuntimeOperations.selectStep(next);
      if (ownedGeneration === generation) timer = setTimeout(() => { void advance(); }, 1000 / workspacePlayback.get().speed);
    } catch (cause) { if (ownedGeneration === generation) fail(cause); }
  };
  timer = setTimeout(() => { void advance(); }, 1000 / workspacePlayback.get().speed);
};

export const setWorkspaceSpeed = (speed: number): void => {
  workspacePlayback.update(state => ({ ...state, speed: clampDemoSpeed(speed) }));
};

export const refreshWorkspaceTimeline = async (adapter: RuntimeAdapter): Promise<void> => {
  pauseWorkspacePlayback();
  try { await networkMachineRuntimeOperations.loadSources([adapterNetworkTimelineSource(adapter.runtimeId, adapter)]); }
  catch (cause) { fail(cause); }
};

export const loadWorkspaceScenario = async (key: string): Promise<number> => {
  pauseWorkspacePlayback();
  const request = generation;
  workspacePlayback.update(state => ({ ...state, error: '' }));
  const machine = await networkMachineRuntimeOperations.loadScenario(key);
  // A user choosing Live, another frame, or another Runtime while the
  // recording runs owns the selection. Finishing a run cannot take it back.
  if (request === generation && machine.steps.length) await networkMachineRuntimeOperations.selectStep(0);
  return machine.steps.length;
};

export const bootWorkspacePlayback = (): Promise<void> => {
  if (bootPromise) return bootPromise;
  bootPromise = (async () => {
    try {
      networkMachineOperations.load();
      if (workspaceBoot.kind === 'plain') return;
      const machine = workspaceBoot.kind === 'trail'
        ? await networkMachineRuntimeOperations.loadTrail(await decodeNetworkTrailFromHash(workspaceBoot.encodedTrail))
        : await networkMachineRuntimeOperations.loadScenario(workspaceBoot.scenario);
      if (machine.steps.length > 0) await networkMachineRuntimeOperations.selectStep(0);
      if (workspaceBoot.autoplay) playWorkspace();
    } catch (cause) { fail(cause); }
  })();
  return bootPromise;
};

export const applyWorkspacePresentation = async (config: NetworkMachineConfig): Promise<void> => {
  pauseWorkspacePlayback();
  const selected = workspaceNetwork.get().selectedStep;
  networkMachineOperations.replace(config);
  const machine = networkMachineRuntimeOperations.recompile();
  if (!selected) return;
  // Filtering is presentation-only. Keep the same event when possible, or
  // select the preceding visible event so the slider and frame remain aligned.
  const exact = machine.steps.findIndex(step => step.event.runtimeId === selected.event.runtimeId && step.event.height === selected.event.height);
  const preceding = machine.steps.findLastIndex(step => step.event.timestamp <= selected.event.timestamp);
  if (!machine.steps.length) { networkMachineRuntimeOperations.goLive(); return; }
  await networkMachineRuntimeOperations.selectStep(exact >= 0 ? exact : Math.max(0, preceding));
};

export const copyWorkspaceTrail = async (): Promise<void> => {
  const encoded = await encodeNetworkTrailForHash(await networkMachineRuntimeOperations.exportTrail());
  const url = new URL('/embed', window.location.origin);
  url.hash = new URLSearchParams({ trail: encoded }).toString();
  await navigator.clipboard.writeText(url.href);
};

export const returnWorkspaceLive = (): void => {
  pauseWorkspacePlayback();
  networkMachineRuntimeOperations.goLive();
};

window.addEventListener('pagehide', event => {
  if (!event.persisted) { pauseWorkspacePlayback(); networkMachineRuntimeOperations.dispose(); }
});
