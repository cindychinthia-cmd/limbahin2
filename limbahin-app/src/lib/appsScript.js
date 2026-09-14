// Client for the Google Apps Script web app that backs the NEW spreadsheet (separate from the
// "3.Branch" sheet used by the old MCC Document Generator script). See
// google-apps-script/Code.gs for the server-side implementation.
//
// Why this exists / what it replaces:
//   Previously, /registrasi called supabase.functions.invoke('send-registration-email') (Resend)
//   and Home.jsx called supabase.functions.invoke('send-quote-email') (also Resend), and
//   /registrasi separately wrote a backup row straight to Supabase from the browser. Per your
//   instructions, all three of those responsibilities now live in one place — this Apps Script
//   web app — instead of Resend:
//     1. Appends the submission as a row on the new Google Sheet.
//     2. Upserts the same record into Supabase (`quotations` / `registrations` tables) using the
//        service-role key *server-side* in Apps Script — the browser never touches those two
//        tables directly anymore, so no anon RLS insert policy is needed for them.
//     3. Sends the email:
//        - Quotation: emails the PDF the browser already built (base64) via GmailApp.
//        - Registration: generates the contract draft (.docx + PDF) from `instructionCode` using
//          the same template-filling logic as the original "3.Branch" MCC Document Generator
//          script, saves it to Drive, and emails it immediately via GmailApp.
//   That means the Resend edge functions (`supabase/functions/send-quote-email` and
//   `send-registration-email`) are no longer called anywhere in the app — see NEW_SETUP_NOTES.md
//   for whether you still want to keep/delete them.
//
// Add to your `.env` / `.env.local`:
//   VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/XXXXXXXX/exec
//
// NOTE ON CORS: Apps Script web apps don't reliably support `Content-Type: application/json`
// fetch requests from a browser (the preflight OPTIONS request Apps Script receives can't carry
// custom response headers back). The standard workaround — used here — is to send the JSON body
// with `Content-Type: text/plain;charset=utf-8` instead, which keeps this a CORS "simple request"
// (no preflight). Code.gs still parses `e.postData.contents` as JSON regardless of the declared
// content type, so nothing is lost.
const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL;

async function callAppsScript(action, payload) {
  if (!APPS_SCRIPT_URL) {
    throw new Error('VITE_APPS_SCRIPT_URL belum diisi — hubungkan dulu ke Apps Script web app.');
  }
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, payload }),
  });
  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Respons Apps Script tidak valid (status ${res.status}).`);
  }
  if (!res.ok || json?.error) {
    throw new Error(json?.error || `Gagal menghubungi Apps Script (status ${res.status}).`);
  }
  return json;
}

// Called from Home.jsx / the referral quote review step when the customer taps "Request Kirim
// Penawaran". `pdfBase64`/`filename` are the client-built quote PDF (see lib/pdf.js).
export function submitQuotation({ email, filename, pdfBase64, quote, company }) {
  return callAppsScript('quotation', {
    email,
    filename,
    pdfBase64,
    quoteCode: quote?.code,
    serviceLabel: quote?.serviceLabel,
    summary: quote?.summary,
    items: quote?.items,
    total: quote?.total,
    totalLabel: quote?.totalLabel,
    notes: quote?.notes,
    company,
  });
}

// Called from Registrasi.jsx on final submit ("Request Kirim Kontrak").
export function submitRegistration({ quote, company, registration }) {
  return callAppsScript('registration', { quote, company, registration });
}
