'use client';

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useId, type ReactNode } from 'react';

// Shared building blocks used by every panel. Keep styling consistent here.
// EXPORTED NAMES and PROP SIGNATURES are a public API — do not change them.

export function PanelHeader({ title, subtitle, icon }: { title: string; subtitle?: string; icon?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3.5">
      {icon && (
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient-soft text-brand-2 ring-1 ring-inset ring-white/10">
          {icon}
        </div>
      )}
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-white/90">{title}</h2>
        {subtitle && <p className="text-[11px] text-white/40">{subtitle}</p>}
      </div>
    </div>
  );
}

export function Field({ label, hint, children, right }: { label: string; hint?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/45">{label}</label>
        {right}
      </div>
      {children}
      {hint && <p className="text-[10px] leading-relaxed text-white/30">{hint}</p>}
    </div>
  );
}

export function Slider({
  value,
  min,
  max,
  step = 0.01,
  onChange,
  label,
  display,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  label?: string;
  display?: string;
}) {
  // Filled portion of the track (clamped 0-100) for the CSS gradient.
  const pct = max > min ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 0;
  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-center justify-between text-[11px] text-white/50">
          <span>{label}</span>
          <span className="tabular-nums font-medium text-white/80">{display ?? value.toFixed(2)}</span>
        </div>
      )}
      <input
        type="range"
        className="w-full"
        style={{ ['--pct' as string]: `${pct}%` }}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
}) {
  const groupId = useId();
  return (
    <div className="flex gap-1 rounded-xl border border-white/[0.06] bg-black/20 p-1">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative flex-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors duration-150',
              active ? 'text-white' : 'text-white/45 hover:text-white/80',
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${groupId}`}
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                className="absolute inset-0 rounded-lg bg-brand-gradient shadow-glow-sm"
              />
            )}
            <span className="relative z-10">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-9 w-9 overflow-hidden rounded-lg border border-white/10 shadow-inner-hairline ring-1 ring-inset ring-black/30">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute -left-1 -top-1 h-12 w-12 cursor-pointer"
        />
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-24 rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-2 text-xs tabular-nums text-white/80 outline-none transition focus:border-brand/60 focus:ring-2 focus:ring-brand/20"
      />
    </div>
  );
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center rounded-lg border border-white/[0.06] bg-black/20 transition focus-within:border-brand/60 focus-within:ring-2 focus-within:ring-brand/20">
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full bg-transparent px-2.5 py-2 text-xs tabular-nums text-white/80 outline-none"
      />
      {suffix && <span className="pr-2.5 text-[10px] font-medium text-white/30">{suffix}</span>}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 text-xs text-white/80 outline-none transition placeholder:text-white/25 focus:border-brand/60 focus:ring-2 focus:ring-brand/20"
    />
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button onClick={() => onChange(!checked)} className="group flex items-center gap-2.5 text-xs text-white/70">
      <span
        className={cn(
          'relative h-5 w-9 rounded-full border transition-colors duration-200',
          checked
            ? 'border-transparent bg-brand-gradient shadow-glow-sm'
            : 'border-white/10 bg-white/[0.06] group-hover:bg-white/10',
        )}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 600, damping: 36 }}
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm',
            checked ? 'left-[18px]' : 'left-0.5',
          )}
        />
      </span>
      {label}
    </button>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  className,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  className?: string;
  disabled?: boolean;
}) {
  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors disabled:pointer-events-none disabled:opacity-40',
        variant === 'primary' &&
          'bg-brand-gradient text-white shadow-brand hover:brightness-110',
        variant === 'ghost' &&
          'border border-white/[0.08] bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white',
        variant === 'danger' &&
          'border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20',
        className,
      )}
    >
      {children}
    </motion.button>
  );
}

export function EmptyState({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      {icon && (
        <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/[0.06] bg-white/[0.03] text-white/25">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-white/55">{title}</p>
      {hint && <p className="max-w-[220px] text-[11px] leading-relaxed text-white/30">{hint}</p>}
    </div>
  );
}

export function ScrollArea({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex-1 space-y-5 overflow-y-auto p-4', className)}>{children}</div>;
}
