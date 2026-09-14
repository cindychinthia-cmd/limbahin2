// ⚠️ DEPRECATED — no longer called anywhere in the app. Home.jsx now sends the quotation email
// via the Google Apps Script web app (GmailApp) instead of Resend — see
// google-apps-script/Code.gs `sendQuotationEmail_` and src/lib/appsScript.js. Kept here only for
// reference / in case you want to revert. Safe to delete along with the RESEND_API_KEY secret
// once you've confirmed the Apps Script path is working.
//
// Supabase Edge Function: send-quote-email
//
// Deploy:   supabase functions deploy send-quote-email
// Secrets:  supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
//
// This is written for Resend (https://resend.com) because it's the simplest option to wire up in
// a Deno edge function with no SMTP setup. If you already use a different provider (SendGrid,
// Postmark, your own SMTP via the old Apps Script GmailApp, etc.) tell Claude and this gets
// swapped — only the `sendViaResend()` function at the bottom needs to change, the request
// parsing/validation above it stays the same.
//
// Called from the frontend as:
//   supabase.functions.invoke('send-quote-email', { body: {
//     email, filename, pdfBase64, quoteCode, companyName, summary, total, totalLabel, serviceLabel
//   }})

import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = Deno.env.get('QUOTE_EMAIL_FROM') || 'LIMBAHIN <cs@mediacahayacerah.com>';
const MAIN_TO = 'kontrak@mediacahayacerah.com';
const CC = ['kelvinfiless@gmail.com'];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function formatIDR(v) {
  return `IDR ${Math.round(Number(v || 0)).toLocaleString('id-ID')}`;
}

function buildHtml({ companyName, quoteCode, serviceLabel, summary, total, totalLabel }) {
  const rows = (summary || [])
    .map((s) => `<tr><td style="padding:4px 12px 4px 0;color:#64748b;">${s.label}</td><td style="padding:4px 0;font-weight:600;">${s.value}</td></tr>`)
    .join('');
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#0f232c;">
    <h2 style="color:#185c6c;margin-bottom:4px;">Penawaran Harga LIMBAHIN</h2>
    <p style="color:#64748b;font-size:13px;margin-top:0;">Kode: ${quoteCode}</p>
    <p style="font-size:14px;">Terima kasih${companyName ? `, <strong>${companyName}</strong>,` : ','} telah mengajukan permintaan penawaran melalui web LIMBAHIN. Berikut ringkasan penawaran Anda — dokumen lengkap (PDF) terlampir pada email ini.</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0;">${rows}</table>
    <div style="background:#f0faf9;border:1px solid #cde3e0;border-radius:8px;padding:12px 16px;display:flex;justify-content:space-between;">
      <strong>${serviceLabel || ''}</strong>
    </div>
    <p style="font-size:18px;font-weight:700;color:#185c6c;margin:12px 0 20px;">${totalLabel || 'Total'}: ${formatIDR(total)}</p>
    <p style="font-size:13px;color:#64748b;">Jika ada pertanyaan, silakan hubungi CS LIMBAHIN melalui WhatsApp di 0851 2800 5532.</p>
    <p style="font-size:13px;color:#64748b;">Salam,<br/>Tim LIMBAHIN — PT Media Cahaya Cerah</p>
  </div>`;
}

async function sendViaResend({ toCustomer, filename, pdfBase64, html, subject }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [MAIN_TO],
      cc: CC,
      bcc: [toCustomer],
      subject,
      html,
      attachments: [{ filename, content: pdfBase64 }],
    }),
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
    const { email, filename, pdfBase64, quoteCode, companyName, summary, total, totalLabel, serviceLabel } = body;

    if (!email || !pdfBase64 || !filename) {
      return new Response(JSON.stringify({ error: 'email, filename, dan pdfBase64 wajib diisi.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const html = buildHtml({ companyName, quoteCode, serviceLabel, summary, total, totalLabel });
    const subject = `Penawaran LIMBAHIN${companyName ? ` — ${companyName}` : ''} (${quoteCode || ''})`;

    await sendViaResend({ toCustomer: email, filename, pdfBase64, html, subject });

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
