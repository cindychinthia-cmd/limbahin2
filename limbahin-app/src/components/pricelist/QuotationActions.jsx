import React, { useState } from 'react';
import { FileSignature, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { buildPricelistSummaryText } from '@/lib/pricing';

export default function QuotationActions({ quote, email, onSendEmail, onContinue }) {
  const [open, setOpen] = useState(false);
  const summary = buildPricelistSummaryText(quote);

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
        <p className="font-display text-sm font-bold text-primary">Rincian Pelayanan & Harga</p>
        <pre className="whitespace-pre-wrap font-body text-xs leading-relaxed">{summary}</pre>
      </div>

      <Button type="button" onClick={() => setOpen(true)} disabled={!quote || !email} className="w-full">
        <Mail className="mr-1.5 h-4 w-4" />
        Kirim Penawaran PDF
      </Button>
      <Button
        type="button"
        onClick={onContinue}
        disabled={!quote}
        className="w-full bg-accent py-6 text-sm font-bold text-accent-foreground hover:bg-accent/90"
      >
        <FileSignature className="mr-1.5 h-4 w-4" />
        Pilih pelayanan ini & lanjut registrasi
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Email Penawaran</DialogTitle>
            <DialogDescription>
              PDF penawaran akan dikirim ke <strong>{email}</strong>. Pastikan alamat email sudah benar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              className="w-full"
              onClick={() => {
                setOpen(false);
                onSendEmail();
              }}
            >
              <Mail className="mr-1.5 h-4 w-4" />
              Ya, kirim ke email ini
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
