-- LIMBAHIN unified customer-form migration.
-- Review and run once in Supabase SQL Editor. This intentionally drops the obsolete
-- quotations and registrations tables after custforms is created.

create extension if not exists pgcrypto;

-- One referral can contain any number of priced line items.
alter table if exists referal_model
  add column if not exists items jsonb not null default '[]'::jsonb;

-- Preserve legacy referral rows by converting their single item before dropping old columns.
-- Dynamic SQL keeps this migration safe to re-run after those columns have already been removed.
do $
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'referal_model' and column_name = 'item_title'
  ) then
    execute $migration$
      update referal_model
      set items = jsonb_build_array(jsonb_build_object(
        'item', coalesce(item_title, 'Item'),
        'description', coalesce(item_description, ''),
        'harga', harga,
        'unit', coalesce(unit, ''),
        'qty', qty,
        'jumlah', jumlah
      ))
      where (items is null or jsonb_array_length(items) = 0)
        and item_title is not null
    $migration$;
  end if;
end $;

alter table if exists referal_model
  drop column if exists item_title,
  drop column if exists item_description,
  drop column if exists harga,
  drop column if exists unit,
  drop column if exists qty,
  drop column if exists jumlah;

alter table referal_model enable row level security;
drop policy if exists "referal_model anon select" on referal_model;
drop policy if exists "referal_model anon insert" on referal_model;
create policy "referal_model anon select" on referal_model
  for select to anon using (true);
create policy "referal_model anon insert" on referal_model
  for insert to anon with check (
    code is not null
    and jsonb_typeof(items) = 'array'
    and jsonb_array_length(items) > 0
  );

-- A single row is overwritten as the customer emails a quote, edits it, and later submits
-- registration. Browser clients have no direct access; Apps Script uses the service-role key.
create table if not exists custforms (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  status               text not null default 'draft',
  rate                 text not null,
  config               text not null default 'Default',
  email                text not null,
  company_name         text,
  pic_name              text,
  phone                 text,
  location              text,
  waste                 text,
  service               text,
  referral_id           uuid references referal_model(id) on delete set null,
  rincian_pelayanan     text,
  state_json            jsonb not null default '{}'::jsonb,
  quote_json            jsonb,
  registration_json     jsonb,
  doc_urls              text,
  pdf_urls              text
);

create index if not exists custforms_updated_at_idx on custforms(updated_at desc);
create index if not exists custforms_email_idx on custforms(lower(email));
alter table custforms enable row level security;
-- No anon policies: create/load/update is mediated by Apps Script. The opaque UUID in the emailed
-- link acts as the passwordless magic link, while the service-role credential stays server-side.

drop table if exists quotations cascade;
drop table if exists registrations cascade;
