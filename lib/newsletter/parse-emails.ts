/**
 * Pure email-list parser for the bulk newsletter tools (bulk enroll + one-off
 * send). Accepts a free-form paste — one email per line, or comma / semicolon /
 * whitespace separated, or any mix — and returns the normalized, de-duped set of
 * syntactically valid addresses.
 *
 * Kept pure + dependency-free so it unit-tests trivially and can run on either
 * side of the server/client boundary. Validity here is a pragmatic RFC-ish check
 * (local@domain.tld with no spaces), NOT deliverability — the send path still
 * runs the suppression + active re-check per row before anything goes out.
 */

// Local part: letters/digits and the common punctuation RFC 5321 allows, no
// leading/trailing/double dots. Domain: labels separated by dots, a 2+ char TLD.
const EMAIL_RE =
  /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/

/**
 * Parse a raw pasted email list into a clean, lowercased, de-duped array of
 * syntactically valid emails. Splits on newlines, commas, semicolons, and any
 * whitespace; trims each token; drops anything that fails the validity check;
 * collapses case-insensitive duplicates (preserving first-seen order).
 */
export function parseEmailList(raw: string): string[] {
  if (!raw || typeof raw !== 'string') return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const token of raw.split(/[\s,;]+/)) {
    const email = token.trim().toLowerCase()
    if (!email) continue
    if (!EMAIL_RE.test(email)) continue
    if (seen.has(email)) continue
    seen.add(email)
    out.push(email)
  }
  return out
}
