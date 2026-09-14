import React from 'react';
import { Building2, MapPin, User, Phone, Ticket, Loader2, CheckCircle2 } from 'lucide-react';
import { Field, AreaField, FieldLabel, StepIntro } from './fields';
import { normalizeIndoPhone } from '@/lib/phone';

export default function CompanyStep({
  company,
  onChange,
  referral,
  onReferral,
  referralError,
  referralChecking,
  referralFound,
}) {
  const set = (key) => (e) => onChange({ ...company, [key]: e.target.value });
  const setPhone = (key) => (e) => onChange({ ...company, [key]: normalizeIndoPhone(e.target.value) });
  return (
    <div className="space-y-4">
      <StepIntro
        title="Detail Perusahaan"
        subtitle="Opsional — data perusahaan akan tercantum pada dokumen; boleh dikosongkan jika ingin dilewati."
      />
      <Field label="Nama Perusahaan" icon={Building2} value={company.name} onChange={set('name')} placeholder="PT Contoh Sejahtera" />
      <AreaField
        label="Alamat Lengkap"
        icon={MapPin}
        rows={2}
        value={company.address}
        onChange={set('address')}
        placeholder="Jl. Contoh No. 1, Jakarta"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nama Kontak" icon={User} value={company.contact} onChange={set('contact')} placeholder="Nama PIC" />
        <Field
          label="Nomor Kontak"
          icon={Phone}
          type="tel"
          value={company.phone}
          onChange={setPhone('phone')}
          onFocus={(e) => {
            if (!e.target.value) onChange({ ...company, phone: '+62 ' });
          }}
          placeholder="+62 812-3456-7890"
        />
      </div>
      <div>
        <FieldLabel icon={Ticket}>Kode Referal</FieldLabel>
        <input
          className="pl-input"
          placeholder="Kosongkan untuk alur normal"
          value={referral}
          onChange={(e) => onReferral(e.target.value)}
        />
        {referralChecking ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Memeriksa kode referal...
          </p>
        ) : referralFound ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-primary">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Kode referal ditemukan — lanjut untuk melihat penawaran khusus Anda.
          </p>
        ) : referralError ? (
          <p className="mt-1.5 text-[11px] font-medium text-destructive">Kode referal tidak ditemukan.</p>
        ) : (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Isi Kode Referal anda untuk fitur tambahan.
          </p>
        )}
      </div>
    </div>
  );
}
