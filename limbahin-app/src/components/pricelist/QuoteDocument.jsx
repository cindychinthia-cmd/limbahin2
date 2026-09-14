import React from 'react';
import { FileText } from 'lucide-react';
import { formatIDR } from '@/lib/pricing';

const fmtAmount = (v) => (v < 0 ? `−${formatIDR(-v)}` : formatIDR(v));

function NoteBlock({ title, body }) {
  if (!body) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</p>
      <p className="mt-1 whitespace-pre-line text-[11px] leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

export default function QuoteDocument({ quote, company }) {
  if (!quote) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <FileText className="h-8 w-8 text-muted-foreground/40" />
        <p className="font-display text-sm font-bold">Price List &amp; Quotation</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          Dokumen price list akan muncul di langkah terakhir setelah semua parameter diisi.
        </p>
      </div>
    );
  }

  const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* On narrow (mobile) screens the document is wider than the viewport — instead of letting
          the outer `overflow-hidden` above silently crop it, this inner wrapper scrolls
          horizontally so every column (table, summary grid, etc.) stays reachable by swiping. */}
      <div className="overflow-x-auto">
      <div className="min-w-[640px]">
      <div className="flex items-start justify-between gap-4 bg-primary px-5 py-4 text-primary-foreground">
        <div>
          <p className="font-display text-base font-bold leading-tight">LIMBAHIN</p>
          <p className="text-[10px] uppercase tracking-widest opacity-80">Price List &amp; Quotation</p>
        </div>
        <div className="text-right">
          <p className="font-display text-sm font-bold leading-tight">{quote.serviceLabel}</p>
          <p className="mt-0.5 text-[10px] opacity-90">{quote.code}</p>
          <p className="text-[10px] opacity-90">{today}</p>
        </div>
      </div>

      <div className="grid gap-4 border-b border-border px-5 py-4 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Disiapkan untuk</p>
          <p className="mt-1 font-display text-sm font-bold">{company?.name || '—'}</p>
          <p className="mt-0.5 whitespace-pre-line text-xs text-muted-foreground">{company?.address}</p>
        </div>
        <div className="sm:text-right">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Kontak</p>
          <p className="mt-1 text-xs font-semibold">{company?.contact || '—'}</p>
          <p className="text-xs text-muted-foreground">{company?.phone}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-b border-border px-5 py-4 sm:grid-cols-3">
        {quote.summary.map((s) => (
          <div key={s.label}>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className="mt-0.5 text-xs font-semibold">{s.value}</p>
          </div>
        ))}
        <div className="col-span-2 sm:col-span-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Pelayanan</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{quote.definisi}</p>
        </div>
      </div>

      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground">
            <th className="px-5 py-2 font-semibold">No</th>
            <th className="py-2 font-semibold">Item</th>
            <th className="py-2 font-semibold">Harga</th>
            <th className="py-2 text-right font-semibold">Qty</th>
            <th className="px-5 py-2 text-right font-semibold">Jumlah</th>
          </tr>
        </thead>
        <tbody>
          {quote.items.map((it, i) => (
            <tr key={i} className="border-b border-border/60 align-top">
              <td className="px-5 py-2.5 text-muted-foreground">{i + 1}</td>
              <td className="py-2.5 pr-2">
                <p className="font-semibold">{it.item}</p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{it.definisi}</p>
              </td>
              <td className="py-2.5 pr-2 tabular-nums">
                {fmtAmount(it.harga)} <span className="text-muted-foreground">/ {it.unit.replace('per ', '')}</span>
              </td>
              <td className="py-2.5 text-right tabular-nums">{it.qty == null ? '—' : it.qty.toLocaleString('id-ID')}</td>
              <td className="px-5 py-2.5 text-right font-semibold tabular-nums">{fmtAmount(it.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {quote.total != null && (
        <div className="flex items-center justify-between border-t-2 border-primary bg-primary/5 px-5 py-3">
          <p className="text-xs font-semibold text-primary">{quote.totalLabel}</p>
          <p className="font-display text-lg font-bold tabular-nums text-primary">{formatIDR(quote.total)}</p>
        </div>
      )}

      <div className="space-y-3 border-t border-border px-5 py-4">
        <NoteBlock title={quote.notes.pelayananTitle} body={quote.notes.pelayanan} />
        <NoteBlock title="Catatan Limbah" body={quote.notes.limbah} />
        <NoteBlock title="Catatan Umum" body={quote.notes.global} />
      </div>
      <div className="border-t border-border px-5 py-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Disetujui oleh</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Jika setuju, silakan tanda tangani di ruang di bawah dan kirim dokumen ini kembali kepada kami.
        </p>
        <div className="mt-12 border-t border-border pt-1.5 text-[10px] text-muted-foreground">
          Nama &amp; tanda tangan klien · Tanggal: ……………………
        </div>
      </div>
      <p className="border-t border-border px-5 py-3 text-[10px] leading-relaxed text-muted-foreground">
        Dokumen ini dibuat pada {today} dan berlaku selama 14 hari sejak tanggal dibuat. Dokumen estimasi harga
        berdasarkan pricelist resmi — bukan invoice.
      </p>
      </div>
      </div>
    </div>
  );
}