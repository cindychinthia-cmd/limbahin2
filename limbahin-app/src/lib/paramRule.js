// URL price modifier — new rule.
//
// Old rule: ?param= had to be one of a fixed set of codes (NULL, FIVE, TEN, MFIVE, ...) looked up
// in PARAM_MULTIPLIERS.
//
// New rule: ?param= is a signed number, optionally followed by any letters (the letters are just
// obfuscation/noise and are ignored). Examples:
//   ?param=15askdhakds   -> +15%  (multiplier 1.15)
//   ?param=0ftyiu        -> +0%   (multiplier 1.00, normal price)
//   ?param=-26qaz        -> -26%  (multiplier 0.74)
//   ?param=NULL          -> invalid (no leading number) -> price list tidak ditemukan
//   ?param= (missing)    -> invalid
//
// No bounds are enforced — any signed integer is accepted, per explicit instruction, so e.g.
// ?param=-500xyz produces a (negative) multiplier of -4.00. That's intentional: this is an
// internal/CS-controlled link parameter, not user-facing input validation.
export function parseParamPercent(raw) {
  if (raw == null) return null;
  const str = String(raw).trim();
  const match = str.match(/^(-?\d+)/);
  if (!match) return null;
  return Number(match[1]);
}

export function percentToMultiplier(percent) {
  return 1 + percent / 100;
}

// Convenience: parse straight to a multiplier, or null if the param is invalid.
export function parseParamMultiplier(raw) {
  const percent = parseParamPercent(raw);
  if (percent == null) return null;
  return percentToMultiplier(percent);
}
