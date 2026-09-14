import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, AreaField, StepIntro } from '@/components/pricelist/fields';
import { insertReferralModel } from '@/lib/remoteConfig';

const EMPTY = {
  code: '',
  lokasi_pelayanan: '',
  jenis_limbah: '',
  item_title: '',
  item_description: '',
  harga: '',
  unit: '',
  qty: '',
  jumlah: '',
  catatan_limbah: '',
  catatan_pelayanan: '',
};

import { LOGO_BADGE_PNG } from '@/assets/logoBadgeBase64.js';

// Unlisted/"hidden" route — see App.jsx comment. Not linked anywhere in the customer-facing UI;
// staff reach it by typing /tambahreferal directly. Writes a new row to Supabase table
// `referal_model` (see supabase/schema.sql). A customer who later types this row's `code` into
// Step 1's "Kode Referal" field skips straight to a final quote built from this row.
export default function TambahReferal() {
  const [form, setForm] = useState(EMPTY);
  const [status, setStatus] = useState('idle'); // idle | saving | saved | error
  const [errorMsg, setErrorMsg] = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const autoJumlah = () => {
    const harga = Number(form.harga || 0);
    const qty = Number(form.qty || 0);
    if (harga && qty) setForm((f) => ({ ...f, jumlah: String(harga * qty) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.code.trim() || !form.item_title.trim()) {
      setStatus('error');
      setErrorMsg('Kode Referal dan Item Title wajib diisi.');
      return;
    }
    setStatus('saving');
    setErrorMsg('');
    const payload = {
      code: form.code.trim(),
      lokasi_pelayanan: form.lokasi_pelayanan.trim(),
      jenis_limbah: form.jenis_limbah.trim(),
      item_title: form.item_title.trim(),
      item_description: form.item_description.trim(),
      harga: form.harga === '' ? null : Number(form.harga),
      unit: form.unit.trim(),
      qty: form.qty === '' ? null : Number(form.qty),
      jumlah: form.jumlah === '' ? null : Number(form.jumlah),
      catatan_limbah: form.catatan_limbah.trim(),
      catatan_pelayanan: form.catatan_pelayanan.trim(),
    };
    const res = await insertReferralModel(payload);
    if (res.status === 'ok') {
      setStatus('saved');
      setForm(EMPTY);
    } else {
      setStatus('error');
      setErrorMsg(res.message || 'Supabase belum terhubung / gagal menyimpan.');
    }
  };

  return (
    <div className="min-h-screen bg-background font-body text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <img src={LOGO_BADGE_PNG} alt="LIMBAHIN" className="h-8 w-auto shrink-0 object-contain" />
          <div>
            <p className="font-display text-base font-bold tracking-tight text-primary">LIMBAHIN</p>
            <p className="text-[11px] text-muted-foreground">Tambah Kode Referal</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />
          Kembali ke halaman utama
        </Link>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <StepIntro
            title="Tambah Kode Referal"
            subtitle="Kode ini bisa dimasukkan pelanggan di Step 1 (Kode Referal) untuk langsung menerima penawaran khusus ini, tanpa melalui wizard normal."
          />

          <Field label="Kode Referal" icon={Ticket} value={form.code} onChange={set('code')} placeholder="mis. PROMOAGT26" required />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Lokasi Pelayanan" value={form.lokasi_pelayanan} onChange={set('lokasi_pelayanan')} placeholder="mis. Cikarang" />
            <Field label="Jenis Limbah" value={form.jenis_limbah} onChange={set('jenis_limbah')} placeholder="mis. MEDIS" />
          </div>

          <Field label="Item Title" value={form.item_title} onChange={set('item_title')} placeholder="Nama item pada dokumen" required />
          <AreaField label="Item Description" rows={2} value={form.item_description} onChange={set('item_description')} placeholder="Deskripsi/definisi item" />

          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Harga" type="number" value={form.harga} onChange={set('harga')} onBlur={autoJumlah} placeholder="0" />
            <Field label="Unit" value={form.unit} onChange={set('unit')} placeholder="per Kg / per Ritase" />
            <Field label="Qty" type="number" value={form.qty} onChange={set('qty')} onBlur={autoJumlah} placeholder="0" />
            <Field label="Jumlah" type="number" value={form.jumlah} onChange={set('jumlah')} placeholder="Harga × Qty" />
          </div>

          <AreaField label="Catatan Limbah" rows={2} value={form.catatan_limbah} onChange={set('catatan_limbah')} />
          <AreaField label="Catatan Pelayanan" rows={2} value={form.catatan_pelayanan} onChange={set('catatan_pelayanan')} />

          {status === 'error' && <p className="text-[12px] font-medium text-destructive">{errorMsg}</p>}
          {status === 'saved' && (
            <p className="flex items-center gap-1.5 text-[12px] font-medium text-primary">
              <CheckCircle2 className="h-4 w-4" />
              Kode referal tersimpan.
            </p>
          )}

          <Button type="submit" disabled={status === 'saving'} className="w-full">
            {status === 'saving' ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              'Simpan Kode Referal'
            )}
          </Button>
        </form>
      </main>
    </div>
  );
}
