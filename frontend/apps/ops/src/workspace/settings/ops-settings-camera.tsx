import { useEffect, useState } from 'react';
import { safeStringify } from '@xln/core/protocol/serialization';
import { panelBridge } from '../../../../../src/lib/view/utils/panelBridge';
import { mergeSettingsCameraState, type SettingsCameraState, type ViewSettings } from '../../../../../packages/runtime-client/src/panels/settings-panel-view';
import { readOpsGraphCamera } from '../graph/ops-graph-preferences';
import { SettingsRange } from './ops-settings-range';

const readCamera = (): SettingsCameraState | null => {
  const camera = readOpsGraphCamera();
  if (!camera) return null;
  return { ...camera, distance: Math.hypot(camera.position.x - camera.target.x, camera.position.y - camera.target.y, camera.position.z - camera.target.z) };
};

export function OpsSettingsCamera({ view, update }: Readonly<{ view: ViewSettings; update: (patch: Partial<ViewSettings>) => void }>) {
  const [camera, setCamera] = useState(readCamera);
  const [issue, setIssue] = useState('');
  useEffect(() => panelBridge.on('camera:update', pose => setCamera(current => mergeSettingsCameraState(current ?? { ...pose, distance: 0 }, pose))), []);
  const focusOrigin = (): void => {
    try { panelBridge.emit('camera:focus', { target: { x: 0, y: 0, z: 0 } }); update({ cameraTarget: { x: 0, y: 0, z: 0 } }); setIssue(''); }
    catch (cause) { setIssue(cause instanceof Error ? cause.message : String(cause)); }
  };
  return <>
    <h3>Camera</h3>
    <SettingsRange label="Camera distance" value={view.cameraDistance} min={100} max={2000} step={50} onChange={cameraDistance => update({ cameraDistance })} />
    <SettingsRange label="Field of view" value={view.fov} min={30} max={120} step={5} onChange={fov => update({ fov })} />
    <label className="ops-settings-toggle"><input type="checkbox" checked={view.autoRotate} onChange={event => update({ autoRotate: event.currentTarget.checked })} /> Auto rotate</label>
    <SettingsRange label="Auto rotate speed" value={view.autoRotateSpeed} min={0.1} max={2} step={0.1} onChange={autoRotateSpeed => update({ autoRotateSpeed })} />
    <fieldset className="ops-camera-target"><legend>Camera target</legend>{(['x', 'y', 'z'] as const).map(axis => <label key={axis}>{axis.toUpperCase()}<input aria-label={`Camera target ${axis}`} type="number" value={view.cameraTarget[axis]} onChange={event => {
      const value = event.currentTarget.valueAsNumber;
      if (Number.isFinite(value)) update({ cameraTarget: { ...view.cameraTarget, [axis]: value } });
    }} /></label>)}</fieldset><button type="button" onClick={focusOrigin}>Focus origin</button>
    <details><summary>Current camera pose</summary>{camera ? <pre data-testid="settings-camera-pose">{safeStringify(camera, 2)}</pre> : <p>Open Graph3D to position the camera.</p>}</details>
    {issue ? <p role="alert">{issue}</p> : null}
  </>;
}
