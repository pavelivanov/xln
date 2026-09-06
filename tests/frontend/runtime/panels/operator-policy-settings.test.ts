import { expect, test } from 'bun:test';
import { buildStoragePolicy, readStoragePolicyFields, buildPerformancePolicy, readPerformancePolicyFields } from '../../../../frontend/packages/runtime-client/src/operator-policy-settings';

test('storage form preserves exact byte limits and unrelated operator policy', () => {
  const policy = { epochMaxBytes: 1, snapshotPeriodFrames: 48, retainSnapshots: 3, enabled: true };
  expect(buildStoragePolicy(policy, readStoragePolicyFields(policy))).toEqual(policy);
  expect(buildStoragePolicy(policy, { walEpochGiB: '2' })).toEqual({
    epochMaxBytes: 2 * 1024 ** 3, snapshotPeriodFrames: 48, retainSnapshots: 3, enabled: true,
  });
  expect(buildStoragePolicy(policy, readStoragePolicyFields(undefined))).toEqual({ snapshotPeriodFrames: 48, retainSnapshots: 3, enabled: true });
  expect(policy.epochMaxBytes).toBe(1);
  expect(readStoragePolicyFields({ epochMaxBytes: Number.MAX_SAFE_INTEGER })).toEqual({ walEpochGiB: '' });
  expect(buildStoragePolicy(undefined, { walEpochGiB: '0.5' })).toEqual({ epochMaxBytes: 536_870_912 });
});

test('storage and performance policy reject invalid limits before application', () => {
  const empty = readStoragePolicyFields(undefined);
  for (const value of ['0', '-1', 'NaN', 'Infinity', '0.0000000001']) {
    expect(() => buildStoragePolicy(undefined, { ...empty, walEpochGiB: value })).toThrow();
  }
  for (const value of ['0', '-1', 'NaN', 'Infinity', '9007199254740992']) {
    expect(() => buildPerformancePolicy({ ...readPerformancePolicyFields(undefined), cloneMs: value })).toThrow();
  }
});

test('performance form preserves fractional metrics and clears only blank budgets', () => {
  const policy = { maxCloneBytes: 1, maxCloneMs: 0.0001, maxReducerMs: 2.125, maxWalMs: 99 };
  expect(buildPerformancePolicy(readPerformancePolicyFields(policy))).toEqual(policy);
  expect(buildPerformancePolicy({ ...readPerformancePolicyFields(policy), cloneMiB: '', walMs: '' })).toEqual({ maxCloneMs: 0.0001, maxReducerMs: 2.125 });
  expect(buildPerformancePolicy(readPerformancePolicyFields(undefined))).toEqual({});
});
