import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2, PlusCircle, Ticket, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AreaField, Field, StepIntro } from '@/components/pricelist/fields';
import { insertReferralModel } from '@/lib/remoteConfig';
import { LOGO_BADGE_PNG } from '@/assets/logoBadgeBase64.js';

const emptyItem = () => ({ item: '', description: '', harga: '', unit: '', qty: '', jumlah: '' });
const EMPTY = {
  code: '',
  lokasi_pelayanan: '',
  jenis_limbah: '',
  items: [emptyItem()],
  catatan_limbah: '',
  catatan_pelayanan: '',
};

export default function TambahReferal() {
  const [form, setForm] = useState(EMPTY);
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const setItem = (index, key, value) => setForm((current) => ({
    ...current,
    items: current.items.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const next = { ...item, [key]: value };
      if ((key === 'harga' || key === 'qty') && next.harga !== '' && next.qty !== '') {
        next.jumlah = String(Number(next.harga) * Number(next.qty));
      }
      return next;
    }),
  }));

  const submit = async (event) => {
    event.preventDefault();
    const validItems = form.items.filter((item) => item.item.trim());
    if (!form.code.trim() || !validItems.length) {
      setStatus('error');
      setErrorMsg('Kode Referal dan minimal satu item wajib diisi.');
      return;
    }
    setStatus('saving');
    const payload = {
      code: form.code.trim(),
      lokasi_pelayanan: form.lokasi_pelayanan.trim(),
      jenis_limbah: form.jenis_limbah.trim(),
      items: validItems.map((item) => ({
        item: item.item.trim(),
        description: item.description.trim(),
        harga: item.harga === '' ? null : Number(item.harga),
        unit: item.unit.trim(),
        qty: item.qty === '' ? null : Number(item.qty),
        jumlah: item.jumlah === '' ? null : Number(item.jumlah),
      })),
      catatan_limbah: form.catatan_limbah.trim(),
      catatan_pelayanan: form.catatan_pelayanan.trim(),
    };
    const result = await insertReferralModel(payload);
    if (result.status === 'ok') {
      setStatus('saved');
      setForm({ ...EMPTY, items: [emptyItem()] });
    } else {
      setStatus('error');
      setErrorMsg(result.message || 'Gagal menyimpan referal.');
    }
  };

  return (
    <div className="min-h-screen bg-background font-body text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <img src={LOGO_BADGE_PNG} alt="LIMBAHIN" className="h-8 w-auto" />
          <div>
            <p className="font-display text-base font-bold text-primary">LIMBAHIN</p>
            <p className="text-[11px] text-muted-foreground">Tambah Kode Referal</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali
        </Link>
        <form onSubmit={submit} className="space-y-5 rounded-xl border border-border bg-card p-5 shadow-sm">
          <StepIntro title="Tambah Kode Referal" subtitle="Satu referal dapat memiliki beberapa item harga." />
          <Field label="Kode Referal" icon={Ticket} value={form.code} onChange={set('code')} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Lokasi Pelayanan" value={form.lokasi_pelayanan} onChange={set('lokasi_pelayanan')} />
            <Field label="Jenis Limbah" value={form.jenis_limbah} onChange={set('jenis_limbah')} />
          </div>

          <div className="space-y-3">
            {form.items.map((item, index) => (
              <div key={index} className="space-y-3 rounded-lg border border-border bg-background p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">Item {index + 1}</p>
                  {form.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, items: current.items.filter((_, i) => i !== index) }))}
                      className="flex items-center gap-1 text-xs text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Hapus
                    </button>
                  )}
                </div>
                <Field label="Nama Item" value={item.item} onChange={(event) => setItem(index, 'item', event.target.value)} required />
                <AreaField label="Deskripsi Item" rows={2} value={item.description} onChange={(event) => setItem(index, 'description', event.target.value)} />
                <div className="grid gap-3 sm:grid-cols-4">
                  <Field label="Harga" type="number" value={item.harga} onChange={(event) => setItem(index, 'harga', event.target.value)} />
                  <Field label="Unit" value={item.unit} onChange={(event) => setItem(index, 'unit', event.target.value)} />
                  <Field label="Qty" type="number" value={item.qty} onChange={(event) => setItem(index, 'qty', event.target.value)} />
                  <Field label="Jumlah" type="number" value={item.jumlah} onChange={(event) => setItem(index, 'jumlah', event.target.value)} />
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => setForm((current) => ({ ...current, items: [...current.items, emptyItem()] }))}>
              <PlusCircle className="mr-1.5 h-4 w-4" /> Tambah Item
            </Button>
          </div>

          <AreaField label="Catatan Limbah" rows={2} value={form.catatan_limbah} onChange={set('catatan_limbah')} />
          <AreaField label="Catatan Pelayanan" rows={2} value={form.catatan_pelayanan} onChange={set('catatan_pelayanan')} />
          {status === 'error' && <p className="text-xs font-medium text-destructive">{errorMsg}</p>}
          {status === 'saved' && <p className="flex items-center gap-1.5 text-xs font-medium text-primary"><CheckCircle2 className="h-4 w-4" /> Kode referal tersimpan.</p>}
          <Button type="submit" disabled={status === 'saving'} className="w-full">
            {status === 'saving' ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Menyimpan…</> : 'Simpan Kode Referal'}
          </Button>
        </form>
      </main>
    </div>
  );
}
