import React from 'react';
import { Switch } from '@/components/ui/switch';

export function FieldLabel({ icon: Icon, required, children }) {
  return (
    <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {children}
      {required && <span className="text-destructive normal-case">*</span>}
    </span>
  );
}

export function Field({ label, icon, required, className = '', ...props }) {
  return (
    <label className="block">
      <FieldLabel icon={icon} required={required}>{label}</FieldLabel>
      <input className={`pl-input ${className}`} required={required} {...props} />
    </label>
  );
}

export function AreaField({ label, icon, required, rows = 3, ...props }) {
  return (
    <label className="block">
      <FieldLabel icon={icon} required={required}>{label}</FieldLabel>
      <textarea rows={rows} className="pl-input resize-none" required={required} {...props} />
    </label>
  );
}

export function SelectField({ label, icon, required, children, ...props }) {
  return (
    <label className="block">
      <FieldLabel icon={icon} required={required}>{label}</FieldLabel>
      <select className="pl-input" required={required} {...props}>
        {children}
      </select>
    </label>
  );
}

export function ToggleRow({ checked, onCheckedChange, title, description }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="mt-0.5 shrink-0" />
    </div>
  );
}

export function InfoCard({ children }) {
  return (
    <div className="flex gap-2.5 rounded-lg border border-border bg-background p-4 text-xs leading-relaxed text-muted-foreground">
      <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden />
      <p>{children}</p>
    </div>
  );
}

// Reusable A/B (or more) choice-card group — same visual language as ServiceStep's service
// cards, used throughout the registration/contract wizard (manifest, jenis kontrak, fisik
// kontrak, etc.) so those choices look consistent with the rest of the app.
export function ChoiceCard({ options, value, onChange }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`rounded-xl border p-4 text-left transition-colors ${
              active ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'
            }`}
          >
            <p className="text-sm font-bold leading-tight">{opt.label}</p>
            {opt.desc && <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{opt.desc}</p>}
          </button>
        );
      })}
    </div>
  );
}

export function SectionTitle({ children, required }) {
  return (
    <p className="font-display text-sm font-bold text-primary">
      {children}
      {required && <span className="text-destructive"> *</span>}
    </p>
  );
}

// Shown near the top of long, unsaved forms (the quotation wizard, the registration form) so
// people don't lose their progress by refreshing/closing the tab mid-way — nothing here is saved
// until the final "Kirim" button succeeds.
export function NoRefreshWarning() {
  return (
    <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
      ⚠️ Data belum tersimpan sampai berhasil dikirim — jangan refresh atau tutup halaman ini, isian dapat hilang.
    </p>
  );
}

export function StepIntro({ title, subtitle }) {
  return (
    <div>
      <h3 className="font-display text-lg font-bold leading-tight">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
    </div>
  );
}