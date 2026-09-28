type SimulatorRow = Readonly<{
  deviceTypeIdentifier: string;
  lastBootedAt: string;
  name: string;
  runtimeIdentifier: string;
  state: string;
  udid: string;
}>;

export type IosUiSimulatorSelection = SimulatorRow & Readonly<{ source: 'discovered' | 'explicit' }>;

const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu;
const iosRuntimePrefix = 'com.apple.CoreSimulator.SimRuntime.iOS-';
const iphoneTypePrefix = 'com.apple.CoreSimulator.SimDeviceType.iPhone-';

const asRecord = (value: unknown, error: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(error);
  return value as Record<string, unknown>;
};

const requiredString = (value: unknown, error: string): string => {
  if (typeof value !== 'string' || value.length === 0) throw new Error(error);
  return value;
};

const parseSimulator = (runtimeIdentifier: string, value: unknown): SimulatorRow | null => {
  const row = asRecord(value, 'IOS_UI_DEVICE_ROW_INVALID');
  if (row.isAvailable !== true) return null;
  const deviceTypeIdentifier = requiredString(row.deviceTypeIdentifier, 'IOS_UI_DEVICE_TYPE_INVALID');
  if (!deviceTypeIdentifier.startsWith(iphoneTypePrefix)) return null;
  const udid = requiredString(row.udid, 'IOS_UI_DEVICE_ID_INVALID');
  if (!uuidPattern.test(udid)) throw new Error(`IOS_UI_DEVICE_ID_INVALID:${udid}`);
  return {
    deviceTypeIdentifier,
    lastBootedAt: typeof row.lastBootedAt === 'string' ? row.lastBootedAt : '',
    name: requiredString(row.name, 'IOS_UI_DEVICE_NAME_INVALID'),
    runtimeIdentifier,
    state: requiredString(row.state, 'IOS_UI_DEVICE_STATE_INVALID'),
    udid,
  };
};

const parseAvailableIphones = (value: unknown): readonly SimulatorRow[] => {
  const root = asRecord(value, 'IOS_UI_DEVICE_LIST_INVALID');
  const devices = asRecord(root.devices, 'IOS_UI_DEVICE_LIST_INVALID');
  return Object.entries(devices).flatMap(([runtimeIdentifier, rows]) => {
    if (!runtimeIdentifier.startsWith(iosRuntimePrefix)) return [];
    if (!Array.isArray(rows)) throw new Error(`IOS_UI_DEVICE_RUNTIME_INVALID:${runtimeIdentifier}`);
    return rows.flatMap(row => {
      const parsed = parseSimulator(runtimeIdentifier, row);
      return parsed ? [parsed] : [];
    });
  });
};

const comparePreference = (left: SimulatorRow, right: SimulatorRow): number => {
  const booted = Number(right.state === 'Booted') - Number(left.state === 'Booted');
  if (booted !== 0) return booted;
  const recent = right.lastBootedAt.localeCompare(left.lastBootedAt);
  if (recent !== 0) return recent;
  const runtime = right.runtimeIdentifier.localeCompare(left.runtimeIdentifier);
  if (runtime !== 0) return runtime;
  return left.name.localeCompare(right.name) || left.udid.localeCompare(right.udid);
};

export const selectIosUiSimulator = (
  inventory: unknown,
  requestedDevice: string | undefined,
): IosUiSimulatorSelection => {
  const devices = [...parseAvailableIphones(inventory)].sort(comparePreference);
  const requested = requestedDevice?.trim();
  if (!requested) {
    const selected = devices[0];
    if (!selected) throw new Error('IOS_UI_DEVICE_UNAVAILABLE');
    return { ...selected, source: 'discovered' };
  }
  if (!uuidPattern.test(requested)) throw new Error(`IOS_UI_DEVICE_ID_INVALID:${requested}`);
  const selected = devices.find(device => device.udid.toLowerCase() === requested.toLowerCase());
  if (!selected) throw new Error(`IOS_UI_DEVICE_UNAVAILABLE:${requested}`);
  return { ...selected, source: 'explicit' };
};

export const discoverIosUiSimulator = (
  env: Readonly<Record<string, string | undefined>> = process.env,
): IosUiSimulatorSelection => {
  const listed = Bun.spawnSync(['xcrun', 'simctl', 'list', 'devices', 'available', '--json']);
  if (listed.exitCode !== 0) throw new Error(`IOS_UI_DEVICE_QUERY_FAILED:${listed.stderr.toString()}`);
  let inventory: unknown;
  try {
    inventory = JSON.parse(listed.stdout.toString());
  } catch {
    throw new Error('IOS_UI_DEVICE_LIST_INVALID');
  }
  return selectIosUiSimulator(inventory, env.XLN_IOS_UI_DEVICE);
};
