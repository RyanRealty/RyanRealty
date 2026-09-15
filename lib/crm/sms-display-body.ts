/**
 * Display-only strip of a leading participant/date header that sometimes lands
 * inside SMS body text (group/iMessage-style imports), e.g.
 *   "Matt Ryan Tanya Hogan Patrick Hogan Jun 3 Sounds like…"
 * → "Sounds like…"
 *
 * Leaves normal SMS alone. Pure — safe in client bundles. Prefer render-time
 * strip so historical rows clean up without a migration.
 */

const MONTH =
  '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)'

/** One Capitalized token (First / Last / O'Brien / Mary-Jane). */
const NAME_TOKEN = "[A-Z][a-zA-Z'-]*"

/**
 * Leading header: 2+ CapWords (at least one First Last), then Month Day,
 * optional comma/year, then the real body.
 */
const PARTICIPANT_DATE_HEADER = new RegExp(
  `^(?:${NAME_TOKEN}\\s+){2,}${MONTH}\\s+\\d{1,2}(?:,?\\s*\\d{4})?\\s+([\\s\\S]+)$`,
)

export function smsDisplayBody(raw: string | null | undefined): string {
  if (raw == null) return ''
  const t = raw.trim()
  if (!t) return t
  const m = t.match(PARTICIPANT_DATE_HEADER)
  if (!m) return t
  const rest = (m[1] ?? '').trim()
  // Refuse to strip down to empty — keep the original if the "body" vanished.
  return rest || t
}
