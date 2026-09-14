import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, SlidersHorizontal, FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/settings/SettingsContext';
import { FieldLabel } from '@/components/pricelist/fields';
import { formatIDR } from '@/lib/pricing';

function ValueRow({ label, value }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
      <FieldLabel>{label}</FieldLabel>
      <p className="mt-0.5 font-display text-sm font-bold tabular-nums">{value}</p>
    </div>
  );
}

const MONEY_GROUPS = [
  {
    title: 'Kontrak & Biaya Tetap',
    items: [
      { key: 'mou', label: 'Biaya MOU / kontrak non-paket (per tahun)' },
      { key: 'ptpbContract', label: 'Biaya kontrak paket PTPB (per tahun)' },
      { key: 'contractRevisionFee', label: 'Biaya revisi kontrak ke-2 dst. (per kontrak)' },
      { key: 'lampuTLInPaket', label: 'Lampu TL dalam paket (per kg)' },
      { key: 'lampuTLOutPaket', label: 'Lampu TL di luar paket (per kg)' },
    ],
  },
  {
    title: 'Transport & Surcharge',
    items: [
      { key: 'noContractSurcharge', label: 'Tambahan transport tanpa kontrak (per ritase)' },
      { key: 'extraPointFee', label: 'Titik ambil tambahan <25 km (per ritase)' },
    ],
  },
];

const FORMULA_GROUPS = [
  {
    title: 'Rumus SPKMAX — rantai harga per kg',
    items: [
      { key: 'spkmaxMinusRate', label: 'Multiplier tier berikutnya', money: false },
      { key: 'spkmaxMinusConstant', label: 'Pengurang tetap per tier', money: true },
      { key: 'spkmaxMround', label: 'Pembulatan MROUND (kelipatan)', money: true },
    ],
  },
  {
    title: 'Rumus RUTIN — rantai harga per kg',
    items: [
      { key: 'rutinMinusRate', label: 'Multiplier tier berikutnya', money: false },
      { key: 'rutinMinusConstant', label: 'Pengurang tetap per tier', money: true },
      { key: 'rutinMround', label: 'Pembulatan MROUND (kelipatan)', money: true },
    ],
  },
];

export default function Settings() {
  const { location } = useParams();
  const { constants, content, loading, error, configName } = useSettings();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
    );
  }

  if (error) {
    const messages = {
      'not-configured': 'Supabase belum terhubung (env var VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY belum diisi).',
      'no-active-row': 'Tidak ada konfigurasi pricelist yang aktif di Supabase (tabel pricelist_configs, active = true).',
      error: `Gagal memuat data dari Supabase: ${error.message || 'terjadi kesalahan.'}`,
    };
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center font-body text-foreground">
        <div className="max-w-sm">
          <FileQuestion className="mx-auto h-10 w-10 text-destructive" />
          <p className="mt-3 font-display text-sm font-bold">Data tidak tersedia</p>
          <p className="mt-2 text-xs text-muted-foreground">{messages[error.status] || messages.error}</p>
        </div>
      </div>
    );
  }

  const isValidLocation = (content.locations || []).some(
    (l) => l.name.toLowerCase() === decodeURIComponent(location || '').toLowerCase()
  );

  if (!isValidLocation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 font-body text-foreground">
        <div className="max-w-sm text-center">
          <FileQuestion className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-display text-sm font-bold">Halaman tidak ditemukan</p>
          <Link to="/" className="mt-4 inline-block">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Kembali ke Pricelist
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-body text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-sm font-bold tracking-tight">Konstanta Rumus (Read-only)</p>
            <p className="text-[11px] text-muted-foreground">Sumber: Supabase — &quot;{configName}&quot;</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <Link to="/">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Kembali
          </Button>
        </Link>

        {MONEY_GROUPS.map((group) => (
          <section key={group.title} className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-display text-sm font-bold">{group.title}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {group.items.map((item) => (
                <ValueRow key={item.key} label={item.label} value={formatIDR(constants[item.key])} />
              ))}
            </div>
          </section>
        ))}

        {FORMULA_GROUPS.map((group) => (
          <section key={group.title} className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-display text-sm font-bold">{group.title}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {group.items.map((item) => (
                <ValueRow
                  key={item.key}
                  label={item.label}
                  value={item.money ? formatIDR(constants[item.key]) : constants[item.key]}
                />
              ))}
            </div>
          </section>
        ))}

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="font-display text-sm font-bold">Transport — biaya dasar per kendaraan (jarak &amp; kendaraan)</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Biaya transport per ritase = biaya dasar (mencakup {constants.minimumDistanceKm} km pertama) + biaya per km
            × sisa jarak lokasi. Harga PAKET = biaya transport &quot;CDE 2-3 Ton&quot; pada jarak lokasi, dibagi{' '}
            {constants.paketDivisor}.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-1.5 pr-3 font-semibold">Kendaraan</th>
                  <th className="py-1.5 pr-3 font-semibold">Biaya Dasar</th>
                  <th className="py-1.5 pr-3 font-semibold">Biaya / km tambahan</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(content.vehicleRates).map(([vehicle, rate]) => (
                  <tr key={vehicle} className="border-t border-border">
                    <td className="py-1.5 pr-3 font-semibold">{vehicle}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{formatIDR(rate.basedCost)}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{formatIDR(rate.costPerKm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="font-display text-sm font-bold">Diskon Transport PTPB (per kunjungan)</h2>
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            {[
              { period: 'ptpbDiscountTahunan', label: 'Paket Tahunan', visits: [2, 4, 6, 9, 12] },
              { period: 'ptpbDiscountBulanan', label: 'Paket Bulanan', visits: [1, 2, 4] },
            ].map(({ period, label, visits }) => (
              <div key={period}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                <div className="grid grid-cols-3 gap-2">
                  {visits.map((v) => (
                    <ValueRow key={v} label={`${v}×`} value={formatIDR(constants[period][v])} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="font-display text-sm font-bold">Lokasi ({content.locations.length})</h2>
          <div className="mt-4 max-h-80 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="sticky top-0 bg-card text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-1.5 pr-3 font-semibold">Kota / Kabupaten</th>
                  <th className="py-1.5 pr-3 font-semibold">Jarak (km)</th>
                  <th className="py-1.5 pr-3 font-semibold">Layanan Tersedia</th>
                </tr>
              </thead>
              <tbody>
                {content.locations.map((loc) => (
                  <tr key={loc.name} className="border-t border-border">
                    <td className="py-1.5 pr-3 font-semibold">{loc.name}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{loc.distanceKm}</td>
                    <td className="py-1.5 pr-3">{loc.available.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Semua nilai di halaman ini hanya untuk dilihat. Untuk mengubah, edit langsung di Supabase pada tabel{' '}
          <code>pricelist_configs</code> — baris dengan <code>active = true</code> yang dipakai aplikasi ini. Anda
          bisa membuat beberapa baris/draft sekaligus; ganti baris mana yang <code>active</code> untuk mengganti
          harga yang berlaku, tanpa mengubah kode aplikasi.
        </p>
      </main>
    </div>
  );
}
