// ⚠️ DEPRECATED — no longer called anywhere in the app. /registrasi now submits straight to the
// Google Apps Script web app, which both generates the contract draft AND emails it immediately
// (GmailApp) — see google-apps-script/Code.gs `handleRegistration_` / `sendRegistrationEmail_`
// and src/lib/appsScript.js. The old "email is just a handoff for staff to run createXXX()
// manually" flow described below no longer applies: the draft is generated automatically now.
// Kept here only for reference. Safe to delete along with the RESEND_API_KEY secret once you've
// confirmed the Apps Script path is working.
//
// Supabase Edge Function: send-registration-email
//
// Deploy:   supabase functions deploy send-registration-email
// Secrets:  same RESEND_API_KEY as send-quote-email (shared).
//
// Sends the full registration (contract/MOU) submission — company data, PIC data, contract
// choices, instruction code — plus a short quotation summary, to the kontrak team so they can
// pick the right template (per INSTRUCTIONCODE: PKSTJS / PKSTPA / PKSB) and run the existing
// Apps Script (createPKSTJS() etc.) to actually generate the draft document.
//
// Called from the frontend as:
//   supabase.functions.invoke('send-registration-email', { body: {
//     to, cc, bccCustomerEmail, quote, company, registration
//   }})
//
// NOTE: this function does NOT generate the actual contract document — that still happens in your
// Google Apps Script against the "3.Branch" sheet, keyed by the instruction code below. This email
// is the handoff: everything staff need to go run the right createXXX() function.

import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = Deno.env.get('QUOTE_EMAIL_FROM') || 'LIMBAHIN <cs@mediacahayacerah.com>';

// Optional: URL of the Apps Script Web App deployment's doPost() endpoint (see the updated
// Code.gs — doPost() appends this payload to a "WebPendaftaran" queue sheet for staff to process
// into the "3.Branch" sheet and generate the contract). Set with:
//   supabase secrets set APPS_SCRIPT_WEBHOOK_URL=https://script.google.com/macros/s/XXXX/exec
// Left unset, this step is simply skipped — nothing else in this function depends on it.
const APPS_SCRIPT_WEBHOOK_URL = Deno.env.get('APPS_SCRIPT_WEBHOOK_URL');

async function forwardToAppsScript(payload) {
  if (!APPS_SCRIPT_WEBHOOK_URL) return;
  try {
    await fetch(APPS_SCRIPT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    // Never fail the customer-facing request just because the internal sheet hand-off failed —
    // staff still get the email above with everything they need.
    console.error('forwardToAppsScript failed:', err);
  }
}

// Keep in sync with src/lib/contactConfig.js (CS_WHATSAPP_NUMBER).
const CS_WHATSAPP_NUMBER = '6285128005532';
function buildCustomerWaLink(registration, company) {
  const r = registration || {};
  const text = `Halo CS LIMBAHIN, saya (${r.namaPerusahaan || company?.name || ''}) sudah mengecek draf dokumen kontrak saya dan datanya sudah benar. Kode Instruksi: ${(r.instructionCode || '').toUpperCase()}. Mohon dilanjutkan prosesnya. Terima kasih.`;
  return `https://wa.me/${CS_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function formatIDR(v) {
  return `IDR ${Math.round(Number(v || 0)).toLocaleString('id-ID')}`;
}

function row(label, value) {
  return `<tr><td style="padding:3px 12px 3px 0;color:#64748b;white-space:nowrap;">${label}</td><td style="padding:3px 0;font-weight:600;">${value ?? '-'}</td></tr>`;
}

const INSTRUCTION_DOC_MAP = {
  PKSTJS: 'PKS TJS (Tripartite) + SPK + Label',
  PKSTPA: 'PKS TPA (Tripartite) + SPK + Label',
  PKSB: 'PKB (Bipartite) + Label',
};

function buildHtml({ quote, company, registration }) {
  const r = registration || {};
  const code = (r.instructionCode || '').toUpperCase();
  const docSet = INSTRUCTION_DOC_MAP[code] || 'Tidak dikenali — cek kembali kode instruksi.';

  const quoteRows = [
    row('Kode Penawaran', quote?.code),
    row('Layanan', quote?.serviceLabel),
    ...(quote?.summary || []).map((s) => row(s.label, s.value)),
    quote?.total != null ? row(quote?.totalLabel || 'Total', formatIDR(quote.total)) : '',
  ].join('');

  const picExtra = [];
  if (r.picOperasionalNama || r.picOperasionalTel) picExtra.push(row('PIC Operasional', `${r.picOperasionalNama || '-'} (${r.picOperasionalTel || '-'})`));
  if (r.picKeuanganNama || r.picKeuanganTel) picExtra.push(row('PIC Keuangan', `${r.picKeuanganNama || '-'} (${r.picKeuanganTel || '-'})`));
  if (r.catatanTambahanPic || r.picLain) picExtra.push(row('Catatan Tambahan', r.catatanTambahanPic || r.picLain));

  const companyRows = [
    row('Nama Perusahaan', r.namaPerusahaan || company?.name),
    row('NPWP & Kode Faktur', r.npwp),
    row('Industri & Bidang', r.industriBidang),
    row('Alamat Limbah', r.alamatLimbah),
    row('Alamat Dokumen', r.alamatDokumen || 'Sama dengan alamat limbah'),
    row('No. Telp Perusahaan', r.telpPerusahaan),
    row('Email Perusahaan', r.emailPerusahaan),
  ].join('');

  const pjRows = [
    row('Nama Lengkap', r.pjNama),
    row('Jabatan', r.pjJabatan),
    row('Catatan Tambahan', r.catatanTambahan),
  ].join('');

  const kontrakRows = [
    row('Manifest / Festronik', r.manifestPilihan === 'festronik' ? 'B. Festronik' : 'A. Hanya Manifest'),
    ...picExtra,
    row('Fisik Kontrak', r.fisikKontrak === 'mekari' ? 'B. Mekari (E-Kontrak)' : 'A. Dicetak Fisik'),
    row('Kode Instruksi', `<span style="color:#b91c1c;">${code || '-'}</span>`),
    row('Dokumen yang perlu dibuat', docSet),
  ].join('');

  const rincianBlock = r.rincianPelayanan
    ? `<h3 style="font-size:13px;color:#185c6c;margin-bottom:4px;">Rincian Pelayanan &amp; Harga (masuk ke {rinc} kontrak)</h3>
       <pre style="white-space:pre-wrap;font-family:Arial,Helvetica,sans-serif;font-size:12.5px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:16px;">${r.rincianPelayanan}</pre>`
    : '';

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0f232c;">
    <h2 style="color:#185c6c;margin-bottom:4px;">Permintaan Draf Kontrak — ${r.namaPerusahaan || company?.name || ''}</h2>
    <p style="color:#64748b;font-size:13px;margin-top:0;">Kode Instruksi: <strong>${code}</strong> → ${docSet}</p>

    <h3 style="font-size:13px;color:#185c6c;margin-bottom:4px;">Ringkasan Penawaran</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;">${quoteRows}</table>

    <h3 style="font-size:13px;color:#185c6c;margin-bottom:4px;">Perusahaan</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;">${companyRows}</table>

    <h3 style="font-size:13px;color:#185c6c;margin-bottom:4px;">Penanggung Jawab Utama</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;">${pjRows}</table>

    <h3 style="font-size:13px;color:#185c6c;margin-bottom:4px;">Kontrak</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;">${kontrakRows}</table>

    ${rincianBlock}

    <p style="font-size:12px;color:#64748b;">Email ini dikirim otomatis dari web LIMBAHIN New Customer Management setelah pelanggan menyetujui penawaran dan mengisi form pendaftaran.</p>
  </div>`;
}

// Short, separate email sent DIRECTLY to the customer (not bcc on the internal one above).
// Per requirement: this email's only real instruction is "check the draft (sent separately once
// staff generates it), then confirm via the WhatsApp button" — no internal jargon, no PIC tables.
function buildCustomerHtml({ registration, company, waLink }) {
  const r = registration || {};
  const name = r.namaPerusahaan || company?.name || 'Bapak/Ibu';
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#0f232c;">
    <h2 style="color:#185c6c;margin-bottom:8px;">Pendaftaran Anda Sudah Kami Terima</h2>
    <p style="font-size:14px;line-height:1.6;">Halo <strong>${name}</strong>,</p>
    <p style="font-size:14px;line-height:1.6;">
      Terima kasih sudah mengisi formulir pendaftaran LIMBAHIN. Tim kami akan menyiapkan draf dokumen kontrak Anda
      dan mengirimkannya lewat email terpisah dalam waktu dekat.
    </p>
    <p style="font-size:14px;line-height:1.6;font-weight:600;">
      Langkah Anda: cek draf dokumen yang kami kirimkan, dan jika semua sudah benar, klik tombol di bawah ini untuk
      konfirmasi ke CS kami lewat WhatsApp.
    </p>
    <p style="text-align:center;margin:24px 0;">
      <a href="${waLink}" style="background:#185c6c;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 28px;border-radius:8px;display:inline-block;">
        Konfirmasi via WhatsApp
      </a>
    </p>
    <p style="font-size:12px;color:#64748b;">Jika tombol tidak berfungsi, hubungi CS LIMBAHIN di WhatsApp secara langsung.</p>
  </div>`;
}

async function sendViaResend({ to, cc, bcc, html, subject }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], cc, bcc: bcc ? [bcc] : undefined, subject, html }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || `Resend error (${res.status})`);
  return json;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY belum diatur (supabase secrets set RESEND_API_KEY=...)');

    const body = await req.json();
    const { to, cc, bccCustomerEmail, quote, company, registration } = body;

    if (!to || !registration) {
      return new Response(JSON.stringify({ error: 'to dan registration wajib diisi.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const html = buildHtml({ quote, company, registration });
    const subject = `Permintaan Draf Kontrak — ${registration.namaPerusahaan || company?.name || ''} (${(registration.instructionCode || '').toUpperCase()})`;

    // Internal email — full detail, to the kontrak team (cc'd), customer bcc'd so they have a
    // copy but the "To"/"Cc" internal addresses stay hidden from them.
    await sendViaResend({ to, cc, bcc: bccCustomerEmail, html, subject });

    // Hand off to the Apps Script queue (see Code.gs doPost) so the contract draft can be
    // generated automatically once staff confirms the remaining CRM-only fields (customer ID,
    // kode limbah, contract duration/dates) directly in the "3.Branch" sheet.
    await forwardToAppsScript({ quote, company, registration });

    // Separate, short customer-facing email: plain instructions + WhatsApp confirm button. Only
    // sent if we have a real customer email address.
    if (bccCustomerEmail) {
      const waLink = buildCustomerWaLink(registration, company);
      const customerHtml = buildCustomerHtml({ registration, company, waLink });
      await sendViaResend({
        to: bccCustomerEmail,
        cc: undefined,
        bcc: undefined,
        html: customerHtml,
        subject: `Pendaftaran Anda Diterima — ${registration.namaPerusahaan || company?.name || ''}`,
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
