import { useId, useState, type KeyboardEvent } from 'react';
import { compareStableText } from '../../../src/lib/utils/stableSort';
import { parseEntityInput, type EntityInputProfile } from '../../../src/lib/components/shared/entity-input-model';

export function WalletEntityInput({ value, onChange, entities, profiles, disabled }: Readonly<{
  value: string; onChange: (value: string) => void; entities: readonly string[];
  profiles: readonly EntityInputProfile[]; disabled: boolean;
}>) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const names = new Map(profiles.map(profile => [profile.entityId.toLowerCase(), profile.name]));
  const options = entities.map(id => ({ id, name: names.get(id.toLowerCase()) || id }))
    .sort((a, b) => compareStableText(a.name, b.name))
    .filter(option => !value || option.id.toLowerCase().includes(value.toLowerCase()) || option.name.toLowerCase().includes(value.toLowerCase()));
  const selectedIndex = Math.min(active, Math.max(0, options.length - 1));
  const parsed = parseEntityInput(value, { entities, profiles });
  const select = (id: string) => { onChange(id); setOpen(false); setActive(0); };
  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); setOpen(true);
      setActive(event.key === 'ArrowDown' ? Math.min(selectedIndex + 1, options.length - 1) : Math.max(0, selectedIndex - 1));
    } else if (event.key === 'Enter' && open) {
      const option = options[selectedIndex];
      if (option) { event.preventDefault(); select(option.id); }
    }
  };
  return <div className="wallet-entity-input" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label htmlFor={`${listId}-input`}>Recipient</label>
    <input id={`${listId}-input`} role="combobox" aria-autocomplete="list" aria-expanded={open}
      aria-controls={listId} aria-activedescendant={open && options.length ? `${listId}-${selectedIndex}` : undefined}
      aria-describedby={`${listId}-resolution`} value={value} disabled={disabled} autoComplete="off" spellCheck={false}
      placeholder="Select or paste entity ID" onFocus={() => { setOpen(true); setActive(0); }} onKeyDown={keyDown}
      onChange={event => { onChange(event.target.value); setOpen(true); setActive(0); }} />
    {open ? <ul id={listId} role="listbox" aria-label="Known counterparties">
      {options.map((option, index) => <li key={option.id} role="presentation">
        <button id={`${listId}-${index}`} type="button" role="option" aria-selected={index === selectedIndex} tabIndex={-1}
          data-entity-id={option.id} onMouseDown={event => event.preventDefault()} onClick={() => select(option.id)}>
          <strong>{option.name}</strong><code>{option.id}</code>
        </button>
      </li>)}
      {options.length === 0 ? <li role="presentation">No matching known Entities</li> : null}
    </ul> : null}
    <p id={`${listId}-resolution`} className="wallet-entity-resolution">
      {parsed.resolved ? <code>{parsed.entityId}</code> : 'Use a known name, short ID, number or full Entity ID.'}
    </p>
  </div>;
}
