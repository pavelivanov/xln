import { createObservableStore } from '../../../../src/lib/utils/observableStore';
import { setFrontendVerboseLogging } from '../../../../src/lib/view/utils/frontendLogger';
import {
  readBirdViewSettings, writeBirdViewSettings, type BirdViewSettings, type BirdViewCameraState,
} from '../../../../src/lib/view/panels/graph3d/graph3d-settings';
import {
  createDefaultViewSettings, parseViewSettings, normalizeViewSettings, serializeViewSettings,
  VIEW_SETTINGS_STORAGE_KEY, type ViewSettings,
} from '../../../../packages/runtime-client/src/settings-panel-view';

const storage = typeof localStorage === 'undefined' ? null : localStorage;
const savedView = storage?.getItem(VIEW_SETTINGS_STORAGE_KEY);
export const opsGraphBirdSettings = createObservableStore(readBirdViewSettings(storage));
export const opsGraphViewSettings = createObservableStore(savedView ? parseViewSettings(savedView) : createDefaultViewSettings());
setFrontendVerboseLogging(opsGraphViewSettings.get().verboseLogging);

export const updateOpsGraphBirdSettings = (patch: Partial<Pick<BirdViewSettings, 'barsMode' | 'selectedTokenId'>>): void => {
  // Camera writes happen on the browser control boundary. Read that latest pose
  // before changing another field, so a stale React render cannot replace it.
  const next = { ...readBirdViewSettings(storage), ...patch };
  writeBirdViewSettings(storage, next);
  opsGraphBirdSettings.set(next);
};

export const saveOpsGraphCamera = (camera: BirdViewCameraState): void => {
  writeBirdViewSettings(storage, { ...readBirdViewSettings(storage), camera });
};

export const updateOpsGraphViewSettings = (patch: Partial<ViewSettings>): void => {
  const next = normalizeViewSettings({ ...opsGraphViewSettings.get(), ...patch });
  storage?.setItem(VIEW_SETTINGS_STORAGE_KEY, serializeViewSettings(next));
  setFrontendVerboseLogging(next.verboseLogging);
  opsGraphViewSettings.set(next);
};

export const readOpsGraphCamera = (): BirdViewCameraState | undefined => readBirdViewSettings(storage).camera;
