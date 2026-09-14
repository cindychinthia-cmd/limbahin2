import { jsPDF } from 'jspdf';
import { LOGO_BADGE_PNG } from '@/assets/logoBadgeBase64.js';
import { CS_WHATSAPP_DISPLAY } from '@/lib/contactConfig.js';

const CYAN = [86, 160, 178];
const TEAL = [24, 92, 108];
const DARK = [15, 35, 44];
const MUTED = [100, 116, 139];
const BORDER = [205, 216, 222];
const INK = [70, 80, 95];

const fmt = (v) => `IDR ${Math.round(v).toLocaleString('id-ID')}`;

// Builds the quote jsPDF document and returns it (without saving/downloading anything), so callers
// can either .save() it locally or turn it into base64/blob to send to the backend for emailing.
export function buildQuotePdfDoc(quote, company) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const M = 16;
  const CW = W - M * 2;
  let y = 0;

  const ensure = (h) => {
    if (y + h > 283) {
      doc.addPage();
      y = 20;
    }
  };

  // ---- Header band ----
  // Restored the original cyan header band (this is what the app used before the letterhead-image
  // experiment) — now with the round logo badge + "PT Media Cahaya Cerah" added, per your request.
  doc.setFillColor(...CYAN);
  doc.rect(0, 0, W, 36, 'F');
  doc.addImage(LOGO_BADGE_PNG, 'PNG', M, 6, 13, 13);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('LIMBAHIN', M + 16, 14.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('PRICE LIST & QUOTATION', M + 16, 20.5);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.text('PT Media Cahaya Cerah', M + 16, 25.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(doc.splitTextToSize(quote.serviceLabel || '', 82)[0] || '', W - M, 13, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(quote.code, W - M, 19, { align: 'right' });
  const dateLabel = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  doc.text(dateLabel, W - M, 24.5, { align: 'right' });

  // ---- Customer block ----
  y = 46;
  doc.setTextColor(...MUTED);
  doc.setFontSize(7);
  doc.text('DISIAPKAN UNTUK', M, y);
  doc.setTextColor(...DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(company.name || '-', M, y + 6.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  let addrY = y + 12;
  const addrLines = doc.splitTextToSize(company.address || '', CW / 2 - 12).slice(0, 3);
  addrLines.forEach((line) => {
    doc.text(line, M, addrY);
    addrY += 4.5;
  });
  doc.setTextColor(...MUTED);
  doc.text(`Kontak: ${company.contact || '-'}   |   ${company.phone || '-'}`, M, addrY + 0.5);
  y = Math.max(addrY + 8, y + 26);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.2);
  doc.line(M, y, W - M, y);
  y += 6;

  // ---- Summary grid (2 columns) ----
  const half = Math.ceil(quote.summary.length / 2);
  for (let i = 0; i < half; i += 1) {
    ensure(12);
    const a = quote.summary[i];
    const b = quote.summary[half + i];
    doc.setTextColor(...MUTED);
    doc.setFontSize(6.5);
    doc.text(String(a.label).toUpperCase(), M, y);
    doc.setTextColor(...DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(doc.splitTextToSize(String(a.value), 82)[0], M, y + 4.5);
    if (b) {
      doc.setTextColor(...MUTED);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.text(String(b.label).toUpperCase(), M + 95, y);
      doc.setTextColor(...DARK);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(doc.splitTextToSize(String(b.value), 80)[0], M + 95, y + 4.5);
    }
    y += 11;
  }
  y += 1;

  // ---- Layanan definisi ----
  ensure(16);
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('LAYANAN', M, y);
  doc.setTextColor(...INK);
  doc.setFontSize(7.5);
  const defLines = doc.splitTextToSize(quote.definisi, CW);
  defLines.forEach((line) => {
    ensure(5);
    doc.text(line, M, y + 4);
    y += 3.6;
  });
  y += 4;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.2);
  doc.line(M, y, W - M, y);
  y += 6;

  // ---- Items table ----
  const colItem = M + 7;
  const colHarga = M + 88;
  const colQtyR = M + 140;
  const colJmlR = W - M;
  ensure(8);
  doc.setTextColor(...MUTED);
  doc.setFontSize(6.5);
  doc.text('NO', M, y);
  doc.text('ITEM', colItem, y);
  doc.text('HARGA', colHarga, y);
  doc.text('QTY', colQtyR, y, { align: 'right' });
  doc.text('JUMLAH', colJmlR, y, { align: 'right' });
  y += 2.5;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(M, y, W - M, y);
  y += 5;

  quote.items.forEach((it, i) => {
    const nameLines = doc.splitTextToSize(it.item, 76).slice(0, 2);
    const defShort = doc.splitTextToSize(it.definisi, 76).slice(0, 2);
    const rowH = 6 + nameLines.length * 4 + defShort.length * 3.2;
    ensure(rowH);
    doc.setTextColor(...MUTED);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(String(i + 1), M, y);
    let ty = y;
    doc.setTextColor(...DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    nameLines.forEach((l) => {
      doc.text(l, colItem, ty);
      ty += 4;
    });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    doc.setFontSize(6.8);
    defShort.forEach((l) => {
      doc.text(l, colItem, ty);
      ty += 3.2;
    });
    doc.setFontSize(7.2);
    doc.setTextColor(...INK);
    const harga = it.harga < 0 ? `-${fmt(-it.harga)}` : fmt(it.harga);
    doc.text(`${harga} / ${it.unit.replace('per ', '')}`, colHarga, y);
    doc.text(it.qty == null ? '-' : String(it.qty), colQtyR, y, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...DARK);
    const amt = it.amount < 0 ? `-${fmt(-it.amount)}` : fmt(it.amount);
    doc.text(amt, colJmlR, y, { align: 'right' });
    y = Math.max(ty, y + 8) + 2.5;
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.15);
    doc.line(M, y - 3, W - M, y - 3);
  });
  y += 2;

  // ---- Total (hanya jika ada) ----
  if (quote.total != null) {
    ensure(16);
    doc.setFillColor(230, 242, 245);
    doc.rect(M, y, CW, 11, 'F');
    doc.setTextColor(...TEAL);
    doc.setFontSize(8);
    doc.text(String(quote.totalLabel || 'Total').toUpperCase(), M + 2, y + 7);
    doc.setFontSize(11.5);
    doc.text(fmt(quote.total), W - M - 2, y + 7.2, { align: 'right' });
    y += 18;
  }

  // ---- Notes ----
  const noteBlock = (title, body) => {
    if (!body) return;
    const lines = doc.splitTextToSize(body, CW);
    ensure(10 + lines.length * 3.4);
    doc.setTextColor(...MUTED);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text(title.toUpperCase(), M, y);
    y += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...INK);
    lines.forEach((l) => {
      doc.text(l, M, y);
      y += 3.4;
    });
    y += 3.5;
  };
  noteBlock(quote.notes.pelayananTitle, quote.notes.pelayanan);
  noteBlock('Catatan Limbah', quote.notes.limbah);
  noteBlock('Catatan Umum', quote.notes.global);

  // ---- Validitas & tanda tangan ----
  ensure(44);
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('DISETUJUI OLEH (KLIEN)', M, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...INK);
  doc.text('Jika setuju, silakan tanda tangani di ruang di bawah dan kirim dokumen ini kembali kepada kami.', M, y + 4.5);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.2);
  doc.line(M, y + 26, M + 80, y + 26);
  doc.setTextColor(...MUTED);
  doc.setFontSize(7);
  doc.text('Nama & tanda tangan klien', M, y + 30);
  y += 36;

  ensure(6);
  doc.setTextColor(...MUTED);
  doc.setFontSize(6.5);
  doc.text(`Dokumen ini dibuat pada ${dateLabel} dan berlaku selama 14 hari sejak tanggal dibuat.`, M, y);
  doc.text('Dokumen estimasi harga berdasarkan pricelist resmi - bukan invoice.', M, y + 4);
  doc.text(`Pertanyaan? Hubungi CS LIMBAHIN via WhatsApp: ${CS_WHATSAPP_DISPLAY}.`, M, y + 8);

  return doc;
}

// Filename shared by the local-download path and the "email me the PDF" path, so a user who does
// both ends up with matching file names.
export function quotePdfFilename(quote) {
  const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  return `${quote.code.replace(/\s+/g, '_')}_${ts}.pdf`;
}

// Kept for any other caller that still wants a direct browser download.
export function downloadQuotePdf(quote, company) {
  const doc = buildQuotePdfDoc(quote, company);
  doc.save(quotePdfFilename(quote));
}

// Base64-encodes the PDF (no data: URI prefix) so it can be sent as JSON to a Supabase Edge
// Function / API route for emailing, without ever touching the user's local disk.
export function getQuotePdfBase64(quote, company) {
  const doc = buildQuotePdfDoc(quote, company);
  return doc.output('datauristring').split(',')[1];
}