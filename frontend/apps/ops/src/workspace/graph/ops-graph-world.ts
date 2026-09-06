import * as THREE from 'three';
import { createGraphEntityNode, type GraphEntityVisualData } from '../../../../../packages/ui/src/graph/graph3d-entity-visuals';
import { buildGraphConnection } from '../../../../../src/lib/view/panels/graph3d/graph3d-visuals';
import { materializeRuntimeGraphReplicas } from '../../../../../src/lib/network3d/runtimeGraphRender';
import type { MergedRuntimeGraph } from '../../../../../src/lib/network3d/runtimeGraphProjection';
import { resolveRuntimeGraphLayout, type RuntimeGraphLayoutCache } from '../../../../../src/lib/network3d/runtimeGraphLayout';
import { readGraphPositionOverrides } from '../../../../../src/lib/network3d/graphPositionOverrides';
import type { GraphConnectionData, GraphXLNRuntime } from '../../../../../src/lib/view/panels/graph3d/graph3d-types';
import { getGraphEntitySizeForToken } from '../../../../../src/lib/view/panels/graph3d/graph3d-actions';
import { requireTokenDecimals } from '../../../../../src/lib/components/Entity/token-metadata';
import type { ViewSettings } from '../../../../../packages/runtime-client/src/panels/settings-panel-view';
import { createGraph3dSceneInputView } from '../../../../../packages/runtime-client/src/graph/graph3d-scene-input';
import { createGraphGrid, createGraphJMachine } from '../../../../../packages/ui/src/graph/graph3d-scene-primitives';
import type { NetworkMachineCue } from '../../../../../src/lib/network3d/networkMachine';

export type OpsGraphOptions = Readonly<{
  barsMode: 'close' | 'spread'; selectedTokenId: number; view: ViewSettings;
  cue: NetworkMachineCue | null;
}>;
export type OpsGraphConnection = GraphConnectionData & { accountId: string };

export const buildOpsGraphWorld = (
  world: THREE.Group, runtime: GraphXLNRuntime, graph: MergedRuntimeGraph,
  options: OpsGraphOptions, previousLayout: RuntimeGraphLayoutCache | null,
) => {
  const replicas = materializeRuntimeGraphReplicas(graph);
  const sceneInput = createGraph3dSceneInputView(graph.sources.map(source => ({ source })), graph);
  const jurisdictions = new Map(sceneInput.jurisdictions.map(jurisdiction => [jurisdiction.name, jurisdiction.jMachine]));
  const jurisdictionMeshes: { name: string; mesh: THREE.Group }[] = [];
  const jurisdictionBounds: { id: string; position: THREE.Vector3 }[] = [];
  world.add(createGraphGrid(options.view.gridColor, options.view.gridOpacity, options.view.gridSize, options.view.gridDivisions));
  for (const jurisdiction of sceneInput.jurisdictions) {
    const machine = createGraphJMachine(12, jurisdiction.jMachine.position, jurisdiction.name, jurisdiction.jMachine.jHeight);
    world.add(machine);
    jurisdictionMeshes.push({ name: jurisdiction.name, mesh: machine });
    const bounds = new THREE.Box3().setFromObject(machine);
    jurisdictionBounds.push({ id: `${jurisdiction.name}:min`, position: bounds.min }, { id: `${jurisdiction.name}:max`, position: bounds.max });
  }
  const userPositions = readGraphPositionOverrides(localStorage);
  const layout = resolveRuntimeGraphLayout(graph, userPositions, previousLayout);
  const getEntitySize = (entityId: string, tokenId: number): number => getGraphEntitySizeForToken({
    replicas, entityId, tokenId, sizeMultiplier: options.view.entitySizeMultiplier,
    tokenDecimals: requireTokenDecimals(runtime.getTokenInfo(tokenId).decimals, String(tokenId)),
  });
  const entities: GraphEntityVisualData[] = graph.nodes.map((node, index) => {
    const placed = layout.positions.get(node.entityId);
    if (!placed) throw new Error(`GRAPH_LAYOUT_ENTITY_MISSING:${node.entityId}`);
    return createGraphEntityNode({
      profile: { entityId: node.entityId, metadata: { name: node.selected.label, isHub: node.selected.isHub,
        position: node.selected.position ?? undefined } },
      index, total: graph.nodes.length, forceLayoutPosition: new THREE.Vector3(placed.position.x, placed.position.y, placed.position.z),
      forceLayoutEnabled: options.view.forceLayoutEnabled, isHub: node.selected.isHub, replica: node.selected.replica,
      userPosition: userPositions.get(node.entityId), persistedPosition: undefined,
      defaultJurisdiction: sceneInput.activeJurisdictionName ?? '',
      resolveJMachinePosition: name => jurisdictions.get(name)?.position ?? null,
      selectedTokenId: options.selectedTokenId, getEntitySize,
      labelContent: { flag: '', labelText: node.selected.label, key: node.entityId },
      labelScale: options.view.entityLabelScale, isVrActive: false,
    });
  });
  entities.forEach(entity => world.add(entity.mesh));
  const rebuildConnections = (group: THREE.Group): OpsGraphConnection[] => graph.accounts.map(entry => {
    const fromEntity = entities.find(entity => entity.id === entry.selected.leftEntityId);
    const toEntity = entities.find(entity => entity.id === entry.selected.rightEntityId);
    if (!fromEntity || !toEntity) throw new Error(`GRAPH_ACCOUNT_ENTITY_MISSING:${entry.accountId}`);
    const connection = buildGraphConnection({ graphWorld: group, fromEntity, toEntity, fromId: fromEntity.id, toId: toEntity.id,
      replicas, runtime, theme: 'dark', barsMode: options.barsMode, portfolioScale: 5000, getEntitySize });
    return { ...connection, accountId: entry.accountId };
  });
  return { entities, jurisdictionMeshes, layout, rebuildConnections, focusPoints: [...entities, ...jurisdictionBounds] };
};
