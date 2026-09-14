import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Building2, MapPin, Phone, Mail, User, Briefcase, CalendarDays,
  Loader2, ExternalLink, PlusCircle, Send, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, AreaField, SelectField, ChoiceCard, SectionTitle, StepIntro, NoRefreshWarning } from '@/components/pricelist/fields';
import { fetchReferralByCode } from '@/lib/remoteConfig';
import { buildWhatsAppLink } from '@/lib/contactConfig';
import { buildRegistrationWhatsAppMessage } from '@/lib/waMessages';
import { registrationEmailLimiter, formatWaitTime } from '@/lib/rateLimiter';
import { normalizeIndoPhone } from '@/lib/phone';
import { buildReferralQuote } from '@/lib/referralQuote';
import { parseParamMultiplier } from '@/lib/paramRule';
import { buildPricelistSummaryText } from '@/lib/pricing';
import { submitRegistration as submitRegistrationToAppsScript } from '@/lib/appsScript';
import { addYearsAsDate, formatDateDMY, todayInputValue } from '@/lib/contractDates';

import { LOGO_BADGE_PNG } from '@/assets/logoBadgeBase64.js';

// Kode instruksi -> dokumen apa saja yang akan dibuat (lihat INSTRUCTION_DOC_GROUPS di
// google-apps-script/Code.gs — daftar di sini HARUS selalu sama persis dengan itu).
const INSTRUCTION_CODE_OPTIONS = [
  { id: 'PKSTJS', label: 'PKSTJS', desc: 'Membuat: SPK + PKS Jasa (TJS)' },
  { id: 'PKSTPA', label: 'PKSTPA', desc: 'Membuat: SPK + PKS TPA' },
  { id: 'PKSPLIB', label: 'PKSPLIB', desc: 'Membuat: SPK + PKS Limbah B3 (PLIB)' },
  { id: 'PKSB', label: 'PKSB', desc: 'Membuat: PKSB saja' },
  { id: 'SPK', label: 'SPK', desc: 'Membuat: SPK saja' },
];

const DURATION_OPTIONS = [1, 2, 3];

const INITIAL_FORM = {
  namaPerusahaan: '',
  npwp: '',
  industriBidang: '',
  alamatLimbah: '',
  alamatDokumen: '',
  telpPerusahaan: '',
  emailPerusahaan: '',
  pjNama: '',
  pjJabatan: '',
  manifestPilihan: '',
  showPicOperasional: false,
  picOperasionalNama: '',
  picOperasionalTel: '',
  showPicKeuangan: false,
  picKeuanganNama: '',
  picKeuanganTel: '',
  catatanTambahanPic: '',
  fisikKontrak: '',
  instructionCode: '',
  tanggalMulaiKontrak: '',
  durasiKontrakTahun: '',
};

export default function Registrasi() {
  const location = useLocation();
  const navigate = useNavigate();
  const { quote: quoteFromWizard, company: companyFromWizard, email: quotationEmail } = location.state || {};

  // ---- Direct-access gate ---------------------------------------------------------------
  // If someone opens /registrasi straight from a URL (no location.state, i.e. they didn't come
  // through the quotation wizard and click "Saya setuju..."), they must first enter a Kode
  // Referal so we can look up the priced item and build a quote from it — same lookup used by
  // Step 1 of the normal wizard (`referal_model` in Supabase). Only once that quote exists does
  // the rest of the registration form render.
  const urlParams = new URLSearchParams(window.location.search);
  const directMultiplier = parseParamMultiplier(urlParams.get('param')) ?? 1;

  const [directReferral, setDirectReferral] = useState('');
  const [directLookup, setDirectLookup] = useState('idle'); // idle | checking | found | notfound | error
  const [directRow, setDirectRow] = useState(null);

  const handleDirectReferralLookup = async () => {
    const trimmed = directReferral.trim();
    if (!trimmed) return;
    setDirectLookup('checking');
    const res = await fetchReferralByCode(trimmed);
    if (res.status === 'ok') {
      setDirectRow(res.data);
      setDirectLookup('found');
    } else if (res.status === 'not-found') {
      setDirectRow(null);
      setDirectLookup('notfound');
    } else {
      setDirectRow(null);
      setDirectLookup('error');
    }
  };

  const directQuote = directRow ? buildReferralQuote(directRow, directMultiplier) : null;

  // The quote/company actually used by the rest of this page — either carried over from the
  // quotation wizard (normal path), or built from the referral code entered above (direct path).
  const quote = quoteFromWizard || directQuote;
  const company = companyFromWizard || null;

  const [form, setForm] = useState({
    ...INITIAL_FORM,
    namaPerusahaan: company?.name || '',
    telpPerusahaan: company?.phone || '',
    emailPerusahaan: quotationEmail || '',
    pjNama: company?.contact || '',
    // Continuity: carry the waste/document address collected in the quotation step over here —
    // customer can still edit it freely.
    alamatLimbah: company?.address || '',
    // If we got here via the "Ubah Pilihan Harga" edit round-trip (see the Rincian Pelayanan
    // section below + Home.jsx), re-apply whatever the customer had already typed in — spread
    // last so it wins over the defaults derived from `company` above.
    ...(location.state?.registrationDraft || {}),
  });
  const [status, setStatus] = useState('idle'); // idle | sending | error
  const [errorMsg, setErrorMsg] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setBool = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));
  // Phone/WA fields always get normalized to a "+62 ..." prefix as the person types.
  const setPhone = (key) => (e) => setForm((f) => ({ ...f, [key]: normalizeIndoPhone(e.target.value) }));

  const removePic = (kind) => {
    if (kind === 'operasional') {
      setForm((f) => ({ ...f, showPicOperasional: false, picOperasionalNama: '', picOperasionalTel: '' }));
    } else {
      setForm((f) => ({ ...f, showPicKeuangan: false, picKeuanganNama: '', picKeuanganTel: '' }));
    }
  };

  // No quote yet AND we didn't come from the wizard -> show the referral-code gate instead of a
  // dead end. Once a code resolves to a quote, the component re-renders past this block.
  if (!quote) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <img src={LOGO_BADGE_PNG} alt="LIMBAHIN" className="h-11 w-auto object-contain" />
        <p className="font-display text-lg font-bold">Masukkan Kode Referal</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Anda membuka halaman pendaftaran secara langsung. Masukkan Kode Referal yang diberikan CS LIMBAHIN untuk
          memuat rincian harga sebelum melanjutkan pendaftaran, atau isi form Quotation terlebih dahulu.
        </p>
        <div className="w-full max-w-xs space-y-2 text-left">
          <input
            className="pl-input w-full"
            placeholder="Kode Referal"
            value={directReferral}
            onChange={(e) => {
              setDirectReferral(e.target.value);
              if (directLookup !== 'idle') setDirectLookup('idle');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleDirectReferralLookup();
            }}
          />
          {directLookup === 'checking' && (
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Memeriksa kode referal...
            </p>
          )}
          {directLookup === 'notfound' && (
            <p className="text-[11px] font-medium text-destructive">Kode referal tidak ditemukan.</p>
          )}
          {directLookup === 'error' && (
            <p className="text-[11px] font-medium text-destructive">Gagal memeriksa kode referal. Coba lagi.</p>
          )}
          <Button
            type="button"
            className="w-full"
            disabled={!directReferral.trim() || directLookup === 'checking'}
            onClick={handleDirectReferralLookup}
          >
            Cek Kode Referal
          </Button>
        </div>
      </div>
    );
  }

  const instructionCodeValid = INSTRUCTION_CODE_OPTIONS.some((o) => o.id === form.instructionCode);
  const tanggalAkhirKontrakIso = addYearsAsDate(form.tanggalMulaiKontrak, form.durasiKontrakTahun);

  const requiredOk =
    form.namaPerusahaan.trim() &&
    form.alamatLimbah.trim() &&
    form.telpPerusahaan.trim() &&
    form.emailPerusahaan.trim() &&
    form.pjNama.trim() &&
    form.pjJabatan.trim() &&
    form.manifestPilihan &&
    form.fisikKontrak &&
    form.tanggalMulaiKontrak &&
    form.durasiKontrakTahun &&
    instructionCodeValid;

  const rateLimited = !registrationEmailLimiter.canSend();

  // "Rincian Pelayanan" — a concise, itemized summary of the priced item(s) actually selected
  // (name, price, qty, unit, subtotal) plus the pelayanan/limbah notes, built straight from
  // `quote` so it can never drift from the price list document the customer already received.
  // Shown again here so the customer reconfirms pricing before submitting, and sent along in the
  // registration payload so Apps Script can drop it straight into the {rinc} placeholder of the
  // contract template.
  const rincianPelayanan = buildPricelistSummaryText(quote);

  // "Ubah Pilihan Harga" — sends the customer back to Step 1 of the quotation wizard to pick a
  // different price/item, WITHOUT losing whatever they've already typed into this registration
  // form. `form` is carried along as `registrationDraft`; Home.jsx re-applies it once a new quote
  // has been built and the customer clicks "Saya setuju..." again (see Home.jsx / QuotationActions.jsx).
  const handleEditPricelist = () => {
    navigate({ pathname: '/', search: window.location.search }, { state: { registrationDraft: form } });
  };

  const handleSubmit = async () => {
    setCodeTouched(true);
    if (!requiredOk) return;
    if (!registrationEmailLimiter.canSend()) {
      setStatus('error');
      setErrorMsg(`Batas pengiriman tercapai (maksimal 3 kali per 30 menit). Coba lagi dalam ${formatWaitTime(registrationEmailLimiter.msUntilNext())}.`);
      return;
    }
    setStatus('sending');
    setErrorMsg('');
    const registrationPayload = {
      ...form,
      picLain: form.catatanTambahanPic,
      rincianPelayanan,
      tanggalMulaiKontrak: formatDateDMY(form.tanggalMulaiKontrak),
      tanggalAkhirKontrak: formatDateDMY(tanggalAkhirKontrakIso),
    };
    try {
      // Single call to the Apps Script web app: it (1) appends this submission as a row on the
      // new Google Sheet, (2) upserts the same record into Supabase (`registrations` table) using
      // the service-role key server-side, and (3) generates the contract draft(s) (.docx + PDF)
      // from `form.instructionCode` and emails them right away to kontrak@ (cc: kelvin,
      // bcc: customer). See google-apps-script/Code.gs (`handleRegistration_`) for the exact logic.
      await submitRegistrationToAppsScript({ quote, company, registration: registrationPayload });

      registrationEmailLimiter.recordSend();
      const waLink = buildWhatsAppLink(
        buildRegistrationWhatsAppMessage({ company, quote, registration: registrationPayload, email: form.emailPerusahaan })
      );
      window.open(waLink, '_blank', 'noopener,noreferrer');
      navigate('/hasil', {
        state: { type: 'registration', success: true, quote, company, registration: registrationPayload },
      });
    } catch (err) {
      navigate('/hasil', {
        state: {
          type: 'registration',
          success: false,
          error: err?.message || 'Gagal mengirim permintaan. Silakan coba lagi.',
          quote,
          company,
          registration: registrationPayload,
        },
      });
    }
  };

  return (
    <div className="min-h-screen bg-background font-body text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <img src={LOGO_BADGE_PNG} alt="LIMBAHIN" className="h-8 w-auto shrink-0 object-contain" />
          <div>
            <p className="font-display text-base font-bold tracking-tight text-primary">LIMBAHIN</p>
            <p className="text-[11px] text-muted-foreground">Pendaftaran &amp; Draf Kontrak</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <NoRefreshWarning />

        {/* Intro / Mekari e-contract explanation */}
        <div className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
          <StepIntro
            title="Formulir Pendaftaran"
            subtitle="Halo Pelanggan LIMBAHIN MCC, kami menggunakan kontrak elektronik melalui Mekari."
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Kontrak elektronik itu sama ya, bermaterai juga (materai elektronik) dan dianggap sebagai dokumen resmi.
            Untuk diawal, jika tidak punya akun Mekari, maka harus registrasi dulu ya — namun untuk selanjutnya
            tinggal pakai, jadi menjadi sangat simpel dan mudah (bisa digunakan untuk vendor lain juga).
          </p>
          <ul className="space-y-1 text-xs leading-relaxed text-muted-foreground">
            <li>• Silakan download aplikasi Mekari jika tanda tangan melalui HP (akan lebih mudah).</li>
            <li>• Silakan siapkan logo instansi/perusahaan/merek untuk diupload menjadi bentuk ttd.</li>
            <li>
              • Jika suatu saat kontrak elektronik tidak diterima, LIMBAHIN akan bertanggung jawab melalui 2
              alternatif: (1) mencoba meyakinkan dan membuktikan bahwa dokumen tersebut valid, atau (2) mencetak
              dokumen fisik dari dokumen yang dimaksud tanpa biaya tambahan.
            </li>
          </ul>
          <div className="flex flex-wrap gap-3 pt-1 text-xs font-medium">
            <a
              href="https://www.youtube.com/watch?v=6Z1e1g8wGSU&t=2s"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Video Tutorial Mekari
            </a>
            <a
              href="https://drive.google.com/file/d/1qdDfMOLmvMEugvDXUzTyQ4dphWdRu-o1/view?usp=drive_link"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Formulir Pendaftaran (PDF)
            </a>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Proses kontrak ada 4 langkah: 1. Harga & penawaran disetujui — 2. Isi formulir data (di bawah) —
            3. Cek draf dokumen kontrak — 4. Pilih fisik kontrak (dicetak / e-kontrak Mekari).
          </p>
        </div>

        {/* Data Perusahaan */}
        <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <SectionTitle>Perusahaan</SectionTitle>
          <Field label="Nama Perusahaan" icon={Building2} value={form.namaPerusahaan} onChange={set('namaPerusahaan')} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="NPWP & Kode Faktur" value={form.npwp} onChange={set('npwp')} placeholder="Kosongkan jika belum ada" />
            <Field label="Industri & Bidang" icon={Briefcase} value={form.industriBidang} onChange={set('industriBidang')} />
          </div>
          <AreaField
            label="Alamat Limbah (jika ada beberapa lokasi, sebutkan semua)"
            icon={MapPin}
            rows={2}
            value={form.alamatLimbah}
            onChange={set('alamatLimbah')}
            required
          />
          <AreaField
            label="Alamat Dokumen (kosongkan jika sama dengan alamat limbah)"
            icon={MapPin}
            rows={2}
            value={form.alamatDokumen}
            onChange={set('alamatDokumen')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="No. Telp Perusahaan (usahakan WA & tidak berubah)"
              icon={Phone}
              value={form.telpPerusahaan}
              onChange={setPhone('telpPerusahaan')}
              onFocus={() => {
                if (!form.telpPerusahaan) setForm((f) => ({ ...f, telpPerusahaan: '+62 ' }));
              }}
              placeholder="+62 812-3456-7890"
              required
            />
            <Field label="Email Perusahaan (dokumen softcopy dikirim ke sini)" icon={Mail} type="email" value={form.emailPerusahaan} onChange={set('emailPerusahaan')} required />
          </div>
        </div>

        {/* Penanggung Jawab Utama */}
        <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <SectionTitle>Penanggung Jawab Utama</SectionTitle>
          <p className="text-[11px] text-muted-foreground">Yang menyetujui — biasanya anggota direksi.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama Lengkap" icon={User} value={form.pjNama} onChange={set('pjNama')} required />
            <Field label="Jabatan" icon={Briefcase} value={form.pjJabatan} onChange={set('pjJabatan')} required />
          </div>
        </div>

        {/* Manifest / Festronik */}
        <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <SectionTitle required>Manifest / Festronik</SectionTitle>
          <ChoiceCard
            value={form.manifestPilihan}
            onChange={(v) => setForm((f) => ({ ...f, manifestPilihan: v }))}
            options={[
              { id: 'manifest', label: 'A. Saya hanya ingin menggunakan manifest.' },
              { id: 'festronik', label: 'B. Saya menggunakan Festronik.', desc: 'Aplikasi resmi KLHK untuk pelaporan limbah (perlu NIB).' },
            ]}
          />
          {form.manifestPilihan === 'festronik' && (
            <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-4 text-xs leading-relaxed text-muted-foreground">
              <p className="font-semibold text-foreground">Persyaratan Akun Festronik</p>
              <ul className="ml-4 list-disc space-y-0.5">
                <li>NIB/OSS & akses login ke OSS.id</li>
                <li>Dokumen Izin Lingkungan (opsional)</li>
                <li>Diagram operasional (opsional)</li>
              </ul>
              <div className="flex flex-wrap gap-3 pt-1 font-medium">
                <a href="https://youtu.be/u10GCVAxKjI?si=LVPwn1EMNwgqmA8h" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  <ExternalLink className="h-3.5 w-3.5" /> Tutorial Setup & Registrasi
                </a>
                <a href="https://youtu.be/FEeUnZMsTt4?si=z3imFuocRcvjoXay" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  <ExternalLink className="h-3.5 w-3.5" /> Tutorial Input Data
                </a>
              </div>
            </div>
          )}
        </div>

        {/* PIC tambahan */}
        <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <SectionTitle>PIC Tambahan (opsional)</SectionTitle>
          <p className="text-[11px] text-muted-foreground">Tidak perlu diisi jika sama dengan Penanggung Jawab Utama.</p>

          {!form.showPicOperasional ? (
            <button type="button" onClick={() => setBool('showPicOperasional')(true)} className="flex items-center gap-1.5 text-xs font-semibold text-primary">
              <PlusCircle className="h-3.5 w-3.5" /> Tambah PIC Operasional (penjadwalan & lapangan)
            </button>
          ) : (
            <div className="space-y-2 rounded-lg border border-border bg-background p-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-foreground">PIC Operasional</p>
                <button type="button" onClick={() => removePic('operasional')} className="flex items-center gap-1 text-[11px] font-medium text-destructive">
                  <X className="h-3.5 w-3.5" /> Hapus
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nama PIC Operasional" value={form.picOperasionalNama} onChange={set('picOperasionalNama')} />
                <Field
                  label="Tel/WA PIC Operasional"
                  value={form.picOperasionalTel}
                  onChange={setPhone('picOperasionalTel')}
                  placeholder="+62 812-3456-7890"
                />
              </div>
            </div>
          )}

          {!form.showPicKeuangan ? (
            <button type="button" onClick={() => setBool('showPicKeuangan')(true)} className="flex items-center gap-1.5 text-xs font-semibold text-primary">
              <PlusCircle className="h-3.5 w-3.5" /> Tambah PIC Keuangan (penagihan)
            </button>
          ) : (
            <div className="space-y-2 rounded-lg border border-border bg-background p-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-foreground">PIC Keuangan</p>
                <button type="button" onClick={() => removePic('keuangan')} className="flex items-center gap-1 text-[11px] font-medium text-destructive">
                  <X className="h-3.5 w-3.5" /> Hapus
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nama PIC Keuangan" value={form.picKeuanganNama} onChange={set('picKeuanganNama')} />
                <Field
                  label="Tel/WA PIC Keuangan"
                  value={form.picKeuanganTel}
                  onChange={setPhone('picKeuanganTel')}
                  placeholder="+62 812-3456-7890"
                />
              </div>
            </div>
          )}

          <AreaField label="Catatan Tambahan (opsional)" rows={2} value={form.catatanTambahanPic} onChange={set('catatanTambahanPic')} />
        </div>

        {/* Fisik Kontrak */}
        <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <SectionTitle required>Fisik Kontrak</SectionTitle>
          <ChoiceCard
            value={form.fisikKontrak}
            onChange={(v) => setForm((f) => ({ ...f, fisikKontrak: v }))}
            options={[
              {
                id: 'cetak',
                label: 'A. Saya ingin kontrak dicetak',
                desc: '10–14 hari (kontrak 3 pihak) · 4 hari (kontrak 2 pihak)',
              },
              {
                id: 'mekari',
                label: 'B. Saya ingin menggunakan Mekari (e-kontrak)',
                desc: '2–4 hari (kontrak 3 pihak) · 1 hari (kontrak 2 pihak). Tutorial akan dipandu.',
              },
            ]}
          />

          <div className="rounded-lg border border-border bg-background p-3.5 text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Info pembayaran: </span>
            Paket Tahunan/Bulanan (PTPB) — biaya kontrak dibayar di awal. SPK / Rutin — dibayar setelah pengambilan
            atau di akhir bulan.
          </div>
        </div>

        {/* Tanggal & Durasi Kontrak */}
        <div className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
          <SectionTitle required>Tanggal &amp; Durasi Kontrak</SectionTitle>
          <p className="text-[11px] text-muted-foreground">
            Tanggal mulai berlaku (biasanya tanggal tanda tangan) dan lama kontrak — tanggal akhir dihitung otomatis.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Tanggal Mulai Kontrak"
              icon={CalendarDays}
              type="date"
              value={form.tanggalMulaiKontrak}
              onChange={set('tanggalMulaiKontrak')}
              min={todayInputValue()}
              required
            />
            <SelectField
              label="Durasi Kontrak"
              icon={CalendarDays}
              value={form.durasiKontrakTahun}
              onChange={set('durasiKontrakTahun')}
              required
            >
              <option value="">Pilih durasi</option>
              {DURATION_OPTIONS.map((y) => (
                <option key={y} value={y}>{y} Tahun</option>
              ))}
            </SelectField>
          </div>
          {form.tanggalMulaiKontrak && form.durasiKontrakTahun && (
            <p className="text-[11px] font-medium text-foreground">
              Tanggal akhir kontrak: <span className="text-primary">{formatDateDMY(tanggalAkhirKontrakIso) || '-'}</span>
            </p>
          )}
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-[11px] leading-relaxed text-amber-800">
            <span className="font-semibold">Catatan: </span>
            Jika layanan Anda menggunakan skema Paket Tahunan (PTPB) atau biaya kontrak lainnya yang dihitung per
            tahun, memilih durasi lebih dari 1 tahun berarti biaya tersebut akan dikenakan untuk setiap tahun sesuai
            durasi yang dipilih (mis. durasi 2 tahun = biaya tahunan dikenakan 2×).
          </div>
        </div>

        {/* Instruction code */}
        <div className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
          <SectionTitle required>Kode Instruksi</SectionTitle>
          <p className="text-[11px] text-muted-foreground">
            Kode ini menentukan dokumen draf kontrak mana yang akan diproses. Tanyakan ke CS LIMBAHIN jika belum
            tahu kode Anda.
          </p>
          <ChoiceCard
            value={form.instructionCode}
            onChange={(v) => {
              setCodeTouched(true);
              setForm((f) => ({ ...f, instructionCode: v }));
            }}
            options={INSTRUCTION_CODE_OPTIONS}
          />
          {codeTouched && !form.instructionCode && (
            <p className="text-[11px] font-medium text-destructive">Pilih salah satu kode instruksi di atas.</p>
          )}
        </div>

        {/* Rincian Pelayanan — price summary, shown again here so the customer reconfirms before
            submitting. Same text that will be dropped into the {rinc} field of the contract.
            Editable via "Ubah Pilihan Harga", which sends the customer back to Step 1 of the
            quotation wizard without losing anything already filled in on this form. */}
        {rincianPelayanan && (
          <div className="space-y-2 rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <SectionTitle>Rincian Pelayanan &amp; Harga</SectionTitle>
              <button
                type="button"
                onClick={handleEditPricelist}
                className="shrink-0 text-[11px] font-semibold text-primary hover:underline"
              >
                Ubah Pilihan Harga
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Ini akan menjadi rincian layanan yang tercantum di dalam kontrak/PKS Anda. Mohon dicek kembali sebelum
              mengirim.
            </p>
            <div className="whitespace-pre-line rounded-lg border border-border bg-background p-4 text-xs leading-relaxed text-foreground">
              {rincianPelayanan}
            </div>
          </div>
        )}

        {status === 'error' && <p className="text-[12px] font-medium text-destructive">{errorMsg}</p>}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={status === 'sending' || (codeTouched && !requiredOk) || (rateLimited && status !== 'sending')}
            className="w-full py-6 text-sm font-bold"
          >
            {status === 'sending' ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Mengirim...
              </>
            ) : (
              <>
                <Send className="mr-1.5 h-4 w-4" />
                Request Kirim Kontrak (Email + WhatsApp)
              </>
            )}
          </Button>
        </div>

        {!requiredOk && codeTouched && (
          <p className="text-center text-[11px] text-muted-foreground">Lengkapi semua field wajib di atas sebelum mengirim.</p>
        )}
        {rateLimited && (
          <p className="text-center text-[11px] font-medium text-destructive">
            Batas pengiriman tercapai (maksimal 3 kali per 30 menit). Coba lagi dalam {formatWaitTime(registrationEmailLimiter.msUntilNext())}.
          </p>
        )}
      </main>
    </div>
  );
}
