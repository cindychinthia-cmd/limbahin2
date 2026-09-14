import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingOverlay({ show, label = 'Memproses data…' }) {
  if (!show) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-white/70 backdrop-blur-sm"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-4 shadow-lg">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <p className="text-sm font-semibold">{label}</p>
      </div>
    </div>
  );
}
