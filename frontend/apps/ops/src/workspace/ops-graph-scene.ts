import * as THREE from 'three';
import { safeStringify } from '@xln/core/protocol/serialization';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { resolveGraphHoverHit, highlightGraphHoverTarget } from '../../../../packages/ui/src/graph3d-hover';
import {
  resetGraphObjectHighlight, setGraphPointerNdc, updateGraphSelectionHighlight,
  beginGraphEntityDrag, moveGraphEntityDrag, endGraphEntityDrag,
} from '../../../../packages/ui/src/graph3d-interaction';
import type { GraphEntityVisualData } from '../../../../packages/ui/src/graph3d-entity-visuals';
import { disposeGraphObject3D } from '../../../../packages/ui/src/graph3d-renderer';
import { fitGraphCameraToEntities, applyGraphCameraPose, applyGraphCameraTarget } from '../../../../packages/ui/src/graph3d-camera';
import { bindGraphControlsLifecycle } from '../../../../packages/ui/src/graph3d-lifecycle';
import type { MergedRuntimeGraph } from '../../../../src/lib/network3d/runtimeGraphProjection';
import type { RuntimeGraphLayoutCache } from '../../../../src/lib/network3d/runtimeGraphLayout';
import { writeGraphPositionOverride } from '../../../../src/lib/network3d/graphPositionOverrides';
import type { GraphXLNRuntime } from '../../../../src/lib/view/panels/graph3d/graph3d-types';
import { panelBridge } from '../../../../src/lib/view/utils/panelBridge';
import { readOpsGraphCamera, saveOpsGraphCamera, opsGraphViewSettings } from './ops-graph-preferences';
import { buildOpsGraphWorld, type OpsGraphConnection, type OpsGraphOptions } from './ops-graph-world';
import { applyOpsGraphCue } from './ops-graph-cues';
import { createOpsGraphStats } from './ops-graph-stats';
import { logDebug } from '../../../../src/lib/view/utils/frontendLogger';

export type OpsGraphSelection = Readonly<{ kind: 'entity' | 'account' | 'jurisdiction'; id: string }>;

export const createOpsGraphScene = (
  container: HTMLDivElement, runtime: GraphXLNRuntime,
  onSelect: (selection: OpsGraphSelection) => void,
  onHover: (selection: OpsGraphSelection | null) => void,
  onOpen: (entityId: string) => void,
  onError: (cause: unknown) => void,
  onOpenJurisdiction: (name: string) => void,
) => {
  const settings = opsGraphViewSettings.get();
  let previousView = settings;
  let previousCue = '';
  const renderer = new THREE.WebGLRenderer({ antialias: settings.antiAlias, alpha: false });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#15191d');
  const camera = new THREE.PerspectiveCamera(settings.fov, 1, 0.1, 10000);
  camera.position.set(0, 60, 90);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  const savedCamera = readOpsGraphCamera();
  if (savedCamera) applyGraphCameraPose(camera, controls, savedCamera);
  let cameraChosen = Boolean(savedCamera);
  let cameraSaveTimer: ReturnType<typeof setTimeout> | null = null;
  const cameraState = () => ({ position: { ...camera.position }, target: { ...controls.target }, zoom: camera.zoom });
  const saveCamera = (): void => { saveOpsGraphCamera(cameraState()); cameraChosen = true; };
  const focusBinding = panelBridge.on('camera:focus', ({ target }) => { applyGraphCameraTarget(controls, target); saveCamera(); });
  const restoreBinding = panelBridge.on('camera:restore', pose => { applyGraphCameraPose(camera, controls, pose); saveCamera(); });
  const fail = (cause: unknown): void => { renderer.setAnimationLoop(null); onError(cause); };
  const guarded = <T extends Event>(handler: (event: T) => void) => (event: T): void => {
    try { handler(event); } catch (cause) { fail(cause); }
  };
  const controlBinding = bindGraphControlsLifecycle(controls, {
    onChange: () => {
      panelBridge.emit('camera:update', { ...cameraState(), distance: camera.position.distanceTo(controls.target) });
      if (!cameraChosen) return;
      if (cameraSaveTimer !== null) clearTimeout(cameraSaveTimer);
      cameraSaveTimer = setTimeout(() => {
        cameraSaveTimer = null;
        try { saveCamera(); } catch (cause) { fail(cause); }
      }, 100);
    },
    onEnd: () => { try { saveCamera(); } catch (cause) { fail(cause); } },
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.setAttribute('aria-label', '3D Runtime network');
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-busy', 'true');
  container.append(renderer.domElement);
  const stats = createOpsGraphStats(container);
  scene.add(new THREE.AmbientLight(0xffffff, 2));
  const light = new THREE.DirectionalLight(0xffffff, 3);
  light.position.set(40, 80, 60);
  scene.add(light);
  let world = new THREE.Group(), accountWorld = new THREE.Group();
  scene.add(world);
  let entities: GraphEntityVisualData[] = [];
  let jurisdictionMeshes: { name: string; mesh: THREE.Group }[] = [];
  let focusPoints: { id: string; position: THREE.Vector3 }[] = [];
  let connections: OpsGraphConnection[] = [];
  let layout: RuntimeGraphLayoutCache | null = null;
  let rebuildConnections: ((group: THREE.Group) => OpsGraphConnection[]) | null = null;
  let hovered: THREE.Object3D | null = null;
  let selected: OpsGraphSelection | null = null;
  const resize = (): void => {
    stats.reset();
    const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  const dragPlane = new THREE.Plane(), dragOffset = new THREE.Vector3();
  let pointerDown: { x: number; y: number; id: number } | null = null;
  let dragged: GraphEntityVisualData | null = null;
  let moved = false;
  const hitAt = (event: MouseEvent) => {
    setGraphPointerNdc(pointer, event, renderer.domElement.getBoundingClientRect());
    raycaster.setFromCamera(pointer, camera);
    const hit = resolveGraphHoverHit(raycaster, entities, connections, world, scene);
    if (hit.kind !== 'none') return hit;
    const jurisdictionHit = raycaster.intersectObjects(jurisdictionMeshes.map(entry => entry.mesh), true)[0];
    if (!jurisdictionHit) return hit;
    const jurisdiction = jurisdictionMeshes.find(entry => {
      let object: THREE.Object3D | null = jurisdictionHit.object;
      while (object) { if (object === entry.mesh) return true; object = object.parent; }
      return false;
    });
    if (!jurisdiction) throw new Error('GRAPH_JURISDICTION_HIT_UNRESOLVED');
    return { kind: 'jurisdiction' as const, name: jurisdiction.name };
  };
  const down = guarded((event: PointerEvent): void => {
    if (event.button !== 0 || pointerDown) return;
    pointerDown = { x: event.clientX, y: event.clientY, id: event.pointerId };
    moved = false;
    const hit = hitAt(event);
    if (hit.kind !== 'entity') return;
    controls.enabled = false;
    dragged = hit.entity;
    beginGraphEntityDrag(camera, raycaster, dragged, dragPlane, dragOffset);
    renderer.domElement.setPointerCapture(event.pointerId);
    onSelect({ kind: 'entity', id: dragged.id });
  });
  const refreshConnections = (): void => {
    world.remove(accountWorld);
    disposeGraphObject3D(accountWorld);
    accountWorld = new THREE.Group();
    world.add(accountWorld);
    if (rebuildConnections) connections = rebuildConnections(accountWorld);
  };
  const up = guarded((event: PointerEvent): void => {
    if (!pointerDown || pointerDown.id !== event.pointerId) return;
    if (dragged) {
      endGraphEntityDrag(dragged);
      if (moved) writeGraphPositionOverride(localStorage, dragged.id, { ...dragged.position });
      dragged = null;
    }
    if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
    controls.enabled = true;
    pointerDown = null;
  });
  const click = guarded((event: MouseEvent): void => {
    if (moved) return;
    const hit = hitAt(event);
    if (hit.kind === 'entity') onSelect({ kind: 'entity', id: hit.entity.id });
    if (hit.kind === 'connection') onSelect({ kind: 'account', id: hit.connection.accountId });
    if (hit.kind === 'jurisdiction') onOpenJurisdiction(hit.name);
  });
  const doubleClick = guarded((event: MouseEvent): void => {
    if (moved) return;
    const hit = hitAt(event);
    if (hit.kind === 'entity') onOpen(hit.entity.id);
  });
  const leave = (): void => {
    if (hovered) resetGraphObjectHighlight(hovered);
    hovered = null;
    renderer.domElement.style.cursor = '';
    onHover(null);
  };
  const move = guarded((event: PointerEvent): void => {
    if (pointerDown && Math.hypot(pointerDown.x - event.clientX, pointerDown.y - event.clientY) > 5) moved = true;
    if (dragged && moved) {
      setGraphPointerNdc(pointer, event, renderer.domElement.getBoundingClientRect());
      raycaster.setFromCamera(pointer, camera);
      moveGraphEntityDrag(raycaster, dragged, dragPlane, dragOffset);
      refreshConnections();
      return;
    }
    if (event.buttons) return;
    leave();
    const hit = hitAt(event);
    if (hit.kind === 'jurisdiction') { renderer.domElement.style.cursor = 'pointer'; onHover({ kind: 'jurisdiction', id: hit.name }); return; }
    if (hit.kind !== 'entity' && hit.kind !== 'connection') return;
    hovered = hit.target;
    highlightGraphHoverTarget(hit.kind, hit.target);
    renderer.domElement.style.cursor = 'pointer';
    onHover(hit.kind === 'entity' ? { kind: 'entity', id: hit.entity.id } : { kind: 'account', id: hit.connection.accountId });
  });
  // Capture precedes OrbitControls' pointer handler, so entity dragging never
  // rotates the camera. Pointer capture ends the gesture outside the canvas too.
  renderer.domElement.addEventListener('pointerdown', down, true);
  renderer.domElement.addEventListener('pointerup', up);
  renderer.domElement.addEventListener('pointercancel', up);
  renderer.domElement.addEventListener('click', click);
  renderer.domElement.addEventListener('dblclick', doubleClick);
  renderer.domElement.addEventListener('pointermove', move);
  renderer.domElement.addEventListener('pointerleave', leave);
  renderer.setAnimationLoop(timestamp => {
    try { controls.update(); renderer.render(scene, camera); stats.frame(timestamp, renderer); renderer.domElement.setAttribute('aria-busy', 'false'); }
    catch (cause) { fail(cause); }
  });
  return {
    select: (selection: OpsGraphSelection | null): void => {
      selected = selection;
      updateGraphSelectionHighlight(entities, selection?.kind === 'entity' ? selection.id : '');
    },
    fit: (): void => { fitGraphCameraToEntities(camera, controls, focusPoints); saveCamera(); },
    update: (graph: MergedRuntimeGraph, options: OpsGraphOptions): void => {
      // Finish a drag before replacing its meshes; a playback tick must not
      // retain a pointer to a disposed entity or leave orbit controls disabled.
      if (dragged) { endGraphEntityDrag(dragged); dragged = null; controls.enabled = true; }
      renderer.domElement.setAttribute('aria-busy', 'true');
      leave();
      scene.remove(world);
      disposeGraphObject3D(world);
      world = new THREE.Group();
      accountWorld = new THREE.Group();
      scene.add(world);
      const result = buildOpsGraphWorld(world, runtime, graph, options, layout);
      logDebug('GRAPH3D_UPDATES', { entities: graph.nodes.length, accounts: graph.accounts.length, jurisdictions: graph.jMachines.length });
      stats.setVisible(options.view.showFpsOverlay);
      entities = result.entities;
      jurisdictionMeshes = result.jurisdictionMeshes;
      focusPoints = result.focusPoints;
      layout = result.layout;
      rebuildConnections = result.rebuildConnections;
      refreshConnections();
      camera.fov = options.cue?.camera?.fov ?? options.view.fov;
      camera.updateProjectionMatrix();
      controls.autoRotate = options.view.autoRotate;
      controls.autoRotateSpeed = options.view.autoRotateSpeed;
      if (!cameraChosen && focusPoints.length) { fitGraphCameraToEntities(camera, controls, focusPoints); cameraChosen = true; }
      // Settings only apply edited fields. Broadcasting the defaults on mount
      // must never replace a retained manual camera pose.
      const target = options.view.cameraTarget, oldTarget = previousView.cameraTarget;
      if (target.x !== oldTarget.x || target.y !== oldTarget.y || target.z !== oldTarget.z) applyGraphCameraTarget(controls, target);
      if (options.view.cameraDistance !== previousView.cameraDistance) {
        const direction = camera.position.clone().sub(controls.target).normalize();
        if (!direction.lengthSq()) direction.set(0, 1, 1).normalize();
        camera.position.copy(controls.target).addScaledVector(direction, options.view.cameraDistance);
        controls.update();
      }
      previousView = options.view;
      const cue = options.cue ? safeStringify(options.cue) : '';
      if (cue !== previousCue && options.cue && applyOpsGraphCue(camera, controls, options.cue, graph, focusPoints)) saveCamera();
      previousCue = cue;
      updateGraphSelectionHighlight(entities, selected?.kind === 'entity' ? selected.id : '');
    },
    dispose: (): void => {
      if (cameraSaveTimer !== null) clearTimeout(cameraSaveTimer);
      // Storage failures remain visible, but must not leak animation loops,
      // controls, or GPU resources while a dock panel is being removed.
      try { if (cameraChosen) saveCamera(); } catch (cause) { onError(cause); }
      renderer.setAnimationLoop(null);
      focusBinding();
      restoreBinding();
      observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', down, true);
      renderer.domElement.removeEventListener('pointerup', up);
      renderer.domElement.removeEventListener('pointercancel', up);
      renderer.domElement.removeEventListener('click', click);
      renderer.domElement.removeEventListener('dblclick', doubleClick);
      renderer.domElement.removeEventListener('pointermove', move);
      renderer.domElement.removeEventListener('pointerleave', leave);
      controlBinding.dispose();
      controls.dispose();
      disposeGraphObject3D(scene);
      renderer.dispose();
      stats.dispose();
      renderer.domElement.remove();
    },
  };
};
