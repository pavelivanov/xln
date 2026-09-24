import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import {
  resolveWalletShellPhase,
  type WalletShellSnapshot,
} from '../../../../frontend/packages/browser/src/preferences/wallet-shell-state';

const readySnapshot = (
  overrides: Partial<WalletShellSnapshot> = {},
): WalletShellSnapshot => ({
  activeTabLockReady: true,
  hasActiveTabLock: true,
  hasError: false,
  hasPendingRemoteRuntime: false,
  lockTestMode: false,
  scenarioPreviewMode: false,
  runtimeLoading: false,
  runtimeReady: true,
  ...overrides,
});

describe('browser wallet shell state', () => {
  test('publishes remote Runtime consent before booting an inactive tab', () => {
    expect(resolveWalletShellPhase(readySnapshot({
      hasActiveTabLock: false,
      hasPendingRemoteRuntime: true,
    }))).toBe('remote-runtime-consent');
  });

  test('publishes standby when another tab owns the Runtime', () => {
    expect(resolveWalletShellPhase(readySnapshot({
      hasActiveTabLock: false,
    }))).toBe('inactive-tab');
  });

  test('does not hide a boot error behind inactive-tab standby', () => {
    expect(resolveWalletShellPhase(readySnapshot({
      hasActiveTabLock: false,
      hasError: true,
    }))).toBe('error');
  });

  test('keeps scenario preview ahead of Runtime loading and errors', () => {
    expect(resolveWalletShellPhase(readySnapshot({
      hasError: true,
      lockTestMode: true,
      runtimeLoading: true,
      scenarioPreviewMode: true,
    }))).toBe('scenario-preview');
  });

  test('keeps lock-test readiness ahead of Runtime loading and errors', () => {
    expect(resolveWalletShellPhase(readySnapshot({
      hasError: true,
      lockTestMode: true,
      runtimeLoading: true,
    }))).toBe('lock-test-ready');
  });

  test('publishes ordinary initialization errors', () => {
    expect(resolveWalletShellPhase(readySnapshot({ hasError: true }))).toBe('error');
  });

  test('waits for active-tab lock initialization', () => {
    expect(resolveWalletShellPhase(readySnapshot({
      activeTabLockReady: false,
    }))).toBe('loading');
  });

  test('keeps loading while Runtime work is pending', () => {
    expect(resolveWalletShellPhase(readySnapshot({
      runtimeLoading: true,
    }))).toBe('loading');
  });

  test('keeps loading until Runtime functions are ready', () => {
    expect(resolveWalletShellPhase(readySnapshot({
      runtimeReady: false,
    }))).toBe('loading');
  });

  test('publishes ready only after lock and Runtime readiness', () => {
    expect(resolveWalletShellPhase(readySnapshot())).toBe('ready');
  });

  test('keeps the canonical React shell on the shared Runtime summary boundary', () => {
    const boundary = readFileSync(
      'frontend/packages/browser/src/preferences/wallet-shell-state.ts',
      'utf8',
    );
    const shell = readFileSync('frontend/apps/wallet/src/app-shell.tsx', 'utf8');

    expect(boundary).not.toContain('svelte');
    expect(boundary).not.toContain('../../../../core');
    expect(shell).toContain('resolveWalletRuntimeSummary(runtimeConfig');
    expect(shell).toContain("runtime.state === 'local-standby'");
    expect(shell).toContain("runtime.state === 'local-error'");
    expect(shell).toContain("view === 'scenario-preview'");
    expect(shell).toContain('<WalletRuntimeBoundary runtime={runtime} />');
  });
});
