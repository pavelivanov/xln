import { useEffect, useRef, useState, type FormEvent } from 'react';
import { parseEntityInput } from '../../../src/lib/components/shared/entity-input-model';
import { WalletEntityInput } from './wallet-entity-input';
import type { WalletHubDiscoverySnapshot, WalletHubDiscoverySource } from './wallet-hub-discovery-source';
import './styles/wallet-account-open.css';

export function WalletDirectAccountOpen({ source, snapshot }: Readonly<{ source: WalletHubDiscoverySource; snapshot: WalletHubDiscoverySnapshot }>) {
  const [recipient, setRecipient] = useState('');
  const errorRef = useRef<HTMLParagraphElement>(null);
  const parsed = parseEntityInput(recipient, { entities: snapshot.entities, profiles: snapshot.profiles });
  const error = snapshot.messageKind === 'direct' ? snapshot.error : '';
  const notice = snapshot.messageKind === 'direct' ? snapshot.notice : '';
  const pending = snapshot.retryKind === 'direct';
  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.focus({ preventScroll: true });
      errorRef.current.scrollIntoView({ block: 'center' });
    }
  }, [error]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (await source.openDirect(pending ? snapshot.retryHubId : parsed.entityId)) setRecipient('');
  };
  if (!snapshot.canOpenAccounts) return null;
  return <section className="wallet-account-direct">
    <header><p>Direct</p><h3>Open by ID</h3></header>
    <form aria-label="Open Account by ID" onSubmit={event => void submit(event)}>
      <WalletEntityInput value={recipient} onChange={value => { setRecipient(value); source.clearDirectMessage(); }} entities={snapshot.entities} profiles={snapshot.profiles}
        disabled={Boolean(snapshot.connectingHubId || snapshot.retryHubId)} />
      {error ? <p className="wallet-hub-error" role="alert" tabIndex={-1} ref={errorRef}>{error}</p> : null}
      {notice ? <p role="status">{notice}</p> : null}
      <button type="submit" data-testid="open-account-submit"
        disabled={Boolean(snapshot.connectingHubId) || (Boolean(snapshot.retryHubId) && !pending) || (!pending && !parsed.entityId.trim())}>
        {snapshot.connectingHubId && snapshot.messageKind === 'direct' ? 'Opening…' : pending ? 'Retry request' : 'Open'}
      </button>
    </form>
  </section>;
}
