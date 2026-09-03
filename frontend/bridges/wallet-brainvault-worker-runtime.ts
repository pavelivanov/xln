import {
  BRAINVAULT_V1,
  BRAINVAULT_V1_SPEC_ID,
} from '../../brainvault/core.ts';
import {
  decodeWalletBrainVaultWorkerMessage,
  normalizeWalletBrainVaultWorkerError,
} from '../packages/browser/src/wallet-brainvault-worker-validation';
import {
  BRAINVAULT_WORKER_CAP_STORAGE_KEY,
  computeBrainVaultWorkerCap,
} from '../packages/browser/src/wallet-brainvault-worker-resilience';
import { parseWalletBrainVaultWorkerCap } from '../packages/browser/src/wallet-runtime-preferences';

const WORKER_URL = `/brainvault-worker.js?spec=${encodeURIComponent(BRAINVAULT_V1_SPEC_ID)}`;

const asDeviceMemory = (): number => {
  const candidate = navigator as Navigator & { deviceMemory?: number };
  return candidate.deviceMemory ?? 8;
};

const isIOSWebKit = (): boolean => /AppleWebKit/i.test(navigator.userAgent)
  && (/iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

export const computeWalletBrainVaultWorkerTarget = (shardCount: number): number =>
  Math.min(shardCount, computeBrainVaultWorkerCap({
    hardwareConcurrency: navigator.hardwareConcurrency || 4,
    deviceMemoryGB: asDeviceMemory(),
    shardMemoryMB: BRAINVAULT_V1.SHARD_MEMORY_KB / 1024,
    isWebKit: isIOSWebKit(),
    storedCap: parseWalletBrainVaultWorkerCap(
      localStorage.getItem(BRAINVAULT_WORKER_CAP_STORAGE_KEY),
    ),
  }));

export const createReadyWalletBrainVaultWorker = (): Promise<Worker> =>
  new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_URL);
    let timeout: ReturnType<typeof setTimeout>;
    const fail = (error: unknown): void => {
      clearTimeout(timeout);
      worker.terminate();
      reject(new Error(normalizeWalletBrainVaultWorkerError(error)));
    };
    timeout = setTimeout(() => fail('Worker init timeout'), 30_000);
    worker.onmessage = (event) => {
      try {
        const message = decodeWalletBrainVaultWorkerMessage(event.data, BRAINVAULT_V1_SPEC_ID);
        if (message.kind === 'ready') {
          clearTimeout(timeout);
          worker.onmessage = null;
          worker.onerror = null;
          resolve(worker);
        } else if (message.kind === 'invalid') fail(message.message);
        else if (message.kind === 'failed') fail(message.error);
        else fail('BRAINVAULT_WORKER_READY_MESSAGE_INVALID');
      } catch (error) {
        fail(error);
      }
    };
    worker.onerror = fail;
    worker.postMessage({ type: 'init', id: 0 });
  });
