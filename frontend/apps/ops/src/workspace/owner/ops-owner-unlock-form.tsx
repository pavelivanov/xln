import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { opsEntityWorkspaceSource } from '../../entity-workspace/ops-entity-workspace-runtime';
import { readCanonicalOpsOwnerUnlocked, lockCanonicalOpsOwner, subscribeCanonicalOpsOwner, unlockCanonicalOpsOwner, unlockCanonicalOpsLocalOwner, lockCanonicalOpsLocalOwner } from '../../../../../bridges/ops-canonical-owner';
import { browserRuntimeSession } from '../../../../../bridges/runtime/browser-runtime-session';
import { selectWorkspaceRuntime } from '../runtime/ops-runtime-selection';
import type { VaultUnlockDurationMs } from '../../../../../src/lib/security/vaultProtection';

export function OpsOwnerUnlockForm({ runtimeId, local }: Readonly<{ runtimeId: string; local: boolean }>) {
  const adapter = useSyncExternalStore(opsEntityWorkspaceSource.subscribe, opsEntityWorkspaceSource.getAdapter);
  const session = useSyncExternalStore(browserRuntimeSession.subscribe, browserRuntimeSession.getSnapshot);
  const [expanded, setExpanded] = useState(false);
  const [seed, setSeed] = useState('');
  const [duration, setDuration] = useState<VaultUnlockDurationMs>(600_000);
  const [unlocked, setUnlocked] = useState(false);
  const [pending, setPending] = useState(false);
  const [issue, setIssue] = useState('');
  const generation = useRef(0);
  useEffect(() => {
    generation.current += 1;
    setSeed(''); setIssue(''); setPending(false); setExpanded(false);
    const refresh = (): void => {
      setUnlocked(readCanonicalOpsOwnerUnlocked(runtimeId));
    };
    const unsubscribe = subscribeCanonicalOpsOwner(refresh);
    refresh();
    const timer = window.setInterval(refresh, 1000);
    return () => { generation.current += 1; unsubscribe(); window.clearInterval(timer); };
  }, [runtimeId, adapter]);
  const submit = async (): Promise<void> => {
    const ownedGeneration = generation.current;
    const current = (): boolean => generation.current === ownedGeneration && opsEntityWorkspaceSource.getAdapter() === adapter;
    setPending(true); setIssue('');
    try {
      if (unlocked) { if (local) await lockCanonicalOpsLocalOwner(runtimeId); else await lockCanonicalOpsOwner(runtimeId); }
      else {
        const input = seed.trim(); setSeed('');
        if (local) { await unlockCanonicalOpsLocalOwner(runtimeId, input, duration); await selectWorkspaceRuntime('embedded'); }
        else await unlockCanonicalOpsOwner(runtimeId, input, duration);
      }
      if (current()) setUnlocked(readCanonicalOpsOwnerUnlocked(runtimeId));
    } catch (cause) { if (current()) setIssue(cause instanceof Error ? cause.message : String(cause)); }
    finally { if (current()) setPending(false); }
  };
  const localReady = session.status === 'ready' && session.runtimeId === runtimeId;
  const ownerLabel = pending ? 'unlocking…' : unlocked ? local && !localReady ? 'keys unlocked' : 'unlocked' : 'locked';
  return <div className="ops-owner-unlock" data-testid="ops-owner-unlock" data-runtime-status={local ? session.status : undefined}>
    <button aria-expanded={expanded} onClick={() => setExpanded(value => !value)} type="button">Owner {ownerLabel}</button>
    {expanded ? <form aria-label="Unlock Runtime owner" onSubmit={event => { event.preventDefault(); void submit(); }}>
      <strong>{local ? 'Local Runtime owner' : 'Runtime owner'}</strong><code>{runtimeId}</code>
      {!unlocked ? <><label>Wallet seed phrase<textarea disabled={pending} autoComplete="off" spellCheck={false} aria-label="Owner wallet seed phrase" value={seed} onChange={event => setSeed(event.currentTarget.value)} /></label>
        <label>Unlock duration<select disabled={pending} aria-label="Owner unlock duration" value={duration ?? 'session'} onChange={event => {
          const value = event.currentTarget.value;
          if (value !== '600000' && value !== '86400000' && value !== 'session') throw new Error('VAULT_UNLOCK_DURATION_INVALID');
          setDuration(value === 'session' ? null : value === '600000' ? 600_000 : 86_400_000);
        }}><option value="600000">10 minutes</option><option value="86400000">24 hours</option><option value="session">Until locked</option></select></label></> : <p>{local && !localReady ? 'Vault keys are unlocked. The local Runtime is not ready; commands remain unavailable.' : 'Owner commands are enabled for this vault lease.'}</p>}
      <button disabled={pending || (local && session.status === 'booting') || (!unlocked && !seed.trim())} type="submit">{pending ? 'Working…' : unlocked ? 'Lock owner' : 'Unlock owner'}</button>
      {issue ? <p role="alert">{issue}</p> : null}
    </form> : null}
  </div>;
}
