// Normalizes any Indonesian phone/WA number input so it always starts with "+62", regardless of
// how the customer types it in (with a leading 0, a leading 62, spaces, dashes, or already with a
// +). Used by every "Nomor Kontak" / "No. Telp" / "Tel/WA PIC" field across the wizard and the
// registration form.
//
// Examples:
//   "0812 3456 7890"  -> "+62 812-3456-7890"
//   "62812-3456-7890" -> "+62 812-3456-7890"
//   "+62812345"       -> "+62 812345"
//   "812345"          -> "+62 812345"
//   ""                -> ""
//
// The formatting keeps things forgiving while the person is still typing (it doesn't reject
// partial numbers), it only ever fixes the *prefix* — the rest of the digits typed are preserved
// as-is (just re-grouped lightly with dashes for readability).
export function normalizeIndoPhone(raw) {
  const value = String(raw ?? '');
  if (!value.trim()) return '';

  // Keep only digits from here on; the leading "+" (if any) is re-added at the end.
  let digits = value.replace(/[^\d]/g, '');
  if (!digits) return '';

  if (digits.startsWith('620')) {
    // Someone typed "62" then kept the local leading 0 (e.g. 62081234...) — drop that extra 0.
    digits = '62' + digits.slice(3);
  } else if (digits.startsWith('0')) {
    // Local format (0812...) -> country code format (62812...)
    digits = '62' + digits.slice(1);
  } else if (!digits.startsWith('62')) {
    // No recognizable country/leading-zero prefix at all -> assume it's a local number typed
    // without the 0, and just prepend 62.
    digits = '62' + digits;
  }

  const national = digits.slice(2); // digits after "62"
  if (!national) return '+62';

  // Light grouping for readability: 62 8xx xxxx xxxx — grouped as 3-4-4 after the country code.
  const groups = [];
  let rest = national;
  const sizes = [3, 4, 4, 4];
  for (const size of sizes) {
    if (!rest) break;
    groups.push(rest.slice(0, size));
    rest = rest.slice(size);
  }
  if (rest) groups.push(rest);

  return `+62 ${groups.join('-')}`;
}

// Convenience onChange wrapper: pass the field's setter and this handles pulling the value out of
// the change event and normalizing it before storing it in state.
export function handleIndoPhoneChange(setValue) {
  return (e) => setValue(normalizeIndoPhone(e.target.value));
}
