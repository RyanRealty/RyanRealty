/**
 * lib/meta/audienceHash.ts -- PURE PII normalization + SHA-256 hashing for Meta
 * Custom Audiences (CONTACT360 Phase 5.1).
 *
 * This is the ONLY place PII is turned into the hashed form that leaves the
 * server. It is pure (no I/O, no env, no Meta call) so it can be unit-tested
 * against Meta's published normalization spec and reused everywhere a hashed
 * row is built. Raw PII NEVER leaves the server -- only the SHA-256 hex of the
 * normalized value does.
 *
 * Meta's customer-file match spec ("Customer File Custom Audiences -> preparing
 * hashed data"):
 *   - EMAIL: trim, lowercase, then SHA-256.
 *   - PHONE: strip everything except digits, prefix the country code (US -> 1)
 *     so it is E.164 without the leading "+", then SHA-256.
 *   - FN / LN: trim, lowercase, strip whitespace + the punctuation Meta ignores;
 *     letters (including accented) are preserved (Meta hashes the UTF-8 bytes --
 *     over-stripping diacritics loses matches), then SHA-256.
 *
 * The hashed record uses Meta's MULTI_KEY schema: one object per person with the
 * keys EMAIL, PHONE, FN, LN (each a 64-char lowercase SHA-256 hex string, or
 * absent when the person has no value for that key).
 */

import { createHash } from 'node:crypto'

/** Lowercase SHA-256 hex of a UTF-8 string. The single hashing primitive. */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

/**
 * Normalize an email per Meta's spec: trim, lowercase. Returns null when the
 * input is blank or not an email-ish value, so the key is omitted rather than
 * hashing an empty/garbage string (a hashed empty string is a guaranteed
 * no-match that only inflates the upload).
 */
export function normalizeEmail(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const v = String(raw).trim().toLowerCase()
  // Require an "@" with something either side -- a bare token never matches and
  // would only pollute the row count.
  if (!v || !/^[^@\s]+@[^@\s]+$/.test(v)) return null
  return v
}

/**
 * Normalize a phone per Meta's spec: digits only, E.164 without the leading "+".
 * US/Canada default: a 10-digit number gets a "1" country prefix; an 11-digit
 * number already starting with the country code is kept as-is. A number too
 * short to be a real North-American phone (< 10 digits) returns null.
 *
 * @param defaultCountryCode digits to prefix a bare national number (US/CA "1").
 */
export function normalizePhone(
  raw: string | null | undefined,
  defaultCountryCode = '1',
): string | null {
  if (raw == null) return null
  let digits = String(raw).replace(/\D/g, '')
  if (!digits) return null
  // A 10-digit number is a national number -> prefix the country code.
  if (digits.length === 10) digits = defaultCountryCode + digits
  // Below 11 digits after prefixing it cannot be a valid E.164 number; drop it.
  if (digits.length < 11) return null
  return digits
}

/**
 * Normalize a person/first/last name per Meta's spec: trim, lowercase, strip the
 * punctuation Meta ignores (periods, commas, apostrophes, hyphens, slashes) and
 * all whitespace so "O'Brien" and "obrien" match. Letters (including accented)
 * are preserved. Returns null when nothing remains.
 */
export function normalizeName(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const v = String(raw)
    .trim()
    .toLowerCase()
    .replace(/[.,'\u2019`\-_/\\]/g, '')
    .replace(/\s+/g, '')
  return v || null
}

/** A person's raw PII, as carried on a crm_people row. */
export type AudiencePerson = {
  email?: string | null
  /** Additional emails (e.g. crm_people.emails[]); the first usable one wins. */
  emails?: ReadonlyArray<string | null | undefined> | null
  phone?: string | null
  phones?: ReadonlyArray<string | null | undefined> | null
  firstName?: string | null
  lastName?: string | null
}

/**
 * A single Meta MULTI_KEY hashed record. Every present field is a 64-char
 * lowercase SHA-256 hex string. Absent fields mean the person had no usable
 * value for that key (Meta matches on whatever keys are present).
 */
export type AudienceUserData = {
  EMAIL?: string
  PHONE?: string
  FN?: string
  LN?: string
}

/** First usable normalized value across a scalar + an optional list. */
function firstNormalized(
  scalar: string | null | undefined,
  list: ReadonlyArray<string | null | undefined> | null | undefined,
  normalize: (v: string | null | undefined) => string | null,
): string | null {
  const direct = normalize(scalar)
  if (direct) return direct
  for (const item of list ?? []) {
    const n = normalize(item)
    if (n) return n
  }
  return null
}

/**
 * Build the Meta MULTI_KEY hashed record for one person. Returns null when the
 * person has NO usable email AND NO usable phone -- such a row can never match
 * and must not be uploaded (it would only inflate the count). Name keys ride
 * along only when an email or phone is present.
 */
export function buildAudienceUserData(person: AudiencePerson): AudienceUserData | null {
  const email = firstNormalized(person.email, person.emails, normalizeEmail)
  const phone = firstNormalized(person.phone, person.phones, (v) => normalizePhone(v))
  if (!email && !phone) return null

  const out: AudienceUserData = {}
  if (email) out.EMAIL = sha256Hex(email)
  if (phone) out.PHONE = sha256Hex(phone)

  const fn = normalizeName(person.firstName)
  const ln = normalizeName(person.lastName)
  if (fn) out.FN = sha256Hex(fn)
  if (ln) out.LN = sha256Hex(ln)

  return out
}

/** The MULTI_KEY schema column order Meta's /users endpoint expects. */
export const AUDIENCE_SCHEMA = ['EMAIL', 'PHONE', 'FN', 'LN'] as const

/**
 * Project a hashed record into the positional row Meta's batched /users payload
 * uses (schema = AUDIENCE_SCHEMA). Missing keys become empty strings, which Meta
 * treats as "no value for this key" within a multi-key row.
 */
export function toSchemaRow(user: AudienceUserData): string[] {
  return AUDIENCE_SCHEMA.map((k) => user[k] ?? '')
}
