import React from 'react';
import { Phone, Package, Repeat, Check } from 'lucide-react';
import { SERVICE_CARDS, SERVICE_ORDER } from '@/data/pricelistData';
import { availableServices } from '@/lib/pricing';
import { StepIntro } from './fields';
import ComparisonInfoButton from './ComparisonInfoButton';

const ICONS = { SPK: Phone, PTPB: Package, RUTIN: Repeat };

export default function ServiceStep({ location, waste, service, onService, content }) {
  const available = availableServices(location, waste, content);
  const services = content?.services || SERVICE_CARDS;
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <StepIntro title="Pilih Layanan" subtitle={`Layanan yang tersedia untuk ${waste} di ${location}.`} />
        <ComparisonInfoButton content={content} />
      </div>
      <div className="grid gap-2.5 sm:grid-cols-3">
        {SERVICE_ORDER.filter((id) => available.includes(id)).map((id) => {
          const s = services[id] || SERVICE_CARDS[id];
          const Icon = ICONS[id];
          const active = service === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onService(id)}
              className={`rounded-xl border p-4 text-left transition-colors ${
                active ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-bold leading-tight">
                  <Icon className="h-4 w-4 shrink-0 text-primary" />
                  {s.name}
                </span>
                {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{s.definisi}</p>
              <div className="mt-2 space-y-1">
                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  Kontrak: {s.kontrak} · Transport: {s.transport} · Limbah: {s.limbah}
                </p>
                <p className="text-[10px] font-medium leading-relaxed text-primary">Cocok untuk: {s.cocok}</p>
              </div>
            </button>
          );
        })}
      </div>
      {available.length === 0 && (
        <p className="rounded-lg border border-border bg-background p-3.5 text-xs text-muted-foreground">
          Tidak ada layanan tersedia untuk kombinasi lokasi & jenis limbah ini.
        </p>
      )}
    </div>
  );
}