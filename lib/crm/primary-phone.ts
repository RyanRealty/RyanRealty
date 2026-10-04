/**
 * The number a text to a person goes to: the phone marked primary, else the
 * first one listed (crm_people.phones). getSendTarget sends to it, and every
 * surface that shows or reasons about "the" phone (the inbox card, the compose
 * chips and their quiet-hours zones) reads it from here, so the number a
 * composer checks is the number the server texts (code review 2026-10-04).
 * Pure; '' and malformed entries are skipped.
 */
export function primaryPhoneValue(phones: unknown): string | null {
  if (!Array.isArray(phones)) return null
  const entries = phones.filter(
    (p): p is { value: string; isPrimary?: unknown } =>
      typeof p === 'object' && p !== null && typeof (p as { value?: unknown }).value === 'string' && (p as { value: string }).value.trim() !== '',
  )
  // Truthy, as getSendTarget always read it (true, 1).
  const primary = entries.find((p) => Boolean(p.isPrimary))
  return (primary ?? entries[0])?.value ?? null
}
