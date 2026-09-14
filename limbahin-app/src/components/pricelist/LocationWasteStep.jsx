import React, { useState } from 'react';
import { MapPin, Search, Check } from 'lucide-react';
import { WASTE_TYPES } from '@/data/pricelistData';
import { FieldLabel, StepIntro } from './fields';

export default function LocationWasteStep({ location, waste, onLocation, onWaste, content }) {
  const [query, setQuery] = useState('');
  const wasteTypes = content?.wasteTypes || WASTE_TYPES;
  const locations = content?.locations || [];
  const filtered = query.trim()
    ? locations.filter((l) => l.name.toLowerCase().includes(query.trim().toLowerCase()))
    : locations;

  return (
    <div className="space-y-5">
      <StepIntro title="Lokasi & Jenis Limbah" subtitle="Cari lokasi pengambilan limbah Anda, lalu pilih jenis limbah." />

      <div>
        <FieldLabel icon={Search}>Cari Lokasi</FieldLabel>
        <input
          className="pl-input"
          placeholder="Ketik nama kota / kabupaten…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-border bg-card p-2">
          {filtered.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">Lokasi tidak ditemukan.</p>
          ) : (
            <div className="space-y-1">
              {filtered.map((l) => {
                const active = location === l.name;
                return (
                  <button
                    key={l.name}
                    type="button"
                    onClick={() => onLocation(l.name)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                      active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-secondary'
                    }`}
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1">{l.name}</span>
                    {active && <Check className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div>
        <FieldLabel>Pilih Jenis Limbah Anda</FieldLabel>
        <p className="mb-2.5 text-[11px] text-muted-foreground">
          Satu jenis limbah per dokumen price list — pilih jenis limbah utama Anda.
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {wasteTypes.map((w) => {
            const active = waste === w.id;
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => onWaste(w.id)}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  active ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-sm font-bold tracking-wide text-primary">{w.id}</span>
                  {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </div>
                <p className="mt-1 text-xs font-semibold">{w.header}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{w.definisi}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}