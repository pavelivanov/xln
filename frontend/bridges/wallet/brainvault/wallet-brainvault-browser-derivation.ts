import {
  BRAINVAULT_V1,
  BRAINVAULT_V1_SPEC_ID,
  getShardCount,
  hexToBytes,
} from '../../../../brainvault/src/core/index.ts';
import type {
  WalletBrainVaultDerivationInput,
  WalletBrainVaultDerivationProgress,
  WalletBrainVaultDerivedMaterial,
} from '../../../packages/browser/src/identity/wallet-brainvault-opening';
import {
  decodeWalletBrainVaultWorkerMessage,
  normalizeWalletBrainVaultWorkerError,
  validateWalletBrainVaultShardCompletion,
} from '../../../packages/browser/src/identity/wallet-brainvault-worker-validation';
import {
  resolveWalletBrainVaultShardDispatch,
  resolveWalletBrainVaultShardRetry,
} from '../../../packages/browser/src/identity/wallet-brainvault-worker-scheduling';
import {
  BRAINVAULT_WORKER_CAP_STORAGE_KEY,
  isBrainVaultWasmMemoryError,
  resolveWalletBrainVaultMemoryReduction,
  resolveWalletBrainVaultShardWatchdog,
  resolveWalletBrainVaultWorkerInitRetry,
} from '../../../packages/browser/src/identity/wallet-brainvault-worker-resilience';
import { serializeWalletBrainVaultWorkerCap } from '../../../packages/browser/src/runtime/wallet-runtime-preferences';
import { finalizeWalletBrainVaultMaterial } from './wallet-brainvault-material-finalization';
import {
  computeWalletBrainVaultWorkerTarget,
  createReadyWalletBrainVaultWorker,
} from './wallet-brainvault-worker-runtime';

type ProgressWriter = (progress: WalletBrainVaultDerivationProgress) => void;

export type WalletBrainVaultBrowserDerivationOptions = Readonly<{
  workerTarget?: number;
  estimatedShardTimeMs?: number;
}>;

type WorkerRun = {
  input: WalletBrainVaultDerivationInput;
  shardCount: number;
  workers: Set<Worker>;
  initializingWorkers: number;
  retiring: Set<Worker>;
  active: Map<Worker, number>;
  watchdogs: Map<Worker, ReturnType<typeof setTimeout>>;
  results: Map<number, Uint8Array>;
  retries: Map<number, number>;
  retryQueue: number[];
  nextShard: number;
  workerCap: number;
  workerTarget: number;
  estimatedShardTimeMs: number;
  lastShardTimeMs: number | null;
  notice: string;
  settled: boolean;
  onProgress: ProgressWriter;
  resolve: () => void;
  reject: (error: Error) => void;
};

const writeProgress = (run: WorkerRun): void => run.onProgress({
  phase: 'deriving',
  completed: run.results.size,
  total: run.shardCount,
  workers: run.workers.size - run.retiring.size,
  notice: run.notice,
  ...(run.lastShardTimeMs === null ? {} : { lastShardMs: run.lastShardTimeMs }),
  workerLimit: run.workerCap,
});

const clearWatchdog = (run: WorkerRun, worker: Worker): void => {
  const watchdog = run.watchdogs.get(worker);
  if (watchdog !== undefined) clearTimeout(watchdog);
  run.watchdogs.delete(worker);
};

const terminateWorker = (run: WorkerRun, worker: Worker): void => {
  clearWatchdog(run, worker);
  worker.onmessage = null;
  worker.onerror = null;
  worker.terminate();
  run.workers.delete(worker);
  run.retiring.delete(worker);
  run.active.delete(worker);
};

const terminateRun = (run: WorkerRun): void => {
  for (const worker of [...run.workers]) terminateWorker(run, worker);
};

const wipeResults = (run: WorkerRun): void => {
  for (const shard of run.results.values()) shard.fill(0);
  run.results.clear();
};

const rejectRun = (run: WorkerRun, error: unknown): void => {
  if (run.settled) return;
  run.settled = true;
  terminateRun(run);
  run.reject(new Error(normalizeWalletBrainVaultWorkerError(error)));
};

const resolveRun = (run: WorkerRun): void => {
  if (run.settled) return;
  run.settled = true;
  terminateRun(run);
  run.resolve();
};

const armWatchdog = (run: WorkerRun, worker: Worker, shardIndex: number): void => {
  const watchdog = resolveWalletBrainVaultShardWatchdog(run.estimatedShardTimeMs, shardIndex);
  run.watchdogs.set(worker, setTimeout(() => {
    if (run.active.get(worker) !== shardIndex) return;
    rejectRun(run, watchdog.message);
  }, watchdog.timeoutMs));
};

const dispatch = (run: WorkerRun, worker: Worker): void => {
  if (run.settled || run.retiring.has(worker)) return;
  const next = resolveWalletBrainVaultShardDispatch({
    retryQueue: run.retryQueue,
    nextShardToDispatch: run.nextShard,
    shardCount: run.shardCount,
  }, run.results);
  run.retryQueue = [...next.retryQueue];
  run.nextShard = next.nextShardToDispatch;
  if (next.status === 'idle') return;
  run.active.set(worker, next.shardIndex);
  armWatchdog(run, worker, next.shardIndex);
  worker.postMessage({
    type: 'derive_shard',
    id: next.shardIndex,
    data: {
      name: run.input.name,
      passphrase: run.input.passphrase,
      shardIndex: next.shardIndex,
      shardCount: run.shardCount,
    },
  });
};

const requeueActiveShard = (run: WorkerRun, worker: Worker, message: string): boolean => {
  const shardIndex = run.active.get(worker);
  if (shardIndex === undefined) return true;
  const retry = resolveWalletBrainVaultShardRetry(shardIndex, message, {
    alreadyCompleted: run.results.has(shardIndex),
    currentAttempts: run.retries.get(shardIndex) ?? 0,
    retryQueue: run.retryQueue,
  });
  run.retries.set(shardIndex, retry.attempts);
  run.retryQueue = [...retry.retryQueue];
  if (retry.status === 'failed') rejectRun(run, retry.message);
  return retry.status !== 'failed';
};

const markExcessWorkersRetiring = (run: WorkerRun): void => {
  const available = [...run.workers].filter(worker => !run.retiring.has(worker));
  for (const worker of available.slice(run.workerTarget)) {
    if (run.active.has(worker)) run.retiring.add(worker);
    else terminateWorker(run, worker);
  }
};

const reduceWorkerTarget = (run: WorkerRun): void => {
  const reduction = resolveWalletBrainVaultMemoryReduction({
    activeWorkerCount: run.workers.size,
    effectiveTargetWorkerCount: run.workerTarget,
    maxWorkers: run.workerCap,
    targetWorkerCount: run.workerTarget,
  });
  run.workerCap = reduction.maxWorkers;
  run.workerTarget = reduction.targetWorkerCount;
  run.notice = reduction.notice;
  localStorage.setItem(BRAINVAULT_WORKER_CAP_STORAGE_KEY, serializeWalletBrainVaultWorkerCap(run.workerTarget));
  markExcessWorkersRetiring(run);
};

const attachRunWorker = (run: WorkerRun, worker: Worker): void => {
  run.workers.add(worker);
  worker.onmessage = event => handleWorkerMessage(run, worker, event.data);
  worker.onerror = error => {
    try {
      handleWorkerFailure(run, worker, error);
    } catch (failure) {
      rejectRun(run, failure);
    }
  };
  dispatch(run, worker);
};

const addReplacementWorker = async (run: WorkerRun): Promise<void> => {
  if (run.settled || run.workers.size - run.retiring.size + run.initializingWorkers >= run.workerTarget) return;
  run.initializingWorkers += 1;
  try {
    const worker = await createReadyWalletBrainVaultWorker();
    if (run.settled || run.workers.size - run.retiring.size >= run.workerTarget) {
      worker.terminate();
      return;
    }
    attachRunWorker(run, worker);
    writeProgress(run);
  } catch (error) {
    rejectRun(run, error);
  } finally {
    run.initializingWorkers -= 1;
  }
};

const fillWorkerTarget = (run: WorkerRun): void => {
  const activeCount = run.workers.size - run.retiring.size;
  for (let index = activeCount; index < run.workerTarget; index += 1) {
    void addReplacementWorker(run);
  }
};

const handleWorkerFailure = (run: WorkerRun, worker: Worker, error: unknown): void => {
  if (run.settled) return;
  const message = normalizeWalletBrainVaultWorkerError(error);
  if (!requeueActiveShard(run, worker, message)) return;
  terminateWorker(run, worker);
  if (isBrainVaultWasmMemoryError(message)) reduceWorkerTarget(run);
  fillWorkerTarget(run);
  writeProgress(run);
};

const handleShardComplete = (run: WorkerRun, worker: Worker, message: Parameters<typeof validateWalletBrainVaultShardCompletion>[0]): void => {
  const completion = validateWalletBrainVaultShardCompletion(message, {
    activeShard: run.active.get(worker),
    shardCount: run.shardCount,
    expectedResultHexLength: BRAINVAULT_V1.SHARD_OUTPUT_BYTES * 2,
    alreadyCompleted: Number.isSafeInteger(message.shardIndex) && run.results.has(Number(message.shardIndex)),
  });
  clearWatchdog(run, worker);
  run.active.delete(worker);
  run.results.set(completion.shardIndex, hexToBytes(completion.resultHex));
  if (completion.measuredShardTimeMs !== null) {
    run.estimatedShardTimeMs = run.lastShardTimeMs === null
      ? completion.measuredShardTimeMs
      : run.estimatedShardTimeMs * 0.7 + completion.measuredShardTimeMs * 0.3;
    run.lastShardTimeMs = completion.measuredShardTimeMs;
  }
  writeProgress(run);
  if (run.results.size === run.shardCount) return resolveRun(run);
  if (run.retiring.has(worker)) terminateWorker(run, worker);
  else dispatch(run, worker);
};

function handleWorkerMessage(run: WorkerRun, worker: Worker, value: unknown): void {
  try {
    const message = decodeWalletBrainVaultWorkerMessage(value, BRAINVAULT_V1_SPEC_ID);
    if (message.kind === 'shard-complete') handleShardComplete(run, worker, message);
    else if (message.kind === 'failed') handleWorkerFailure(run, worker, message.error);
    else if (message.kind === 'invalid') handleWorkerFailure(run, worker, message.message);
    else handleWorkerFailure(run, worker, 'BRAINVAULT_WORKER_DERIVATION_MESSAGE_INVALID');
  } catch (error) {
    rejectRun(run, error);
  }
}

const initializeWorkers = async (run: WorkerRun): Promise<Worker[]> => {
  let attempts = 0;
  while (true) {
    const initialized = await Promise.allSettled(
      Array.from({ length: run.workerTarget }, () => createReadyWalletBrainVaultWorker()),
    );
    const ready = initialized.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
    const failure = initialized.find(result => result.status === 'rejected');
    if (!failure || failure.status !== 'rejected') return ready;
    for (const worker of ready) worker.terminate();
    const message = normalizeWalletBrainVaultWorkerError(failure.reason);
    const retry = resolveWalletBrainVaultWorkerInitRetry({
      attempts,
      initialWorkers: run.workerTarget,
      maxWorkers: run.workerCap,
      targetWorkerCount: run.workerTarget,
      message,
    });
    if (retry.status !== 'retry') throw new Error(message);
    attempts = retry.attempts;
    run.workerCap = retry.maxWorkers;
    run.workerTarget = retry.targetWorkerCount;
    run.notice = retry.notice;
    localStorage.setItem(BRAINVAULT_WORKER_CAP_STORAGE_KEY, serializeWalletBrainVaultWorkerCap(run.workerCap));
    writeProgress(run);
  }
};

const runWorkers = async (run: WorkerRun): Promise<void> => {
  const ready = await initializeWorkers(run);
  if (run.settled) {
    for (const worker of ready) worker.terminate();
    throw new Error('WALLET_BRAINVAULT_DERIVATION_CANCELLED');
  }
  const completion = new Promise<void>((resolve, reject) => {
    run.resolve = resolve;
    run.reject = reject;
  });
  for (const worker of ready) attachRunWorker(run, worker);
  writeProgress(run);
  await completion;
};

export class WalletBrainVaultBrowserDerivation {
  private active: WorkerRun | null = null;

  async derive(
    input: WalletBrainVaultDerivationInput,
    onProgress: ProgressWriter,
    options: WalletBrainVaultBrowserDerivationOptions = {},
  ): Promise<WalletBrainVaultDerivedMaterial> {
    this.cancel();
    const shardCount = input.shardCount ?? getShardCount(input.factor);
    if (!Number.isSafeInteger(shardCount) || shardCount < 1) {
      throw new Error('WALLET_BRAINVAULT_SHARD_COUNT_INVALID');
    }
    const workerCap = computeWalletBrainVaultWorkerTarget(shardCount);
    const requestedWorkers = Math.floor(options.workerTarget ?? workerCap);
    const run = {
      input, shardCount, workers: new Set(), initializingWorkers: 0, retiring: new Set(), active: new Map(),
      watchdogs: new Map(), results: new Map(), retries: new Map(), retryQueue: [],
      nextShard: 0, workerCap, workerTarget: Math.max(1, Math.min(workerCap, requestedWorkers)),
      estimatedShardTimeMs: Math.max(100, options.estimatedShardTimeMs ?? 3_000),
      lastShardTimeMs: null, notice: '', settled: false,
      onProgress, resolve: () => {}, reject: () => {},
    } satisfies WorkerRun;
    this.active = run;
    try {
      writeProgress(run);
      await runWorkers(run);
      if (this.active !== run) throw new Error('WALLET_BRAINVAULT_DERIVATION_CANCELLED');
      return await finalizeWalletBrainVaultMaterial(
        run.input,
        run.shardCount,
        run.results,
        () => this.active === run,
      );
    } finally {
      terminateRun(run);
      wipeResults(run);
      if (this.active === run) this.active = null;
    }
  }

  cancel(): void {
    const run = this.active;
    if (!run) return;
    this.active = null;
    rejectRun(run, 'WALLET_BRAINVAULT_DERIVATION_CANCELLED');
  }

  setWorkerTarget(target: number): void {
    const run = this.active;
    if (!run || run.settled || !Number.isFinite(target)) return;
    run.workerTarget = Math.max(1, Math.min(run.workerCap, run.shardCount, Math.floor(target)));
    markExcessWorkersRetiring(run);
    fillWorkerTarget(run);
    writeProgress(run);
  }
}
