import type { WebGLRenderer } from 'three';
import { createGraph3dFpsOverlayView } from '../../../../../packages/runtime-client/src/graph/graph3d-viewport-view';

export const createOpsGraphStats = (container: HTMLElement) => {
  const output = document.createElement('output');
  output.className = 'ops-graph-stats';
  output.dataset['testid'] = 'graph-render-stats';
  output.setAttribute('aria-label', 'Graph rendering performance');
  output.hidden = true;
  container.append(output);
  let started: number | null = null, frames = 0;
  return {
    reset: (): void => { started = null; frames = 0; output.textContent = 'Measuring rendered frames…'; },
    setVisible: (visible: boolean): void => { output.hidden = !visible; },
    frame: (timestamp: number, renderer: WebGLRenderer): void => {
      if (output.hidden) { started = null; frames = 0; return; }
      if (started === null) { started = timestamp; return; }
      frames += 1;
      const elapsed = timestamp - started;
      if (elapsed < 1000) return;
      const stats = createGraph3dFpsOverlayView(frames * 1000 / elapsed, elapsed / frames, 'close');
      output.dataset['tone'] = stats.tone;
      output.textContent = `${stats.fpsLabel} FPS · ${stats.frameTimeLabel}\n${renderer.info.render.calls} draw calls · ${renderer.info.render.triangles} triangles\n${renderer.info.memory.geometries} geometries · ${renderer.info.memory.textures} textures`;
      started = timestamp; frames = 0;
    },
    dispose: (): void => output.remove(),
  };
};
