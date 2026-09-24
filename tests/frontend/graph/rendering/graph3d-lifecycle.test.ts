import { describe, expect, test } from 'bun:test';

const read = (path: string): Promise<string> => Bun.file(path).text();

describe('Graph3D framework-neutral lifecycle', () => {
  test('pairs every canvas and viewport subscription with deterministic cleanup', async () => {
    const source = await read('frontend/packages/ui/src/graph/three/core/graph3d-lifecycle.ts');

    for (const eventName of [
      'mousedown',
      'mouseup',
      'mousemove',
      'mouseout',
      'click',
      'dblclick',
      'touchstart',
      'touchmove',
      'touchend',
    ]) {
      expect(source).toContain(`canvas.addEventListener('${eventName}'`);
      expect(source).toContain(`canvas.removeEventListener('${eventName}'`);
    }
    expect(source).toContain("browserWindow.addEventListener('resize', handlers.onResize)");
    expect(source).toContain("browserWindow.removeEventListener('resize', handlers.onResize)");
    expect(source).toContain('observer.disconnect()');
    expect(source).toContain('browserWindow.clearTimeout(resizeTimer)');
    expect(source).toContain('browserWindow.cancelAnimationFrame(resizeFrame)');
    expect(source).toContain("controls.addEventListener('change', handlers.onChange)");
    expect(source).toContain("controls.removeEventListener('change', handlers.onChange)");
    expect(source).toContain("controls.addEventListener('end', handlers.onEnd)");
    expect(source).toContain("controls.removeEventListener('end', handlers.onEnd)");
  });

  test('React Graph3D frees DOM, Three.js, controls, and XR resources', async () => {
    const source = await read('frontend/apps/ops/src/workspace/graph/ops-graph-scene.ts');

    expect(source).toContain('bindGraphControlsLifecycle(controls');
    expect(source).toContain('controlBinding.dispose()');
    expect(source).toContain('observer.disconnect()');
    expect(source).toContain("renderer.domElement.removeEventListener('pointerdown', down, true)");
    expect(source).toContain('xr.dispose()');
    expect(source).toContain('disposeGraphObject3D(scene)');
    expect(source).toContain('renderer.setAnimationLoop(null)');
    expect(source).toContain('renderer.domElement.remove()');
    expect(source).not.toContain('window.__debugScene');
    expect(source).not.toContain('window.__debugCamera');
    expect(source).not.toContain('window.__debugRenderer');
  });

  test('debug registrations expose an ownership-safe disposer and React graph stays private', async () => {
    const [debugSource, graphSource] = await Promise.all([
      read('frontend/packages/browser/src/runtime/debug-surface.ts'),
      read('frontend/apps/ops/src/workspace/graph/ops-graph-scene.ts'),
    ]);

    expect(debugSource).toContain('): () => void {');
    expect(debugSource).toContain('descriptor?.get === factory');
    expect(debugSource).toContain('delete currentRoot[name]');
    expect(graphSource).not.toContain('registerDebugSurface');
    expect(graphSource).not.toContain('__debugScene');
  });
});
