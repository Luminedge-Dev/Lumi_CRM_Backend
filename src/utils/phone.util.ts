// Mirrors frontend/lib/phone/phone.utils.ts canonicalization rules so phone values are
// stored in one consistent format across the app (backend writes, CSV import, frontend forms).
// The country table itself is imported from phone.utils.ts (this repo's other backend phone
// helper, used by validatePhone/typing-input helpers) so the two files can't drift apart.

import { PHONE_COUNTRIES as PHONE_COUNTRY_OPTIONS, DEFAULT_PHONE_COUNTRY_CODE as DEFAULT_CODE } from './phone.utils';

interface PhoneCountryRule {
  min: number;
  max: number;
  stripLeadingZero: boolean;
}

const PHONE_COUNTRIES: Array<{ code: string } & PhoneCountryRule> = PHONE_COUNTRY_OPTIONS.map((c) => ({
  code: c.code,
  min: c.min,
  max: c.max,
  stripLeadingZero: c.stripLeadingZero,
}));

export const DEFAULT_PHONE_COUNTRY_CODE = DEFAULT_CODE as string;

export const extractPhoneDigits = (value: unknown): string => String(value ?? '').replace(/\D/g, '');

const stripManualCountryPrefix = (digits: string, countryDigits: string): string => {
  if (!countryDigits) return digits;
  if (digits.startsWith(`00${countryDigits}`)) return digits.slice(2 + countryDigits.length);
  if (digits.startsWith(countryDigits)) return digits.slice(countryDigits.length);
  return digits;
};

const stripNationalTrunkPrefix = (digits: string): string => (digits.startsWith('0') ? digits.slice(1) : digits);

const normalizePhone = (phone: string, countryCode: string): string => {
  let digits = extractPhoneDigits(phone);
  const countryDigits = extractPhoneDigits(countryCode);
  const rule = PHONE_COUNTRIES.find((c) => c.code === countryCode);

  digits = stripManualCountryPrefix(digits, countryDigits);
  if (rule?.stripLeadingZero) digits = stripNationalTrunkPrefix(digits);

  return digits;
};

const buildInternationalPhone = (phone: string, countryCode: string): string => {
  const normalized = normalizePhone(phone, countryCode);
  const countryDigits = extractPhoneDigits(countryCode);
  if (!normalized || !countryDigits) return '';
  return `+${countryDigits}${normalized}`;
};

/** A bare national number (e.g. a 10-digit BD mobile number with its leading 0 already
 * stripped) can spuriously start with another country's short calling code (e.g. "1" for
 * +1), so digit-prefix detection only runs when the input actually carries an explicit
 * international prefix ('+' or '00'). Without one, the number is assumed to belong to the
 * default country rather than guessed. */
const hasExplicitInternationalPrefix = (phone: string): boolean => {
  const trimmed = String(phone ?? '').trim();
  return trimmed.startsWith('+') || trimmed.replace(/[\s\-()]/g, '').startsWith('00');
};

/** Detects the likely country from a raw phone string's digit prefix, defaulting to Bangladesh. */
const detectPhoneCountry = (phone: string): { countryCode: string; nationalNumber: string } => {
  const digits = extractPhoneDigits(phone);

  if (hasExplicitInternationalPrefix(phone)) {
    const sorted = [...PHONE_COUNTRIES].sort((a, b) => extractPhoneDigits(b.code).length - extractPhoneDigits(a.code).length);

    for (const country of sorted) {
      const countryDigits = extractPhoneDigits(country.code);
      if (countryDigits && digits.startsWith(countryDigits)) {
        return { countryCode: country.code, nationalNumber: normalizePhone(phone, country.code) };
      }
    }
  }

  return { countryCode: DEFAULT_PHONE_COUNTRY_CODE, nationalNumber: normalizePhone(phone, DEFAULT_PHONE_COUNTRY_CODE) };
};

export const splitPhoneEntries = (value?: string | null): string[] =>
  (value || '').split(/[;,\n]+/).map((part) => part.trim()).filter(Boolean);

/**
 * Canonicalizes one phone entry to "+<countryDigits><nationalDigits>" form.
 * If `countryCode` is omitted, the country is guessed from the digits (defaulting to Bangladesh),
 * matching the frontend's `detectPhoneCountry` fallback for CSV/legacy data with no explicit country.
 */
export const canonicalizePhoneEntry = (raw: string, countryCode?: string): string => {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return '';

  if (countryCode) return buildInternationalPhone(trimmed, countryCode);

  const { countryCode: detectedCode } = detectPhoneCountry(trimmed);
  return buildInternationalPhone(trimmed, detectedCode);
};

/**
 * Canonicalizes a full `phone` field value, which may contain multiple comma-separated numbers
 * (see LeadDetail.tsx's "add another phone" feature). Each entry is canonicalized independently
 * and the field is treated as one atomic value for uniqueness purposes — this does not decompose
 * multi-number leads into per-number uniqueness checks.
 *
 * `countryCode` should be passed explicitly whenever the source of the number is unambiguous
 * (e.g. bulk-importing known-market data). Without it, the country is only guessed from the
 * digit prefix when the number carries an explicit '+' or '00' international prefix; a bare
 * local number (e.g. a Bangladeshi mobile number with its leading 0 already stripped) falls
 * back to the default country instead of being misread as another country's shorter code.
 */
export const canonicalizePhoneValue = (raw: unknown, countryCode?: string): string =>
  splitPhoneEntries(String(raw ?? ''))
    .map((entry) => canonicalizePhoneEntry(entry, countryCode))
    .filter(Boolean)
    .join(', ');

export const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Digits to search `phone` by, for a raw (possibly partial) query typed into a search box.
 * Canonicalizes first so a bare national number (e.g. "01736461877") and its international
 * form (e.g. "+8801736461877") match the same stored leads — falls back to the query's raw
 * digits when canonicalization yields nothing (e.g. a short in-progress prefix while typing).
 */
export const phoneSearchDigits = (raw: string): string => {
  const canonicalDigits = extractPhoneDigits(canonicalizePhoneEntry(raw));
  return canonicalDigits || extractPhoneDigits(raw);
};

/**
 * Builds a Mongo filter that matches a lead whose `phone` field contains `canonicalPhone`
 * as one of its comma-separated entries (not just an exact whole-field match) — a `phone`
 * value can hold multiple numbers (see LeadDetail.tsx's "add another phone" feature), and
 * duplicate checks need to catch a match against any single one of them.
 */
export const buildPhoneEntryFilter = (canonicalPhone: string): Record<string, any> | null => {
  const entries = splitPhoneEntries(canonicalPhone);
  if (entries.length === 0) return null;

  const orClauses = entries.map((entry) => ({
    phone: { $regex: `(^|,\\s*)${escapeRegex(entry)}(\\s*,|$)` },
  }));

  return orClauses.length === 1 ? orClauses[0] : { $or: orClauses };
};
