import { expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { RuntimeInput } from '@xln/core/api/public/runtime-module';
import {
  clearRuntimeCommandReceipts,
  replayRuntimeCommandIntentsInOrder,
  runtimeCommandLatestReceipt,
  runtimeCommandReceipts,
  runtimeCommandRetryOptions,
  submitRuntimeCommand,
  type CommandReceipt,
} from '../../../../frontend/bridges/runtime/runtime-command-bus';
import { RuntimeAdapterError } from '../../../../core/api/runtime-adapter/errors';
import { listUnresolvedRemoteRuntimeCommandIntents } from '../../../../frontend/packages/browser/src/commands/runtime-command-intent';
import {
  findCommittedRuntimeInputHeight,
  findPersistedRuntimeInputHeight,
  runtimeFrameContainsSubmittedInput,
} from '../../../../core/runtime/mempool/input-completion';

const SIGNED_SERVER_FINGERPRINT = '0x01fe56d4322ab531393851ee54e1f751c8358fc2fc3730a432963661e33f50d3';

const frontendSourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) return frontendSourceFiles(path);
    return /\.(ts|tsx)$/.test(path) ? [path] : [];
  });

const readStore = <T>(store: { subscribe: (run: (value: T) => void) => () => void }): T => {
  let value: T | undefined;
  const unsubscribe = store.subscribe((next) => {
    value = next;
  });
  unsubscribe();
  return value as T;
};

test('runtime command bus records pending accepted observed committed error receipts deterministically', () => {
  const source = readFileSync('frontend/bridges/runtime/runtime-command-bus.ts', 'utf8');

  expect(source).toContain("export type RuntimeCommandStatus = 'pending' | 'accepted' | 'observed' | 'committed' | 'error'");
  expect(source).toContain('receiptId: `runtime-command-${++receiptSequence}`');
	  expect(source).toContain('acceptedAtHeight');
  expect(source).toContain('committedAtHeight');
  expect(source).not.toContain('upstreamReceiptId');
  expect(source).not.toContain('statusUrl');
  expect(source).not.toContain('commitAcceptedRuntimeCommands');
  expect(source).not.toContain('recordRuntimeIngressReceipt');
  expect(source).toContain('classifyRuntimeFailure');
  expect(source).toContain('failureKind: RuntimeFailureKind | null');
  expect(source).toContain("status: receipt.mode === 'remote' ? 'observed' : 'committed'");
  expect(source).toContain("registerDebugSurface('commands'");
  expect(source).not.toContain('__xlnRuntimeCommands');
  expect(source).not.toContain('Date.now');
  expect(source).not.toContain('Math.random');
});

test('browser E2E mutations use the live runtime command bus instead of a detached view RuntimeReplica', () => {
  const storeSource = readFileSync('frontend/bridges/runtime/xln-store.ts', 'utf8');
  const embeddedSource = readFileSync('frontend/bridges/runtime/embedded-runtime-store.ts', 'utf8');
  const helperSource = readFileSync('tests/utils/runtime/e2e-runtime-input.ts', 'utf8');
  const enqueueStart = helperSource.indexOf('export async function enqueueRuntimeInput');
  const enqueueEnd = helperSource.indexOf('export async function enqueueEntityTxs', enqueueStart);
  const enqueueSource = helperSource.slice(enqueueStart, enqueueEnd);

  expect(storeSource).toContain("registerDebugSurface('runtimeIngress'");
  expect(storeSource).toContain('submit: submitActiveRuntimeInput');
  expect(storeSource).toContain('waitForDrained: waitForActiveRuntimeDrained');
  expect(storeSource).toContain('waitForProcessingIdle: waitForActiveRuntimeProcessingIdle');
  expect(storeSource).toContain('xln.waitForRuntimeWorkDrained(runtimeEnv, timeoutMs)');
  expect(storeSource).toContain('ACTIVE_RUNTIME_HALTED:${xln.safeStringify(fatalPayload())}');
  expect(embeddedSource).toContain("registerDebugSurface('jurisdictionConnectivity'");
  expect(embeddedSource).toContain('hasConnectedJurisdictionAdapter(localRuntimeEnv, name)');
  expect(enqueueSource).toContain('runtimeIngress.submit(input)');
  expect(enqueueSource).not.toContain('isolatedEnv');
  expect(enqueueSource).not.toContain('await import(');
});

test('runtime command bus transitions receipts from pending to accepted committed and error', async () => {
  clearRuntimeCommandReceipts();
  const input: RuntimeInput = {
    runtimeTxs: [],
    entityInputs: [],
    jInputs: [],
  };

  const committed = await submitRuntimeCommand({
    input,
    runtimeId: 'runtime-a',
    mode: 'embedded',
    initialHeight: 4,
  }, async (progress) => {
    expect(readStore(runtimeCommandLatestReceipt)?.status).toBe('pending');
    await progress.accepted(5);
    expect(readStore(runtimeCommandLatestReceipt)?.status).toBe('accepted');
    await progress.committed(6);
    expect(readStore(runtimeCommandLatestReceipt)?.status).toBe('committed');
    return 'ok';
  });

  expect(committed.result).toBe('ok');
  expect(committed.receipt.receiptId).toMatch(/^runtime-command-/);
  expect(committed.receipt.status).toBe('committed');
  expect(committed.receipt.runtimeId).toBe('runtime-a');
  expect(committed.receipt.mode).toBe('embedded');
  expect(committed.receipt.acceptedAtHeight).toBe(5);
  expect(committed.receipt.committedAtHeight).toBe(6);
  expect(committed.receipt).not.toHaveProperty('upstreamReceiptId');
  expect(committed.receipt).not.toHaveProperty('statusUrl');
  expect(readStore(runtimeCommandReceipts)).toHaveLength(1);

  const remoteAccepted = await submitRuntimeCommand({
    input,
    runtimeId: 'runtime-remote',
    mode: 'remote',
    serverFingerprint: SIGNED_SERVER_FINGERPRINT,
    initialHeight: 20,
  }, async (progress) => {
    await progress.accepted(21);
    await progress.committed(22);
    return 'remote-ok';
  });
  expect(remoteAccepted.receipt.status).toBe('accepted');
  expect(remoteAccepted.receipt.committedAtHeight).toBeNull();
  expect(readStore(runtimeCommandLatestReceipt)?.runtimeId).toBe('runtime-remote');
  expect(readStore(runtimeCommandLatestReceipt)?.status).toBe('accepted');

  const remoteObserved = await submitRuntimeCommand({
    input,
    runtimeId: 'runtime-remote-observed',
    mode: 'remote',
    serverFingerprint: SIGNED_SERVER_FINGERPRINT,
    initialHeight: 30,
  }, async (progress) => {
    await progress.accepted(31);
    await progress.observed(32);
    return 'remote-observed';
  });
  expect(remoteObserved.receipt.status).toBe('observed');
  expect(remoteObserved.receipt.acceptedAtHeight).toBe(31);
  expect(remoteObserved.receipt.committedAtHeight).toBe(32);

  const acceptedOnly = await submitRuntimeCommand({
    input,
    runtimeId: 'runtime-b',
    mode: 'embedded',
    initialHeight: 10,
  }, async (progress) => {
    await progress.accepted(10);
    return 'accepted';
  });
  expect(acceptedOnly.receipt.status).toBe('accepted');
  expect(readStore(runtimeCommandLatestReceipt)?.runtimeId).toBe('runtime-b');
  expect(readStore(runtimeCommandLatestReceipt)?.status).toBe('accepted');
  expect(readStore(runtimeCommandLatestReceipt)?.committedAtHeight).toBeNull();

  await expect(submitRuntimeCommand({
    input,
    runtimeId: 'runtime-c',
    mode: 'remote',
    serverFingerprint: SIGNED_SERVER_FINGERPRINT,
    initialHeight: 1,
  }, async (progress) => {
    await progress.accepted(2);
    throw new Error('boom');
  })).rejects.toThrow('boom');
  const latest = readStore(runtimeCommandLatestReceipt);
  expect(latest?.runtimeId).toBe('runtime-c');
  expect(latest?.status).toBe('error');
  expect(latest?.acceptedAtHeight).toBe(2);
  expect(latest?.error).toBe('boom');
  expect(latest?.failureKind).toBe('fatal');
  expect(latest?.failureRetryable).toBe(false);

  await expect(submitRuntimeCommand({
    input,
    runtimeId: 'runtime-d',
    mode: 'remote',
    serverFingerprint: SIGNED_SERVER_FINGERPRINT,
    initialHeight: 1,
  }, async () => {
    throw new Error('fetch failed: ECONNREFUSED');
  })).rejects.toThrow('fetch failed');
  const retryable = readStore(runtimeCommandLatestReceipt);
  expect(retryable?.failureKind).toBe('defer');
  expect(retryable?.failureRetryable).toBe(true);
});

test('runtime command pre-execution admission cancels before receipt publication or executor mutation', async () => {
  clearRuntimeCommandReceipts();
  let executorCalls = 0;

  await expect(submitRuntimeCommand({
    input: { runtimeTxs: [], entityInputs: [], jInputs: [] },
    runtimeId: 'runtime-quiescing',
    mode: 'embedded',
    beforeExecute: () => {
      throw new Error('EXTERNAL_WALLET_SNAPSHOT_INGRESS_CANCELLED:cancel-runtime-quiescing');
    },
  }, async () => {
    executorCalls += 1;
    return null;
  })).rejects.toThrow('EXTERNAL_WALLET_SNAPSHOT_INGRESS_CANCELLED:cancel-runtime-quiescing');

  expect(executorCalls).toBe(0);
  expect(readStore(runtimeCommandReceipts)).toEqual([]);
  expect(readStore(runtimeCommandLatestReceipt)).toBeNull();
});

test('terminal remote intent does not head-of-line block the next replay', async () => {
  const attempted: string[] = [];
  const completed = await replayRuntimeCommandIntentsInOrder(['terminal', 'next'], async (intent) => {
    attempted.push(intent);
    if (intent === 'terminal') {
      throw new RuntimeAdapterError(
        'E_BAD_QUERY',
        'runtime adapter commandId was reused with a different payload',
      );
    }
  });
  expect(attempted).toEqual(['terminal', 'next']);
  expect(completed).toBe(1);
});

test('remote command IDs identify UI intents, not identical payloads', async () => {
  clearRuntimeCommandReceipts();
  const input: RuntimeInput = {
    runtimeTxs: [],
    entityInputs: [],
    jInputs: [],
  };
  const seenCommandIds: string[] = [];

  await expect(submitRuntimeCommand({
    input,
    runtimeId: 'runtime-idempotency',
    mode: 'remote',
    serverFingerprint: SIGNED_SERVER_FINGERPRINT,
    initialHeight: 1,
  }, async (_progress, receipt) => {
    seenCommandIds.push(receipt.commandId);
    throw new Error('runtime adapter request timed out: send');
  })).rejects.toThrow('timed out');

  const retryableReceipt = readStore(runtimeCommandLatestReceipt);
  expect(retryableReceipt?.failureRetryable).toBe(true);

  const identicalNewIntent = await submitRuntimeCommand({
    input: structuredClone(input),
    runtimeId: 'runtime-idempotency',
    mode: 'remote',
    serverFingerprint: SIGNED_SERVER_FINGERPRINT,
    initialHeight: 1,
  }, async (progress, receipt) => {
    seenCommandIds.push(receipt.commandId);
    await progress.accepted(1);
    await progress.observed(2);
    return 'distinct-observed';
  });

  await expect(submitRuntimeCommand({
    input: {
      ...structuredClone(input),
      entityInputs: [{
        entityId: `0x${'11'.repeat(32)}`,
        signerId: 'signer-different-payload',
        entityTxs: [{
          type: 'extendCredit',
          data: { counterpartyEntityId: `0x${'22'.repeat(32)}`, tokenId: 1, amount: 1n },
        }],
      }],
    },
    runtimeId: 'runtime-idempotency',
    mode: 'remote',
    serverFingerprint: SIGNED_SERVER_FINGERPRINT,
    initialHeight: 1,
    commandId: seenCommandIds[0],
  }, async () => 'must-not-run')).rejects.toThrow('RUNTIME_COMMAND_ID_PAYLOAD_MISMATCH');

  if (!retryableReceipt) throw new Error('TEST_RETRYABLE_RECEIPT_MISSING');
  const retry = await submitRuntimeCommand({
    input: structuredClone(input),
    runtimeId: 'runtime-idempotency',
    mode: 'remote',
    serverFingerprint: SIGNED_SERVER_FINGERPRINT,
    initialHeight: 1,
    ...runtimeCommandRetryOptions(retryableReceipt),
  }, async (progress, receipt) => {
    seenCommandIds.push(receipt.commandId);
    await progress.accepted(1);
    await progress.observed(2);
    return 'observed';
  });

  expect(seenCommandIds[0]).toMatch(/^[A-Za-z0-9._:-]{16,128}$/);
  expect(seenCommandIds[1]).not.toBe(seenCommandIds[0]);
  expect(seenCommandIds[2]).toBe(seenCommandIds[0]);
  expect(identicalNewIntent.receipt.commandId).toBe(seenCommandIds[1]);
  expect(retry.receipt.commandId).toBe(seenCommandIds[0]);
  expect(() => runtimeCommandRetryOptions(retry.receipt)).toThrow('RUNTIME_COMMAND_RECEIPT_NOT_RETRYABLE');
});

test('an explicit stale-tab retry cannot recreate a settled command intent', async () => {
  const input: RuntimeInput = { runtimeTxs: [], entityInputs: [], jInputs: [] };
  const first = await submitRuntimeCommand({
    input,
    runtimeId: 'runtime-stale-tab',
    mode: 'remote',
    serverFingerprint: SIGNED_SERVER_FINGERPRINT,
  }, async (progress) => {
    await progress.accepted(1);
    await progress.observed(2);
    return null;
  });

  await expect(submitRuntimeCommand({
    input: structuredClone(input),
    runtimeId: 'runtime-stale-tab',
    mode: 'remote',
    serverFingerprint: SIGNED_SERVER_FINGERPRINT,
    commandId: first.receipt.commandId,
  }, async () => null)).rejects.toThrow(`RUNTIME_COMMAND_INTENT_NOT_FOUND:${first.receipt.commandId}`);
  expect(await listUnresolvedRemoteRuntimeCommandIntents(
    'runtime-stale-tab',
    SIGNED_SERVER_FINGERPRINT,
  )).toEqual([]);
});

test('capability-lane one-shot Entity commands never create a durable journal intent', async () => {
  const runtimeId = 'runtime-capability-only';
  const input: RuntimeInput = {
    runtimeTxs: [],
    entityInputs: [{
      entityId: 'entity-a',
      signerId: 'signer-a',
      entityTxs: [{
        type: 'extendCredit',
        data: { counterpartyEntityId: 'entity-b', tokenId: 1, amount: 1n },
      }],
    }],
    jInputs: [],
  };
  const submitted = await submitRuntimeCommand({
    input,
    runtimeId,
    mode: 'remote',
    serverFingerprint: SIGNED_SERVER_FINGERPRINT,
    nextCommandSequence: 7,
    remoteJournalMode: 'one-shot',
  }, async (progress, receipt) => {
    expect(receipt.commandSequence).toBe(7);
    await progress.accepted(3);
    await progress.observed(4);
    return null;
  });

  expect(submitted.receipt.status).toBe('observed');
  expect(await listUnresolvedRemoteRuntimeCommandIntents(
    runtimeId,
    SIGNED_SERVER_FINGERPRINT,
  )).toEqual([]);
});

test('capability-only one-shot response loss is not offered as a retryable payment-style intent', async () => {
  await expect(submitRuntimeCommand({
    input: { runtimeTxs: [], entityInputs: [], jInputs: [] },
    runtimeId: 'runtime-capability-loss',
    mode: 'remote',
    serverFingerprint: SIGNED_SERVER_FINGERPRINT,
    nextCommandSequence: 1,
    remoteJournalMode: 'one-shot',
  }, async () => {
    throw new Error('runtime adapter request timed out: response lost');
  })).rejects.toThrow('response lost');

  const receipt = readStore(runtimeCommandLatestReceipt);
  expect(receipt?.failureRetryable).toBe(false);
  expect(() => runtimeCommandRetryOptions(receipt!)).toThrow('RUNTIME_COMMAND_RECEIPT_NOT_RETRYABLE');
});

test('remote command journal persists protected replayable intents outside localStorage', () => {
  const intentSource = readFileSync('frontend/packages/browser/src/commands/runtime-command-intent.ts', 'utf8');
  const codecSource = readFileSync('frontend/packages/browser/src/commands/runtime-command-intent-codec.ts', 'utf8');
  const indexedDbSource = readFileSync('frontend/packages/browser/src/commands/runtime-command-journal-indexed-db.ts', 'utf8');
  const keyringSource = readFileSync('frontend/packages/browser/src/commands/runtime-command-journal-keyring.ts', 'utf8');
  const storageSource = readFileSync('frontend/packages/browser/src/commands/runtime-command-journal-storage.ts', 'utf8');
  const routeSource = readFileSync('frontend/bridges/runtime/xln-store.ts', 'utf8');
  const journalSource = `${intentSource}\n${codecSource}\n${indexedDbSource}\n${keyringSource}\n${storageSource}`;

  expect(journalSource).not.toContain('localStorage');
  expect(indexedDbSource).toContain('indexedDB');
  expect(indexedDbSource).toContain('const DB_VERSION = 2');
  expect(indexedDbSource).toContain("const REMOVED_META_STORE = 'meta'");
  expect(indexedDbSource).toContain('db.deleteObjectStore(REMOVED_META_STORE)');
  expect(storageSource).toContain('AES-GCM');
  expect(storageSource).toContain('safeParse');
  expect(storageSource).toContain("from './runtime-command-journal-indexed-db'");
  expect(routeSource).toContain('resumeRemoteRuntimeCommandIntents');
});

test('remote command journal retains exact payload and status until observed', async () => {
  const runtimeId = 'runtime-journal-roundtrip';
  const input: RuntimeInput = {
    runtimeTxs: [],
    entityInputs: [{
      entityId: `0x${'33'.repeat(32)}`,
      signerId: 'signer-journal-payload',
      entityTxs: [{
        type: 'extendCredit',
        data: { counterpartyEntityId: `0x${'44'.repeat(32)}`, tokenId: 3, amount: 7n },
      }],
    }],
    jInputs: [],
  };
  let retryableReceipt: CommandReceipt | null;

  await expect(submitRuntimeCommand({
    input,
    runtimeId,
    mode: 'remote',
    serverFingerprint: SIGNED_SERVER_FINGERPRINT,
  }, async () => {
    throw new Error('runtime adapter request timed out: response lost');
  })).rejects.toThrow('response lost');
  retryableReceipt = readStore(runtimeCommandLatestReceipt);
  if (!retryableReceipt) throw new Error('TEST_RETRYABLE_RECEIPT_MISSING');

  expect(await listUnresolvedRemoteRuntimeCommandIntents(runtimeId, SIGNED_SERVER_FINGERPRINT)).toMatchObject([{
    commandId: retryableReceipt.commandId,
    runtimeId,
    input,
    status: 'pending',
  }]);

  await expect(submitRuntimeCommand({
    input: structuredClone(input),
    runtimeId,
    mode: 'remote',
    serverFingerprint: SIGNED_SERVER_FINGERPRINT,
    ...runtimeCommandRetryOptions(retryableReceipt),
  }, async (progress) => {
    await progress.accepted(9);
    throw new Error('runtime projection timed out after acceptance');
  })).rejects.toThrow('timed out');
  retryableReceipt = readStore(runtimeCommandLatestReceipt);
  if (!retryableReceipt) throw new Error('TEST_ACCEPTED_RECEIPT_MISSING');

  expect(await listUnresolvedRemoteRuntimeCommandIntents(runtimeId, SIGNED_SERVER_FINGERPRINT)).toMatchObject([{
    commandId: retryableReceipt.commandId,
    input,
    status: 'accepted',
  }]);

  await submitRuntimeCommand({
    input: structuredClone(input),
    runtimeId,
    mode: 'remote',
    serverFingerprint: SIGNED_SERVER_FINGERPRINT,
    ...runtimeCommandRetryOptions(retryableReceipt),
  }, async (progress) => {
    await progress.accepted(9);
    await progress.observed(10);
    return null;
  });
  expect(await listUnresolvedRemoteRuntimeCommandIntents(runtimeId, SIGNED_SERVER_FINGERPRINT)).toEqual([]);
});

test('server results cannot synthesize command receipts or durable receipt URLs', () => {
  const source = readFileSync('frontend/bridges/runtime/runtime-command-bus.ts', 'utf8');
  expect(source).not.toContain('recordRuntimeIngressReceipt');
  expect(source).not.toContain('statusUrl');
  expect(source).not.toContain('upstreamReceiptId');
});

test('xlnStore routes RuntimeInput mutations through RuntimeCommandBus', () => {
  const source = readFileSync('frontend/bridges/runtime/xln-store.ts', 'utf8');
  const routeIndex = source.indexOf('const routeRuntimeInput = async');
  expect(routeIndex).toBeGreaterThan(0);
  const routeSource = source.slice(routeIndex, source.indexOf('// Enqueue entity inputs', routeIndex));

  expect(routeSource).toContain('submitRuntimeCommand');
	  expect(routeSource).toContain('progress.accepted');
	  expect(source).toContain('const observeRemoteRuntimeCommand');
	  expect(routeSource).toContain('commandSequence: receipt.commandSequence');
	  expect(routeSource).toContain('await observeRemoteRuntimeCommand(remoteAdapter, input, {');
	  expect(source).not.toContain('statusUrl');
	  expect(source).toContain('waitForObservedRemoteCommand({ adapter, input, command, isCurrent, accepted: progress.accepted })');
	  expect(source).toContain('progress.observed');
	  expect(routeSource).toContain('progress.committed');
	  expect(routeSource).toContain("runtimeAdapterSend(input, { commandId: receipt.commandId })");
	  expect(routeSource).toContain('const usesRemoteAdapter = Boolean');
	  expect(routeSource).toContain('REMOTE_RUNTIME_ENV_MISMATCH');
	  expect(routeSource).toContain('!targetRuntimeId || !handleRuntimeId || targetRuntimeId === handleRuntimeId');
	  expect(routeSource).toContain('mode: usesRemoteAdapter ? \'remote\' : \'embedded\'');
  expect(routeSource).toContain('if (usesRemoteAdapter)');
  expect(routeSource).toContain('embeddedAdapterTargetsRuntimeEnv(runtimeEnv)');
  expect(routeSource).toContain('xln.enqueueRuntimeInput(runtimeEnv, input)');
	  expect(source).not.toContain('commitAcceptedRuntimeCommands');
		  expect(source).not.toContain("registerDebugSurface('submit'");
		  expect(source).not.toContain('__xlnRuntimeSubmit');
	  expect(source).toContain("from './runtime-store';");
	  expect(source).toContain('activeEnv');
	  expect(source).toContain('activeRuntimeId');
	  expect(source).toContain('runtimes');
	  expect(source).toContain('runtimeOperations');
	  expect(source).toContain('export async function submitActiveRuntimeInput');
	  expect(source).toContain('export async function submitActiveEntityInputs');
	  expect(source).toContain('export async function submitRuntimeInput');
	  expect(source).toContain('export async function submitEntityInputs');
	});

test('remote command authority does not depend on a local vault Runtime', () => {
  const source = readFileSync('frontend/bridges/runtime/xln-store.ts', 'utf8');
  const submitStart = source.indexOf('export async function submitActiveRuntimeInput');
  const submitEnd = source.indexOf('async function waitForActiveRuntimeDrained', submitStart);
  const submitSource = source.slice(submitStart, submitEnd);
  const remoteReturn = submitSource.indexOf('return routeRemoteRuntimeInput(input, commandOptions);');
  const localAuthority = submitSource.indexOf('vaultOperations.assertRuntimeAuthority(handle.runtimeId);');

  expect(remoteReturn).toBeGreaterThan(0);
  expect(localAuthority).toBeGreaterThan(remoteReturn);

  const crossStart = source.indexOf('export async function submitActiveCrossJurisdictionIntent');
  const crossEnd = source.indexOf('// === FRONTEND UTILITY FUNCTIONS ===', crossStart);
  const crossSource = source.slice(crossStart, crossEnd);
  expect(crossSource).toContain("if (adapter?.mode !== 'remote' || handle.mode !== 'remote')");
  expect(crossSource).toContain('vaultOperations.assertRuntimeAuthority(handle.runtimeId);');
});

test('embedded command completion follows the submitted input, not unrelated consensus backlog', () => {
  const submitted: RuntimeInput = {
    runtimeTxs: [],
    entityInputs: [{
      entityId: '0xentity-a',
      signerId: '0xsigner-a',
      entityTxs: [{
        type: 'profile-update',
        data: { profile: { entityId: '0xentity-a', name: 'Alice', bio: '', website: '' } },
      } as never],
    }],
  };
  const committedWithBackground: RuntimeInput = {
    runtimeTxs: [],
    entityInputs: [
      structuredClone(submitted.entityInputs[0]!),
      {
        entityId: '0xentity-b',
        signerId: '0xsigner-b',
        entityTxs: [{ type: 'scheduledWake', data: { dueAt: 99n } } as never],
      },
    ],
  };
  const history = [{ height: 12, runtimeInput: committedWithBackground }] as never;

  expect(runtimeFrameContainsSubmittedInput(committedWithBackground, submitted)).toBe(true);
  expect(findCommittedRuntimeInputHeight(history, submitted, 11)).toBe(12);
  expect(findCommittedRuntimeInputHeight(history, submitted, 12)).toBeNull();
});

test('embedded command completion reads an evicted committed frame from durable storage', async () => {
  const submitted: RuntimeInput = {
    runtimeTxs: [],
    entityInputs: [{
      entityId: '0xentity-a',
      signerId: '0xsigner-a',
      entityTxs: [{ type: 'extendCredit', data: { tokenId: 3, amount: 10n } } as never],
    }],
  };
  const unrelated: RuntimeInput = {
    runtimeTxs: [],
    entityInputs: [{
      entityId: '0xentity-b',
      signerId: '0xsigner-b',
      entityTxs: [{ type: 'scheduledWake', data: {} } as never],
    }],
  };
  const frames = new Map([
    [19, { height: 19, runtimeInput: submitted }],
    [20, { height: 20, runtimeInput: unrelated }],
  ]);

  expect(findCommittedRuntimeInputHeight([frames.get(20)!] as never, submitted, 15)).toBeNull();
  expect(await findPersistedRuntimeInputHeight(
    async (height) => frames.get(height) ?? null,
    submitted,
    15,
    20,
  )).toBe(19);
});

test('embedded command completion is multiset-exact and accepts only derived HTLC fields', () => {
  const profileTx = {
    type: 'profile-update',
    data: { profile: { entityId: '0xentity-a', name: 'Alice', bio: '', website: '' } },
  } as never;
  const duplicateSubmission: RuntimeInput = {
    runtimeTxs: [],
    entityInputs: [{ entityId: '0xentity-a', signerId: '0xsigner-a', entityTxs: [profileTx, profileTx] }],
  };
  const oneApplied: RuntimeInput = {
    runtimeTxs: [],
    entityInputs: [{ entityId: '0xentity-a', signerId: '0xsigner-a', entityTxs: [profileTx] }],
  };
  expect(runtimeFrameContainsSubmittedInput(oneApplied, duplicateSubmission)).toBe(false);

  const rawPayment = {
    type: 'htlcPayment',
    data: {
      targetEntityId: '0xtarget', tokenId: 1, amount: 7n, description: 'rent',
      maxSenderDebit: 7n,
      route: ['0xentity-a', '0xtarget'], deliveryMode: 'instant',
    },
  } as never;
  const preparedPayment = {
    type: 'htlcPayment',
    data: {
      targetEntityId: '0xtarget', tokenId: 1, amount: 7n, description: 'rent',
      maxSenderDebit: 7n,
      hashlock: '0xhash', route: ['0xentity-a', '0xtarget'], deliveryMode: 'instant',
      envelope: { version: 1 },
    },
  } as never;
  const input = (tx: typeof rawPayment): RuntimeInput => ({
    runtimeTxs: [],
    entityInputs: [{ entityId: '0xentity-a', signerId: '0xsigner-a', entityTxs: [tx] }],
  });
  expect(runtimeFrameContainsSubmittedInput(input(preparedPayment), input(rawPayment))).toBe(true);
  expect(runtimeFrameContainsSubmittedInput(
    input({ ...preparedPayment, data: { ...preparedPayment.data, amount: 8n } } as never),
    input(rawPayment),
  )).toBe(false);
});

test('runtime controller forwards caller-owned commandId to the remote adapter', () => {
  const source = readFileSync('frontend/bridges/runtime/runtime-controller-store.ts', 'utf8');
  const sendIndex = source.indexOf('export const runtimeAdapterSend');
  expect(sendIndex).toBeGreaterThan(0);
  const sendSource = source.slice(sendIndex, source.indexOf('\n};', sendIndex) + 3);

  expect(sendSource).toContain('options: RuntimeAdapterSendOptions = {}');
  expect(sendSource).toContain('adapter.send(input, options)');
});

test('public mutation exports no longer accept caller-owned RuntimeReplica', () => {
  const source = readFileSync('frontend/bridges/runtime/xln-store.ts', 'utf8');
  expect(source).not.toContain('assertSubmittedEnvMatchesActiveRuntime');

  const submitRuntimeIndex = source.indexOf('export async function submitRuntimeInput');
  const submitEntityIndex = source.indexOf('export async function submitEntityInputs');
  const utilityFunctionsIndex = source.indexOf('// === FRONTEND UTILITY FUNCTIONS ===');
  expect(submitRuntimeIndex).toBeGreaterThan(0);
  expect(submitEntityIndex).toBeGreaterThan(submitRuntimeIndex);
  expect(utilityFunctionsIndex).toBeGreaterThan(submitEntityIndex);

  const submitRuntimeSource = source.slice(submitRuntimeIndex, submitEntityIndex);
  expect(submitRuntimeSource).toContain('export async function submitRuntimeInput(');
  expect(submitRuntimeSource).toContain('commandOptions: RuntimeCommandExecutionOptions = {}');
  expect(submitRuntimeSource).toContain('return submitActiveRuntimeInput(input, commandOptions);');
  expect(submitRuntimeSource).not.toContain('env: RuntimeReplica');
  expect(submitRuntimeSource).not.toContain('assertSubmittedEnvMatchesActiveRuntime');
  expect(submitRuntimeSource).not.toContain('routeRuntimeInput(');

  const submitEntitySource = source.slice(submitEntityIndex, utilityFunctionsIndex);
  expect(submitEntitySource).toContain('export async function submitEntityInputs(inputs: RoutedEntityInput[] = [])');
  expect(submitEntitySource).toContain('return submitActiveEntityInputs(inputs);');
  expect(submitEntitySource).not.toContain('env: RuntimeReplica');
  expect(submitEntitySource).not.toContain('submitRuntimeInput(env');
  expect(submitEntitySource).not.toContain('assertSubmittedEnvMatchesActiveRuntime');
  expect(submitEntitySource).not.toContain('routeRuntimeInput(');
});

// Upstream ingress receipts were removed from the whole product in f85f450e5
// (`recordRuntimeIngressReceipt`, `result.receipt`, `result.statusUrl`). What
// survives is the server-side credit request itself, gated on the remote
// controller handle.
test('server-side credit requests validate the result without synthesizing ingress receipts', () => {
  const source = readFileSync('frontend/apps/wallet/src/manage/wallet-manage-credit.ts', 'utf8');

  expect(source).not.toContain('recordRuntimeIngressReceipt');
  expect(source).toContain("fetch(new URL('/api/credit/request', apiBase)");
  expect(source).toContain("requireRuntimeRecord(raw, 'CREDIT_REQUEST_RESPONSE')");
  expect(source).toContain("!response.ok || result['success'] !== true");
  expect(source).not.toContain('statusUrl');
});

test('credit and collateral configure forms submit RuntimeInput through shared command path', () => {
  const manageSource = readFileSync('frontend/apps/wallet/src/manage/wallet-manage.tsx', 'utf8');
  const paymentSource = readFileSync('frontend/apps/wallet/src/payments/wallet-payment-source.ts', 'utf8');
  const collateralPolicySource = readFileSync('frontend/packages/runtime-client/src/entity/collateral-request.ts', 'utf8');
  const accountWorkspaceSource = readFileSync('frontend/apps/wallet/src/account/wallet-account-workspace.tsx', 'utf8');
  const resolverSource = readFileSync('core/api/runtime-adapter/resolve.ts', 'utf8');

  expect(manageSource).toContain("type: 'extendCredit'");
  expect(manageSource).toContain('buildCollateralRequest(account, context.entityId');
  expect(manageSource).toContain('resolveCollateralFeePolicy(account, context.entityId, tokenId)');
  expect(manageSource).toContain('await source.submitAccountTxs(context.entityId, [tx])');
  expect(paymentSource).toContain('if (!adapter.commandReady)');
  expect(paymentSource).toContain('submitAccountTxs');
  expect(accountWorkspaceSource).toContain('<WalletManage context={context} source={source}');
  expect(accountWorkspaceSource).toContain('commandsReady: snapshot.data.commandsReady');
  expect(collateralPolicySource).toContain('account.state.rebalanceFeePolicies');
  expect(resolverSource).toContain('const rebalanceFeePolicies = compactMapHead(doc.state.rebalanceFeePolicies, 100)');
  expect(resolverSource).toContain('if (rebalanceFeePolicies) compact.state.rebalanceFeePolicies = rebalanceFeePolicies');
});

test('payment panel submits RuntimeInput through shared command path', () => {
  const paymentSource = readFileSync('frontend/apps/wallet/src/payments/wallet-payment-source.ts', 'utf8');
  const commandSource = readFileSync('frontend/apps/wallet/src/payments/commands/wallet-payment-command.ts', 'utf8');
  const paymentView = readFileSync('frontend/apps/wallet/src/payments/wallet-payments.tsx', 'utf8');

  expect(paymentSource).toContain('prepareWalletPaymentCommand(this.requireAdapter(), input)');
  expect(paymentSource).toContain('executeWalletPaymentCommand(this.requireAdapter(), command)');
  expect(paymentSource).toContain("status: 'pending'");
  expect(paymentSource).toContain('retryPendingCommand');
  expect(commandSource).toContain('adapter.send(command.input');
  expect(commandSource).toContain('commandId: command.commandId');
  expect(paymentView).toContain('Runtime command {shortCommandId(snapshot.command.commandId)}');
});

test('lending stays visible as unsupported without a Runtime command path', () => {
  const source = readFileSync('frontend/apps/wallet/src/manage/wallet-lending.tsx', 'utf8');
  const operations = readFileSync('frontend/apps/wallet/src/payments/wallet-payment-operations.tsx', 'utf8');
  const operationModel = readFileSync('frontend/apps/wallet/src/payments/commands/wallet-payment-operations-model.ts', 'utf8');
  const commandTypes = readFileSync('frontend/packages/runtime-client/src/payments/payment-command-types.ts', 'utf8');

  expect(source).toContain('Production lending is not enabled');
  expect(source).toContain('No lending form or submission control is exposed.');
  expect(source).not.toContain('submitAccountTxs');
  expect(source).not.toContain('/api/lending/state');
  expect(operations).not.toContain('Submit lending');
  expect(operationModel).not.toContain("type: 'lendingOffer'");
  expect(operationModel).not.toContain("type: 'lendingBorrow'");
  expect(commandTypes).not.toContain("type: 'lendingOffer'");
  expect(commandTypes).not.toContain("type: 'lendingBorrow'");
  expect(source).not.toContain('recordRuntimeIngressReceipt');
});

// f85f450e5 deleted the faucet ingress-receipt plumbing end to end: the server
// no longer returns `receipt`/`statusUrl`, `FaucetApiResult` no longer decodes
// them, and `recordServerIngressReceipt` is gone from the panel. The surviving
// invariant is the faucet readiness gate.
test('server-side faucet results retain readiness guards without synthesizing ingress receipts', () => {
  const faucetSource = readFileSync('frontend/packages/browser/src/wallet/account-faucet.ts', 'utf8');
  const accountSource = readFileSync('frontend/apps/wallet/src/account/view/wallet-account-view-source.ts', 'utf8');
  const accountView = readFileSync('frontend/apps/wallet/src/account/view/wallet-account-summary.tsx', 'utf8');

  expect(faucetSource).not.toContain('receipt?: {');
  expect(faucetSource).toContain('decodeFaucetApiResult');
  expect(accountSource).toContain('requestAccountFaucet');
  expect(accountSource).toContain('commandsReady: current.commandsReady');
  expect(accountSource).not.toContain('recordRuntimeIngressReceipt');
  expect(accountView).toContain('disabled={!commandsReady || busy}');
  expect(accountView).toContain("'Runtime is not ready for financial actions'");
});

test('ui mutation surfaces do not use retired enqueue entrypoints', () => {
  const files = [
    ...frontendSourceFiles('frontend/apps'),
    ...frontendSourceFiles('frontend/bridges/wallet'),
  ];

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    expect(source, file).not.toMatch(/\bXLN\.enqueueRuntimeInput/);
    expect(source, file).not.toMatch(/\(XLN as any\)\.enqueueRuntimeInput/);
    expect(source, file).not.toMatch(/\bxln\.enqueueRuntimeInput/);
    expect(source, file).not.toMatch(/\benqueueEntityInputs\b/);
    expect(source, file).not.toMatch(/\benqueueAndProcess\b/);
    expect(source, file).not.toMatch(/\bsubmitRuntimeInput\(\s*(env|runtimeEnv|currentEnv|actionEnv|\$runtimeFrameEnv|crossCommandEnv),/);
    expect(source, file).not.toMatch(/\bsubmitEntityInputs\(\s*(env|runtimeEnv|currentEnv|actionEnv|\$runtimeFrameEnv|crossCommandEnv),/);
  }
});

test('entity workspace renders latest runtime command receipt status', () => {
  const source = readFileSync('frontend/apps/wallet/src/account/wallet-account-workspace.tsx', 'utf8');

  expect(source).toContain("snapshot.command.status !== 'idle'");
  expect(source).toContain("role={snapshot.command.status === 'error' ? 'alert' : 'status'}");
  expect(source).toContain('snapshot.command.message');
  expect(source).toContain('snapshot.command.retryable');
  expect(source).not.toContain('committedAtHeight');
  expect(source).not.toContain('acceptedAtHeight');
  expect(source).not.toContain('upstreamReceiptId');
});

test('entity panel never promotes UI reads or transaction responses into J-prefix inputs', () => {
  const source = readFileSync('frontend/apps/wallet/src/account/wallet-account-workspace.tsx', 'utf8');
  expect(source).not.toContain('async function applyCanonicalJEventsToActiveEnv');
  expect(source).not.toContain('buildJEventsRuntimeInput(env, events');
  expect(source).not.toContain('applyJEventsToEnv');
});

test('entity panel pure RuntimeInput mutations do not require embedded RuntimeReplica on remote', () => {
  const source = readFileSync('frontend/apps/wallet/src/payments/wallet-payment-source.ts', 'utf8');
  const manage = readFileSync('frontend/apps/wallet/src/manage/wallet-manage.tsx', 'utf8');

  expect(source).not.toContain('requireRuntimeEnv');
  expect(source).toContain('if (!adapter.commandReady)');
  expect(source).toContain('submitAccountTxs');
  expect(manage).toContain('await source.submitAccountTxs(context.entityId');
  expect(manage).not.toContain('RuntimeReplica');
});

test('entity panel debt enforcement submits RuntimeInput instead of calling JAdapter directly', () => {
  const source = readFileSync('frontend/apps/wallet/src/financial-health/wallet-financial-health-source.ts', 'utf8');

  expect(source).toContain('buildDebtEnforcementRuntimeInputFromProjection');
  expect(source).toContain("../../../../../core/runtime/tx/debt-enforcement-input");
  expect(source).toContain('prepareWalletPaymentCommand(');
  expect(source).toContain('executeWalletPaymentCommand(adapter, prepared)');
  expect(source).not.toContain('JAdapter');
  expect(source).toContain('timestamp: projection.timestamp');
  expect(source).not.toContain('Date.now()');
});
