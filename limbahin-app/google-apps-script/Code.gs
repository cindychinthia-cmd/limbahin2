/**
 * LIMBAHIN unified customer-form backend.
 *
 * Script Properties:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   APP_BASE_URL  (deployed frontend origin, e.g. https://example.com)
 *
 * Deploy as Web app: Execute as Me, access Anyone.
 */
const CONTRACT_TEMPLATE_IDS = {
  SPK: '1Eko4yLBBNmchb0yi9XZcmtzAp0yh75sEBmaZn48UnWI',
  TPA: '1pojfwll3AGxhrkftBMveGxCe2KkF4W6wej1l1hsgZB0',
  TJS: '1QvWGbPUhEk9p2xq9GSrfsTEVVCAVOhlpwMdUbT3IN-E',
  PLIB: '1PM5pfyWCdV4k0Ak65wI51x_ELUEFus2bxDTVN3iDOlo',
  PKB: '19varbqEE99m3qZWw3_txUgMI0rv1i6TdauDDbsu4aj4',
};
const DOC_TYPE_CONFIG = {
  SPK: { docname: 'SPK', templateId: CONTRACT_TEMPLATE_IDS.SPK },
  TPA: { docname: 'PKST-MCC-TPA', templateId: CONTRACT_TEMPLATE_IDS.TPA },
  TJS: { docname: 'PKST-MCC-TJS', templateId: CONTRACT_TEMPLATE_IDS.TJS },
  PLIB: { docname: 'PKST-MCC-PLIB', templateId: CONTRACT_TEMPLATE_IDS.PLIB },
  PKB: { docname: 'PKSB-MCC', templateId: CONTRACT_TEMPLATE_IDS.PKB },
};
const INSTRUCTION_DOC_GROUPS = {
  PKSTJS: ['SPK', 'TJS'],
  PKSTPA: ['SPK', 'TPA'],
  PKSPLIB: ['SPK', 'PLIB'],
  PKSB: ['PKB'],
  SPK: ['SPK'],
};

const CONTRACT_DOC_FOLDER_ID = '1i00ABXsMSmDkb58a0OMb2HBqZ1xwmBpQ';
const CONTRACT_PDF_FOLDER_ID = '1i00ABXsMSmDkb58a0OMb2HBqZ1xwmBpQ';
const EMAIL_MAIN_TO = 'kontrak@mediacahayacerah.com';
const EMAIL_CC = ['kelvinfiless@gmail.com'];
const EMAIL_FROM_NAME = 'LIMBAHIN - PT Media Cahaya Cerah';
const SHEET_CUSTFORMS = 'Custforms';
const CUSTFORM_HEADERS = [
  'id', 'created_at', 'updated_at', 'status', 'rate', 'config', 'email',
  'company_name', 'pic_name', 'phone', 'location', 'waste', 'service',
  'referral_id', 'rincian_pelayanan', 'state_json', 'quote_json',
  'registration_json', 'doc_urls', 'pdf_urls',
];

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const action = body.action;
    const payload = body.payload || {};
    let data;
    if (action === 'load') data = loadCustform_(payload.id);
    else if (action === 'quotation') data = handleQuotation_(payload);
    else if (action === 'registration') data = handleRegistration_(payload);
    else throw new Error('Unknown action: ' + action);
    return jsonResponse_({ ok: true, data: data });
  } catch (error) {
    const detail = error && error.stack ? error.stack : String(error);
    console.error(detail);
    return jsonResponse_({ error: error && error.message ? error.message : String(error) });
  }
}

function doGet() {
  return jsonResponse_({ ok: true, message: 'LIMBAHIN unified custform backend is running.' });
}

function jsonResponse_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleQuotation_(payload) {
  validateCustformPayload_(payload);
  if (!payload.pdfBase64) throw new Error('PDF penawaran tidak diterima.');
  const id = payload.id || Utilities.getUuid();
  const existing = payload.id ? loadCustform_(payload.id) : null;
  const row = buildCustformRow_(payload, id, 'quotation_sent', existing);
  saveCustform_(row);

  const links = buildCustomerLinks_(id, row.config, row.rate);
  sendQuotationEmail_(payload, links);
  return { id: id };
}

function handleRegistration_(payload) {
  validateCustformPayload_(payload);
  const id = payload.id || Utilities.getUuid();
  const existing = payload.id ? loadCustform_(payload.id) : null;
  const row = buildCustformRow_(payload, id, 'registration_sent', existing);
  saveCustform_(row);

  const generated = generateContractDrafts_(payload.quote || {}, payload.registration || {}, payload.state || {}, id);
  row.doc_urls = generated.results.map(function (item) {
    return item.docType + ': ' + item.docFile.getUrl();
  }).join(' | ');
  row.pdf_urls = generated.results.map(function (item) {
    return item.docType + ': ' + item.pdfFile.getUrl();
  }).join(' | ');
  saveCustform_(row);

  const links = buildCustomerLinks_(id, row.config, row.rate);
  sendRegistrationEmails_(payload, generated, links);
  return {
    id: id,
    docUrls: row.doc_urls,
    pdfUrls: row.pdf_urls,
    generationErrors: generated.errors.map(function (item) { return { docType: item.docType }; }),
  };
}

function validateCustformPayload_(payload) {
  if (!/^r-?\d+[a-z]*$/i.test(String(payload.rate || '').trim())) {
    throw new Error('Rate tidak valid. Format harus dimulai dengan r, misalnya r20abc.');
  }
  if (!payload.config) payload.config = 'Default';
  if (!payload.state || !payload.state.company || !payload.state.company.email) {
    throw new Error('Email customer wajib diisi.');
  }
}

function buildCustformRow_(payload, id, status, existing) {
  const state = payload.state || {};
  const company = state.company || {};
  const quote = payload.quote || {};
  const registration = payload.registration || (existing && existing.registration) || null;
  return {
    id: id,
    created_at: existing && existing.created_at ? existing.created_at : new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: status,
    rate: payload.rate,
    config: payload.config || 'Default',
    email: company.email || '',
    company_name: company.name || '',
    pic_name: company.contact || '',
    phone: phoneForStorage_(company.phone),
    location: state.location || '',
    waste: state.waste || '',
    service: quote.service || state.service || '',
    referral_id: quote._referralRow && quote._referralRow.id ? quote._referralRow.id : '',
    rincian_pelayanan: registration && registration.rincianPelayanan
      ? registration.rincianPelayanan
      : buildItemizedSummaryText_(quote),
    state_json: state,
    quote_json: quote,
    registration_json: registration,
    doc_urls: existing && existing.doc_urls ? existing.doc_urls : '',
    pdf_urls: existing && existing.pdf_urls ? existing.pdf_urls : '',
  };
}

function phoneForStorage_(value) {
  return String(value || '').replace(/\D/g, '');
}

function saveCustform_(row) {
  const sheet = ensureSheet_(SHEET_CUSTFORMS, CUSTFORM_HEADERS);
  upsertSheetRow_(sheet, row, CUSTFORM_HEADERS);
  upsertToSupabase_('custforms', row.id, row);
}

function loadCustform_(id) {
  if (!id) throw new Error('Custform id wajib diisi.');
  const rows = supabaseRequest_(
    '/rest/v1/custforms?id=eq.' + encodeURIComponent(id) + '&select=*&limit=1',
    'get'
  );
  if (!rows || !rows.length) throw new Error('Custform tidak ditemukan.');
  const row = rows[0];
  return {
    id: row.id,
    created_at: row.created_at,
    status: row.status,
    rate: row.rate,
    config: row.config || 'Default',
    state: parseJsonValue_(row.state_json, {}),
    quote: parseJsonValue_(row.quote_json, null),
    registration: parseJsonValue_(row.registration_json, {}),
    doc_urls: row.doc_urls || '',
    pdf_urls: row.pdf_urls || '',
  };
}

function parseJsonValue_(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch (error) { return fallback; }
}

function buildCustomerLinks_(id, config, rate) {
  const base = PropertiesService.getScriptProperties().getProperty('APP_BASE_URL');
  if (!base) throw new Error('APP_BASE_URL belum diatur di Script Properties.');
  const root = base.replace(/\/$/, '') + '/?id=' + encodeURIComponent(id) +
    '&config=' + encodeURIComponent(config || 'Default') +
    '&rate=' + encodeURIComponent(rate);
  return { edit: root + '&step=2', continue: root + '&step=3' };
}

function sendQuotationEmail_(payload, links) {
  const state = payload.state || {};
  const company = state.company || {};
  const quote = payload.quote || {};
  const pdf = Utilities.newBlob(
    Utilities.base64Decode(payload.pdfBase64),
    'application/pdf',
    payload.filename || 'penawaran.pdf'
  );
  const summary = buildItemizedSummaryText_(quote);
  const subject = 'Penawaran LIMBAHIN' +
    (company.name ? ' — ' + company.name : '') +
    (quote.code ? ' (' + quote.code + ')' : '');
  const html =
    '<div style="font-family:Arial,sans-serif;max-width:600px;color:#0f232c">' +
    '<h2 style="color:#185c6c">Penawaran Harga LIMBAHIN</h2>' +
    '<p>PDF penawaran terlampir. Periksa kembali rincian berikut:</p>' +
    '<pre style="white-space:pre-wrap;background:#f0faf9;border:1px solid #cde3e0;border-radius:8px;padding:14px">' +
    escapeHtml_(summary) + '</pre>' +
    actionButton_(links.edit, 'Edit Pelayanan') +
    actionButton_(links.continue, 'Lanjutkan ke Draf Kontrak') +
    '<p style="font-size:12px;color:#64748b">Periksa juga folder spam/junk jika email LIMBAHIN berikutnya tidak terlihat.</p>' +
    '</div>';

  GmailApp.sendEmail(EMAIL_MAIN_TO, subject, summary, {
    cc: EMAIL_CC.join(','),
    bcc: company.email,
    name: EMAIL_FROM_NAME,
    htmlBody: html,
    attachments: [pdf],
  });
}

function sendRegistrationEmails_(payload, generated, links) {
  const state = payload.state || {};
  const company = state.company || {};
  const registration = payload.registration || {};
  const quote = payload.quote || {};
  const summary = buildItemizedSummaryText_(quote);
  const attachments = [];
  generated.results.forEach(function (item) {
    attachments.push(item.pdfFile.getBlob());
    attachments.push(item.docxBlob);
  });

  const errorLines = generated.errors.map(function (item) {
    return item.docType + ': ' + item.message;
  });
  const internalBody = [
    'Custform ID: ' + (payload.id || 'baru'),
    'Kode Instruksi: ' + (registration.instructionCode || '-'),
    '',
    'Rincian Pelayanan:',
    summary,
    '',
    generated.results.length ? 'Dokumen berhasil: ' + generated.results.map(function (item) { return item.docType; }).join(', ') : 'Tidak ada dokumen yang berhasil dibuat.',
    errorLines.length ? 'ERROR PEMBUATAN DOKUMEN:\n' + errorLines.join('\n') : 'Tidak ada error pembuatan dokumen.',
    '',
    'Edit data: ' + links.continue,
  ].join('\n');

  GmailApp.sendEmail(EMAIL_MAIN_TO, 'Pendaftaran LIMBAHIN — ' + (company.name || ''), internalBody, {
    cc: EMAIL_CC.join(','),
    name: EMAIL_FROM_NAME,
    attachments: attachments,
    htmlBody: escapeHtml_(internalBody).replace(/\n/g, '<br>'),
  });

  const customerHtml =
    '<div style="font-family:Arial,sans-serif;max-width:600px;color:#0f232c">' +
    '<h2 style="color:#185c6c">Draf Kontrak LIMBAHIN</h2>' +
    (generated.results.length
      ? '<p>Draf yang berhasil dibuat terlampir. Mohon periksa seluruh data.</p>'
      : '<p>Data Anda sudah diterima. Tim kami sedang memeriksa pembuatan draf dokumen.</p>') +
    actionButton_(links.continue, 'Edit Data / Cek Kembali') +
    '<p style="font-size:12px;color:#64748b"><strong>Periksa inbox dan folder spam/junk email Anda.</strong></p>' +
    '</div>';

  GmailApp.sendEmail(company.email, 'Draf Kontrak LIMBAHIN — ' + (company.name || ''), 'Data Anda sudah diterima.', {
    name: EMAIL_FROM_NAME,
    htmlBody: customerHtml,
    attachments: attachments,
  });
}

function actionButton_(url, label) {
  return '<a href="' + escapeHtml_(url) + '" style="display:inline-block;margin:8px 8px 8px 0;padding:12px 18px;background:#185c6c;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">' +
    escapeHtml_(label) + '</a>';
}

function generateContractDrafts_(quote, registration, state, custformId) {
  const code = String(registration.instructionCode || '').trim().toUpperCase();
  const docTypes = INSTRUCTION_DOC_GROUPS[code];
  if (!docTypes || !docTypes.length) {
    return { results: [], errors: [{ docType: code || 'KOSONG', message: 'Kode instruksi tidak dikenali.' }] };
  }

  const fields = mapRegistrationToTemplateFields_(quote, registration, state.company || {});
  const results = [];
  const errors = [];
  docTypes.forEach(function (docType) {
    try {
      results.push(generateOneDocument_(docType, fields, custformId));
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      console.error('Generation failed [' + docType + '] custform ' + custformId + ': ' + message);
      errors.push({ docType: docType, message: message });
    }
  });
  return { results: results, errors: errors };
}

function generateOneDocument_(docType, fields, custformId) {
  const config = DOC_TYPE_CONFIG[docType];
  if (!config) throw new Error('Konfigurasi dokumen tidak ditemukan.');
  const now = new Date();
  const suffix = String(custformId).slice(0, 8).toUpperCase();
  const docNumber = config.docname + '/' + now.getFullYear() + '/' + toRoman_(now.getMonth() + 1) + '/' + suffix;
  const docFolder = DriveApp.getFolderById(CONTRACT_DOC_FOLDER_ID);
  const pdfFolder = DriveApp.getFolderById(CONTRACT_PDF_FOLDER_ID);
  const template = DriveApp.getFileById(config.templateId);
  const copy = template.makeCopy(docNumber, docFolder);

  const document = DocumentApp.openById(copy.getId());
  const header = document.getHeader();
  if (header) header.replaceText('\\{nodok\\}', safeReplacement_(docNumber));
  const body = document.getBody();
  body.replaceText('\\{nodok\\}', safeReplacement_(docNumber));
  Object.keys(fields).forEach(function (key) {
    body.replaceText('\\{' + key + '\\}', safeReplacement_(fields[key]));
  });
  document.saveAndClose();
  Utilities.sleep(300);

  const pdfFile = pdfFolder.createFile(copy.getAs(MimeType.PDF).setName(fileSafeName_(docNumber) + '.pdf'));
  const exportUrl = 'https://docs.google.com/feeds/download/documents/export/Export?id=' +
    copy.getId() + '&exportFormat=docx';
  const response = UrlFetchApp.fetch(exportUrl, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() >= 300) {
    throw new Error('Export DOCX gagal (' + response.getResponseCode() + '): ' + response.getContentText().slice(0, 300));
  }
  const docxBlob = response.getBlob().setName(fileSafeName_(docNumber) + '.docx');
  return { docType: docType, docFile: copy, pdfFile: pdfFile, docxBlob: docxBlob, docNumber: docNumber };
}

function fileSafeName_(value) {
  return String(value).replace(/[\\/:*?"<>|]/g, '-');
}

function mapRegistrationToTemplateFields_(quote, registration, company) {
  const summary = {};
  (quote.summary || []).forEach(function (item) { summary[item.label] = item.value; });
  return {
    np: String(registration.namaPerusahaan || company.name || '').toUpperCase(),
    npj: registration.pjNama || company.contact || '',
    jpj: registration.pjJabatan || '',
    all: registration.alamatLimbah || '',
    aud: registration.alamatDokumen || registration.alamatLimbah || '',
    npwp: registration.npwp || '',
    kode: summary['Jenis Limbah'] || '',
    rinc: registration.rincianPelayanan || buildItemizedSummaryText_(quote),
    jen: quote.serviceLabel || '',
    dur: summary['Kunjungan'] || summary['Periode'] || summary['Kontrak'] || '',
    tm: registration.tanggalMulaiKontrak || '',
    ta: registration.tanggalAkhirKontrak || '',
    email: registration.emailPerusahaan || company.email || '',
    picl: registration.picOperasionalNama || '',
    picltel: phoneForStorage_(registration.picOperasionalTel),
    pick: registration.picKeuanganNama || '',
    picktel: phoneForStorage_(registration.picKeuanganTel),
    picextra: registration.picLain || registration.catatanTambahanPic || '',
    fest: registration.manifestPilihan === 'festronik' ? 'Menggunakan Festronik' : 'Hanya Manifest',
    catatan: registration.picLain || registration.catatanTambahanPic || '',
    bidang: registration.industriBidang || '',
  };
}

function buildItemizedSummaryText_(quote) {
  const lines = ['Layanan: ' + (quote.serviceLabel || '-')];
  (quote.summary || []).forEach(function (item) {
    lines.push(item.label + ': ' + (item.value || '-'));
  });
  if ((quote.items || []).length) {
    lines.push('', 'Rincian Item:');
    quote.items.forEach(function (item, index) {
      const unit = String(item.unit || '').replace(/^per\s+/i, '');
      const qty = item.qty == null ? '' : ' x ' + item.qty;
      lines.push((index + 1) + '. ' + item.item + ' - ' + formatIDR_(item.harga) + '/' + unit + qty + ' = ' + formatIDR_(item.amount));
      if (item.definisi) lines.push('   Deskripsi: ' + item.definisi);
    });
  }
  if (quote.total != null && quote.total !== '') {
    lines.push((quote.totalLabel || 'Total') + ': ' + formatIDR_(quote.total));
  }
  const notes = quote.notes || {};
  const noteParts = [notes.pelayanan, notes.limbah].filter(Boolean);
  if (noteParts.length) lines.push('', 'Catatan: ' + noteParts.join(' '));
  return lines.join('\n');
}

function ensureSheet_(name, headers) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function upsertSheetRow_(sheet, row, headers) {
  const values = headers.map(function (header) {
    const value = row[header];
    if (header.slice(-5) === '_json') return value == null ? '' : JSON.stringify(value);
    return value == null ? '' : value;
  });
  let rowNumber = 0;
  if (sheet.getLastRow() > 1) {
    const found = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1)
      .createTextFinder(String(row.id)).matchEntireCell(true).findNext();
    if (found) rowNumber = found.getRow();
  }
  if (rowNumber) sheet.getRange(rowNumber, 1, 1, headers.length).setValues([values]);
  else sheet.appendRow(values);
}

function upsertToSupabase_(table, id, row) {
  return supabaseRequest_('/rest/v1/' + table + '?on_conflict=id', 'post', [Object.assign({}, row, { id: id })], {
    Prefer: 'resolution=merge-duplicates,return=minimal',
  });
}

function supabaseRequest_(path, method, payload, extraHeaders) {
  const properties = PropertiesService.getScriptProperties();
  const url = properties.getProperty('SUPABASE_URL');
  const key = properties.getProperty('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diatur.');
  const headers = Object.assign({
    apikey: key,
    Authorization: 'Bearer ' + key,
  }, extraHeaders || {});
  const options = { method: method, headers: headers, muteHttpExceptions: true };
  if (payload !== undefined) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(payload);
  }
  const response = UrlFetchApp.fetch(url.replace(/\/$/, '') + path, options);
  const code = response.getResponseCode();
  const text = response.getContentText();
  if (code >= 300) throw new Error('Supabase ' + method.toUpperCase() + ' gagal (' + code + '): ' + text.slice(0, 500));
  return text ? JSON.parse(text) : null;
}

function formatIDR_(value) {
  return 'IDR ' + Math.round(Number(value || 0)).toLocaleString('id-ID');
}

function escapeHtml_(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function safeReplacement_(value) {
  return String(value == null ? '' : value).replace(/\$/g, '$$$$');
}

function toRoman_(number) {
  const values = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
  let result = '';
  Object.keys(values).forEach(function (key) {
    while (number >= values[key]) {
      result += key;
      number -= values[key];
    }
  });
  return result;
}
