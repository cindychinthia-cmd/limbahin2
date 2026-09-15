import React, { useMemo } from 'react';
import {
  Briefcase, Building2, CalendarDays, ExternalLink, Mail, MapPin,
  Phone, PlusCircle, Send, User, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AreaField, ChoiceCard, Field, SectionTitle, SelectField, StepIntro,
} from '@/components/pricelist/fields';
import { addYearsAsDate, formatDateDMY, todayInputValue } from '@/lib/contractDates';
import { normalizeIndoPhone } from '@/lib/phone';
import { buildPricelistSummaryText } from '@/lib/pricing';

const DURATIONS = [1, 2, 3];

export const EMPTY_REGISTRATION = {
  npwp: '',
  industriBidang: '',
  alamatLimbah: '',
  alamatDokumen: '',
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

export default function RegistrationStep({
  company,
  registration,
  quote,
  onCompany,
  onRegistration,
  onBackToService,
  onSubmit,
  error,
}) {
  const set = (key) => (event) => onRegistration({ ...registration, [key]: event.target.value });
  const setPhone = (key) => (event) =>
    onRegistration({ ...registration, [key]: normalizeIndoPhone(event.target.value) });
  const setCompany = (key) => (event) => {
    const value = key === 'phone' ? normalizeIndoPhone(event.target.value) : event.target.value;
    onCompany({ ...company, [key]: value });
  };

  const endDateIso = addYearsAsDate(registration.tanggalMulaiKontrak, registration.durasiKontrakTahun);
  const rincian = useMemo(() => buildPricelistSummaryText(quote), [quote]);
  const requiredOk = Boolean(
    company.name.trim() &&
    company.email.trim() &&
    company.contact.trim() &&
    company.phone.trim() &&
    registration.alamatLimbah.trim() &&
    registration.pjJabatan.trim() &&
    registration.manifestPilihan &&
    registration.fisikKontrak &&
    registration.tanggalMulaiKontrak &&
    registration.durasiKontrakTahun &&
    registration.instructionCode.trim()
  );

  const removePic = (kind) => {
    if (kind === 'operasional') {
      onRegistration({
        ...registration,
        showPicOperasional: false,
        picOperasionalNama: '',
        picOperasionalTel: '',
      });
    } else {
      onRegistration({
        ...registration,
        showPicKeuangan: false,
        picKeuanganNama: '',
        picKeuanganTel: '',
      });
    }
  };

  const submit = () => onSubmit({
    ...registration,
    namaPerusahaan: company.name,
    telpPerusahaan: company.phone,
    emailPerusahaan: company.email,
    pjNama: company.contact,
    picLain: registration.catatanTambahanPic,
    rincianPelayanan: rincian,
    tanggalMulaiKontrakIso: registration.tanggalMulaiKontrak,
    tanggalAkhirKontrakIso: endDateIso,
    tanggalMulaiKontrak: formatDateDMY(registration.tanggalMulaiKontrak),
    tanggalAkhirKontrak: formatDateDMY(endDateIso),
  });

  return (
    <div className="space-y-5">
      <StepIntro
        title="Registrasi & Draf Kontrak"
        subtitle="Data dari langkah pertama tetap terhubung. Perubahan di sini juga memperbarui Data Dasar."
      />

      <div className="space-y-4 rounded-xl border border-border bg-card p-5">
        <SectionTitle>Perusahaan & Penanggung Jawab</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama Perusahaan" icon={Building2} value={company.name} onChange={setCompany('name')} required />
          <Field label="Email Perusahaan" icon={Mail} type="email" value={company.email} onChange={setCompany('email')} required />
          <Field label="Nama Penanggung Jawab" icon={User} value={company.contact} onChange={setCompany('contact')} required />
          <Field label="Jabatan" icon={Briefcase} value={registration.pjJabatan} onChange={set('pjJabatan')} required />
          <Field label="Nomor Kontak" icon={Phone} value={company.phone} onChange={setCompany('phone')} required />
          <Field label="NPWP & Kode Faktur" value={registration.npwp} onChange={set('npwp')} />
          <Field label="Industri & Bidang" icon={Briefcase} value={registration.industriBidang} onChange={set('industriBidang')} />
        </div>
        <AreaField
          label="Alamat Limbah (jika beberapa lokasi, sebutkan semua)"
          icon={MapPin}
          rows={2}
          value={registration.alamatLimbah}
          onChange={set('alamatLimbah')}
          placeholder="Lokasi harga yang dipilih tidak menggantikan alamat lengkap kontrak."
          required
        />
        <AreaField
          label="Alamat Dokumen (kosongkan jika sama)"
          icon={MapPin}
          rows={2}
          value={registration.alamatDokumen}
          onChange={set('alamatDokumen')}
        />
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-card p-5">
        <SectionTitle required>Manifest / Festronik</SectionTitle>
        <ChoiceCard
          value={registration.manifestPilihan}
          onChange={(value) => onRegistration({ ...registration, manifestPilihan: value })}
          options={[
            { id: 'manifest', label: 'A. Saya hanya ingin menggunakan manifest.' },
            { id: 'festronik', label: 'B. Saya menggunakan Festronik.', desc: 'Aplikasi resmi KLHK; memerlukan NIB.' },
          ]}
        />
        {registration.manifestPilihan === 'festronik' && (
          <div className="flex flex-wrap gap-3 text-xs font-medium">
            <a href="https://youtu.be/u10GCVAxKjI?si=LVPwn1EMNwgqmA8h" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              <ExternalLink className="h-3.5 w-3.5" /> Tutorial Setup
            </a>
            <a href="https://youtu.be/FEeUnZMsTt4?si=z3imFuocRcvjoXay" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              <ExternalLink className="h-3.5 w-3.5" /> Tutorial Input Data
            </a>
          </div>
        )}
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-card p-5">
        <SectionTitle>PIC Tambahan (opsional)</SectionTitle>
        {!registration.showPicOperasional ? (
          <button type="button" onClick={() => onRegistration({ ...registration, showPicOperasional: true })} className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <PlusCircle className="h-3.5 w-3.5" /> Tambah PIC Operasional
          </button>
        ) : (
          <div className="space-y-3 rounded-lg border border-border p-3">
            <button type="button" onClick={() => removePic('operasional')} className="ml-auto flex items-center gap-1 text-[11px] text-destructive">
              <X className="h-3.5 w-3.5" /> Hapus
            </button>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nama PIC Operasional" value={registration.picOperasionalNama} onChange={set('picOperasionalNama')} />
              <Field label="Tel/WA PIC Operasional" value={registration.picOperasionalTel} onChange={setPhone('picOperasionalTel')} />
            </div>
          </div>
        )}
        {!registration.showPicKeuangan ? (
          <button type="button" onClick={() => onRegistration({ ...registration, showPicKeuangan: true })} className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <PlusCircle className="h-3.5 w-3.5" /> Tambah PIC Keuangan
          </button>
        ) : (
          <div className="space-y-3 rounded-lg border border-border p-3">
            <button type="button" onClick={() => removePic('keuangan')} className="ml-auto flex items-center gap-1 text-[11px] text-destructive">
              <X className="h-3.5 w-3.5" /> Hapus
            </button>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nama PIC Keuangan" value={registration.picKeuanganNama} onChange={set('picKeuanganNama')} />
              <Field label="Tel/WA PIC Keuangan" value={registration.picKeuanganTel} onChange={setPhone('picKeuanganTel')} />
            </div>
          </div>
        )}
        <AreaField label="Catatan Tambahan" rows={2} value={registration.catatanTambahanPic} onChange={set('catatanTambahanPic')} />
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-card p-5">
        <SectionTitle required>Fisik Kontrak</SectionTitle>
        <ChoiceCard
          value={registration.fisikKontrak}
          onChange={(value) => onRegistration({ ...registration, fisikKontrak: value })}
          options={[
            { id: 'cetak', label: 'A. Kontrak dicetak', desc: '10–14 hari (3 pihak) · 4 hari (2 pihak).' },
            { id: 'mekari', label: 'B. Mekari (e-kontrak)', desc: '2–4 hari (3 pihak) · 1 hari (2 pihak).' },
          ]}
        />
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-card p-5">
        <SectionTitle required>Tanggal & Durasi Kontrak</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Tanggal Mulai Kontrak"
            icon={CalendarDays}
            type="date"
            value={registration.tanggalMulaiKontrak}
            onChange={set('tanggalMulaiKontrak')}
            min={todayInputValue()}
            required
          />
          <SelectField
            label="Durasi Kontrak"
            icon={CalendarDays}
            value={registration.durasiKontrakTahun}
            onChange={set('durasiKontrakTahun')}
            required
          >
            <option value="">Pilih durasi</option>
            {DURATIONS.map((year) => <option key={year} value={year}>{year} Tahun</option>)}
          </SelectField>
        </div>
        {endDateIso && <p className="text-[11px] font-medium">Tanggal akhir: <span className="text-primary">{formatDateDMY(endDateIso)}</span></p>}
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-card p-5">
        <SectionTitle required>Kode Instruksi</SectionTitle>
        <Field
          label="Kode Instruksi"
          value={registration.instructionCode}
          onChange={(event) => onRegistration({ ...registration, instructionCode: event.target.value.toUpperCase() })}
          placeholder="Masukkan kode dari CS LIMBAHIN"
          required
        />
        <p className="text-[11px] text-muted-foreground">
          Belum mengetahui kode instruksi? Hubungi Customer Service LIMBAHIN terlebih dahulu.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-5">
        <div className="flex items-center justify-between gap-3">
          <SectionTitle>Rincian Pelayanan & Harga</SectionTitle>
          <button type="button" onClick={onBackToService} className="text-xs font-semibold text-primary hover:underline">
            Ubah pelayanan
          </button>
        </div>
        <pre className="whitespace-pre-wrap font-body text-xs leading-relaxed">{rincian}</pre>
      </div>

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      <Button type="button" className="w-full py-6" disabled={!requiredOk} onClick={submit}>
        <Send className="mr-1.5 h-4 w-4" />
        Simpan & Kirim Draf Kontrak
      </Button>
    </div>
  );
}
