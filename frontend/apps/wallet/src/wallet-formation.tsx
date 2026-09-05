import { useEffect, useRef, useState } from 'react';
import { isTronChainId } from '@xln/core/api/public/runtime-module';
import type { WalletFormationResult, WalletFormationView } from '../../../packages/browser/src/wallet-formation';
import { generateLazyEntityIdPreview } from '../../../src/lib/utils/identity/lazyEntityId';
import { createWalletFormation, loadWalletFormation } from './wallet-formation-source';
import './styles/wallet-formation.css';

type ReadyFormation = Extract<WalletFormationView, { state: 'ready' }>;
type BoardMember = { name: string; weight: number };
type BoardMemberDraft = { name: string; weight: string };
const previewBoard = (members: BoardMember[], threshold: number, lazy: boolean) => {
  try { return { hash: lazy ? generateLazyEntityIdPreview(members, BigInt(threshold)) : '', error: '' }; }
  catch (cause) { return { hash: '', error: cause instanceof Error ? cause.message : String(cause) }; }
};

function FormationForm({ view, onCreated }: Readonly<{ view: ReadyFormation; onCreated: (result: WalletFormationResult) => void }>) {
  const [entityType, setEntityType] = useState<'numbered' | 'lazy'>('numbered');
  const [boardMode, setBoardMode] = useState<'personal' | 'shared'>('personal');
  const [entityName, setEntityName] = useState('');
  const [jurisdiction, setJurisdiction] = useState('');
  const [validators, setValidators] = useState<BoardMemberDraft[]>(() => [{ name: view.signerId, weight: '1' }]);
  const [manualThreshold, setManualThreshold] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const operation = useRef<AbortController | null>(null);
  useEffect(() => () => operation.current?.abort(), []);
  const jurisdictions = entityType === 'numbered' ? view.projection.jurisdictions.filter(j => !isTronChainId(Number(j.chainId))) : view.projection.jurisdictions;
  const selectedJurisdiction = jurisdictions.some(j => j.name === jurisdiction) ? jurisdiction : jurisdictions[0]?.name || '';
  const members = boardMode === 'personal' ? [{ name: view.signerId, weight: 1 }] : validators.map(member => ({ name: member.name, weight: Number(member.weight) }));
  const totalWeight = members.reduce((sum, member) => sum + member.weight, 0);
  const threshold = manualThreshold ?? (boardMode === 'personal' ? 1 : totalWeight);
  const preview = previewBoard(members, threshold, entityType === 'lazy');

  const reset = () => {
    setEntityName(''); setEntityType('numbered'); setBoardMode('personal');
    setValidators([{ name: view.signerId, weight: '1' }]); setManualThreshold(null);
  };
  const selectBoard = (mode: 'personal' | 'shared') => {
    setBoardMode(mode); setManualThreshold(null); setError('');
    if (mode === 'shared' && validators.length === 1) setValidators([...validators, { name: '', weight: '1' }]);
  };
  const updateMember = (index: number, patch: Partial<BoardMemberDraft>) => {
    setValidators(current => current.map((member, position) => position === index ? { ...member, ...patch } : member));
  };
  const removeMember = (index: number) => {
    const next = validators.filter((_, position) => position !== index);
    const total = next.reduce((sum, member) => sum + Number(member.weight), 0);
    setValidators(next);
    if (manualThreshold !== null && manualThreshold > total) setManualThreshold(total);
  };
  const create = async () => {
    const controller = new AbortController(); operation.current = controller;
    setBusy(true); setError('');
    try {
      const result = await createWalletFormation({ runtimeId: view.runtimeId, signerId: view.signerId,
        draft: { entityType, entityName, selectedJurisdiction, validators: members, threshold },
      }, controller.signal);
      controller.signal.throwIfAborted(); onCreated(result);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause));
    } finally { if (!controller.signal.aborted) setBusy(false); }
  };
  return (
    <form aria-label="Create Entity" onChange={() => setError('')} onSubmit={event => { event.preventDefault(); if (!busy) void create(); }}>
      <fieldset disabled={busy || view.blockedReason !== ''}>
        <legend className="wallet-formation-sr-only">Entity configuration</legend>
        {jurisdictions.length ? <label>Jurisdiction<select value={selectedJurisdiction} onChange={event => setJurisdiction(event.target.value)}>
          {jurisdictions.map(j => <option key={j.name} value={j.name}>{j.name}{j.chainId ? ` · #${j.chainId}` : ''}</option>)}
        </select></label> : <p>{entityType === 'numbered' ? 'Numbered registration is not available on the connected jurisdictions.' : 'No jurisdictions available. Add one first.'}</p>}
        <label>Entity name<input value={entityName} onChange={event => setEntityName(event.target.value)} placeholder="e.g., ACME" /></label>
        <p>A display name only. The canonical identity comes from registration and the board.</p>
        <div className="wallet-formation-options" role="group" aria-label="Entity control">
          <button aria-pressed={boardMode === 'personal'} data-testid="formation-personal" type="button" onClick={() => selectBoard('personal')}>Personal<small>One Runtime signer</small></button>
          <button aria-pressed={boardMode === 'shared'} data-testid="formation-shared" type="button" onClick={() => selectBoard('shared')}>Shared board<small>Weighted multisig</small></button>
        </div>
        {boardMode === 'personal' ? <div className="wallet-formation-signer"><small>Runtime signer</small><code>{view.signerId || 'Unlock a Runtime signer first'}</code></div> : <section aria-label="Board members">
          <h3>Board members ({validators.length})</h3>
          <div className="wallet-formation-members">{validators.map((member, index) => <div key={index}>
            <span>{index + 1}</span>
            <input aria-label={`Board member ${index + 1}`} value={member.name} onChange={event => updateMember(index, { name: event.target.value })} placeholder="EOA address or Entity ID" />
            <input aria-label={`Board member ${index + 1} weight`} type="number" min="1" value={member.weight} onChange={event => updateMember(index, { weight: event.target.value })} />
            <button aria-label={`Remove board member ${index + 1}`} type="button" disabled={validators.length <= 1} onClick={() => removeMember(index)}>×</button>
          </div>)}</div>
          <button type="button" onClick={() => setValidators(current => [...current, { name: '', weight: '1' }])}>Add Board Member</button>
          <p>Member 1 proposes. Order, weights and threshold are part of the Entity ID.</p>
          {validators.length > 1 ? <label className="wallet-formation-threshold">Threshold
            <input aria-label="Board signing threshold" type="range" min="1" max={totalWeight} value={threshold} onChange={event => setManualThreshold(event.target.valueAsNumber)} />
            <span>{threshold} of {totalWeight}</span><small>{threshold === totalWeight ? 'All validators must sign' : `${threshold} weight required to sign`}</small>
          </label> : null}
        </section>}
        <details className="wallet-formation-advanced"><summary>Advanced identity settings</summary>
          <div className="wallet-formation-options" role="group" aria-label="Registration">
            <button aria-pressed={entityType === 'numbered'} type="button" onClick={() => setEntityType('numbered')}>Numbered<small>Registered on-chain</small></button>
            <button aria-pressed={entityType === 'lazy'} type="button" onClick={() => setEntityType('lazy')}>Lazy<small>Board hash identity</small></button>
          </div>
          {entityType === 'lazy' ? <div className="wallet-formation-preview"><small>Canonical Board Hash</small><code data-testid="formation-board-hash">{preview.hash}</code><p>This hash becomes your entity ID</p></div> : null}
        </details>
        {preview.error ? <p className="wallet-formation-error" role="alert">{preview.error}</p> : null}
        <div className="wallet-formation-actions">
          <button type="button" onClick={reset}>Clear</button>
          <button className="wallet-formation-create" type="submit" disabled={!entityName.trim() || !selectedJurisdiction || members.some(member => !member.name) || Boolean(preview.error)}>{busy ? 'Creating…' : 'Create Entity'}</button>
        </div>
      </fieldset>
      {view.blockedReason || error ? <p className="wallet-formation-error" role="alert">{view.blockedReason || error}</p> : null}
    </form>
  );
}

export function WalletFormation({ runtimeId, onBack, onCreated }: Readonly<{ runtimeId: string; onBack: () => void; onCreated: (result: WalletFormationResult) => void }>) {
  const [view, setView] = useState<WalletFormationView | null>(null);
  const [issue, setIssue] = useState('');
  useEffect(() => {
    let disposed = false; let release = () => {};
    setView(null); setIssue('');
    void loadWalletFormation().then(bridge => {
      if (disposed) return;
      release = bridge.subscribeCanonicalWalletFormation(runtimeId, value => { if (!disposed) { setView(value); setIssue(''); } }, cause => {
        if (!disposed) setIssue(cause instanceof Error ? cause.message : String(cause));
      });
    }).catch(cause => { if (!disposed) setIssue(cause instanceof Error ? cause.message : String(cause)); });
    return () => { disposed = true; release(); };
  }, [runtimeId]);
  return <section className="wallet-formation" data-testid="entity-formation-panel">
    <button className="wallet-formation-back" type="button" onClick={onBack}>← Back to assets</button>
    <header><p>New subject</p><h2>Create Entity</h2><p>Every person, company, and hub starts as the same Entity.</p></header>
    {issue ? <p role="alert" className="wallet-formation-error">{issue}</p> : view === null ? <p role="status">Loading wallet configuration…</p> : view.state === 'unavailable' ? <p role="status">{view.message}</p> : <FormationForm key={`${view.runtimeId}:${view.signerId}`} view={view} onCreated={onCreated} />}
  </section>;
}
