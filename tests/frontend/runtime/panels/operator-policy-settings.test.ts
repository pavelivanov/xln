import { expect, test } from 'bun:test';
import { buildStoragePolicy, readStoragePolicyFields, buildPerformancePolicy, readPerformancePolicyFields } from '../../../../frontend/packages/runtime-client/src/operator-policy-settings';

test('storage form preserves exact byte limits and unrelated operator policy', () => {
  const policy = { epochMaxBytes: 1, historyViewMaxBytes: 4_294_967, historyViewRetainFrames: 17, snapshotPeriodFrames: 48, enabled: true };
  expect(buildStoragePolicy(policy, readStoragePolicyFields(policy))).toEqual(policy);
  expect(buildStoragePolicy(policy, { commonGiB: '2', walEpochGiB: '', historyViewGiB: '1', historyRetainFrames: '' })).toEqual({
    epochMaxBytes: 2 * 1024 ** 3, historyViewMaxBytes: 1024 ** 3, snapshotPeriodFrames: 48, enabled: true,
  });
  expect(buildStoragePolicy(policy, readStoragePolicyFields(undefined))).toEqual({ snapshotPeriodFrames: 48, enabled: true });
  expect(policy.epochMaxBytes).toBe(1);
});

test('storage and performance policy reject invalid limits before application', () => {
  const empty = readStoragePolicyFields(undefined);
  for (const value of ['0', '-1', 'NaN', 'Infinity', '0.0000000001']) {
    expect(() => buildStoragePolicy(undefined, { ...empty, walEpochGiB: value })).toThrow();
  }
  expect(() => buildStoragePolicy(undefined, { ...empty, historyRetainFrames: '1.5' })).toThrow('positive integer');
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
