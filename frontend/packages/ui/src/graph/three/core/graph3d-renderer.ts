import * as THREE from 'three';
import type WebGPURenderer from 'three/src/renderers/webgpu/WebGPURenderer.js';

export type GraphRenderer = THREE.WebGLRenderer | WebGPURenderer;
export type GraphRendererMode = 'webgl' | 'webgpu';

export type GraphRendererSelection = Readonly<{
  renderer: GraphRenderer | null;
  mode: GraphRendererMode;
  issue: string;
}>;

export function getGraphThemeColors(_theme: string) {
  return {
    background: 0x222222,
    entity: 0x007acc,
    connection: 0x444444,
    entityColor: '#007acc',
    entityEmissive: '#003366',
    connectionColor: '#444444',
  };
}

export async function createExactGraphRenderer(
  mode: GraphRendererMode,
  options: THREE.WebGLRendererParameters,
): Promise<GraphRendererSelection> {
  if (mode === 'webgpu') {
    if (typeof navigator === 'undefined' || !navigator.gpu) {
      return { renderer: null, mode, issue: 'GRAPH_WEBGPU_UNSUPPORTED' };
    }
    let renderer: WebGPURenderer | null = null;
    try {
      const { default: WebGPURenderer } = await import('three/src/renderers/webgpu/WebGPURenderer.js');
      renderer = new WebGPURenderer({ antialias: options.antialias });
      await renderer.init();
      return { renderer, mode, issue: '' };
    } catch (error) {
      renderer?.dispose();
      const message = error instanceof Error ? error.message : String(error);
      return { renderer: null, mode, issue: `GRAPH_WEBGPU_INITIALIZATION_FAILED:${message}` };
    }
  }

  try {
    return { renderer: new THREE.WebGLRenderer(options), mode, issue: '' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { renderer: null, mode, issue: `GRAPH_WEBGL_INITIALIZATION_FAILED:${message}` };
  }
}

export async function createGraphRenderer(
  mode: string,
  options: THREE.WebGLRendererParameters,
): Promise<GraphRenderer | null> {
  const selectedMode: GraphRendererMode = mode === 'webgpu' ? 'webgpu' : 'webgl';
  const exact = await createExactGraphRenderer(selectedMode, options);
  if (exact.renderer || selectedMode === 'webgl') return exact.renderer;
  console.warn('[Graph3D] WebGPU renderer unavailable, falling back to WebGL:', exact.issue);
  return (await createExactGraphRenderer('webgl', options)).renderer;
}

type DisposableMaterial = { dispose?: () => void; map?: { dispose?: () => void } | null };

/**
 * Frees geometry, materials AND their textures. Label/mempool sprites carry a CanvasTexture
 * per instance, so skipping `material.map` leaks one texture per rebuild.
 */
export function disposeGraphObject3D(obj: THREE.Object3D): void {
  obj.traverse((child: THREE.Object3D & { geometry?: { dispose?: () => void }; material?: unknown }) => {
    child.geometry?.dispose?.();
    if (!child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const entry of materials as DisposableMaterial[]) {
      entry?.map?.dispose?.();
      entry?.dispose?.();
    }
  });
}

/** Detach from `parent` and free every GPU resource underneath. Safe on null/undefined. */
export function detachGraphObject3D(parent: THREE.Object3D | null, child: THREE.Object3D | null | undefined): void {
  if (!child) return;
  parent?.remove(child);
  disposeGraphObject3D(child);
}
