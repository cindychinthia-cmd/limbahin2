import React from 'react';
import { Check } from 'lucide-react';

const DEFAULT_TITLES = ['Detail Perusahaan', 'Lokasi & Jenis Limbah', 'Pilih Layanan', 'Parameter Tambahan', 'Review & Kirim'];

export default function Stepper({ current, done, onJump, titles }) {
  const stepTitles = titles && titles.length ? titles : DEFAULT_TITLES;
  return (
    <ol className="flex items-start gap-1.5">
      {stepTitles.map((title, i) => {
        const n = i + 1;
        const isDone = done[i];
        const isCurrent = current === n;
        const reachable = i === 0 || done.slice(0, i).every(Boolean);
        const badge = isCurrent
          ? 'border-primary bg-primary text-primary-foreground'
          : isDone
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-border bg-card text-muted-foreground';
        return (
          <React.Fragment key={title}>
            <button
              type="button"
              disabled={!reachable}
              onClick={() => reachable && onJump(n)}
              className="flex flex-col items-center gap-1.5 disabled:cursor-default"
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-bold transition-colors ${badge}`}
              >
                {isDone && !isCurrent ? <Check className="h-3.5 w-3.5" /> : n}
              </span>
              <span
                className={`hidden max-w-[110px] text-center text-[10px] font-semibold leading-tight sm:block ${
                  isCurrent ? 'text-primary' : isDone ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {title}
              </span>
            </button>
            {i < stepTitles.length - 1 && (
              <span className={`mt-3.5 h-px w-4 shrink-0 sm:w-8 ${i < current - 1 ? 'bg-primary' : 'bg-border'}`} aria-hidden />
            )}
          </React.Fragment>
        );
      })}
    </ol>
  );
}
