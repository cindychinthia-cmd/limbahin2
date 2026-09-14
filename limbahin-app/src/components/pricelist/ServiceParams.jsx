import React from 'react';
import { SPK_RANGES, RUTIN_OPTIONS, PTPB_FIXED_OPTIONS, PTPB_OPTIONS } from '@/data/pricelistData';
import { formatIDR, ptpbOptionLabel } from '@/lib/pricing';
import { StepIntro } from './fields';

function Question({ number, children }) {
  return (
    <p className="font-display text-sm font-bold">
      <span className="mr-1.5 text-primary">{number}.</span>
      {children}
    </p>
  );
}

export default function ServiceParams({ service, waste, location, params, onChange, constants, content }) {
  if (service === 'SPK') {
    const locs = content?.locations || [];
    const hasSpkmin = (locs.find((l) => l.name === location)?.available || []).includes('SPKMIN');
    const ranges = hasSpkmin ? SPK_RANGES : SPK_RANGES.filter((r) => r.tier);
    return (
      <div className="space-y-5">
        <StepIntro
          title="Parameter Tambahan"
          subtitle="Jawab pertanyaan berikut — pertanyaan berikutnya muncul setelah pertanyaan sebelumnya dijawab."
        />
        <div>
          <Question number={1}>Apakah butuh kontrak?</Question>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Dokumen kerjasama yang biasanya diminta berbagai instansi/lembaga.
          </p>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
            {[
              { value: true, label: 'Dengan Kontrak', desc: `Termasuk biaya MOU ${formatIDR(constants.mou)} per tahun` },
              { value: false, label: 'Tanpa Kontrak', desc: `Biaya transport + ${formatIDR(constants.noContractSurcharge)} per ritase` },
            ].map((opt) => {
              const active = params.needContract === opt.value;
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => onChange({ ...params, needContract: opt.value })}
                  className={`rounded-lg border p-3.5 text-left transition-colors ${
                    active ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'
                  }`}
                >
                  <span className="block text-sm font-bold">{opt.label}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">{opt.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
        {params.needContract != null && (
          <div>
            <Question number={2}>Jumlah limbah per pengambilan?</Question>
            <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ranges.map((r) => {
                const active = params.range === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onChange({ ...params, range: r.id })}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                      active ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card hover:border-primary/40'
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Catatan: jika jumlah limbah aktual Anda berada di bawah kuantitas minimum tier yang dipilih, biaya
              tetap dikenakan sebesar kuantitas minimum tier tersebut.
            </p>
          </div>
        )}
      </div>
    );
  }

  if (service === 'PTPB') {
    const opt = PTPB_FIXED_OPTIONS.find((o) => o.id === params.option);
    return (
      <div className="space-y-5">
        <StepIntro
          title="Parameter Tambahan"
          subtitle="Jawab pertanyaan berikut — pertanyaan berikutnya muncul setelah pertanyaan sebelumnya dijawab."
        />
        <div>
          <Question number={1}>Berapa jumlah limbah & lampu TL per ambil?</Question>
          <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PTPB_FIXED_OPTIONS.map((o) => {
              const active = params.option === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => onChange({ ...params, option: o.id, monthly: null, visits: null })}
                  className={`rounded-lg border px-3 py-2.5 text-left text-xs font-semibold transition-colors ${
                    active ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card hover:border-primary/40'
                  }`}
                >
                  {ptpbOptionLabel(o, waste)}
                </button>
              );
            })}
          </div>
        </div>
        {opt && (
          <div>
            <Question number={2}>Paket Tahunan atau Bulanan?</Question>
            <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
              {[
                { value: false, label: 'PAKET TAHUNAN', desc: 'Tidak diambil setiap bulan — kunjungan 2/4/6/9/12× per tahun' },
                { value: true, label: 'PAKET BULANAN', desc: 'Diambil setiap bulan — kunjungan 1/2/4× per bulan' },
              ].map((m) => {
                const active = params.monthly === m.value;
                return (
                  <button
                    key={String(m.value)}
                    type="button"
                    onClick={() => onChange({ ...params, monthly: m.value, visits: null })}
                    className={`rounded-lg border p-3.5 text-left transition-colors ${
                      active ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'
                    }`}
                  >
                    <span className="block text-sm font-bold">{m.label}</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">{m.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {opt && params.monthly != null && (
          <div>
            <Question number={3}>{params.monthly ? 'Berapa kali per bulan?' : 'Berapa kali dalam satu tahun?'}</Question>
            <div className="mt-2.5 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {(params.monthly ? PTPB_OPTIONS.bulan : PTPB_OPTIONS.tahun).map((v) => {
                const active = params.visits === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onChange({ ...params, visits: v })}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                      active ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card hover:border-primary/40'
                    }`}
                  >
                    {v}×
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (service === 'RUTIN') {
    return (
      <div className="space-y-5">
        <StepIntro
          title="Parameter Tambahan"
          subtitle="Pilih jumlah limbah per bulan — hanya opsi yang dipilih yang tampil di pricelist."
        />
        <div>
          <Question number={1}>Berapa jumlah limbah per bulan?</Question>
          <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {RUTIN_OPTIONS.map((o) => {
              const active = params.kg === o.kg;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => onChange({ ...params, kg: o.kg })}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                    active ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card hover:border-primary/40'
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return null;
}