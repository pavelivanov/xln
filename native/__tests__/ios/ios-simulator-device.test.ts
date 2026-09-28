import { describe, expect, test } from 'bun:test';
import { selectIosUiSimulator } from '../../../scripts/native/session/ios-simulator-device';

const bootedId = 'DA68BFB0-39DC-4456-A7BE-BA680754A759';
const shutdownId = '3D01A8E4-4B41-4B2E-9138-B81E21EAA611';
const ipadId = '55C1D9A2-8367-4844-BD10-38EFE9C61AB5';

const inventory = {
  devices: {
    'com.apple.CoreSimulator.SimRuntime.iOS-26-3': [
      {
        deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-17',
        isAvailable: true,
        lastBootedAt: '2026-07-15T18:34:19Z',
        name: 'iPhone 17',
        state: 'Shutdown',
        udid: shutdownId,
      },
      {
        deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPad-A16',
        isAvailable: true,
        name: 'iPad (A16)',
        state: 'Booted',
        udid: ipadId,
      },
      {
        deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro',
        isAvailable: true,
        lastBootedAt: '2026-09-26T13:56:41Z',
        name: 'iPhone 17 Pro',
        state: 'Booted',
        udid: bootedId,
      },
    ],
  },
};

describe('iOS UI simulator selection', () => {
  test('discovers the available booted iPhone instead of relying on a stored UUID', () => {
    expect(selectIosUiSimulator(inventory, undefined)).toEqual({
      deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro',
      lastBootedAt: '2026-09-26T13:56:41Z',
      name: 'iPhone 17 Pro',
      runtimeIdentifier: 'com.apple.CoreSimulator.SimRuntime.iOS-26-3',
      source: 'discovered',
      state: 'Booted',
      udid: bootedId,
    });
  });

  test('honors an exact available override even when another iPhone is booted', () => {
    expect(selectIosUiSimulator(inventory, shutdownId)).toMatchObject({
      source: 'explicit',
      state: 'Shutdown',
      udid: shutdownId,
    });
  });

  test('falls back deterministically to the most recently used available iPhone', () => {
    const devices = structuredClone(inventory);
    devices.devices['com.apple.CoreSimulator.SimRuntime.iOS-26-3'][2]!.state = 'Shutdown';
    expect(selectIosUiSimulator(devices, undefined).udid).toBe(bootedId);
  });

  test('rejects stale overrides and inventories without an available iPhone', () => {
    expect(() => selectIosUiSimulator(inventory, '59209751-39EB-4274-AF6C-A88DE1099CAD')).toThrow(
      'IOS_UI_DEVICE_UNAVAILABLE:59209751-39EB-4274-AF6C-A88DE1099CAD',
    );
    expect(() => selectIosUiSimulator({ devices: {} }, undefined)).toThrow('IOS_UI_DEVICE_UNAVAILABLE');
  });
});
