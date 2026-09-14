-- LIMBAHIN New Customer Management — new tables
-- Run this in the Supabase SQL editor (or `supabase db push` if you use migrations).
-- `pricelist_configs` and `pricelist_notes` already exist from the earlier quotation-only app;
-- these two are new for the referral-model shortcut and the registration/contract flow.

-- ============================================================
-- referal_model — Step 1 "Kode Referal" lookup table.
-- Any code typed here that ISN'T "MCC" is checked against this table (case-insensitive). A match
-- skips the rest of the quotation wizard and jumps straight to a final quote/PDF built from this
-- single row. Rows are added via the hidden /tambahreferal form.
-- ============================================================
create table if not exists referal_model (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique,
  lokasi_pelayanan   text,
  jenis_limbah       text,
  item_title         text not null,
  item_description   text,
  harga              numeric,
  unit               text,
  qty                numeric,
  jumlah             numeric,
  catatan_limbah     text,
  catatan_pelayanan  text,
  created_at         timestamptz not null default now()
);

create index if not exists referal_model_code_idx on referal_model (lower(code));

-- RLS: the app uses the anon key from the browser, so anon needs read (Step 1 lookup) and insert
-- (/tambahreferal form) access. Tighten this later if you add auth to /tambahreferal.
alter table referal_model enable row level security;

create policy "referal_model anon select" on referal_model
  for select to anon using (true);

create policy "referal_model anon insert" on referal_model
  for insert to anon with check (true);

-- ============================================================
-- registrations — backup record of every /registrasi (contract/MOU) submission.
-- Nothing in the app reads this back; it's purely there so staff have a record in Supabase even
-- though (per your request) this data does NOT get written to the existing Google Sheet.
-- ============================================================
-- NOTE: `umkm` and `jenis_kontrak` columns below are kept for backward compatibility with older
-- rows but are no longer populated by the app (the "belum NPWP" checkbox and the "Jenis Kontrak"
-- step were both removed from /registrasi). `rincian_pelayanan` is new — it stores the priced
-- service-summary text shown to the customer before submit, which is also what should be copied
-- into the {rinc} placeholder of the contract in Apps Script.
create table if not exists registrations (
  id                       uuid primary key default gen_random_uuid(),
  quote_code               text,
  company_name             text,
  nama_perusahaan          text,
  npwp                     text,
  umkm                     boolean,
  industri_bidang          text,
  alamat_limbah            text,
  alamat_dokumen           text,
  telp_perusahaan          text,
  email_perusahaan         text,
  pj_nama                  text,
  pj_jabatan               text,
  catatan_tambahan         text,
  manifest_pilihan         text,
  pic_operasional_nama     text,
  pic_operasional_tel      text,
  pic_keuangan_nama        text,
  pic_keuangan_tel         text,
  pic_lain                 text,
  jenis_kontrak            text,
  fisik_kontrak            text,
  instruction_code         text,
  rincian_pelayanan        text,
  created_at               timestamptz not null default now()
);

-- If this table already existed before this update, run this to add the new column:
-- alter table registrations add column if not exists rincian_pelayanan text;

alter table registrations enable row level security;

create policy "registrations anon insert" on registrations
  for insert to anon with check (true);

-- No anon select policy on purpose — submissions are write-only from the browser; staff read
-- them from the Supabase dashboard (which uses the service role key, bypassing RLS).

-- ============================================================
-- quotations — one row per Step-5 "Request Kirim Penawaran" submission (the normal wizard AND
-- the referral-code shortcut both write here, tagged by `quote_code`).
--
-- IMPORTANT: unlike `referal_model`/`registrations` above, the browser never inserts into this
-- table directly anymore. It's written server-side by the Apps Script web app (using the
-- service-role key) at the same time the "Quotations" tab on the new Google Sheet is appended —
-- see google-apps-script/Code.gs `handleQuotation_`. That's also why there's NO anon insert
-- policy below: nothing with the anon key should ever be able to write here.
--
-- `id` is set explicitly (not left to the column default) by Apps Script, using the same UUID
-- it also writes into the sheet's `id` column — this is what lets a later manual edit on the
-- sheet be upserted back here by matching on `id` (see the onEdit trigger installed by
-- `installEditTrigger` in Code.gs).
-- ============================================================
create table if not exists quotations (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  quote_code       text,
  service_label    text,
  company_name     text,
  company_address  text,
  company_contact  text,
  company_phone    text,
  email            text,
  summary_json     jsonb,
  items_json       jsonb,
  total            numeric,
  total_label      text,
  notes_json       jsonb
);

alter table quotations enable row level security;
-- No policies at all on purpose: only the service-role key (used server-side by Apps Script)
-- reads/writes this table. The anon key the browser uses has zero access.

-- `registrations` also gains columns for the Drive links Apps Script generates (doc_urls/pdf_urls
-- — plural, since one instruction code can mean more than one generated document, e.g. PKSTJS =
-- an SPK doc + a TJS contract) and the contract start/duration/end date fields collected on the
-- form, once the contract draft has actually been created — and stops being written to directly
-- by the browser (see google-apps-script/Code.gs `handleRegistration_`), so its insert policy is
-- no longer needed either. All of this is handled by the block below, which is safe to re-run.
alter table registrations add column if not exists doc_urls text;
alter table registrations add column if not exists pdf_urls text;
alter table registrations add column if not exists tanggal_mulai_kontrak text;
alter table registrations add column if not exists durasi_kontrak_tahun integer;
alter table registrations add column if not exists tanggal_akhir_kontrak text;
drop policy if exists "registrations anon insert" on registrations;
