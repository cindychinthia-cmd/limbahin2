/**
 * ============================================================
 *  LIMBAHIN Web App Backend — Apps Script
 *  Bound to a NEW Google Sheet (does NOT touch "3.Branch" or anything in the original MCC
 *  Document Generator script — that script and this one can coexist untouched).
 *
 *  Deploy this as a Web App (Deploy > New deployment > Web app, execute as "Me", access
 *  "Anyone"), then put the resulting /exec URL into the React app's VITE_APPS_SCRIPT_URL.
 *
 *  What it does, end to end:
 *
 *  1. `doPost` — called by the React app (src/lib/appsScript.js) with either:
 *       { action: "quotation",   payload: {...} }   — Step 5 "Request Kirim Penawaran"
 *       { action: "registration", payload: {...} }  — /registrasi "Request Kirim Kontrak"
 *
 *     "quotation":
 *       a. Appends a row to the "Quotations" sheet tab.
 *       b. Upserts the same row into Supabase's `quotations` table (service-role key, so RLS
 *          never has to allow anon inserts for this table at all).
 *       c. Emails the client-built quotation PDF (already base64-encoded by the browser) via
 *          GmailApp — To: kontrak@, Cc: kelvin, Bcc: the customer.
 *
 *     "registration":
 *       a. Appends a row to the "Registrations" sheet tab.
 *       b. Generates the contract draft(s) (.docx copy + PDF) for `registration.instructionCode`
 *          — one instruction code can mean MORE than one document (e.g. PKSTJS = an SPK doc +
 *          a TJS contract; see INSTRUCTION_DOC_GROUPS) — reusing the exact template-filling
 *          approach from the original MCC Document Generator script (createFile()), just
 *          parameterized from the web submission instead of a row on "3.Branch" + a UI prompt.
 *       c. Upserts the row (now including the generated Drive links) into Supabase's
 *          `registrations` table.
 *       d. Emails every generated PDF + docx immediately — To: kontrak@, Cc: kelvin,
 *          Bcc: the customer.
 *
 *  2. `installEditTrigger` (run once, manually, from the Apps Script editor) sets up an
 *     installable onEdit trigger (`onEditInstallable_`) so that whenever someone edits a row
 *     directly on the "Quotations" or "Registrations" tab, that row gets pushed back to
 *     Supabase too — keeping the sheet and Supabase in sync in both directions.
 *
 *  Setup checklist:
 *    - Script Properties (Project Settings > Script Properties):
 *        SUPABASE_URL                 = https://xxxxx.supabase.co
 *        SUPABASE_SERVICE_ROLE_KEY    = <service role key, NOT the anon key>
 *    - Run `supabase/schema.sql` (see the `quotations` table added there) so the two target
 *      tables exist before anything gets synced.
 *    - Run `installEditTrigger` once manually to enable the sheet -> Supabase edit sync.
 *    - Double-check CONTRACT_DOC_FOLDER_ID / CONTRACT_PDF_FOLDER_ID / the template IDs below
 *      still point where you want generated contracts to be saved — they're copied from the
 *      original MCC Document Generator script's docPath/pdfPath/template IDs, so by default
 *      contracts land in the same Drive folder as before.
 * ============================================================
 */

// ---- Contract template IDs (same source docs as the original MCC Document Generator) --------
const CONTRACT_TEMPLATE_IDS = {
  SPK: '1Eko4yLBBNmchb0yi9XZcmtzAp0yh75sEBmaZn48UnWI',
  TPA: '1pojfwll3AGxhrkftBMveGxCe2KkF4W6wej1l1hsgZB0',
  TJS: '1QvWGbPUhEk9p2xq9GSrfsTEVVCAVOhlpwMdUbT3IN-E',
  PLIB: '1PM5pfyWCdV4k0Ak65wI51x_ELUEFus2bxDTVN3iDOlo',
  PKB: '19varbqEE99m3qZWw3_txUgMI0rv1i6TdauDDbsu4aj4',
};

// Each doc "type" maps to a template + a doc-number prefix (docname). This is the same set as the
// original MCC Document Generator's DOC_TYPES, minus LABEL (not used by the registration flow).
const DOC_TYPE_CONFIG = {
  SPK: { docname: 'SPK', templateId: CONTRACT_TEMPLATE_IDS.SPK },
  TPA: { docname: 'PKST-MCC-TPA', templateId: CONTRACT_TEMPLATE_IDS.TPA },
  TJS: { docname: 'PKST-MCC-TJS', templateId: CONTRACT_TEMPLATE_IDS.TJS },
  PLIB: { docname: 'PKST-MCC-PLIB', templateId: CONTRACT_TEMPLATE_IDS.PLIB },
  PKB: { docname: 'PKSB-MCC', templateId: CONTRACT_TEMPLATE_IDS.PKB },
};

// Maps the "Kode Instruksi" the customer picks in /registrasi to the SET of documents that need
// to be generated for it. Keep this in sync with INSTRUCTION_CODE_OPTIONS in
// src/pages/Registrasi.jsx.
//   PKSTJS   -> SPK + TJS contract
//   PKSTPA   -> SPK + TPA contract
//   PKSPLIB  -> SPK + PLIB contract
//   PKSB     -> PKB contract only
//   SPK      -> SPK only
const INSTRUCTION_DOC_GROUPS = {
  PKSTJS: ['SPK', 'TJS'],
  PKSTPA: ['SPK', 'TPA'],
  PKSPLIB: ['SPK', 'PLIB'],
  PKSB: ['PKB'],
  SPK: ['SPK'],
};

// Where generated Docs/PDFs are saved — same folder as the original script by default.
const CONTRACT_DOC_FOLDER_ID = '1i00ABXsMSmDkb58a0OMb2HBqZ1xwmBpQ';
const CONTRACT_PDF_FOLDER_ID = '1i00ABXsMSmDkb58a0OMb2HBqZ1xwmBpQ';

// ---- Email routing (matches src/lib/contactConfig.js) -----------------------------------------
const EMAIL_MAIN_TO = 'kontrak@mediacahayacerah.com';
const EMAIL_CC = ['kelvinfiless@gmail.com'];
const EMAIL_FROM_NAME = 'PT Media Cahaya Cerah <Waste Solution & Logistic Service>';

// ---- Sheet tabs on THIS (new) spreadsheet ------------------------------------------------------
const SHEET_QUOTATIONS = 'Quotations';
const SHEET_REGISTRATIONS = 'Registrations';

const QUOTATION_HEADERS = [
  'id', 'created_at', 'quote_code', 'service_label',
  'company_name', 'company_address', 'company_contact', 'company_phone',
  'email', 'summary_json', 'items_json', 'total', 'total_label', 'notes_json',
];

const REGISTRATION_HEADERS = [
  'id', 'created_at', 'quote_code', 'company_name', 'nama_perusahaan', 'npwp',
  'industri_bidang', 'alamat_limbah', 'alamat_dokumen', 'telp_perusahaan', 'email_perusahaan',
  'pj_nama', 'pj_jabatan', 'catatan_tambahan', 'manifest_pilihan',
  'pic_operasional_nama', 'pic_operasional_tel', 'pic_keuangan_nama', 'pic_keuangan_tel',
  'pic_lain', 'fisik_kontrak', 'instruction_code',
  'tanggal_mulai_kontrak', 'durasi_kontrak_tahun', 'tanggal_akhir_kontrak',
  'rincian_pelayanan', 'doc_urls', 'pdf_urls',
];

// ============================================================
//  Web app entry points
// ============================================================
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    const payload = body.payload || {};

    let result;
    if (action === 'quotation') {
      result = handleQuotation_(payload);
    } else if (action === 'registration') {
      result = handleRegistration_(payload);
    } else {
      throw new Error('Unknown action: ' + action);
    }

    return jsonResponse_({ ok: true, data: result });
  } catch (err) {
    Logger.log('doPost error: ' + (err && err.stack ? err.stack : err));
    return jsonResponse_({ error: err && err.message ? err.message : String(err) });
  }
}

// Simple health check — open the /exec URL in a browser to confirm the deployment is live.
function doGet() {
  return jsonResponse_({ ok: true, message: 'LIMBAHIN web app is running.' });
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
//  Quotation flow
// ============================================================
function handleQuotation_(payload) {
  const sheet = ensureSheet_(SHEET_QUOTATIONS, QUOTATION_HEADERS);
  const company = payload.company || {};

  const rowObj = {
    quote_code: payload.quoteCode || '',
    service_label: payload.serviceLabel || '',
    company_name: company.name || '',
    company_address: company.address || '',
    company_contact: company.contact || '',
    company_phone: company.phone || '',
    email: payload.email || '',
    summary_json: JSON.stringify(payload.summary || []),
    items_json: JSON.stringify(payload.items || []),
    total: payload.total != null ? payload.total : '',
    total_label: payload.totalLabel || '',
    notes_json: JSON.stringify(payload.notes || {}),
  };

  appendRowWithId_(sheet, rowObj, QUOTATION_HEADERS); // sets rowObj.id / rowObj.created_at
  upsertToSupabase_('quotations', rowObj.id, rowObj);
  sendQuotationEmail_(payload);

  return { id: rowObj.id };
}

function sendQuotationEmail_(payload) {
  if (!payload.pdfBase64) throw new Error('pdfBase64 wajib diisi untuk mengirim email penawaran.');

  const pdfBlob = Utilities.newBlob(
    Utilities.base64Decode(payload.pdfBase64),
    'application/pdf',
    payload.filename || 'penawaran.pdf'
  );

  const company = payload.company || {};
  const summaryText = buildItemizedSummaryText_(payload);
  const subject =
    'Penawaran LIMBAHIN' +
    (company.name ? ' — ' + company.name : '') +
    (payload.quoteCode ? ' (' + payload.quoteCode + ')' : '');

  const intro =
    'Terima kasih' +
    (company.name ? ', ' + company.name + ',' : ',') +
    ' telah mengajukan permintaan penawaran melalui web LIMBAHIN. Dokumen lengkap (PDF) terlampir pada email ini.';

  const htmlBody =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;color:#0f232c;">' +
    '<h2 style="color:#185c6c;margin-bottom:4px;">Penawaran Harga LIMBAHIN</h2>' +
    (payload.quoteCode ? '<p style="color:#64748b;font-size:13px;margin-top:0;">Kode: ' + payload.quoteCode + '</p>' : '') +
    '<p style="font-size:14px;">' + intro + '</p>' +
    '<pre style="white-space:pre-wrap;font-family:Arial,Helvetica,sans-serif;font-size:13px;' +
    'background:#f0faf9;border:1px solid #cde3e0;border-radius:8px;padding:12px 16px;">' +
    escapeHtml_(summaryText) +
    '</pre>' +
    '<p style="font-size:13px;color:#64748b;">Jika ada pertanyaan, silakan hubungi CS LIMBAHIN melalui WhatsApp.</p>' +
    '<p style="font-size:13px;color:#64748b;">Salam,<br/>Tim LIMBAHIN — PT Media Cahaya Cerah</p>' +
    '</div>';

  GmailApp.sendEmail(EMAIL_MAIN_TO, subject, summaryText, {
    cc: EMAIL_CC.join(','),
    bcc: payload.email || '',
    name: EMAIL_FROM_NAME,
    htmlBody: htmlBody,
    attachments: [pdfBlob],
  });
}

// ============================================================
//  Registration / contract-draft flow
// ============================================================
function handleRegistration_(payload) {
  const quote = payload.quote || {};
  const company = payload.company || {};
  const reg = payload.registration || {};

  const sheet = ensureSheet_(SHEET_REGISTRATIONS, REGISTRATION_HEADERS);
  const rowObj = {
    quote_code: quote.code || '',
    company_name: reg.namaPerusahaan || company.name || '',
    nama_perusahaan: reg.namaPerusahaan || '',
    npwp: reg.npwp || '',
    industri_bidang: reg.industriBidang || '',
    alamat_limbah: reg.alamatLimbah || '',
    alamat_dokumen: reg.alamatDokumen || '',
    telp_perusahaan: reg.telpPerusahaan || '',
    email_perusahaan: reg.emailPerusahaan || '',
    pj_nama: reg.pjNama || '',
    pj_jabatan: reg.pjJabatan || '',
    // No dedicated "general notes" field on the form anymore (it duplicated the PIC notes field
    // below) — the contract's {catatan} placeholder now also just uses picLain. See
    // mapRegistrationToTemplateFields_.
    catatan_tambahan: reg.picLain || reg.catatanTambahanPic || '',
    manifest_pilihan: reg.manifestPilihan || '',
    pic_operasional_nama: reg.picOperasionalNama || '',
    pic_operasional_tel: reg.picOperasionalTel || '',
    pic_keuangan_nama: reg.picKeuanganNama || '',
    pic_keuangan_tel: reg.picKeuanganTel || '',
    pic_lain: reg.picLain || '',
    fisik_kontrak: reg.fisikKontrak || '',
    instruction_code: reg.instructionCode || '',
    tanggal_mulai_kontrak: reg.tanggalMulaiKontrak || '',
    durasi_kontrak_tahun: reg.durasiKontrakTahun || '',
    tanggal_akhir_kontrak: reg.tanggalAkhirKontrak || '',
    rincian_pelayanan: reg.rincianPelayanan || '',
    doc_urls: '',
    pdf_urls: '',
  };

  const appended = appendRowWithId_(sheet, rowObj, REGISTRATION_HEADERS);

  let docResults = [];
  try {
    docResults = generateContractDrafts_(quote, company, reg, appended.rowNumber);
    rowObj.doc_urls = docResults.map((d) => d.docType + ': ' + d.docFile.getUrl()).join(' | ');
    rowObj.pdf_urls = docResults.map((d) => d.docType + ': ' + d.pdfFile.getUrl()).join(' | ');
    const linkColStart = REGISTRATION_HEADERS.indexOf('doc_urls') + 1;
    sheet.getRange(appended.rowNumber, linkColStart, 1, 2).setValues([[rowObj.doc_urls, rowObj.pdf_urls]]);
  } catch (err) {
    // Don't let a template/Drive hiccup block the record + notification email — kontrak@ still
    // gets pinged (see sendRegistrationEmail_ below) and can generate the draft by hand.
    Logger.log('Contract generation failed for row ' + appended.rowNumber + ': ' + err);
  }

  upsertToSupabase_('registrations', rowObj.id, rowObj);
  sendRegistrationEmail_(quote, company, reg, docResults);

  return { id: rowObj.id, docUrls: rowObj.doc_urls, pdfUrls: rowObj.pdf_urls };
}

// Adapted from createFile() in the original MCC Document Generator script — same template-copy +
// placeholder-fill + PDF/docx export approach, just driven by the web submission's fields instead
// of a row read off "3.Branch" via ui.prompt(). One instruction code can require MORE THAN ONE
// document (e.g. PKSTJS = an SPK doc + a TJS contract) — see INSTRUCTION_DOC_GROUPS — so this
// generates and returns one result per doc type in that group.
function generateContractDrafts_(quote, company, reg, rowNumber) {
  const code = String(reg.instructionCode || '').trim().toUpperCase();
  const docTypes = INSTRUCTION_DOC_GROUPS[code];
  if (!docTypes || !docTypes.length) throw new Error('Kode instruksi tidak dikenali: ' + code);

  const fields = mapRegistrationToTemplateFields_(quote, reg, company);
  const now = new Date();

  return docTypes.map((docType) => {
    const config = DOC_TYPE_CONFIG[docType];
    const docNumber = config.docname + '/' + now.getFullYear() + '/' + toRoman_(now.getMonth() + 1) + '/' + (2000 + rowNumber);

    const pdfFolder = DriveApp.getFolderById(CONTRACT_PDF_FOLDER_ID);
    const docFolder = DriveApp.getFolderById(CONTRACT_DOC_FOLDER_ID);
    const templateDoc = DriveApp.getFileById(config.templateId);
    const copy = templateDoc.makeCopy(docFolder);

    const openDoc = DocumentApp.openById(copy.getId());
    openDoc.setName(docNumber);

    const header = openDoc.getHeader();
    if (header) header.replaceText('{nodok}', safeReplacement_(docNumber));

    const body = openDoc.getBody();
    body.replaceText('{nodok}', safeReplacement_(docNumber));
    Object.keys(fields).forEach((key) => {
      body.replaceText('{' + key + '}', safeReplacement_(fields[key]));
    });

    openDoc.saveAndClose();

    const pdfBlob = copy.getAs(MimeType.PDF).setName(docNumber + '.pdf');
    const pdfFile = pdfFolder.createFile(pdfBlob);

    const exportUrl = 'https://docs.google.com/feeds/download/documents/export/Export?id=' +
      copy.getId() + '&exportFormat=docx';
    const oauthToken = ScriptApp.getOAuthToken();
    const docxBlob = UrlFetchApp.fetch(exportUrl, {
      headers: { Authorization: 'Bearer ' + oauthToken },
    }).getBlob().setName(docNumber + '.docx');

    return { docType: docType, docFile: copy, pdfFile: pdfFile, docxBlob: docxBlob, docNumber: docNumber };
  });
}

// `{...}` placeholder values, mapped from the registration form + the carried-over quote.
//
// `{tm}` / `{ta}` (contract start/end date) are now filled in from the "Tanggal Mulai Kontrak" +
// "Durasi Kontrak" fields the customer picks on the form (end date = start date + N years,
// computed client-side — see Registrasi.jsx). Expected format: dd/mm/yyyy, matching what's
// normally typed into the sheet by hand.
function mapRegistrationToTemplateFields_(quote, reg, company) {
  const summaryMap = {};
  (quote.summary || []).forEach((s) => { summaryMap[s.label] = s.value; });

  return {
    np: (reg.namaPerusahaan || company.name || '').toUpperCase(),
    npj: reg.pjNama || '',
    jpj: reg.pjJabatan || '',
    all: reg.alamatLimbah || '',
    aud: reg.alamatDokumen || reg.alamatLimbah || '',
    npwp: reg.npwp || '',
    kode: summaryMap['Jenis Limbah'] || '',
    rinc: reg.rincianPelayanan || '',
    jen: quote.serviceLabel || '',
    dur: summaryMap['Kunjungan'] || summaryMap['Periode'] || summaryMap['Kontrak'] || '',
    tm: reg.tanggalMulaiKontrak || '',
    ta: reg.tanggalAkhirKontrak || '',
    email: reg.emailPerusahaan || '',
    picl: reg.picOperasionalNama || '',
    picltel: reg.picOperasionalTel || '',
    pick: reg.picKeuanganNama || '',
    picktel: reg.picKeuanganTel || '',
    picextra: reg.picLain || '',
    fest: reg.manifestPilihan === 'festronik' ? 'Menggunakan Festronik' : 'Hanya Manifest',
    // No separate general-notes field anymore (removed the duplicate "Info / Catatan Tambahan"
    // field on the form) — reuse the PIC notes field here too.
    catatan: reg.picLain || reg.catatanTambahanPic || '',
    bidang: reg.industriBidang || '',
  };
}

function sendRegistrationEmail_(quote, company, reg, docResults) {
  const hasDocuments = docResults && docResults.length > 0;
  const subject =
    (hasDocuments ? docResults.map((d) => d.docNumber).join(', ') : 'Pendaftaran LIMBAHIN') +
    ' — ' + (reg.namaPerusahaan || company.name || '');

  const summaryText = buildItemizedSummaryText_({
    serviceLabel: quote.serviceLabel,
    summary: quote.summary,
    items: quote.items,
    total: quote.total,
    totalLabel: quote.totalLabel,
    notes: quote.notes,
  });

  const lines = [
    'Pendaftaran / permintaan draf kontrak baru dari web LIMBAHIN.',
    '',
    'Kode Instruksi: ' + (reg.instructionCode || '-'),
    'Mulai Kontrak: ' + (reg.tanggalMulaiKontrak || '-') + '  |  Durasi: ' + (reg.durasiKontrakTahun || '-') + ' tahun  |  Akhir: ' + (reg.tanggalAkhirKontrak || '-'),
    'Fisik Kontrak: ' + (reg.fisikKontrak === 'mekari' ? 'Mekari (E-Kontrak)' : 'Dicetak Fisik'),
    '',
  ];
  if (!hasDocuments) {
    lines.push('** Draf kontrak GAGAL dibuat otomatis — mohon dibuat manual, cek Logger di Apps Script untuk detail error. **');
    lines.push('');
  }
  lines.push('Ringkasan Penawaran:');
  lines.push(summaryText);
  const body = lines.join('\n');

  const attachments = [];
  if (hasDocuments) {
    docResults.forEach((d) => {
      attachments.push(d.pdfFile.getBlob(), d.docxBlob);
    });
  }

  GmailApp.sendEmail(EMAIL_MAIN_TO, subject, body, {
    cc: EMAIL_CC.join(','),
    bcc: reg.emailPerusahaan || '',
    name: EMAIL_FROM_NAME,
    attachments: attachments,
    htmlBody: escapeHtml_(body).replace(/\n/g, '<br>'),
  });
}

// Same Roman-numeral helper as the original MCC Document Generator script.
function toRoman_(num) {
  if (typeof num !== 'number' || num < 1 || num > 3999) return String(num);
  let roman = '';
  const romanValues = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
  for (const key in romanValues) {
    while (num >= romanValues[key]) {
      roman += key;
      num -= romanValues[key];
    }
  }
  return roman;
}

// ============================================================
//  Shared item/price summary text (mirrors src/lib/pricing.js#buildPricelistSummaryText, kept in
//  sync by hand since Apps Script can't import the frontend module).
// ============================================================
function buildItemizedSummaryText_(quote) {
  const lines = [];
  lines.push('Layanan: ' + (quote.serviceLabel || '-'));
  (quote.summary || []).forEach((s) => lines.push(s.label + ': ' + (s.value || '-')));

  const items = quote.items || [];
  if (items.length) {
    lines.push('');
    lines.push('Rincian Item:');
    items.forEach((it, i) => {
      const unit = String(it.unit || '').replace(/^per\s+/i, '');
      const qtyPart = it.qty != null ? ' x ' + it.qty : '';
      lines.push((i + 1) + '. ' + it.item + ' - ' + formatIDR_(it.harga) + '/' + unit + qtyPart + ' = ' + formatIDR_(it.amount));
    });
  }

  if (quote.total != null && quote.total !== '') {
    lines.push((quote.totalLabel || 'Total') + ': ' + formatIDR_(quote.total));
  }

  const notes = quote.notes || {};
  const noteParts = [];
  if (notes.pelayanan) noteParts.push(notes.pelayanan);
  if (notes.limbah) noteParts.push(notes.limbah);
  if (noteParts.length) {
    lines.push('');
    lines.push('Catatan: ' + noteParts.join(' '));
  }

  return lines.join('\n');
}

function formatIDR_(v) {
  const n = Math.round(Number(v || 0));
  return 'IDR ' + n.toLocaleString('id-ID');
}

function escapeHtml_(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Document.replaceText() treats the replacement string specially ("$1" etc. means a regex
// capture group) — escape a literal "$" so a company/address/etc. containing one doesn't corrupt
// the document.
function safeReplacement_(value) {
  return String(value == null ? '' : value).replace(/\$/g, '$$$$');
}

// ============================================================
//  Sheet helpers
// ============================================================
function ensureSheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Appends a row built from `rowObj` (keyed by column name) in `headers` order. Mutates `rowObj`
// in place, adding the generated `id` / `created_at` it just wrote, so the caller can reuse the
// same object for the Supabase upsert without re-reading the sheet.
function appendRowWithId_(sheet, rowObj, headers) {
  rowObj.id = Utilities.getUuid();
  rowObj.created_at = new Date().toISOString();
  const row = headers.map((h) => (rowObj[h] !== undefined ? rowObj[h] : ''));
  sheet.appendRow(row);
  return { id: rowObj.id, rowNumber: sheet.getLastRow() };
}

// ============================================================
//  Supabase sync (service-role key — never expose this to the browser)
// ============================================================
function upsertToSupabase_(table, id, rowObj) {
  const url = PropertiesService.getScriptProperties().getProperty('SUPABASE_URL');
  const key = PropertiesService.getScriptProperties().getProperty('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    Logger.log('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set in Script Properties — skipping sync for ' + table);
    return;
  }

  const payload = Object.assign({}, rowObj, { id: id });
  const res = UrlFetchApp.fetch(url + '/rest/v1/' + table + '?on_conflict=id', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    payload: JSON.stringify([payload]),
    muteHttpExceptions: true,
  });

  if (res.getResponseCode() >= 300) {
    Logger.log('Supabase upsert failed (' + table + '): [' + res.getResponseCode() + '] ' + res.getContentText());
  }
}

// ============================================================
//  Sheet -> Supabase edit sync
// ============================================================
// A plain `onEdit(e)` simple trigger can't call UrlFetchApp (Apps Script restricts simple
// triggers from making external requests), so this needs to be an installable trigger. Run this
// function ONCE manually from the Apps Script editor (select it in the function dropdown, click
// ▷ Run, approve the authorization prompt) to set it up.
function installEditTrigger() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === 'onEditInstallable_') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onEditInstallable_').forSpreadsheet(ss).onEdit().create();
  Logger.log('Installable onEdit trigger created — manual edits to Quotations/Registrations will now sync to Supabase.');
}

function onEditInstallable_(e) {
  try {
    const sheet = e.range.getSheet();
    const name = sheet.getName();
    if (name !== SHEET_QUOTATIONS && name !== SHEET_REGISTRATIONS) return;

    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const table = name === SHEET_QUOTATIONS ? 'quotations' : 'registrations';

    // e.range can span multiple rows/columns (e.g. a paste) — sync every affected data row once.
    const firstRow = e.range.getRow();
    const numRows = e.range.getNumRows();
    for (let row = firstRow; row < firstRow + numRows; row++) {
      if (row === 1) continue; // header row
      const values = sheet.getRange(row, 1, 1, lastCol).getValues()[0];
      const obj = {};
      headers.forEach((h, i) => { if (h) obj[h] = values[i]; });
      if (!obj.id) continue; // row wasn't created through the web app (no id) — nothing to key on
      upsertToSupabase_(table, obj.id, obj);
    }
  } catch (err) {
    Logger.log('onEditInstallable_ sync failed: ' + err);
  }
}
