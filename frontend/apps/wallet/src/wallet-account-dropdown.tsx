import { useEffect, useState, useSyncExternalStore } from 'react';
import type { RuntimeAdapter } from '@xln/core/api/public/runtime-module';
import { AccountDropdown } from '../../../packages/ui/src/account-dropdown';
import { WalletAccountDropdownSource } from './wallet-account-dropdown-source';

export function WalletAccountDropdown({ adapter, entityId, onSelect }: Readonly<{
  adapter: RuntimeAdapter; entityId: string; onSelect: (id: string) => void;
}>) {
  const [source] = useState(() => new WalletAccountDropdownSource(adapter, entityId));
  const snapshot = useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  useEffect(() => { source.start(); return source.stop; }, [source]);
  if (snapshot.error) return <div role="alert"><p>{snapshot.error}</p><button type="button" onClick={() => void source.refresh()}>Retry Account list</button></div>;
  if (snapshot.loading || !snapshot.data) return <p role="status">Loading Accounts…</p>;
  return <AccountDropdown accounts={snapshot.data} selectedAccountId={null} onSelect={id => { if (id) onSelect(id); }} />;
}
