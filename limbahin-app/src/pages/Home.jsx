import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, FileQuestion, Home as HomeIcon, Pencil, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BasicDataStep from '@/components/custform/BasicDataStep';
import RegistrationStep, { EMPTY_REGISTRATION } from '@/components/custform/RegistrationStep';
import LoadingOverlay from '@/components/LoadingOverlay';
import LocationWasteStep from '@/components/pricelist/LocationWasteStep';
import QuotationActions from '@/components/pricelist/QuotationActions';
import QuoteDocument from '@/components/pricelist/QuoteDocument';
import ServiceParams from '@/components/pricelist/ServiceParams';
import ServiceStep from '@/components/pricelist/ServiceStep';
import { FieldLabel, NoRefreshWarning, StepIntro } from '@/components/pricelist/fields';
import { WASTE_TYPES, SERVICE_CARDS, COMPARISON } from '@/data/pricelistData';
import { getQuotePdfBase64, quotePdfFilename } from '@/lib/pdf';
import { computeQuote, serviceDefaults } from '@/lib/pricing';
import { buildReferralQuote } from '@/lib/referralQuote';
import {
  fetchConfigByName, fetchNotesByConfigName, fetchReferralByCode,
} from '@/lib/remoteConfig';
import { parseRateMultiplier } from '@/lib/rateRule';
import { loadCustform, submitQuotation, submitRegistration } from '@/lib/appsScript';
import { buildWhatsAppLink } from '@/lib/contactConfig';
import { buildQuotationWhatsAppMessage, buildRegistrationWhatsAppMessage } from '@/lib/waMessages';
import { LOGO_BADGE_PNG } from '@/assets/logoBadgeBase64.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INITIAL_STATE = {
  company: { email: '', name: '', contact: '', phone: '' },
  location: '',
  waste: '',
  service: '',
  params: null,
  referral: '',
};

function replaceUrl({ id, config, rate, step }) {
  const query = new URLSearchParams();
  if (id) query.set('id', id);
  if (config && config !== 'Default') query.set('config', config);
  if (rate) query.set('rate', rate);
  if (step) query.set('step', String(step));
  window.history.replaceState({}, '', `/?${query.toString()}`);
}

function SetupGate({ initialConfig, initialRate, error, onContinue }) {
  const [config, setConfig] = useState(initialConfig || '');
  const [rate, setRate] = useState(initialRate || '');
  const [localError, setLocalError] = useState(error || '');

  const submit = (event) => {
    event.preventDefault();
    if (parseRateMultiplier(rate) == null) {
      setLocalError('Rate tidak valid. Gunakan format r + angka, misalnya r0abc atau r20abc.');
      return;
    }
    onContinue({ config: config.trim() || 'Default', rate: rate.trim() });
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-white/75 px-4 backdrop-blur-md">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-6 shadow-xl">
        <div className="text-center">
          <img src={LOGO_BADGE_PNG} alt="LIMBAHIN" className="mx-auto h-10 w-auto" />
          <h1 className="mt-3 font-display text-lg font-bold">Buka Customer Form</h1>
          <p className="mt-1 text-xs text-muted-foreground">Masukkan rate dari CS. Config boleh dikosongkan untuk memakai Default.</p>
        </div>
        <label className="block">
          <FieldLabel required>Rate</FieldLabel>
          <input className="pl-input" value={rate} onChange={(event) => setRate(event.target.value)} placeholder="contoh: r20abc" autoFocus />
        </label>
        <label className="block">
          <FieldLabel>Config</FieldLabel>
          <input className="pl-input" value={config} onChange={(event) => setConfig(event.target.value)} placeholder="Default" />
        </label>
        {localError && <p className="text-xs font-medium text-destructive">{localError}</p>}
        <Button type="submit" className="w-full">Lanjut</Button>
      </form>
    </div>
  );
}

function SuccessPanel({ type, email, warning, onEdit }) {
  const registration = type === 'registration';
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-5 text-center">
      <CheckCircle2 className="h-12 w-12 text-primary" />
      <div>
        <h2 className="font-display text-xl font-bold">
          {registration ? 'Data Registrasi Berhasil Dikirim' : 'Penawaran Berhasil Dikirim'}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {registration ? 'Permintaan draf kontrak sudah diterima.' : `PDF penawaran sudah dikirim ke ${email}.`}
        </p>
        <p className="mt-2 text-sm"><strong>Periksa inbox dan folder spam/junk email Anda.</strong></p>
        {warning && <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">{warning}</p>}
      </div>
      <div className="flex w-full flex-col gap-2 sm:flex-row">
        <Button variant="outline" className="w-full" onClick={onEdit}>
          <Pencil className="mr-1.5 h-4 w-4" /> Edit input sebelumnya
        </Button>
        <Button className="w-full" onClick={() => { window.location.href = '/'; }}>
          <HomeIcon className="mr-1.5 h-4 w-4" /> Mulai dari awal
        </Button>
      </div>
    </div>
  );
}

export default function Home() {
  const [state, setState] = useState(INITIAL_STATE);
  const [registration, setRegistration] = useState(EMPTY_REGISTRATION);
  const [custformId, setCustformId] = useState('');
  const [rate, setRate] = useState('');
  const [configName, setConfigName] = useState('Default');
  const [constants, setConstants] = useState(null);
  const [content, setContent] = useState(null);
  const [stage, setStage] = useState(1);
  const [serviceStep, setServiceStep] = useState(1);
  const [busy, setBusy] = useState(true);
  const [busyLabel, setBusyLabel] = useState('Memuat data…');
  const [setupRequired, setSetupRequired] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [pageError, setPageError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(null);
  const [referralStatus, setReferralStatus] = useState('idle');
  const [referralRow, setReferralRow] = useState(null);

  const loadPricing = async (name) => {
    const [configResult, notesResult] = await Promise.all([
      fetchConfigByName(name),
      fetchNotesByConfigName(name),
    ]);
    if (configResult.status !== 'ok') {
      throw new Error(configResult.message || 'Config pricelist tidak ditemukan.');
    }
    if (notesResult.status !== 'ok') {
      throw new Error(notesResult.message || 'Catatan pricelist tidak ditemukan.');
    }
    const remote = configResult.data;
    const notes = notesResult.data;
    setConstants(remote.constants);
    setContent({
      wasteTypes: WASTE_TYPES,
      services: SERVICE_CARDS,
      comparison: COMPARISON,
      locations: remote.locations || [],
      vehicleRates: remote.vehicle_rates || {},
      notes: {
        global: notes.global_note || '',
        waste: notes.waste_notes || {},
        service: notes.service_notes || {},
      },
    });
  };

  const bootstrap = async (override) => {
    setBusy(true);
    setPageError('');
    try {
      const query = new URLSearchParams(window.location.search);
      const urlId = query.get('id') || '';
      let effectiveRate = override?.rate || query.get('rate') || '';
      let effectiveConfig = override?.config || query.get('config') || 'Default';
      let restored = null;

      if (urlId) {
        restored = await loadCustform(urlId);
        if (!restored) throw new Error('Custform tidak ditemukan.');
        effectiveRate = restored.rate;
        effectiveConfig = restored.config || 'Default';
        setCustformId(restored.id);
        setState({ ...INITIAL_STATE, ...(restored.state || {}) });
        setRegistration({ ...EMPTY_REGISTRATION, ...(restored.registration || {}) });
      }

      if (parseRateMultiplier(effectiveRate) == null) {
        setRate(effectiveRate);
        setConfigName(effectiveConfig);
        setSetupError(effectiveRate ? 'Rate tidak valid. Kode harus dimulai dengan huruf r.' : '');
        setSetupRequired(true);
        return;
      }

      setSetupRequired(false);
      await loadPricing(effectiveConfig);
      setRate(effectiveRate);
      setConfigName(effectiveConfig);
      setSetupRequired(false);

      const requestedStep = Number(query.get('step'));
      if (restored?.quote && requestedStep === 3) setStage(3);
      else if (restored && requestedStep === 2) {
        setStage(2);
        setServiceStep(5);
      }
      replaceUrl({ id: restored?.id || '', config: effectiveConfig, rate: effectiveRate, step: requestedStep || '' });
    } catch (error) {
      setPageError(error?.message || String(error));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    bootstrap();
  }, []);

  useEffect(() => {
    const code = state.referral.trim();
    if (!code || code.toUpperCase() === 'MCC') {
      setReferralStatus('idle');
      setReferralRow(null);
      return;
    }
    let cancelled = false;
    setReferralStatus('checking');
    const timer = setTimeout(async () => {
      const result = await fetchReferralByCode(code);
      if (cancelled) return;
      if (result.status === 'ok') {
        setReferralRow(result.data);
        setReferralStatus('found');
      } else {
        setReferralRow(null);
        setReferralStatus(result.status === 'not-found' ? 'notfound' : 'error');
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [state.referral]);

  const multiplier = parseRateMultiplier(rate);
  const showAll = state.referral.trim().toUpperCase() === 'MCC';
  const regularQuote = useMemo(
    () => (constants && content && multiplier != null
      ? computeQuote(state, constants, content, multiplier, showAll)
      : null),
    [state, constants, content, multiplier, showAll]
  );
  const referralQuote = useMemo(
    () => (referralRow && multiplier != null ? buildReferralQuote(referralRow, multiplier) : null),
    [referralRow, multiplier]
  );
  const quote = referralQuote || regularQuote;

  const patch = (values) => setState((current) => ({ ...current, ...values }));
  const chooseLocation = (location) => patch({ location, waste: '', service: '', params: null, referral: '' });
  const chooseWaste = (waste) => patch({ waste, service: '', params: null, referral: '' });
  const chooseService = (service) => setState((current) => ({
    ...current,
    service,
    params: serviceDefaults(service, current.location, content),
    referral: '',
  }));

  const basicValid = EMAIL_RE.test(state.company.email.trim()) && Boolean(state.location);
  const paramsValid = showAll || Boolean(
    state.params &&
    (state.service === 'SPK'
      ? state.params.needContract != null && state.params.range
      : state.service === 'PTPB'
        ? state.params.option && state.params.monthly != null && state.params.visits != null
        : state.service === 'RUTIN'
          ? state.params.kg != null
          : false)
  );
  const referralValid = !state.referral.trim() || showAll || referralStatus === 'found';

  const persistUrl = (id, nextStep) => {
    setCustformId(id);
    replaceUrl({ id, config: configName, rate, step: nextStep });
  };

  const sendQuote = async () => {
    if (!quote) return;
    setBusyLabel('Menyimpan dan mengirim penawaran…');
    setBusy(true);
    setSubmitError('');
    try {
      const activeId = custformId || window.crypto.randomUUID();
      setCustformId(activeId);
      const result = await submitQuotation({
        id: activeId,
        rate,
        config: configName,
        state,
        quote,
        registration,
        filename: quotePdfFilename(quote),
        pdfBase64: getQuotePdfBase64(quote, state.company),
      });
      persistUrl(result.id, 2);
      window.open(buildWhatsAppLink(buildQuotationWhatsAppMessage({
        company: state.company,
        quote,
        email: state.company.email,
      })), '_blank', 'noopener,noreferrer');
      setSuccess({ type: 'quotation', editStage: 2, warning: result.warning || '' });
    } catch (error) {
      setSubmitError(error?.message || 'Gagal mengirim penawaran.');
    } finally {
      setBusy(false);
    }
  };

  const continueRegistration = () => {
    setRegistration((current) => ({
      ...current,
      alamatLimbah: current.alamatLimbah || state.location,
    }));
    setStage(3);
    setSuccess(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const sendRegistration = async (payload) => {
    if (!quote) return;
    setBusyLabel('Menyimpan data dan membuat draf kontrak…');
    setBusy(true);
    setSubmitError('');
    try {
      const activeId = custformId || window.crypto.randomUUID();
      setCustformId(activeId);
      const result = await submitRegistration({
        id: activeId,
        rate,
        config: configName,
        state,
        quote,
        registration: payload,
      });
      persistUrl(result.id, 3);
      setRegistration({
        ...payload,
        tanggalMulaiKontrak: payload.tanggalMulaiKontrakIso,
        tanggalAkhirKontrak: payload.tanggalAkhirKontrakIso,
      });
      window.open(buildWhatsAppLink(buildRegistrationWhatsAppMessage({
        company: state.company,
        quote,
        registration: payload,
        email: state.company.email,
      })), '_blank', 'noopener,noreferrer');
      const warning = (result.generationErrors || []).length
        ? 'Data tersimpan, tetapi sebagian draf gagal dibuat. Tim LIMBAHIN sudah menerima detail error melalui email.'
        : '';
      setSuccess({ type: 'registration', editStage: 3, warning });
    } catch (error) {
      setSubmitError(error?.message || 'Gagal mengirim registrasi.');
    } finally {
      setBusy(false);
    }
  };

  if (pageError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <FileQuestion className="h-9 w-9 text-destructive" />
        <h1 className="font-display text-lg font-bold">Data tidak dapat dimuat</h1>
        <p className="max-w-md text-sm text-muted-foreground">{pageError}</p>
        <Button onClick={() => { window.location.href = '/'; }}>Mulai dari awal</Button>
      </div>
    );
  }

  const referralPanel = (
    <div className="space-y-3">
      <StepIntro title="Kode Referal" subtitle="Masukkan kode referal jika Anda memilikinya. Kosongkan untuk memakai pelayanan yang dipilih." />
      <label className="block">
        <FieldLabel icon={Ticket}>Kode Referal</FieldLabel>
        <input
          className="pl-input"
          value={state.referral}
          onChange={(event) => patch({ referral: event.target.value })}
          placeholder="Opsional"
        />
      </label>
      {referralStatus === 'checking' && <p className="text-xs text-muted-foreground">Memeriksa kode…</p>}
      {referralStatus === 'found' && <p className="text-xs font-medium text-primary">Kode ditemukan. Item referal akan menggantikan rincian pelayanan biasa.</p>}
      {(referralStatus === 'notfound' || referralStatus === 'error') && <p className="text-xs font-medium text-destructive">Kode referal tidak ditemukan.</p>}
      {showAll && <p className="text-xs font-medium text-primary">Mode MCC aktif: semua opsi harga untuk pelayanan ini ditampilkan.</p>}
    </div>
  );

  let mainContent;
  if (success) {
    mainContent = (
      <SuccessPanel
        type={success.type}
        email={state.company.email}
        warning={success.warning}
        onEdit={() => {
          setSuccess(null);
          setStage(success.editStage);
          if (success.editStage === 2) setServiceStep(5);
        }}
      />
    );
  } else if (stage === 1) {
    mainContent = (
      <BasicDataStep
        company={state.company}
        location={state.location}
        locations={content?.locations || []}
        onCompany={(company) => patch({ company })}
        onLocation={chooseLocation}
      />
    );
  } else if (stage === 2) {
    const panels = [
      <LocationWasteStep key="waste" hideLocation location={state.location} waste={state.waste} onLocation={chooseLocation} onWaste={chooseWaste} content={content} />,
      <ServiceStep key="service" location={state.location} waste={state.waste} service={state.service} onService={chooseService} content={content} />,
      state.service
        ? <ServiceParams key="params" service={state.service} waste={state.waste} location={state.location} params={state.params || {}} onChange={(params) => patch({ params })} constants={constants} content={content} />
        : <p key="empty" className="text-xs text-muted-foreground">Pilih pelayanan terlebih dahulu.</p>,
      <React.Fragment key="referral">{referralPanel}</React.Fragment>,
      <div key="review" className="space-y-4">
        <StepIntro title="Review Pelayanan" subtitle="Periksa PDF dan rincian teks sebelum memilih tindakan." />
        {quote ? <QuoteDocument quote={quote} company={{ ...state.company, address: state.location }} /> : <p className="text-sm text-destructive">Penawaran belum lengkap.</p>}
        <QuotationActions quote={quote} email={state.company.email} onSendEmail={sendQuote} onContinue={continueRegistration} />
        {submitError && <p className="text-sm font-medium text-destructive">{submitError}</p>}
      </div>,
    ];
    const canNext = [
      Boolean(state.waste),
      Boolean(state.service),
      paramsValid,
      referralValid && referralStatus !== 'checking',
      false,
    ];
    mainContent = (
      <div>
        <p className="mb-4 text-xs font-semibold text-muted-foreground">Pilih Pelayanan · Langkah {serviceStep} dari 5</p>
        {panels[serviceStep - 1]}
        <div className="mt-6 flex justify-between border-t border-border pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (serviceStep === 1) setStage(1);
              else setServiceStep((value) => value - 1);
            }}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Kembali
          </Button>
          {serviceStep < 5 && (
            <Button size="sm" disabled={!canNext[serviceStep - 1]} onClick={() => setServiceStep((value) => value + 1)}>
              Lanjut <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  } else {
    mainContent = (
      <RegistrationStep
        company={state.company}
        registration={registration}
        quote={quote}
        onCompany={(company) => patch({ company })}
        onRegistration={setRegistration}
        onBackToService={() => {
          setStage(2);
          setServiceStep(1);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onSubmit={sendRegistration}
        error={submitError}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background font-body text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <img src={LOGO_BADGE_PNG} alt="LIMBAHIN" className="h-8 w-auto" />
          <div>
            <p className="font-display text-base font-bold text-primary">LIMBAHIN</p>
            <p className="text-[11px] text-muted-foreground">Customer Form</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {!success && (
          <>
            <div className="mb-4"><NoRefreshWarning /></div>
            <div className="mb-5 grid grid-cols-3 gap-2">
              {['Data Dasar', 'Pelayanan', 'Registrasi'].map((title, index) => (
                <div key={title} className={`rounded-lg border px-3 py-2 text-center text-xs font-semibold ${
                  stage === index + 1 ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground'
                }`}>
                  {index + 1}. {title}
                </div>
              ))}
            </div>
          </>
        )}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">{mainContent}</div>
      </main>

      {setupRequired && (
        <SetupGate
          initialConfig={configName === 'Default' ? '' : configName}
          initialRate={rate}
          error={setupError}
          onContinue={({ config, rate: nextRate }) => {
            replaceUrl({ config, rate: nextRate });
            bootstrap({ config, rate: nextRate });
          }}
        />
      )}
      <LoadingOverlay show={busy} label={busyLabel} />
    </div>
  );
}
