// Small helpers for the "Tanggal Mulai Kontrak" + "Durasi Kontrak" fields in the unified registration step.
// The sheet/contract convention is dd/mm/yyyy (e.g. "24/02/2026"), which is what these produce —
// separate from the browser's native <input type="date"> value, which is always yyyy-mm-dd.

export function todayInputValue() {
  const d = new Date();
  return d.toISOString().slice(0, 10); // yyyy-mm-dd, for <input type="date">'s value/min
}

// `startInputValue` is a yyyy-mm-dd string (straight from an <input type="date">). Returns the
// contract's last day as a yyyy-mm-dd string: start date + N years, minus 1 day — e.g. starting
// 2026-02-24 with a 2-year term ends 2028-02-23 (so a fresh term can start again on the 24th).
export function addYearsAsDate(startInputValue, years) {
  if (!startInputValue || !years) return '';
  const [y, m, d] = startInputValue.split('-').map(Number);
  if (!y || !m || !d) return '';
  const end = new Date(y + Number(years), m - 1, d);
  end.setDate(end.getDate() - 1);
  return end.toISOString().slice(0, 10);
}

// yyyy-mm-dd -> dd/mm/yyyy (the format the sheet/contract templates expect).
export function formatDateDMY(isoInputValue) {
  if (!isoInputValue) return '';
  const [y, m, d] = isoInputValue.split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
}
