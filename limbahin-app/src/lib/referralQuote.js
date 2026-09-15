import { formatIDR } from '@/lib/pricing';

// Converts one referal_model row into the regular quote shape. New rows store multiple line items
// in items jsonb; legacy single-item columns are still read during the migration window.
export function buildReferralQuote(row, multiplier = 1) {
  if (!row) return null;

  const sourceItems = Array.isArray(row.items) && row.items.length
    ? row.items
    : [{
        item: row.item_title,
        description: row.item_description,
        harga: row.harga,
        unit: row.unit,
        qty: row.qty,
        jumlah: row.jumlah,
      }];

  const items = sourceItems.map((source, index) => {
    const rawPrice = Number(source.harga || 0);
    const qty = source.qty == null || source.qty === '' ? null : Number(source.qty);
    const rawAmount = source.jumlah == null || source.jumlah === ''
      ? (qty == null ? rawPrice : rawPrice * qty)
      : Number(source.jumlah);
    return {
      item: source.item || source.title || `Item ${index + 1}`,
      definisi: source.description || source.definisi || '',
      harga: Math.round(rawPrice * multiplier),
      unit: source.unit || '-',
      qty,
      amount: Math.round(rawAmount * multiplier),
    };
  });
  const total = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return {
    service: 'REFERAL',
    serviceLabel: 'Penawaran Kode Referal',
    code: `LIMBAHIN-REF-${(row.code || '').toUpperCase()}`,
    vehicle: null,
    definisi: row.description || 'Penawaran khusus berdasarkan kode referal.',
    summary: [
      { label: 'Kode Referal', value: (row.code || '').toUpperCase() },
      { label: 'Lokasi Pelayanan', value: row.lokasi_pelayanan || '-' },
      { label: 'Jenis Limbah', value: row.jenis_limbah || '-' },
    ],
    items,
    total,
    totalLabel: 'Total',
    notes: {
      pelayananTitle: 'Catatan Pelayanan',
      pelayanan: row.catatan_pelayanan || '',
      limbah: row.catatan_limbah || '',
      global: '',
    },
    _referralRow: row,
    _totalDisplay: formatIDR(total),
  };
}
