/**
 * A labeled fact row prints only when the value is a real figure.
 *
 * An em-dash, hyphen, or blank is not a number. Printing "Monthly dues —"
 * next to a verified HOA annual is an empty fact under a real label.
 *
 * Founding case: /communities/tetherow membership tiers printed Initiation
 * and Monthly dues as em-dashes (fleet 5f0ec58d60988a52e76b8a559ef22f0c).
 * Withhold the row. Do not invent a dues figure.
 */

const EMPTY_FACT = /^[\u2014\u2013\u2212\-–—\s]*$/

export function publishFactValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  if (!trimmed || EMPTY_FACT.test(trimmed)) return null
  return trimmed
}
