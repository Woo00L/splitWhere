import { Minus, Plus } from 'lucide-react';
import type { ReactNode } from 'react';

export function Stepper({ label, value, onChange, max = 20 }: { label: string; value: number; onChange: (v: number) => void; max?: number }) {
  return <label className="stepper-field"><span>{label}</span><div className="stepper">
    <button type="button" aria-label={`减少${label}`} disabled={value <= 1} onClick={() => onChange(value - 1)}><Minus size={14} /></button>
    <input aria-label={label} type="number" min={1} max={max} value={value} onChange={e => {
      if (e.target.value !== '') onChange(Math.min(max, Math.max(1, Math.round(Number(e.target.value)))));
    }} />
    <button type="button" aria-label={`增加${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}><Plus size={14} /></button>
  </div></label>;
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-label={label} aria-checked={checked} className={`switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}><span /></button>;
}

export function Segments<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void;
}) {
  return <div className="segments" role="group" aria-label={label}>{options.map(option =>
    <button type="button" aria-pressed={value === option.value} className={value === option.value ? 'active' : ''} key={option.value} onClick={() => onChange(option.value)}>{option.label}</button>
  )}</div>;
}

export function GridIcon({ cols, rows }: { cols: number; rows: number }) {
  return <span className="grid-icon" style={{ gridTemplateColumns: `repeat(${cols},1fr)`, gridTemplateRows: `repeat(${rows},1fr)` }}>{Array.from({ length: cols * rows }, (_, i) => <i key={i} />)}</span>;
}
