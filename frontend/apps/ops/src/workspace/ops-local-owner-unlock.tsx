import { useEffect, useState } from 'react';
import { loadCanonicalOpsOwnerMetadata, readCanonicalOpsOwnerVaults, subscribeCanonicalOpsOwner } from '../../../../bridges/ops-canonical-owner';
import { OpsOwnerUnlockForm } from './ops-owner-unlock-form';

export function OpsLocalOwnerUnlock() {
  const [vaults, setVaults] = useState(readCanonicalOpsOwnerVaults);
  const [selected, setSelected] = useState('');
  const [issue, setIssue] = useState('');
  useEffect(() => {
    try { loadCanonicalOpsOwnerMetadata(); }
    catch (cause) { setIssue(cause instanceof Error ? cause.message : String(cause)); }
    const refresh = (): void => {
      const next = readCanonicalOpsOwnerVaults();
      setVaults(next);
      setSelected(current => next.runtimes.some(runtime => runtime.id === current) ? current
        : next.activeRuntimeId ?? next.runtimes[0]?.id ?? '');
    };
    refresh();
    return subscribeCanonicalOpsOwner(refresh);
  }, []);
  if (issue) return <p role="alert">{issue}</p>;
  if (!selected) return <span className="ops-local-owner-empty">No local owner vault</span>;
  return <div className="ops-local-owner">
    {vaults.runtimes.length > 1 ? <label>Owner vault<select aria-label="Local owner vault" value={selected} onChange={event => setSelected(event.currentTarget.value)}>{vaults.runtimes.map(runtime => <option key={runtime.id} value={runtime.id}>{runtime.label || runtime.id}</option>)}</select></label> : null}
    <OpsOwnerUnlockForm key={selected} runtimeId={selected} local />
  </div>;
}
