import * as THREE from 'three';
import { disposeGraphObject3D, type GraphRenderer } from '../../../../../packages/ui/src/graph/graph3d-renderer';
import type { GraphEntityVisualData } from '../../../../../packages/ui/src/graph/graph3d-entity-visuals';
import {
  beginGraphGesture, beginGraphXrGrab, createGraphXrRaycaster, emptyGraphGestureState,
  endGraphGesture, endGraphXrGrab, findGraphEntityFromObject, moveGraphXrGrab,
  type GraphXrGrab,
} from '../../../../../packages/ui/src/graph/graph3d-interaction';

type XrState = Readonly<{ supported: boolean; active: boolean }>;
type ControllerEvent = Readonly<{ target: THREE.Object3D; data: XRInputSource }>;

export const readOpsGraphXrSupport = async (): Promise<boolean> => {
  if (typeof navigator === 'undefined' || navigator.webdriver || !navigator.xr) return false;
  return navigator.xr.isSessionSupported('immersive-vr');
};

export const createOpsGraphXr = (input: Readonly<{
  renderer: GraphRenderer;
  scene: THREE.Scene;
  supported: boolean;
  getWorld: () => THREE.Group;
  getEntities: () => readonly GraphEntityVisualData[];
  getScale: () => number;
  onSelect: (entityId: string) => void;
  onOpen: (entityId: string) => void;
  onMove: (entity: GraphEntityVisualData) => void;
  onState: (state: XrState) => void;
  onError: (cause: unknown) => void;
}>) => {
  let active = false;
  const desktopBackground = input.scene.background;
  let gesture = emptyGraphGestureState();
  const grabs = new Map<string, GraphXrGrab<GraphEntityVisualData>>();
  const controllers: Array<Readonly<{
    controller: ReturnType<GraphRenderer['xr']['getController']>;
    connected: (event: ControllerEvent) => void;
    disconnected: (event: ControllerEvent) => void;
    selectStart: (event: ControllerEvent) => void;
    selectEnd: (event: ControllerEvent) => void;
  }>> = [];
  const applyWorld = (): void => {
    const world = input.getWorld();
    if (!active) { world.scale.setScalar(1); world.position.set(0, 0, 0); return; }
    world.scale.setScalar(0.01 * input.getScale());
    world.position.set(0, -0.5, -1);
  };
  const releaseGrab = (sourceId: string, allowOpen: boolean): void => {
    const grab = grabs.get(sourceId);
    if (!grab) return;
    const moved = endGraphXrGrab(grab);
    grabs.delete(sourceId);
    const ended = endGraphGesture(gesture, { sourceId, entityId: grab.entity.id, at: performance.now(), moved });
    gesture = ended.state;
    if (moved) input.onMove(grab.entity);
    else if (allowOpen && ended.outcome === 'open') input.onOpen(grab.entity.id);
  };
  const resetGrabs = (): void => { for (const sourceId of [...grabs.keys()]) releaseGrab(sourceId, false); };
  input.renderer.xr.enabled = input.supported;
  if (input.supported) {
    for (let index = 0; index < 2; index += 1) {
      const controller = input.renderer.xr.getController(index);
      controller.userData['sourceId'] = `xr:slot-${index}`;
      const connected = (event: ControllerEvent): void => {
        controller.userData['sourceId'] = `xr:${event.data.targetRayMode}:${event.data.handedness || `slot-${index}`}`;
        controller.visible = true;
      };
      const disconnected = (): void => {
        releaseGrab(String(controller.userData['sourceId'] || controller.uuid), false);
        controller.visible = false;
      };
      const selectStart = (event: ControllerEvent): void => {
        const sourceId = String(controller.userData['sourceId'] || controller.uuid);
        const raycaster = createGraphXrRaycaster(event.target);
        const world = input.getWorld();
        const hit = raycaster.intersectObjects(input.getEntities().map(entity => entity.mesh), true)[0];
        const entity = findGraphEntityFromObject(hit?.object, input.getEntities(), world, input.scene);
        if (!entity || !hit) return;
        input.onSelect(entity.id);
        grabs.set(sourceId, beginGraphXrGrab(entity, controller, sourceId, hit.distance));
        gesture = beginGraphGesture(gesture, { sourceId, entityId: entity.id, at: performance.now() });
      };
      const selectEnd = (): void => releaseGrab(String(controller.userData['sourceId'] || controller.uuid), true);
      controller.addEventListener('connected', connected);
      controller.addEventListener('disconnected', disconnected);
      controller.addEventListener('selectstart', selectStart);
      controller.addEventListener('selectend', selectEnd);
      const ray = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1.5)]),
        new THREE.LineBasicMaterial({ color: 0x00ffff, opacity: 0.8, transparent: true }),
      );
      ray.name = 'xln-xr-target-ray';
      controller.add(ray);
      input.scene.add(controller);
      controllers.push({ controller, connected, disconnected, selectStart, selectEnd });
    }
  }
  const sessionEnded = (): void => {
    active = false;
    input.scene.background = desktopBackground;
    resetGrabs();
    applyWorld();
    input.onState({ supported: input.supported, active: false });
  };
  input.onState({ supported: input.supported, active: false });
  return {
    enter: async (): Promise<void> => {
      if (!input.supported || !navigator.xr) throw new Error('GRAPH_XR_UNSUPPORTED');
      if (active) return;
      const session = await navigator.xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking', 'layers', 'dom-overlay', 'anchors'],
        domOverlay: { root: input.renderer.domElement.parentElement ?? document.body },
      });
      session.addEventListener('end', sessionEnded, { once: true });
      try { await input.renderer.xr.setSession(session); }
      catch (cause) { await session.end(); throw cause; }
      active = true;
      input.scene.background = null;
      applyWorld();
      input.onState({ supported: true, active: true });
    },
    exit: async (): Promise<void> => { await input.renderer.xr.getSession()?.end(); },
    frame: (): void => { for (const grab of grabs.values()) moveGraphXrGrab(grab, input.getWorld()); },
    resetGrabs,
    applyWorld,
    dispose: (): void => {
      const session = input.renderer.xr.getSession();
      if (session) void session.end().catch(input.onError);
      for (const { controller, connected, disconnected, selectStart, selectEnd } of controllers) {
        controller.removeEventListener('connected', connected);
        controller.removeEventListener('disconnected', disconnected);
        controller.removeEventListener('selectstart', selectStart);
        controller.removeEventListener('selectend', selectEnd);
        input.scene.remove(controller);
        disposeGraphObject3D(controller);
      }
      controllers.length = 0;
      sessionEnded();
    },
  };
};
