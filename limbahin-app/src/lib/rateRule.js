// A rate code must start with "r", followed by a signed integer percentage.
// Any trailing letters are accepted as CS-controlled noise and ignored.
// Examples: r20abc => +20%, r0abc => normal, r-15abc => -15%.
export function parseRatePercent(raw) {
  if (raw == null) return null;
  const match = String(raw).trim().match(/^r(-?\d+)[a-z]*$/i);
  return match ? Number(match[1]) : null;
}

export function parseRateMultiplier(raw) {
  const percent = parseRatePercent(raw);
  return percent == null ? null : 1 + percent / 100;
}

export function isValidRate(raw) {
  return parseRatePercent(raw) != null;
}
