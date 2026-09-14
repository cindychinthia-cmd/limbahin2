# LIMBAHIN — This round of changes

Answers + setup steps for everything requested in this batch. Read this top to bottom before
deploying — the last section (Apps Script + Supabase) requires manual setup steps that can't be
done for you from here.

## 1. Small UI fixes (done, no setup needed)

- **Button colors** — `QuotationActions.jsx`: both the email button ("Request Kirim Penawaran")
  and the red "Saya setuju..." button now use the same dark-cyan brand color (`variant="default"`,
  which maps to `--primary`, `hsl(192 43% 34%)`) instead of the previous white outline / red.
- **Phone numbers always start with +62** — new `src/lib/phone.js` (`normalizeIndoPhone`),
  applied to every phone/WA field: "Nomor Kontak" (Step 1), "No. Telp Perusahaan", "Tel/WA PIC
  Operasional", "Tel/WA PIC Keuangan". Typing `0812...`, `62812...`, or just `812...` all
  normalize to `+62 812-...`. Known caveat: because it reformats on every keystroke, the cursor
  can jump to the end while typing in the middle of the number — acceptable for now, but flag it
  if it bothers people in practice and it can be smoothed out further.

## 2. Pricelist summary — now itemized and accurate

New `buildPricelistSummaryText(quote)` in `src/lib/pricing.js` replaces the old summary, which
only listed *choices* (location, waste type, range...) and never showed price/qty/unit — which is
why it didn't match the actual price list document. The new version lists every selected item with
its price, unit, quantity and subtotal, the total, and a condensed version of the pelayanan/limbah
notes. It's now used in:

- The WhatsApp message sent to CS (`src/lib/waMessages.js`)
- The "Rincian Pelayanan & Harga" section on `/registrasi` (shown to the customer AND sent in the
  registration payload / dropped into the contract's `{rinc}` field)
- The quotation email body (Apps Script `buildItemizedSummaryText_` — kept in sync by hand with
  the JS version since Apps Script can't import it directly)

## 3. Direct-registration referral gate

`/registrasi` opened directly (no quotation wizard state) used to be a dead end ("Belum ada
penawaran aktif"). It now shows a "Masukkan Kode Referal" gate: enter the code, it's looked up
against Supabase `referal_model` (same lookup as Step 1 of the wizard), and once found a quote is
built from it — then the rest of the registration form appears, same as the normal path. `?param=`
in the URL still applies as a price multiplier here too.

## 4. New flow: Apps Script + Supabase + Google Sheet, Resend retired

### Your question — is Resend still needed?

**No.** Since actual contract-draft generation is now wired up (see below), everything Resend was
doing is replaced by `GmailApp` inside the new Apps Script web app. Both edge functions
(`supabase/functions/send-quote-email`, `send-registration-email`) are marked `⚠️ DEPRECATED` at
the top of their files and are no longer called anywhere in the app. You can delete them and the
`RESEND_API_KEY` secret once you've confirmed the new path works — nothing else depends on them.

### What actually happens now

**New file: `google-apps-script/Code.gs`** — paste this into a brand-new Apps Script project bound
to a **new** Google Sheet (per your request, so it doesn't touch "3.Branch" or the existing MCC
Document Generator script at all — both can keep running independently).

- **Quotation flow** (Step 5 "Request Kirim Penawaran"): the browser calls the Apps Script web app
  once. It appends a row to a "Quotations" tab, upserts the same row into a new Supabase
  `quotations` table (service-role key, server-side), and emails the client-built PDF via Gmail —
  To: kontrak@, Cc: kelvin, Bcc: the customer.
- **Registration flow** (`/registrasi` final submit): one call appends a row to a "Registrations"
  tab, **generates the actual contract draft** (.docx copy + PDF) from `instructionCode`
  (`PKSTJS`/`PKSTPA`/`PKSB`) — reusing the exact template-copy-and-fill approach from your existing
  MCC Document Generator's `createFile()`, just driven by the web submission instead of a row on
  "3.Branch" + a manual prompt — saves it to Drive, upserts the row (with the new Drive links) into
  a `registrations` Supabase table, and emails the PDF + docx immediately.
- **Direct-registration path** (referral code, no prior quotation): submits through the exact same
  `handleRegistration_` path — it doesn't matter to Apps Script whether the quote came from the
  5-step wizard or the referral shortcut.
- **Sheet → Supabase sync**: run `installEditTrigger` once (see below) to catch manual edits made
  directly on the "Quotations"/"Registrations" tabs and push them back into Supabase.

---

## Round 3 changes (this update)

- **Logo** — the "LIMBAHIN WASTE MANAGEMENT SOLUTION" text banner is gone everywhere; all headers
  now use the circular-arrows badge logo (matches the logo file you sent — it was already in the
  codebase as `LOGO_BADGE_PNG`, previously only used in the PDF).
- **Instruction codes fixed** — `google-apps-script/Code.gs`'s `INSTRUCTION_DOC_GROUPS` now
  generates the right document *sets*: `PKSTJS`→[SPK,TJS], `PKSTPA`→[SPK,TPA],
  `PKSPLIB`→[SPK,PLIB], `PKSB`→[PKB], and a new `SPK`→[SPK]-only code. The field on `/registrasi`
  is now a picker (`ChoiceCard`) instead of free text, so a typo can't produce an unrecognized
  code anymore. **You still need to re-deploy the Apps Script** (Deploy → Manage deployments →
  New version) for this to take effect.
- **Contract dates** — new "Tanggal Mulai Kontrak" + "Durasi Kontrak" (1/2/3 tahun) fields;
  end date is computed automatically and both are sent through as `{tm}`/`{ta}` in dd/mm/yyyy
  format (`src/lib/contractDates.js`). A note next to the duration picker flags that
  PTPB/annual-billed services get charged per year of the term selected.
- **SPK minimum-quantity note** added under "Jumlah limbah per pengambilan?".
- **Duplicate notes field removed** — "Info / Catatan Tambahan dari Pelanggan" is gone from
  `/registrasi`; the remaining "Catatan Tambahan (opsional)" (PIC section) now covers both the
  contract's `{catatan}` and `{picextra}` placeholders.
- **"Ubah Pilihan Harga"** — a link next to Rincian Pelayanan on `/registrasi` sends the customer
  back to Step 1 of the quotation wizard to re-pick pricing, without losing anything already typed
  into the registration form (round-trips via router state as `registrationDraft` /  `homeDraft`).
- **Email popup** — Step 5's "Request Kirim Penawaran" no longer shows an always-visible email
  field; clicking it opens a popup (using the existing shadcn `Dialog`) asking for the address.
- **New `/hasil` result page** — after either flow opens WhatsApp, the tab itself now navigates to
  `/hasil`, showing success or failure with two buttons: "Edit Data" (returns to the relevant form,
  prefilled with what was submitted) and "Kembali ke Beranda".
- **"Jangan refresh" warning** — shown near the top of both the quotation wizard and
  `/registrasi`.
- **"Saya setuju..." button** — now the lighter `--accent` cyan instead of the darker `--primary`
  cyan, so the two Step-5 actions read as visually distinct.
- **Removed** the "Atau Ke Halaman Quotation" button from the direct-registration referral gate.
- **Mandatory-field asterisks** — `Field`/`AreaField`/`SelectField`/`SectionTitle` now render a
  red `*` automatically whenever `required` is passed; applied across `/registrasi`'s required
  fields and section headers.
- Supabase: `doc_url`/`pdf_url` renamed to `doc_urls`/`pdf_urls` (plural — one instruction code can
  now generate more than one document) and gained `tanggal_mulai_kontrak` /
  `durasi_kontrak_tahun` / `tanggal_akhir_kontrak` columns. Re-run `supabase/schema.sql`.

**Still worth doing yourself before relying on this:** a real end-to-end click-through of both
flows (especially the new instruction-code → multi-document generation, and the edit round-trips)
— none of this could be executed/tested from here.


### Setup steps

1. **Create the new Google Sheet**, open Extensions → Apps Script, paste in
   `google-apps-script/Code.gs`.
2. **Script Properties** (Project Settings → Script Properties) — add:
   ```
   SUPABASE_URL              = https://cnpdazqpxnkdqdolqueo.supabase.co
   SUPABASE_SERVICE_ROLE_KEY = <service role key from Supabase project settings — NOT the anon key>
   ```
3. **Run `supabase/schema.sql`** in the Supabase SQL editor (adds the new `quotations` table,
   `doc_url`/`pdf_url` columns on `registrations`, and removes the now-unneeded anon insert policy
   on `registrations` since Apps Script writes there directly with the service-role key now).
4. **Run `installEditTrigger` once**, manually, from the Apps Script editor (select it in the
   function dropdown, click ▷ Run, approve the authorization prompt). This is what enables the
   sheet → Supabase sync — a plain `onEdit` can't make the external request Supabase needs, so it
   has to be this installable trigger.
5. **Deploy → New deployment → Web app** — Execute as "Me", Who has access "Anyone". Copy the
   `/exec` URL.
6. **Frontend `.env` / `.env.local`** — add:
   ```
   VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/XXXXXXXX/exec
   ```
7. Double-check `CONTRACT_DOC_FOLDER_ID` / `CONTRACT_PDF_FOLDER_ID` near the top of `Code.gs` —
   they default to the same Drive folder your original script already uses. Change them if you'd
   rather these new drafts land somewhere else.
8. Do a real end-to-end test of both flows (quotation email, and a registration all the way
   through to receiving the generated PDF/docx) before relying on this in production — none of
   this could be executed/tested from here (no Google account access in this environment).

### Frontend files touched for this

- `src/lib/appsScript.js` (new) — client for the web app (`submitQuotation`, `submitRegistration`).
- `src/pages/Home.jsx` — Step 5 email now calls `submitQuotation` instead of
  `supabase.functions.invoke('send-quote-email')`.
- `src/pages/Registrasi.jsx` — final submit now calls `submitRegistration` instead of a direct
  `supabase.from('registrations').insert()` + `supabase.functions.invoke('send-registration-email')`.
- `src/lib/remoteConfig.js` — `insertRegistration()` is no longer called anywhere (left in place,
  noted as unused, in case you want a browser-side fallback later).
