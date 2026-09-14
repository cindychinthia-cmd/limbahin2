import { supabase } from './supabaseClient';

// Expected Supabase table: `pricelist_configs`
//
//   id            uuid / int, primary key
//   name          text        — label for this draft, e.g. "Default", "Promo Agustus 2026"
//   active        boolean     — exactly one row should be true; that row is what the webapp uses
//   constants     jsonb       — formula constants (mou, ptpbContract, spkmaxMinusRate, etc.)
//   vehicle_rates jsonb       — { [vehicleName]: { basedCost: number, costPerKm: number } }
//   locations     jsonb       — array of { name, available, distanceKm, region }
//   updated_at    timestamptz — tie-breaker if more than one row is accidentally active
//
// This app has NO local fallback data anymore — everything the wizard needs (constants, vehicle
// rates, locations) comes from the row where active = true. Create as many draft rows as you like;
// only the one with active = true is used, and nothing in the webapp writes back to this table —
// all edits happen directly in Supabase.
//
// Returns one of:
//   { status: 'ok', data }            — active row found and loaded
//   { status: 'not-configured' }      — VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set
//   { status: 'no-active-row' }       — table reachable, but no row has active = true
//   { status: 'error', message }      — request failed (network, table missing, RLS, etc.)
export async function fetchActiveConfig() {
  if (!supabase) return { status: 'not-configured' };

  const { data, error } = await supabase
    .from('pricelist_configs')
    .select('*')
    .eq('active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { status: 'error', message: error.message };
  if (!data) return { status: 'no-active-row' };
  return { status: 'ok', data };
}

// Loads a specific pricing model by its name. A blank URL config resolves to "Default".
export async function fetchConfigByName(name = 'Default') {
  if (!supabase) return { status: 'not-configured' };
  const wanted = String(name || 'Default').trim() || 'Default';
  const { data, error } = await supabase
    .from('pricelist_configs')
    .select('*')
    .ilike('name', wanted)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { status: 'error', message: error.message };
  if (!data) return { status: 'not-found', message: `Config "${wanted}" tidak ditemukan.` };
  return { status: 'ok', data };
}

// Notes use the matching config name when one exists; otherwise the active notes row is retained
// for backwards compatibility with installations that have only one shared notes model.
export async function fetchNotesByConfigName(name = 'Default') {
  if (!supabase) return { status: 'not-configured' };
  const wanted = String(name || 'Default').trim() || 'Default';
  let result = await supabase
    .from('pricelist_notes')
    .select('*')
    .ilike('name', wanted)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (result.error) return { status: 'error', message: result.error.message };
  if (!result.data) {
    result = await supabase
      .from('pricelist_notes')
      .select('*')
      .eq('active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
  }
  if (result.error) return { status: 'error', message: result.error.message };
  if (!result.data) return { status: 'not-found', message: 'Catatan pricelist tidak ditemukan.' };
  return { status: 'ok', data: result.data };
}

// Expected Supabase table: `pricelist_notes` — see supabase/pricelist_notes.sql for the full DDL.
//
//   id             uuid, primary key
//   name           text        — label for this draft
//   active         boolean     — exactly one row should be true; that row is what the webapp uses
//   global_note    text        — "Catatan Umum" shown on every quote
//   waste_notes    jsonb       — { [wasteTypeId]: text } — "Catatan Limbah"
//   service_notes  jsonb       — { [serviceId]: text } — "Catatan Pelayanan" (supports {{token}}
//                                 placeholders resolved against pricelist_configs.constants, see
//                                 lib/pricing.js renderNoteTemplate())
//   updated_at     timestamptz
//
// Same "no local fallback" rule as fetchActiveConfig(): if there's no active row, the app should
// show an error rather than compute with missing note text.
export async function fetchActiveNotes() {
  if (!supabase) return { status: 'not-configured' };

  const { data, error } = await supabase
    .from('pricelist_notes')
    .select('*')
    .eq('active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { status: 'error', message: error.message };
  if (!data) return { status: 'no-active-row' };
  return { status: 'ok', data };
}

// Expected Supabase table: `referal_model` — see supabase/schema.sql for the full DDL.
//
//   id                  uuid, primary key
//   code                text, unique (case-insensitive match — see lookup below)
//   lokasi_pelayanan    text
//   jenis_limbah        text
//   item_title          text
//   item_description    text
//   harga               numeric
//   unit                text
//   qty                 numeric
//   jumlah              numeric  — total amount for this line (harga × qty, entered directly)
//   catatan_limbah      text
//   catatan_pelayanan   text
//   created_at          timestamptz
//
// Step 1's "Kode Referal" field checks this table for any code that isn't "MCC". A match skips
// the rest of the wizard entirely and jumps straight to a final quote/PDF built from this single
// row — see lib/referralQuote.js.
//
// Returns one of:
//   { status: 'ok', data }            — a row with this code was found
//   { status: 'not-found' }           — table reachable, no row with this code
//   { status: 'not-configured' }      — Supabase env vars not set
//   { status: 'error', message }      — request failed
export async function fetchReferralByCode(code) {
  if (!supabase) return { status: 'not-configured' };
  const trimmed = (code || '').trim();
  if (!trimmed) return { status: 'not-found' };

  const { data, error } = await supabase
    .from('referal_model')
    .select('*')
    .ilike('code', trimmed)
    .limit(1)
    .maybeSingle();

  if (error) return { status: 'error', message: error.message };
  if (!data) return { status: 'not-found' };
  return { status: 'ok', data };
}

// Used by /tambahreferal to insert a new referral row.
export async function insertReferralModel(row) {
  if (!supabase) return { status: 'not-configured' };
  const { data, error } = await supabase.from('referal_model').insert([row]).select().maybeSingle();
  if (error) return { status: 'error', message: error.message };
  return { status: 'ok', data };
}

// NOTE: no longer called anywhere in the app. /registrasi submissions now go through the Apps
// Script web app (src/lib/appsScript.js -> submitRegistration), which writes to Supabase itself
// server-side using the service-role key (see google-apps-script/Code.gs `handleRegistration_`
// and the updated RLS policy in supabase/schema.sql). Left here only in case you want a
// browser-side fallback path later.
export async function insertRegistration(row) {
  if (!supabase) return { status: 'not-configured' };
  const { data, error } = await supabase.from('registrations').insert([row]).select().maybeSingle();
  if (error) return { status: 'error', message: error.message };
  return { status: 'ok', data };
}
