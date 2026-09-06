import type { RuntimeReplica } from '@xln/core/api/public/runtime-module';

type RuntimeConfig = NonNullable<RuntimeReplica['runtimeConfig']>;
export type RuntimeStoragePolicy = NonNullable<RuntimeConfig['storage']>;
export type RuntimePerformancePolicy = NonNullable<RuntimeConfig['performance']>;
export type StoragePolicyFields = Readonly<{ commonGiB: string; walEpochGiB: string; historyViewGiB: string; historyRetainFrames: string }>;
export type PerformancePolicyFields = Readonly<{ cloneMiB: string; cloneMs: string; reducerMs: string; walMs: string }>;
const GIB = 1024 ** 3, MIB = 1024 ** 2;

export const displayStorageGiB = (bytes: number | undefined): string =>
  bytes === undefined || bytes === Number.MAX_SAFE_INTEGER ? '' : String(bytes / GIB);

export const readStoragePolicyFields = (storage: RuntimeStoragePolicy | undefined): StoragePolicyFields => ({
  commonGiB: '', walEpochGiB: displayStorageGiB(storage?.epochMaxBytes), historyViewGiB: displayStorageGiB(storage?.historyViewMaxBytes),
  historyRetainFrames: storage?.historyViewRetainFrames === undefined || storage.historyViewRetainFrames === Number.MAX_SAFE_INTEGER
    ? '' : String(storage.historyViewRetainFrames),
});

const parsePositive = (raw: string, label: string, multiplier = 1): number | undefined => {
  if (!raw.trim()) return undefined;
  const parsed = Number(raw.trim()) * multiplier;
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > Number.MAX_SAFE_INTEGER) throw new Error(`${label} must be a positive finite number`);
  return parsed;
};

const parseGiB = (raw: string, label: string): number | undefined => {
  const bytes = parsePositive(raw, label, GIB);
  if (bytes !== undefined && !Number.isSafeInteger(bytes)) throw new Error(`${label} must be a positive GiB value with an exact byte count`);
  return bytes;
};

export const buildStoragePolicy = (current: RuntimeStoragePolicy | undefined, fields: StoragePolicyFields): RuntimeStoragePolicy => {
  const common = parseGiB(fields.commonGiB, 'Common limit');
  const epochMaxBytes = parseGiB(fields.walEpochGiB, 'WAL epoch limit') ?? common;
  const historyViewMaxBytes = parseGiB(fields.historyViewGiB, 'History view limit') ?? common;
  const historyViewRetainFrames = parsePositive(fields.historyRetainFrames, 'Retained frames');
  if (historyViewRetainFrames !== undefined && !Number.isSafeInteger(historyViewRetainFrames)) throw new Error('Retained frames must be a positive integer');
  const next = { ...current };
  delete next.epochMaxBytes; delete next.historyViewMaxBytes; delete next.historyViewRetainFrames;
  return { ...next, ...(epochMaxBytes === undefined ? {} : { epochMaxBytes }),
    ...(historyViewMaxBytes === undefined ? {} : { historyViewMaxBytes }),
    ...(historyViewRetainFrames === undefined ? {} : { historyViewRetainFrames }) };
};

export const readPerformancePolicyFields = (policy: RuntimePerformancePolicy | undefined): PerformancePolicyFields => ({
  cloneMiB: policy?.maxCloneBytes === undefined ? '' : String(policy.maxCloneBytes / MIB),
  cloneMs: policy?.maxCloneMs === undefined ? '' : String(policy.maxCloneMs),
  reducerMs: policy?.maxReducerMs === undefined ? '' : String(policy.maxReducerMs),
  walMs: policy?.maxWalMs === undefined ? '' : String(policy.maxWalMs),
});

export const buildPerformancePolicy = (fields: PerformancePolicyFields): RuntimePerformancePolicy => {
  const next = { maxCloneBytes: parsePositive(fields.cloneMiB, 'Clone budget', MIB),
    maxCloneMs: parsePositive(fields.cloneMs, 'Clone latency budget'),
    maxReducerMs: parsePositive(fields.reducerMs, 'Reducer latency budget'),
    maxWalMs: parsePositive(fields.walMs, 'WAL latency budget') };
  return Object.fromEntries(Object.entries(next).filter((entry): entry is [string, number] => entry[1] !== undefined));
};
