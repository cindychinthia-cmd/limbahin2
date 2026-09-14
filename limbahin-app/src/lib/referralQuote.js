import { formatIDR } from '@/lib/pricing';

// Turns a single `referal_model` Supabase row into the same `quote` shape that computeQuote()
// produces, so QuoteDocument.jsx and lib/pdf.js can render it with zero changes.
//
// `multiplier` is the ?param= price modifier (see lib/paramRule.js) — applied the same way it is
// for the normal pricing engine, so a referral quote link still respects ?param=.
export function buildReferralQuote(row, multiplier = 1) {
  if (!row) return null;

  const harga = Math.round(Number(row.harga || 0) * multiplier);
  const qty = row.qty != null ? Number(row.qty) : null;
  const jumlahRaw = row.jumlah != null ? Number(row.jumlah) : qty != null ? Number(row.harga || 0) * qty : harga;
  const amount = Math.round(jumlahRaw * multiplier);

  const item = {
    item: row.item_title || 'Item',
    definisi: row.item_description || '',
    harga,
    unit: row.unit || '-',
    qty,
    amount,
  };

  return {
    service: 'REFERAL',
    serviceLabel: 'Penawaran Kode Referal',
    code: `LIMBAHIN-REF-${(row.code || '').toUpperCase()}`,
    vehicle: null,
    definisi: row.item_description || 'Penawaran khusus berdasarkan kode referal.',
    summary: [
      { label: 'Kode Referal', value: (row.code || '').toUpperCase() },
      { label: 'Lokasi Pelayanan', value: row.lokasi_pelayanan || '-' },
      { label: 'Jenis Limbah', value: row.jenis_limbah || '-' },
    ],
    items: [item],
    total: amount,
    totalLabel: 'Total',
    notes: {
      pelayananTitle: 'Catatan Pelayanan',
      pelayanan: row.catatan_pelayanan || '',
      limbah: row.catatan_limbah || '',
      global: '',
    },
    // Kept for the WhatsApp / email summary text.
    _referralRow: row,
    _totalDisplay: formatIDR(amount),
  };
}
