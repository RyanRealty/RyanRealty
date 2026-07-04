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
// `EXTRACT` finds an email ANYWHERE in a chunk (so "Name <e@x.com>" and "e@x.com"
// both yield the address); the global flag lets one chunk hold several.
const EMAIL_SRC =
  "[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+[a-z]{2,}"

/**
 * Parse a raw pasted email list into a clean, lowercased, de-duped array of
 * syntactically valid emails. Splits on newlines / commas / semicolons (NOT bare
 * whitespace — that would shred "Name <email>"), then EXTRACTS every email-shaped
 * substring from each chunk. So display-name format ("Jane Doe <jane@x.com>"),
 * quote-wrapped CSV values ("jane@x.com"), header rows, and space-separated lists
 * all resolve to just the addresses. Case-insensitive dedupe, first-seen order.
 */
export function parseEmailList(raw: string): string[] {
  if (!raw || typeof raw !== 'string') return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const chunk of raw.split(/[\n,;]+/)) {
    const found = chunk.match(new RegExp(EMAIL_SRC, 'gi'))
    if (!found) continue
    for (const raw of found) {
      const email = raw.toLowerCase()
      if (seen.has(email)) continue
      seen.add(email)
      out.push(email)
    }
  }
  return out
}
