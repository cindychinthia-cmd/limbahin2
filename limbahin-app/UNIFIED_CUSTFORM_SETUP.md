# LIMBAHIN Unified Custform — deployment guide

This branch replaces the separate quotation and registration pages/models with one customer flow
at `/` and one persisted `custforms` record.

## Customer URL

```
/?id=<optional-uuid>&config=<optional-config-name>&rate=<required-rate-code>
```

- `rate` must begin with `r`: `r20abc` means +20%, `r0abc` means normal pricing,
  and `r-10abc` means -10%. A value such as `20abc` is rejected.
- A missing `config` uses the `pricelist_configs` row named `Default`.
- A missing/invalid rate opens a blocking setup layer. Config remains optional there.
- When `id` is present, the stored rate/config always wins over conflicting URL values.
- Email buttons add `step=2` (edit service) or `step=3` (continue registration), while still
  loading the same custform ID.

The customer journey is Data Dasar → Pelayanan → Registrasi. It never navigates to
`/registrasi` or `/hasil`; success and editing remain inside the same `/` page.

## 1. Supabase migration (destructive)

Run [supabase/schema.sql](./supabase/schema.sql) in Supabase SQL Editor.

It:

- converts each legacy referral line into the new `referal_model.items jsonb[]` shape;
- removes the six legacy single-item columns;
- creates `custforms`, with no anon RLS access;
- drops `quotations` and `registrations` as requested.

Back up the old tables first if their historical rows are still needed. The drop is intentional.

The browser anon key can read referral/config data and insert referral models through the unlisted
staff page. Custform create/read/update happens only through Apps Script with the service-role key.

## 2. Apps Script

Replace the deployed project code with [google-apps-script/Code.gs](./google-apps-script/Code.gs).

Add these Script Properties:

```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
APP_BASE_URL=https://<deployed-customer-form-origin>
```

Keep the service-role key only in Script Properties. Never put it in a Vite variable or browser
code.

Deploy a **new Web App version**:

- Execute as: **Me**
- Who has access: **Anyone**

Then keep the resulting `/exec` URL in the frontend:

```
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/<deployment-id>/exec
```

The existing browser Supabase variables remain public client settings:

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-public-key>
```

## 3. SPK diagnostics and recovery

Document types are generated independently. For example, PKSTJS attempts SPK and TJS separately.
A failure in one no longer discards or prevents the other.

The internal registration email now contains:

- each successful document type;
- the exact failed document type;
- the Apps Script/Drive/export error message.

The customer gets a separate, safe email without internal error details. If SPK still fails, use
the internal email message to check the SPK template ID, file type, sharing/ownership, and the
deploying account's Drive permission.

## 4. Changed behavior

- A translucent white blur blocks all input while loading, saving, emailing, or generating drafts.
- Step 1 requires email and uses the configured Kota/Kecamatan picker.
- Waste types appear only after location is selected.
- Referral entry is at the end of the service questions.
- Referrals support multiple items, each with item, description, harga, unit, qty, and jumlah.
- Text summaries now include item descriptions.
- The quotation review shows the full text summary above its two action buttons.
- Instruction code is free text with a prompt to contact CS.
- Google Sheet/Supabase phone values are stored as digits (for example `62812...`), without `+`.
- Quotation and registration sends overwrite the same custform ID.
- Both sends open WhatsApp in a new tab and show an in-page result with spam-folder guidance.
- Quote emails include Edit Service and Continue Registration links.

## 5. Removed

- Customer routes `/registrasi` and `/hasil`
- React pages used only by those routes
- `paramRule.js` and the old `?param=` convention
- Deprecated Resend edge functions
- Supabase `quotations` and `registrations` tables

The unlisted staff routes `/tambahreferal` and `/settings/:location` remain.
