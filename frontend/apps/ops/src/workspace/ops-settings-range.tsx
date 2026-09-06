export function SettingsRange({ label, value, min, max, step, onChange }: Readonly<{
  label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void;
}>) {
  return <label className="ops-settings-range"><span>{label}<output>{value}</output></span>
    <input aria-label={label} type="range" value={value} min={min} max={max} step={step} onChange={event => onChange(Number(event.currentTarget.value))} />
  </label>;
}
