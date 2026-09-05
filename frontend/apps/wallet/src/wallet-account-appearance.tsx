import { useId } from 'react';
import { accountAppearanceOperations as operations, useAccountAppearance } from './wallet-account-appearance-source';
import './styles/wallet-account-appearance.css';

const effects = [
  ['barCreditGradient', 'Credit Gradient', 'Cap credit segments with fade-out'],
  ['barAnimTransition', 'Smooth Resize', 'Animate bar width changes'],
  ['barAnimSweep', 'Sweep', 'Light beam sweeps right-to-left on update'],
  ['barAnimGlow', 'Glow', 'Brightness pulse on bar change'],
  ['barAnimDeltaFlash', 'Delta Flash', 'Show +/- amount text overlay'],
  ['barAnimRipple', 'Ripple', 'Expanding ring from bar center'],
] as const;

export function WalletAccountAppearance({ onBack }: Readonly<{ onBack: () => void }>) {
  const settings = useAccountAppearance();
  const id = useId();
  const scale = Math.min(10_000, Math.max(10, Math.round(settings.accountBarUsdPerPx * 100)));
  return <section className="wallet-account-appearance" aria-labelledby={`${id}-title`}>
    <button type="button" onClick={onBack}>← Back to accounts</button>
    <h1 id={`${id}-title`}>Account appearance</h1>
    <section><h2>Account Bars</h2><p>Layout and scale for capacity bars.</p>
      <fieldset><legend>Layout</legend>{(['center', 'sides'] as const).map(value => <button type="button" key={value} aria-pressed={settings.barLayout === value} onClick={() => operations.layout(value)}>{value === 'center' ? 'Center' : 'Sides'}</button>)}</fieldset>
      <fieldset><legend>Skin (A/B)</legend>{(['classic', 'apple'] as const).map(value => <button type="button" key={value} aria-pressed={settings.accountSkin === value} onClick={() => operations.skin(value)}>{value === 'classic' ? 'Classic' : 'Apple'}</button>)}</fieldset>
      {settings.accountSkin === 'apple' ? <div className="wallet-account-style"><label htmlFor={`${id}-style`}>Bar style</label><select id={`${id}-style`} value={settings.accountBarStyle} onChange={event => {
        const value = event.currentTarget.value;
        if (value !== 'hairline' && value !== 'pips' && value !== 'twin' && value !== 'capsule' && value !== 'thread') throw new Error('ACCOUNT_BAR_STYLE_INVALID');
        operations.style(value);
      }}><option value="hairline">Hairline · line + dot</option><option value="pips">Pips · signal dots</option><option value="twin">Twin · out / in lines</option><option value="capsule">Capsule · iOS fill</option><option value="thread">Thread · fine + diamond</option></select></div> : null}
      <label className="wallet-account-scale" htmlFor={`${id}-scale`}><span>Scale</span><strong>100px = ${scale.toLocaleString('en-US')}</strong></label>
      <input id={`${id}-scale`} type="range" min="10" max="10000" step="10" value={scale} onChange={event => operations.scale(Number(event.currentTarget.value))} />
      <div className="wallet-account-scale-bounds"><span>$10</span><span>$10k</span></div>
    </section>
    <section><h2>Bar Effects</h2><p>Toggle visual effects on capacity bars.</p>
      {effects.map(([key, label, hint]) => <label className="wallet-account-effect" key={key} htmlFor={`${id}-${key}`}>
        <span>{label}<small>{hint}</small></span><input id={`${id}-${key}`} type="checkbox" checked={settings[key]} onChange={event => operations.effect(key, event.currentTarget.checked)} />
      </label>)}
    </section>
  </section>;
}
