import type * as THREE from 'three';
import { applyGraphCameraPose, fitGraphCameraToEntities, type GraphCameraControls } from '../../../../../packages/ui/src/graph/graph3d-camera';
import type { NetworkMachineCue } from '../../../../../src/lib/network3d/networkMachine';
import type { MergedRuntimeGraph } from '../../../../../src/lib/network3d/runtimeGraphProjection';

export const applyOpsGraphCue = (
  camera: THREE.PerspectiveCamera, controls: GraphCameraControls,
  cue: NetworkMachineCue, graph: MergedRuntimeGraph,
  points: readonly { id: string; position: THREE.Vector3 }[],
): boolean => {
  if (cue.camera) { applyGraphCameraPose(camera, controls, cue.camera); return true; }
  const ids = new Set(cue.focusEntityIds ?? []);
  for (const account of graph.accounts) {
    if (!cue.focusAccountIds?.includes(account.accountId)) continue;
    ids.add(account.selected.leftEntityId); ids.add(account.selected.rightEntityId);
  }
  for (const jurisdiction of cue.focusJMachineIds ?? []) {
    ids.add(`${jurisdiction}:min`); ids.add(`${jurisdiction}:max`);
  }
  const selected = points.filter(point => ids.has(point.id));
  return selected.length > 0 && fitGraphCameraToEntities(camera, controls, selected);
};
