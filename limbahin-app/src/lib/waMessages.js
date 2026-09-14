import { buildPricelistSummaryText } from '@/lib/pricing';

const line = (label, value) => `${label}: ${value || '-'}`;

// Itemized, price-list-accurate summary (item name, price, unit, qty, subtotal + notes) used in
// both the CS-facing WhatsApp message and the registration email — see
// lib/pricing.js#buildPricelistSummaryText for why this replaced the old label/value-only list.
function quoteSummaryLines(quote) {
  if (!quote) return [];
  const lines = [line('Kode Penawaran', quote.code)];
  const summaryText = buildPricelistSummaryText(quote);
  if (summaryText) lines.push(...summaryText.split('\n'));
  return lines;
}

// Sent when the customer taps "Request Kirim Penawaran" on the quotation step.
export function buildQuotationWhatsAppMessage({ company, quote, email }) {
  const parts = [
    'Halo CS LIMBAHIN, saya baru saja mengisi form Quotation di web dan meminta penawaran dikirim ke email.',
    '',
    '*Data Perusahaan*',
    line('Nama Perusahaan', company?.name),
    line('Nama Kontak', company?.contact),
    line('No. Kontak', company?.phone),
    line('Email', email),
    '',
    '*Detail Penawaran*',
    ...quoteSummaryLines(quote),
    '',
    'Mohon info lebih lanjut. Terima kasih.',
  ];
  return parts.join('\n');
}

// Sent when the customer taps the final "Request Kirim Kontrak" button on the registration step.
// Includes the original quotation summary PLUS every field collected in the registration form
// so CS/kontrak team has the full picture without needing to ask again.
export function buildRegistrationWhatsAppMessage({ company, quote, registration, email }) {
  const r = registration || {};
  const picExtra = [];
  if (r.picOperasionalNama || r.picOperasionalTel) {
    picExtra.push(line('PIC Operasional', `${r.picOperasionalNama || '-'} (${r.picOperasionalTel || '-'})`));
  }
  if (r.picKeuanganNama || r.picKeuanganTel) {
    picExtra.push(line('PIC Keuangan', `${r.picKeuanganNama || '-'} (${r.picKeuanganTel || '-'})`));
  }
  if (r.catatanTambahanPic || r.picLain) picExtra.push(line('Catatan Tambahan', r.catatanTambahanPic || r.picLain));

  const parts = [
    'Halo CS/Kontrak LIMBAHIN, saya sudah mengisi Form Pendaftaran (MOU/Kontrak) di web dan meminta draf kontrak dikirim ke email.',
    '',
    '*Ringkasan Penawaran*',
    ...quoteSummaryLines(quote),
    '',
    '*Data Perusahaan*',
    line('Nama Perusahaan', r.namaPerusahaan || company?.name),
    line('NPWP & Kode Faktur', r.npwp),
    line('Industri & Bidang', r.industriBidang),
    line('Alamat Limbah', r.alamatLimbah),
    line('Alamat Dokumen', r.alamatDokumen || 'Sama dengan alamat limbah'),
    line('No. Telp Perusahaan', r.telpPerusahaan),
    line('Email Perusahaan', r.emailPerusahaan || email),
    '',
    '*Penanggung Jawab Utama*',
    line('Nama Lengkap', r.pjNama),
    line('Jabatan', r.pjJabatan),
    '',
    '*Manifest / Festronik*',
    line('Pilihan', r.manifestPilihan === 'festronik' ? 'B. Menggunakan Festronik' : 'A. Hanya Manifest'),
    ...picExtra,
    '',
    '*Fisik Kontrak*',
    line('Fisik Kontrak', r.fisikKontrak === 'mekari' ? 'B. Mekari (E-Kontrak)' : 'A. Dicetak Fisik'),
    '',
    '*Tanggal & Durasi Kontrak*',
    line('Mulai', r.tanggalMulaiKontrak),
    line('Durasi', r.durasiKontrakTahun ? `${r.durasiKontrakTahun} Tahun` : ''),
    line('Akhir', r.tanggalAkhirKontrak),
    '',
    line('KODE INSTRUKSI', r.instructionCode),
    '',
    '*Rincian Pelayanan & Harga*',
    r.rincianPelayanan || '-',
    '',
    'Mohon dibuatkan draf kontrak & MOU-nya. Terima kasih.',
  ];
  return parts.join('\n');
}
