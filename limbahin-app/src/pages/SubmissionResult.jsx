import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Pencil, Home as HomeIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LOGO_BADGE_PNG } from '@/assets/logoBadgeBase64.js';

// Landing page after either submission flow:
//   - Step 5 "Request Kirim Penawaran" (type: "quotation")
//   - /registrasi "Request Kirim Kontrak" (type: "registration")
// Both flows already open WhatsApp in a new tab before getting here — this page is what's left in
// the original tab, showing whether the submission itself succeeded or failed, with two ways
// forward: edit the data just submitted (round-trips back to the right form, prefilled), or start
// over from the homepage.
export default function SubmissionResult() {
  const location = useLocation();
  const navigate = useNavigate();
  const data = location.state;

  // Refreshing this page loses `location.state` (nothing here is persisted) — rather than show a
  // confusing blank success/fail card, send people back to the homepage.
  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <img src={LOGO_BADGE_PNG} alt="LIMBAHIN" className="h-11 w-auto object-contain" />
        <p className="font-display text-lg font-bold">Tidak ada data untuk ditampilkan</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Halaman ini mungkin ter-refresh, sehingga status pengiriman sebelumnya tidak lagi tersimpan.
        </p>
        <Button onClick={() => navigate('/')}>
          <HomeIcon className="mr-1.5 h-4 w-4" />
          Kembali ke Beranda
        </Button>
      </div>
    );
  }

  const { type, success, error, quote, company, email, registration, homeState } = data;
  const isRegistration = type === 'registration';

  const handleEdit = () => {
    if (isRegistration) {
      navigate('/registrasi', {
        state: { quote, company, email: registration?.emailPerusahaan || email, registrationDraft: registration },
      });
    } else {
      navigate({ pathname: '/', search: window.location.search }, { state: { homeDraft: homeState } });
    }
  };

  const handleHome = () => navigate('/');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-6 text-center">
      <img src={LOGO_BADGE_PNG} alt="LIMBAHIN" className="h-11 w-auto object-contain" />

      {success ? (
        <>
          <CheckCircle2 className="h-12 w-12 text-primary" />
          <div>
            <p className="font-display text-lg font-bold">
              {isRegistration ? 'Permintaan Draf Kontrak Terkirim' : 'Penawaran Berhasil Dikirim'}
            </p>
            <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
              {isRegistration
                ? 'Data pendaftaran Anda sudah kami terima dan draf kontrak akan segera diproses. Kami juga sudah membuka WhatsApp CS untuk Anda.'
                : `Dokumen PDF penawaran sudah dikirim ke ${email}. Kami juga sudah membuka WhatsApp CS untuk Anda.`}
            </p>
          </div>
        </>
      ) : (
        <>
          <XCircle className="h-12 w-12 text-destructive" />
          <div>
            <p className="font-display text-lg font-bold">
              {isRegistration ? 'Gagal Mengirim Permintaan Draf Kontrak' : 'Gagal Mengirim Penawaran'}
            </p>
            <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
              {error || 'Terjadi kesalahan saat mengirim. Silakan periksa kembali data Anda dan coba lagi.'}
            </p>
          </div>
        </>
      )}

      <div className="flex w-full max-w-xs flex-col gap-2 sm:flex-row">
        <Button variant="outline" className="w-full" onClick={handleEdit}>
          <Pencil className="mr-1.5 h-4 w-4" />
          Edit Data {isRegistration ? 'Pendaftaran' : 'Penawaran'}
        </Button>
        <Button className="w-full" onClick={handleHome}>
          <HomeIcon className="mr-1.5 h-4 w-4" />
          Kembali ke Beranda
        </Button>
      </div>
    </div>
  );
}
