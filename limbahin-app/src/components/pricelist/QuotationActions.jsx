import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Mail, FileSignature } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from './fields';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { buildWhatsAppLink } from '@/lib/contactConfig';
import { buildQuotationWhatsAppMessage } from '@/lib/waMessages';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Renders the two step-5 buttons:
//   1. "Request Kirim Penawaran" — opens a popup asking for the email address, sends the
//      quotation PDF there, then redirects to WhatsApp with a prefilled summary so CS knows the
//      customer submitted (and can follow up). Once that's done, the browser moves on to /hasil
//      (success or failure) instead of staying on this step.
//   2. "Saya setuju..." button (lighter cyan) — carries the quote + company over to /registrasi to
//      start the contract/MOU registration wizard. If the customer had already started filling in
//      the registration form and came back here via "Ubah Pilihan Harga", `registrationDraft`
//      carries that data forward so nothing already typed is lost.
//
// Used by both the normal 5-step wizard's ReviewStep AND the referral-code shortcut flow, so the
// behaviour (and the WA/email copy) never drifts between the two paths.
export default function QuotationActions({ quote, company, onSendEmail, homeState, registrationDraft }) {
  const navigate = useNavigate();
  const [emailPopupOpen, setEmailPopupOpen] = useState(false);
  const [email, setEmail] = useState(company?.email || '');
  const [status, setStatus] = useState('idle'); // idle | sending

  const emailValid = EMAIL_RE.test(email.trim());

  const handleConfirmSendEmail = async () => {
    if (!quote || !emailValid) return;
    setStatus('sending');
    const trimmedEmail = email.trim();
    try {
      await onSendEmail(trimmedEmail);
      const waLink = buildWhatsAppLink(buildQuotationWhatsAppMessage({ company, quote, email: trimmedEmail }));
      window.open(waLink, '_blank', 'noopener,noreferrer');
      setEmailPopupOpen(false);
      navigate('/hasil', { state: { type: 'quotation', success: true, quote, company, email: trimmedEmail, homeState } });
    } catch (err) {
      setEmailPopupOpen(false);
      navigate('/hasil', {
        state: {
          type: 'quotation',
          success: false,
          error: err?.message || 'Gagal mengirim email. Silakan coba lagi.',
          quote,
          company,
          email: trimmedEmail,
          homeState,
        },
      });
    } finally {
      setStatus('idle');
    }
  };

  const handleContinueToContract = () => {
    navigate('/registrasi', { state: { quote, company, email: email.trim(), registrationDraft } });
  };

  return (
    <div className="space-y-4">
      <Button
        onClick={() => setEmailPopupOpen(true)}
        disabled={!quote}
        className="w-full"
        variant="default"
      >
        <Mail className="mr-1.5 h-4 w-4" />
        Request Kirim Penawaran (Email + WhatsApp CS)
      </Button>

      {/* "Saya setuju..." uses the lighter accent cyan (vs the darker primary cyan above) so the
          two actions on this step read as visually distinct. */}
      <Button
        type="button"
        onClick={handleContinueToContract}
        disabled={!quote}
        className="w-full bg-accent py-6 text-sm font-bold text-accent-foreground hover:bg-accent/90"
      >
        <FileSignature className="mr-1.5 h-4 w-4" />
        Saya setuju dan ingin lanjut tahap pembuatan draf dokumen dan kontrak
      </Button>

      <Dialog open={emailPopupOpen} onOpenChange={(open) => status !== 'sending' && setEmailPopupOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kirim Penawaran ke Email</DialogTitle>
            <DialogDescription>
              Masukkan alamat email tujuan — dokumen PDF penawaran akan dikirim ke sana.
            </DialogDescription>
          </DialogHeader>
          <Field
            label="Alamat Email"
            icon={Mail}
            type="email"
            placeholder="nama@perusahaan.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === 'sending'}
            autoFocus
          />
          {email.trim() !== '' && !emailValid && (
            <p className="text-[11px] text-destructive">Masukkan alamat email yang valid.</p>
          )}
          <DialogFooter>
            <Button onClick={handleConfirmSendEmail} disabled={!emailValid || status === 'sending'} className="w-full">
              {status === 'sending' ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Mengirim...
                </>
              ) : (
                <>
                  <Mail className="mr-1.5 h-4 w-4" />
                  Kirim Sekarang
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
