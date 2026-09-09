import * as THREE from 'three';
import type { RuntimeInput } from '@xln/core/api/public/runtime-module';
import {
  createBroadcastParticleMesh,
  createBroadcastRayMesh,
  createBroadcastRippleMesh,
  createDirectionalLightningMesh,
} from '../../../../../packages/ui/src/graph/graph3d-visual-effects';
import { disposeGraphObject3D } from '../../../../../packages/ui/src/graph/graph3d-renderer';
import { graph3dSceneTransactionOf, type Graph3dSceneTransaction } from '../../../../../packages/runtime-client/src/graph/graph3d-scene-input';
import type { GraphEntityVisualData } from '../../../../../packages/ui/src/graph/graph3d-entity-visuals';
import type { ViewSettings } from '../../../../../packages/runtime-client/src/panels/settings-panel-view';
import type { OpsGraphConnection } from './ops-graph-world';

export type OpsGraphEffectSignal =
  | Readonly<{ kind: 'lightning'; fromEntityId: string; toEntityId: string; transaction?: Graph3dSceneTransaction }>
  | Readonly<{ kind: 'broadcast'; entityId: string; txType: string }>
  | Readonly<{ kind: 'jurisdiction-broadcast'; jurisdictionName: string; txType: string; transactionCount: number }>;

type AnimatedEffect = {
  mesh: THREE.Mesh;
  kind: 'lightning' | 'wave' | 'raycast' | 'particles';
  startedAt: number;
  duration: number;
  from?: THREE.Vector3;
  to?: THREE.Vector3;
};

const RESERVE_BROADCAST_TYPES = new Set([
  'r2c', 'reserve_to_collateral', 'deposit_reserve', 'withdraw_reserve',
]);

export const projectOpsGraphEffects = (input: RuntimeInput | null | undefined): OpsGraphEffectSignal[] => {
  if (!input) return [];
  const effects: OpsGraphEffectSignal[] = [];
  for (const entityInput of input.entityInputs ?? []) {
    const entityId = String(entityInput.entityId || '').trim().toLowerCase();
    for (const value of entityInput.entityTxs ?? []) {
      const transaction = graph3dSceneTransactionOf(value);
      const data = transaction.data;
      const fromEntityId = data?.fromEntityId?.trim().toLowerCase();
      const toEntityId = data?.toEntityId?.trim().toLowerCase();
      if (transaction.type === 'accountInput' && fromEntityId && toEntityId) {
        effects.push({ kind: 'lightning', fromEntityId, toEntityId, ...(data?.accountTx ? { transaction: data.accountTx } : {}) });
      } else if (transaction.type && RESERVE_BROADCAST_TYPES.has(transaction.type) && entityId) {
        effects.push({ kind: 'broadcast', entityId, txType: transaction.type });
      }
    }
  }
  for (const jInput of input.jInputs ?? []) {
    const txType = String(jInput.jTxs[0]?.type || 'jurisdiction');
    if (jInput.jTxs.length > 0) effects.push({
      kind: 'jurisdiction-broadcast', jurisdictionName: jInput.jurisdictionName,
      txType, transactionCount: jInput.jTxs.length,
    });
  }
  return effects;
};

const materialOpacity = (mesh: THREE.Mesh, opacity: number): void => {
  const material = mesh.material;
  if (Array.isArray(material)) {
    for (const entry of material) { entry.transparent = true; entry.opacity = opacity; }
    return;
  }
  material.transparent = true;
  material.opacity = opacity;
};

export const createOpsGraphEffects = (container: HTMLElement) => {
  let owner: THREE.Group | null = null;
  let active: AnimatedEffect[] = [];
  const updateEvidence = (): void => {
    container.dataset['effectCount'] = String(active.length);
    container.dataset['effectKinds'] = Array.from(new Set(active.map(effect => effect.kind))).sort().join(',');
  };
  const clear = (): void => {
    for (const effect of active) { owner?.remove(effect.mesh); disposeGraphObject3D(effect.mesh); }
    active = [];
    container.dataset['effectEmittedKinds'] = '';
    updateEvidence();
  };
  const add = (effect: AnimatedEffect): void => { owner?.add(effect.mesh); active.push(effect); };
  const addBroadcast = (
    origin: THREE.Vector3, target: THREE.Vector3, txType: string,
    style: ViewSettings['broadcastStyle'], startedAt: number, duration: number,
  ): void => {
    if (style === 'wave') {
      add({ mesh: createBroadcastRippleMesh(origin, txType), kind: 'wave', startedAt, duration });
    } else if (style === 'raycast') {
      add({ mesh: createBroadcastRayMesh(origin, target, txType), kind: 'raycast', startedAt, duration });
    } else {
      add({ mesh: createBroadcastParticleMesh(origin, txType), kind: 'particles', startedAt, duration, from: origin.clone(), to: target.clone() });
    }
  };
  return {
    replace: (world: THREE.Group, signals: readonly OpsGraphEffectSignal[], options: ViewSettings,
      entities: readonly GraphEntityVisualData[], jurisdictions: readonly { name: string; mesh: THREE.Group }[],
      connections: readonly OpsGraphConnection[]): void => {
      clear(); owner = world;
      const startedAt = performance.now();
      const duration = Math.max(50, options.lightningSpeed);
      for (const signal of signals) {
        if (signal.kind === 'lightning') {
          if (!options.lightningEnabled) continue;
          const connection = connections.find(entry => (entry.from === signal.fromEntityId && entry.to === signal.toEntityId)
            || (entry.from === signal.toEntityId && entry.to === signal.fromEntityId));
          if (!connection) continue;
          add({ mesh: createDirectionalLightningMesh(connection, signal.transaction), kind: 'lightning', startedAt, duration });
          continue;
        }
        if (!options.broadcastEnabled) continue;
        const source = signal.kind === 'broadcast'
          ? entities.find(entity => entity.id.toLowerCase() === signal.entityId)?.position
          : jurisdictions.find(entry => entry.name === signal.jurisdictionName)?.mesh.position;
        if (!source) continue;
        const targets = signal.kind === 'broadcast'
          ? entities.filter(entity => entity.id.toLowerCase() !== signal.entityId).map(entity => entity.position)
          : entities.map(entity => entity.position);
        const selectedTargets = options.broadcastStyle === 'wave' ? [source] : targets;
        for (const target of selectedTargets) addBroadcast(source, target, signal.txType, options.broadcastStyle, startedAt, Math.max(500, duration * 6));
      }
      container.dataset['effectEmittedKinds'] = Array.from(new Set(active.map(effect => effect.kind))).sort().join(',');
      updateEvidence();
    },
    frame: (timestamp: number): void => {
      for (let index = active.length - 1; index >= 0; index -= 1) {
        const effect = active[index]!;
        const progress = Math.min(1, Math.max(0, (timestamp - effect.startedAt) / effect.duration));
        materialOpacity(effect.mesh, 1 - progress);
        if (effect.kind === 'wave') effect.mesh.scale.setScalar(1 + progress * 10);
        if (effect.kind === 'lightning' || effect.kind === 'raycast') effect.mesh.scale.y = Math.min(1, progress * 4);
        if (effect.kind === 'particles' && effect.from && effect.to) effect.mesh.position.copy(effect.from).lerp(effect.to, progress);
        if (progress < 1) continue;
        owner?.remove(effect.mesh); disposeGraphObject3D(effect.mesh); active.splice(index, 1);
      }
      updateEvidence();
    },
    clear,
  };
};
