import { useEffect, useRef, useState } from 'react';
import type { AccountDropdownItem } from '../../../src/lib/components/Entity/account/account-dropdown-model';
import './account-dropdown.css';

export function AccountDropdown({ accounts, selectedAccountId, onSelect, onAdd }: Readonly<{
  accounts: readonly AccountDropdownItem[]; selectedAccountId: string | null;
  onSelect: (id: string | null) => void; onAdd?: () => void;
}>) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const selected = accounts.find(account => account.id === selectedAccountId);
  const label = selected ? selected.name : accounts.length ? `${accounts.length} Account${accounts.length === 1 ? '' : 's'}` : 'Select Account…';
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && root.current && !root.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);
  const select = (id: string | null) => { setOpen(false); onSelect(id); };
  return <div className="react-account-dropdown" ref={root} onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
  }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={trigger} className="account-dropdown-trigger" type="button" aria-label="Select Account" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      {selected?.avatar ? <img src={selected.avatar} alt="" /> : null}<span>{label}</span><span aria-hidden="true">▾</span>
    </button>
    {open ? <div className="account-dropdown-options" role="group" aria-label="Accounts">
      {selectedAccountId ? <button type="button" onClick={() => select(null)}>← Back to Entity</button> : null}
      {accounts.length === 0 ? <p>No connections yet</p> : accounts.map(account => <button type="button" key={account.id}
        data-account-id={account.id} aria-pressed={account.id === selectedAccountId} onClick={() => select(account.id)}>
        {account.avatar ? <img src={account.avatar} alt="" /> : null}
        <span className="account-dropdown-meta"><strong>{account.name}</strong><code>{account.id}</code></span>
        <span className={`account-dropdown-status is-${account.status}`}>{account.statusLabel}{account.status === 'sent' && account.pendingCount > 0 ? ` · ${account.pendingCount}` : ''}</span>
      </button>)}
      {onAdd ? <button type="button" onClick={() => { setOpen(false); onAdd(); }}>+ Add Account</button> : null}
    </div> : null}
  </div>;
}
