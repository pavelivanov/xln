import {
  BRAINVAULT_V1,
  BRAINVAULT_V1_SPEC_ID,
  getShardCount,
  hexToBytes,
} from '../../brainvault/core.ts';
import type {
  WalletBrainVaultDerivationInput,
  WalletBrainVaultDerivationProgress,
  WalletBrainVaultDerivedMaterial,
} from '../packages/browser/src/wallet-brainvault-opening';
import {
  decodeWalletBrainVaultWorkerMessage,
  normalizeWalletBrainVaultWorkerError,
  validateWalletBrainVaultShardCompletion,
} from '../packages/browser/src/wallet-brainvault-worker-validation';
import {
  resolveWalletBrainVaultShardDispatch,
  resolveWalletBrainVaultShardRetry,
} from '../packages/browser/src/wallet-brainvault-worker-scheduling';
import {
  BRAINVAULT_WORKER_CAP_STORAGE_KEY,
  isBrainVaultWasmMemoryError,
  resolveWalletBrainVaultMemoryReduction,
  resolveWalletBrainVaultShardWatchdog,
} from '../packages/browser/src/wallet-brainvault-worker-resilience';
import { serializeWalletBrainVaultWorkerCap } from '../packages/browser/src/wallet-runtime-preferences';
import { finalizeWalletBrainVaultMaterial } from './wallet-brainvault-material-finalization';
import {
  computeWalletBrainVaultWorkerTarget,
  createReadyWalletBrainVaultWorker,
} from './wallet-brainvault-worker-runtime';

type ProgressWriter = (progress: WalletBrainVaultDerivationProgress) => void;

type WorkerRun = {
  input: WalletBrainVaultDerivationInput;
  shardCount: number;
  workers: Set<Worker>;
  retiring: Set<Worker>;
  active: Map<Worker, number>;
  watchdogs: Map<Worker, ReturnType<typeof setTimeout>>;
  results: Map<number, Uint8Array>;
  retries: Map<number, number>;
  retryQueue: number[];
  nextShard: number;
  workerTarget: number;
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
  const watchdog = resolveWalletBrainVaultShardWatchdog(3_000, shardIndex);
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
  for (const worker of available.slice(run.workerTarget)) run.retiring.add(worker);
};

const reduceWorkerTarget = (run: WorkerRun): void => {
  const reduction = resolveWalletBrainVaultMemoryReduction({
    activeWorkerCount: run.workers.size,
    effectiveTargetWorkerCount: run.workerTarget,
    maxWorkers: run.workerTarget,
    targetWorkerCount: run.workerTarget,
  });
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
  if (run.settled || run.workers.size >= run.workerTarget) return;
  try {
    const worker = await createReadyWalletBrainVaultWorker();
    if (run.settled || run.workers.size >= run.workerTarget) {
      worker.terminate();
      return;
    }
    attachRunWorker(run, worker);
    writeProgress(run);
  } catch (error) {
    rejectRun(run, error);
  }
};

const handleWorkerFailure = (run: WorkerRun, worker: Worker, error: unknown): void => {
  if (run.settled) return;
  const message = normalizeWalletBrainVaultWorkerError(error);
  if (!requeueActiveShard(run, worker, message)) return;
  terminateWorker(run, worker);
  if (isBrainVaultWasmMemoryError(message)) reduceWorkerTarget(run);
  void addReplacementWorker(run);
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

const runWorkers = async (run: WorkerRun): Promise<void> => {
  const initialized = await Promise.allSettled(
    Array.from({ length: run.workerTarget }, () => createReadyWalletBrainVaultWorker()),
  );
  const ready = initialized.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
  const failure = initialized.find(result => result.status === 'rejected');
  if (failure?.status === 'rejected') {
    for (const worker of ready) worker.terminate();
    throw new Error(normalizeWalletBrainVaultWorkerError(failure.reason));
  }
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

  async derive(input: WalletBrainVaultDerivationInput, onProgress: ProgressWriter): Promise<WalletBrainVaultDerivedMaterial> {
    this.cancel();
    const shardCount = getShardCount(input.factor);
    const run = {
      input, shardCount, workers: new Set(), retiring: new Set(), active: new Map(),
      watchdogs: new Map(), results: new Map(), retries: new Map(), retryQueue: [],
      nextShard: 0, workerTarget: computeWalletBrainVaultWorkerTarget(shardCount), notice: '', settled: false,
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
}
