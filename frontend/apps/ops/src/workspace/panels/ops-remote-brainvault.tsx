import { useEffect, useRef, useState } from 'react';
import type { RuntimeAdapter, RuntimeAdapterBrainVaultProgress, RuntimeAdapterBrainVaultResult } from '../../../../../../core/api/runtime-adapter/types';
import { BRAINVAULT_V1_SPEC_ID } from '../../../../../../brainvault/src/core/primitives/spec';
import {
  assertWalletNodeBrainVaultResult,
  resolveWalletNodeBrainVaultAccess,
  validateWalletNodeBrainVaultProgress,
} from '../../../../../packages/browser/src/identity/wallet-node-brainvault-validation';

const shardCountForInput = (input: number): number => input <= 5 ? 10 ** (input - 1) : input;
const errorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);

export function OpsRemoteBrainVault({ adapter, historical }: Readonly<{
  adapter: RuntimeAdapter | null;
  historical: boolean;
}>) {
  const [name, setName] = useState('operator');
  const [passphrase, setPassphrase] = useState('');
  const [shardInput, setShardInput] = useState(1);
  const [workers, setWorkers] = useState(1);
  const [progress, setProgress] = useState<RuntimeAdapterBrainVaultProgress | null>(null);
  const [result, setResult] = useState<RuntimeAdapterBrainVaultResult | null>(null);
  const [issue, setIssue] = useState('');
  const [running, setRunning] = useState(false);
  const run = useRef<{ id: number; controller: AbortController } | null>(null);
  const nextRunId = useRef(0);
  const access = resolveWalletNodeBrainVaultAccess(adapter);

  useEffect(() => {
    setPassphrase('');
    setProgress(null);
    setResult(null);
    setIssue('');
    setRunning(false);
    return () => {
      nextRunId.current += 1;
      run.current?.controller.abort();
      run.current = null;
    };
  }, [adapter]);

  const derive = async (): Promise<void> => {
    setIssue('');
    setResult(null);
    setProgress(null);
    if (historical) { setIssue('BrainVault commands require the live Runtime.'); return; }
    if (access.status !== 'ready') { setIssue(access.message); return; }
    if (!name || !passphrase) { setIssue('Name and passphrase are required exactly as entered.'); return; }
    if (!Number.isSafeInteger(shardInput) || shardInput < 1 || !Number.isSafeInteger(workers) || workers < 1) {
      setIssue('Work level / shard count and worker count must be positive integers.');
      return;
    }
    const secret = passphrase;
    setPassphrase('');
    const id = ++nextRunId.current;
    const controller = new AbortController();
    const selected = access.adapter;
    const runtimeId = selected.runtimeId;
    const expectedShards = shardCountForInput(shardInput);
    run.current = { id, controller };
    setRunning(true);
    try {
      const receipt = await selected.deriveBrainVault({
        specId: BRAINVAULT_V1_SPEC_ID, name, passphrase: secret, shardInput, workers,
      }, {
        signal: controller.signal,
        onProgress: value => {
          const validation = validateWalletNodeBrainVaultProgress(value, expectedShards);
          if (!validation.valid) { setIssue(validation.message); controller.abort(); return; }
          if (run.current?.id === id) setProgress(value);
        },
      });
      assertWalletNodeBrainVaultResult(receipt, BRAINVAULT_V1_SPEC_ID, expectedShards);
      if (run.current?.id !== id || adapter !== selected || selected.runtimeId !== runtimeId) {
        throw new Error('OPS_BRAINVAULT_WORKSPACE_SELECTION_CHANGED');
      }
      setResult(receipt);
    } catch (error) {
      if (run.current?.id === id) setIssue(errorMessage(error));
    } finally {
      if (run.current?.id === id) { run.current = null; setRunning(false); }
    }
  };

  return <div className="ops-brainvault-remote">
    <p>Derivation runs on the selected trusted node. The passphrase is cleared from this form immediately and recovery words are never returned here.</p>
    {historical ? <p role="status">Recorded frames are read only. Switch to Live Runtime to derive.</p> : null}
    {access.status === 'blocked' ? <p role="status">{access.message}</p> : null}
    <fieldset disabled={historical || running || access.status !== 'ready'}>
      <legend>Exact recovery inputs</legend>
      <label>Name <input autoComplete="off" value={name} onChange={event => setName(event.currentTarget.value)} /></label>
      <label>Passphrase <input autoComplete="off" type="password" value={passphrase} onChange={event => setPassphrase(event.currentTarget.value)} /></label>
      <label>Work level or explicit shards <input min="1" type="number" value={shardInput} onChange={event => setShardInput(Number(event.currentTarget.value))} /></label>
      <label>Workers <input min="1" type="number" value={workers} onChange={event => setWorkers(Number(event.currentTarget.value))} /></label>
      <button onClick={() => { void derive(); }} type="button">Derive and install on selected node</button>
    </fieldset>
    {running ? <div role="status"><p>Native worker running{progress ? ` · ${progress.completed}/${progress.total} shards · ${progress.lastShardMs} ms last shard` : '…'}</p><button onClick={() => run.current?.controller.abort()} type="button">Cancel derivation</button></div> : null}
    {issue ? <p className="is-error" role="alert">{issue}</p> : null}
    {result ? <dl className="ops-audit-metrics" data-testid="brainvault-node-result">
      <div><dt>Entity</dt><dd>{result.entityId}</dd></div><div><dt>Signer</dt><dd>{result.ethereumAddress}</dd></div>
      <div><dt>Runtime height</dt><dd>{result.height}</dd></div><div><dt>Native duration</dt><dd>{result.derivationTimeMs} ms</dd></div>
    </dl> : null}
  </div>;
}
