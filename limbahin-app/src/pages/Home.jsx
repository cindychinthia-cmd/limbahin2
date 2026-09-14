import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Stepper from '@/components/pricelist/Stepper';
import CompanyStep from '@/components/pricelist/CompanyStep';
import LocationWasteStep from '@/components/pricelist/LocationWasteStep';
import ServiceStep from '@/components/pricelist/ServiceStep';
import ServiceParams from '@/components/pricelist/ServiceParams';
import ReviewStep from '@/components/pricelist/ReviewStep';
import QuoteDocument from '@/components/pricelist/QuoteDocument';
import QuotationActions from '@/components/pricelist/QuotationActions';
import { StepIntro, NoRefreshWarning } from '@/components/pricelist/fields';
import { computeQuote, serviceDefaults } from '@/lib/pricing';
import { getQuotePdfBase64, quotePdfFilename } from '@/lib/pdf';
import { fetchReferralByCode } from '@/lib/remoteConfig';
import { buildReferralQuote } from '@/lib/referralQuote';
import { parseParamMultiplier } from '@/lib/paramRule';
import { useSettings } from '@/settings/SettingsContext';
import { submitQuotation } from '@/lib/appsScript';

import { LOGO_BADGE_PNG } from '@/assets/logoBadgeBase64.js';

const INITIAL = {
  company: { name: '', address: '', contact: '', phone: '' },
  location: '',
  waste: '',
  service: '',
  params: null,
};

const STEP_TITLES_FULL = ['Detail Perusahaan', 'Lokasi & Jenis Limbah', 'Pilih Layanan', 'Parameter Tambahan', 'Review & Kirim'];
const STEP_TITLES_REFERRAL = ['Detail Perusahaan', 'Review & Kirim'];

export default function Home() {
  const location = useLocation();
  // If we got here via "Ubah Pilihan Harga" on /registrasi (edit round-trip) or "Edit Data" on
  // /hasil, `location.state` carries whatever should be restored so the customer doesn't have to
  // redo work they'd already done:
  //   - `homeDraft`: the full wizard state (company/location/waste/service/params) to resume from
  //   - `registrationDraft`: the in-progress /registrasi form to hand back once a new quote is
  //     built and the customer clicks "Saya setuju..." again
  const { homeDraft, registrationDraft } = location.state || {};

  const [state, setState] = useState(homeDraft || INITIAL);
  const [step, setStep] = useState(1);
  const [referral, setReferral] = useState(homeDraft?.referral || '');
  // idle | checking | found | notfound | error
  const [referralLookup, setReferralLookup] = useState('idle');
  const [referralRow, setReferralRow] = useState(null);
  const { constants, content, loading, error, ready } = useSettings();

  const urlParams = new URLSearchParams(window.location.search);
  const multiplier = parseParamMultiplier(urlParams.get('param'));
  const paramValid = multiplier != null;

  const showAll = referral.trim().toUpperCase() === 'MCC';

  // Debounced lookup against Supabase `referal_model` whenever the referral code changes and
  // isn't empty / "MCC". A non-MCC code that resolves here skips the rest of the wizard entirely
  // and jumps straight to a final quote built from that single row (see buildReferralQuote()).
  useEffect(() => {
    const trimmed = referral.trim();
    if (!trimmed || showAll) {
      setReferralLookup('idle');
      setReferralRow(null);
      return;
    }
    let cancelled = false;
    setReferralLookup('checking');
    const t = setTimeout(async () => {
      const res = await fetchReferralByCode(trimmed);
      if (cancelled) return;
      if (res.status === 'ok') {
        setReferralRow(res.data);
        setReferralLookup('found');
      } else if (res.status === 'not-found') {
        setReferralRow(null);
        setReferralLookup('notfound');
      } else {
        setReferralRow(null);
        setReferralLookup('error');
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [referral, showAll]);

  const referralFound = referralLookup === 'found' && !!referralRow;
  const referralError =
    referral.trim() !== '' && !showAll && (referralLookup === 'notfound' || referralLookup === 'error');

  const referralQuote = useMemo(
    () => (referralFound && paramValid ? buildReferralQuote(referralRow, multiplier) : null),
    [referralFound, referralRow, multiplier, paramValid]
  );

  const quote = useMemo(
    () => (!referralFound && paramValid && ready ? computeQuote(state, constants, content, multiplier, showAll) : null),
    [referralFound, paramValid, ready, state, constants, content, multiplier, showAll]
  );

  const onReferral = (value) => {
    setReferral(value);
    setStep(1); // referral changes what the wizard even looks like — always restart at step 1
  };

  const totalSteps = referralFound ? 2 : 5;
  const STEP_TITLES = referralFound ? STEP_TITLES_REFERRAL : STEP_TITLES_FULL;

  const done = referralFound
    ? [true, true]
    : [
        !referralError && referralLookup !== 'checking',
        !!(state.location && state.waste),
        !!state.service,
        showAll ||
          (!!state.params &&
            (state.service === 'SPK'
              ? state.params.needContract != null
              : state.service === 'PTPB'
                ? !!(state.params.option && state.params.monthly != null && state.params.visits != null)
                : state.service === 'RUTIN'
                  ? state.params.kg != null
                  : true)),
        true,
      ];

  const patch = (p) => setState((s) => ({ ...s, ...p }));
  const handlers = {
    company: (company) => patch({ company }),
    location: (location) => patch({ location, waste: '', service: '', params: null }),
    waste: (waste) => patch({ waste, service: '', params: null }),
    service: (service) =>
      setState((s) => ({ ...s, service, params: showAll ? null : serviceDefaults(service, s.location, content) })),
    params: (params) => patch({ params }),
  };

  // Step 5 no longer talks to Resend/Supabase Edge Functions directly — it now calls the Google
  // Apps Script web app, which appends this submission to the new Google Sheet, upserts it into
  // Supabase's `quotations` table (server-side, via the service-role key), and sends the email
  // with the client-built PDF attached. See lib/appsScript.js and google-apps-script/Code.gs.
  const handleSendEmail = async (email) => {
    const activeQuote = referralFound ? referralQuote : quote;
    if (!activeQuote) throw new Error('Dokumen belum siap.');
    const pdfBase64 = getQuotePdfBase64(activeQuote, state.company);
    const filename = quotePdfFilename(activeQuote);
    await submitQuotation({
      email,
      filename,
      pdfBase64,
      quote: activeQuote,
      company: state.company,
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
    );
  }

  if (error) {
    const messages = {
      'not-configured': 'Supabase belum terhubung ke aplikasi ini (env var VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY belum diisi).',
      'no-active-row':
        'Tidak ada konfigurasi pricelist yang aktif di Supabase. Pastikan satu baris di tabel pricelist_configs DAN satu baris di tabel pricelist_notes masing-masing memiliki active = true.',
      error: `Gagal memuat data dari Supabase: ${error.message || 'terjadi kesalahan.'}`,
    };
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center font-body text-foreground">
        <img src={LOGO_BADGE_PNG} alt="LIMBAHIN" className="h-11 w-auto object-contain" />
        <div className="mt-5 flex items-center gap-2 text-destructive">
          <FileQuestion className="h-5 w-5" />
          <p className="font-display text-lg font-bold">Data pricelist tidak tersedia</p>
        </div>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {messages[error.status] || messages.error}
        </p>
      </div>
    );
  }

  if (!paramValid) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center font-body text-foreground">
        <img src={LOGO_BADGE_PNG} alt="LIMBAHIN" className="h-11 w-auto object-contain" />
        <div className="mt-5 flex items-center gap-2 text-destructive">
          <FileQuestion className="h-5 w-5" />
          <p className="font-display text-lg font-bold">Price list tidak ditemukan</p>
        </div>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Tautan pricelist tidak valid atau telah kedaluwarsa. Hubungi CS LIMBAHIN untuk mendapatkan tautan terbaru.
        </p>
      </div>
    );
  }

  const referralReviewStep = (
    <div className="space-y-4">
      <StepIntro
        title="Review & Kirim"
        subtitle="Penawaran khusus berdasarkan kode referal Anda. Periksa dokumen di bawah, lalu pilih salah satu opsi."
      />
      <QuoteDocument quote={referralQuote} company={state.company} />
      <QuotationActions
        quote={referralQuote}
        company={state.company}
        onSendEmail={handleSendEmail}
        homeState={{ ...state, referral }}
        registrationDraft={registrationDraft}
      />
    </div>
  );

  const fullStepContent = [
    <CompanyStep
      key="c"
      company={state.company}
      onChange={handlers.company}
      referral={referral}
      onReferral={onReferral}
      referralError={referralError}
      referralChecking={referralLookup === 'checking'}
      referralFound={referralFound}
    />,
    <LocationWasteStep
      key="lw"
      location={state.location}
      waste={state.waste}
      onLocation={handlers.location}
      onWaste={handlers.waste}
      content={content}
    />,
    <ServiceStep
      key="s"
      location={state.location}
      waste={state.waste}
      service={state.service}
      onService={handlers.service}
      content={content}
    />,
    showAll ? (
      <div key="p" className="rounded-lg border border-primary/30 bg-primary/5 p-5 text-sm text-foreground">
        <p className="font-display font-bold">Kode Referal</p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Masukan Kode
        </p>
      </div>
    ) : state.service ? (
      <ServiceParams
        key="p"
        service={state.service}
        waste={state.waste}
        location={state.location}
        params={state.params}
        onChange={handlers.params}
        constants={constants}
        content={content}
      />
    ) : (
      <div
        key="p"
        className="rounded-lg border border-dashed border-border bg-background p-6 text-center text-xs text-muted-foreground"
      >
        Pilih layanan terlebih dahulu.
      </div>
    ),
    <ReviewStep key="r" quote={quote} company={state.company} onSendEmail={handleSendEmail} homeState={{ ...state, referral }} registrationDraft={registrationDraft} />,
  ];

  const referralStepContent = [
    <CompanyStep
      key="c"
      company={state.company}
      onChange={handlers.company}
      referral={referral}
      onReferral={onReferral}
      referralError={referralError}
      referralChecking={referralLookup === 'checking'}
      referralFound={referralFound}
    />,
    referralReviewStep,
  ];

  const stepContent = referralFound ? referralStepContent : fullStepContent;

  return (
    <div className="min-h-screen bg-background font-body text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <img src={LOGO_BADGE_PNG} alt="LIMBAHIN" className="h-8 w-auto shrink-0 object-contain" />
          <div>
            <p className="font-display text-base font-bold tracking-tight text-primary">LIMBAHIN</p>
            <p className="text-[11px] text-muted-foreground">Quotation &amp; Registration</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4">
          <NoRefreshWarning />
        </div>
        <div className="mb-4 lg:hidden">
          <p className="text-[11px] font-semibold text-muted-foreground">
            Langkah {step} dari {totalSteps} — {STEP_TITLES[step - 1]}
          </p>
          <div className="mt-2 flex gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full ${i < step ? 'bg-primary' : 'bg-border'}`} />
            ))}
          </div>
        </div>

        <div className="mb-6 hidden rounded-xl border border-border bg-card p-4 shadow-sm lg:block">
          <Stepper current={step} done={done} onJump={setStep} titles={STEP_TITLES} />
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          {stepContent[step - 1]}
          <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
            <Button variant="outline" size="sm" disabled={step === 1} onClick={() => setStep(step - 1)}>
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Kembali
            </Button>
            {step < totalSteps && (
              <Button size="sm" disabled={!done[step - 1]} onClick={() => setStep(step + 1)}>
                Lanjut
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            )}
            {/* The last step's own buttons (inside ReviewStep / the referral review step) handle
                sending — nothing to render here on the final step. */}
          </div>
        </div>
      </main>
    </div>
  );
}
