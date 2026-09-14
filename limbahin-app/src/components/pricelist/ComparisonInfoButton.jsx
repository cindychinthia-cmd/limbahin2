import React, { useState } from 'react';
import { Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { COMPARISON } from '@/data/pricelistData';

export default function ComparisonInfoButton({ content }) {
  const [open, setOpen] = useState(false);
  const comparison = content?.comparison || COMPARISON;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Perbandingan layanan"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
      >
        <Info className="h-4 w-4" />
        <span className="sr-only">Perbandingan layanan</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-display">Perbandingan Layanan</DialogTitle>
          </DialogHeader>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-primary text-left text-primary-foreground">
                  <th className="border border-border px-3 py-2 font-semibold">KOMPARASI</th>
                  {comparison.columns.map((c) => (
                    <th key={c} className="border border-border px-3 py-2 font-semibold">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparison.rows.map((row) => (
                  <tr key={row.label}>
                    <td className="border border-border bg-secondary/50 px-3 py-2 font-semibold">{row.label}</td>
                    {row.values.map((v, i) => (
                      <td key={i} className="border border-border px-3 py-2 align-top leading-relaxed">
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}