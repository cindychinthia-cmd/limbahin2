// Browser client for the Google Apps Script web app.
// text/plain keeps requests CORS-simple; Code.gs parses the JSON body.
const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL;

async function callAppsScript(action, payload) {
  if (!APPS_SCRIPT_URL) {
    throw new Error('VITE_APPS_SCRIPT_URL belum diisi — hubungkan aplikasi ke Apps Script web app.');
  }
  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, payload }),
  });
  let json;
  try {
    json = await response.json();
  } catch {
    throw new Error(`Respons Apps Script tidak valid (status ${response.status}).`);
  }
  if (!response.ok || json?.error) {
    throw new Error(json?.error || `Gagal menghubungi Apps Script (status ${response.status}).`);
  }
  return json.data;
}

export function loadCustform(id) {
  return callAppsScript('load', { id });
}

export function submitQuotation({ id, rate, config, state, quote, registration, filename, pdfBase64 }) {
  return callAppsScript('quotation', {
    id,
    rate,
    config,
    state,
    quote,
    registration,
    filename,
    pdfBase64,
  });
}

export function submitRegistration({ id, rate, config, state, quote, registration }) {
  return callAppsScript('registration', {
    id,
    rate,
    config,
    state,
    quote,
    registration,
  });
}
