# LIMBAHIN New Customer Management — Setup Notes

This picks up from your `src_2.zip` (which only contained the `src/` folder — no
`package.json`). Merge this `src/` folder back into your actual project root (the one with
`package.json`, `vite.config.js`, `index.html`, etc.), then follow the steps below. I could not
run `npm install` / `npm run build` myself (no network access in my sandbox), so please do a local
build/dev run before deploying — I syntax-checked every new/changed file with esbuild, but that
doesn't catch everything a real build would.

## 1. New dependency

The app already used `@supabase/supabase-js` and `jspdf` — nothing new there. Nothing else was
added. If your `package.json` still lists `@base44/sdk`, you can remove it — nothing imports it
anymore.

## 2. Environment variables

Same as before — `.env` / `.env.local`:
```
VITE_SUPABASE_URL=https://cnpdazqpxnkdqdolqueo.supabase.co
VITE_SUPABASE_ANON_KEY=<the anon key you shared in chat>
```

## 3. Database — run `supabase/schema.sql`

Open the Supabase SQL editor and run `supabase/schema.sql`. It creates two new tables:

- **`referal_model`** — Step 1's "Kode Referal" now checks any code that isn't `MCC` against this
  table. A match skips straight to a final quote built from that one row. Add rows via the hidden
  `/tambahreferal` page (no login — reachable by URL only, per your answer).
- **`registrations`** — a backup record of every `/registrasi` (contract/MOU) submission. Nothing
  reads it back in the app; it's just there for you to check in the Supabase dashboard. This is
  **separate** from your Google Sheet, per your request not to touch that sheet with quotation
  leads.

Both tables have RLS policies that let the anon key insert (and `referal_model` also select) —
tighten these later if you add auth to `/tambahreferal`.

## 4. Edge Functions — email sending

Two functions, both under `supabase/functions/`:

- **`send-quote-email`** — sends the quotation PDF (company name, submission details, price
  summary in the body, PDF attached).
- **`send-registration-email`** — sends the full contract/MOU submission (company + PIC + contract
  choices + instruction code) to your kontrak team.

Both are written for **Resend** (https://resend.com) because it's the simplest to wire into a Deno
edge function with no SMTP setup — **I don't know what email provider your current
`send-quote-email` function (referenced in your old code but not included in the zip) actually
uses**, so I picked something reasonable rather than guess wrong. If you're already using
SendGrid/Postmark/SMTP, tell me and I'll swap the `sendViaResend()` call — everything else in both
files stays the same.

Deploy:
```
supabase functions deploy send-quote-email
supabase functions deploy send-registration-email
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
```

Recipient routing (per your instructions): **To: kontrak@mediacahayacerah.com, Cc:
kelvinfiless@gmail.com, Bcc: the customer** — so the customer never sees your internal addresses,
but still gets their own copy.

## 5. PDF header

Reverted to the original cyan-band header (the one from before my last message), now with your
round recycling-arrows logo badge and "PT Media Cahaya Cerah" added under the wordmark. The
letterhead-image version is gone — `src/assets/letterheadHeaderBase64.js` was removed since
nothing uses it anymore. The small in-app header logo (top-left of every page) still uses the
LIMBAH.IN wordmark crop from the earlier letterhead photo, which is unrelated to this and stays as
is.

## 6. What changed, in one list

- Removed all `@base44/sdk` auth — the whole app (quotation wizard, `/registrasi`,
  `/tambahreferal`) is now public, no login wall.
- `?param=` now parses as `<signed number><any letters>` (e.g. `15xyz` = +15%, `-26abc` = -26%,
  `0zzz` = normal price) instead of a fixed code list. No bounds enforced.
- PDF header now embeds your letterhead image instead of the old plain cyan band.
- Step 1 "Kode Referal": `MCC` still shows all options; any other code is checked live against
  Supabase `referal_model` and, if found, skips straight to a final quote/PDF for that one item.
- New hidden `/tambahreferal` page to add referral codes.
- Step 5 is now two options: "Request Kirim Penawaran" (email + WhatsApp redirect) or the red
  "Saya setuju..." button, which goes to `/registrasi`.
- New `/registrasi` page: the full company/PIC/contract-type/Festronik/Mekari form from your brief,
  ending in the **Kode Instruksi** field (`PKSTJS` / `PKSTPA` / `PKSB`, filled in by the customer
  after CS tells them which one). Submitting emails the kontrak team + opens WhatsApp with the
  full quotation + registration summary.

## 7. Known gaps / things I did not build

- I did not touch or see your Google Apps Script's Drive/Doc generation — `/registrasi` only
  **collects data and notifies your team**; actually generating the contract `.docx`/PDF still
  happens the way it does today (you running `createPKSTJS()` etc. against the "3.Branch" sheet).
  Nothing here writes to that sheet.
- No visible/automated way (yet) to protect `/tambahreferal` beyond being unlisted — fine for now
  per your answer, but flagging it since it's a page that writes pricing data.
- I have not run an actual `npm run build` — please do that locally before deploying.
