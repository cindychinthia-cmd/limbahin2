import React, { useState } from 'react';
import { Check, MapPin, Search } from 'lucide-react';
import { WASTE_TYPES } from '@/data/pricelistData';
import { FieldLabel, StepIntro } from './fields';

export default function LocationWasteStep({
  location,
  waste,
  onLocation,
  onWaste,
  content,
  hideLocation = false,
}) {
  const [query, setQuery] = useState('');
  const wasteTypes = content?.wasteTypes || WASTE_TYPES;
  const locations = content?.locations || [];
  const filtered = query.trim()
    ? locations.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()))
    : locations;

  return (
    <div className="space-y-5">
      <StepIntro
        title={hideLocation ? 'Pilih Jenis Limbah' : 'Lokasi & Jenis Limbah'}
        subtitle={hideLocation
          ? `Jenis limbah untuk lokasi ${location}.`
          : 'Pilih lokasi terlebih dahulu. Jenis limbah baru tampil setelah lokasi dipilih.'}
      />

      {!hideLocation && (
        <div>
          <FieldLabel icon={Search}>Cari Lokasi</FieldLabel>
          <input
            className="pl-input"
            placeholder="Ketik nama kota / kabupaten…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-border bg-card p-2">
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">Lokasi tidak ditemukan.</p>
            ) : (
              <div className="space-y-1">
                {filtered.map((item) => {
                  const active = location === item.name;
                  return (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => onLocation(item.name)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                        active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-secondary'
                      }`}
                    >
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="flex-1">{item.name}</span>
                      {active && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {location ? (
        <div>
          <FieldLabel>Pilih Jenis Limbah Anda</FieldLabel>
          <p className="mb-2.5 text-[11px] text-muted-foreground">
            Satu jenis limbah per dokumen price list — pilih jenis limbah utama Anda.
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {wasteTypes.map((item) => {
              const active = waste === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onWaste(item.id)}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    active ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-sm font-bold tracking-wide text-primary">{item.id}</span>
                    {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </div>
                  <p className="mt-1 text-xs font-semibold">{item.header}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{item.definisi}</p>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
          Pilih lokasi terlebih dahulu untuk menampilkan jenis limbah.
        </p>
      )}
    </div>
  );
}
