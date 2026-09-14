import React, { useMemo, useState } from 'react';
import { Building2, Check, Mail, MapPin, Phone, Search, User } from 'lucide-react';
import { Field, FieldLabel, StepIntro } from '@/components/pricelist/fields';
import { normalizeIndoPhone } from '@/lib/phone';

export default function BasicDataStep({ company, location, locations, onCompany, onLocation }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? locations.filter((item) => item.name.toLowerCase().includes(needle)) : locations;
  }, [locations, query]);

  const set = (key) => (event) => onCompany({ ...company, [key]: event.target.value });
  const setPhone = (event) => onCompany({ ...company, phone: normalizeIndoPhone(event.target.value) });

  return (
    <div className="space-y-5">
      <StepIntro
        title="Data Dasar"
        subtitle="Isi kontak utama dan pilih Kota/Kecamatan pengambilan. Email wajib diisi untuk melanjutkan."
      />
      <Field label="Email" icon={Mail} type="email" value={company.email} onChange={set('email')} required />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nama Perusahaan" icon={Building2} value={company.name} onChange={set('name')} />
        <Field label="Nama PIC" icon={User} value={company.contact} onChange={set('contact')} />
      </div>
      <Field
        label="Nomor Kontak"
        icon={Phone}
        type="tel"
        value={company.phone}
        onChange={setPhone}
        placeholder="+62 812-3456-7890"
      />
      <div>
        <FieldLabel icon={Search} required>Kota / Kecamatan</FieldLabel>
        <input
          className="pl-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari lokasi dari konfigurasi pricelist…"
        />
        <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-border bg-card p-2">
          {filtered.length ? (
            <div className="space-y-1">
              {filtered.map((item) => {
                const active = location === item.name;
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => onLocation(item.name)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                      active ? 'bg-primary/10 text-primary' : 'hover:bg-secondary'
                    }`}
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="flex-1">{item.name}</span>
                    {active && <Check className="h-3.5 w-3.5" />}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="px-2 py-3 text-xs text-muted-foreground">Lokasi tidak ditemukan.</p>
          )}
        </div>
      </div>
    </div>
  );
}
