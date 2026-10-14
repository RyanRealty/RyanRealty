/**
 * Cold outreach hold when the county legal owner is a company.
 * Family trusts, trustees, and estates still send. A note with no
 * legal-owner sentence does not hold: person-owned rows never write one.
 */

const LEGAL_MARKER = 'Legal owner (entity): '

/** Sentences buildCountyNotes appends after the legal-owner clause. */
const NOTE_CUTS = [
  ' Skip-trace resolved contact:',
  ' Mailing:',
  ' ABSENTEE ',
  ' Owner-occupied ',
  ' OUT-OF-STATE ',
  ' Owned since ',
  ' Skip trace:',
]

/**
 * LLC, L.L.C., LP, L.P., LLP, L.L.P., Inc, Incorporated, Corp, Corporation.
 * LLP is its own alternative so it is not missed, and LP does not match inside it.
 * INC does not match INCLINE. CORP does not match a longer unrelated word.
 */
const COMPANY_RE =
  /\b(?:L\.?\s?L\.?\s?C\.?|L\.?\s?L\.?\s?P\.?|L\.?\s?P\.?|INC(?:ORPORATED)?|CORP(?:ORATION)?)\b/i

/** The county legal owner, or null when that sentence is absent. */
export function legalEntityOwner(notes: string | null | undefined): string | null {
  if (!notes) return null
  const at = notes.indexOf(LEGAL_MARKER)
  if (at < 0) return null
  let rest = notes.slice(at + LEGAL_MARKER.length)
  let cut = rest.length
  for (const marker of NOTE_CUTS) {
    const i = rest.indexOf(marker)
    if (i >= 0 && i < cut) cut = i
  }
  rest = rest.slice(0, cut).trim()
  if (rest.endsWith('.')) rest = rest.slice(0, -1).trim()
  return rest.length > 0 ? rest : null
}

export function isCompanyOwnedEntity(name: string): boolean {
  return COMPANY_RE.test(name)
}

/**
 * Null when the letter may send. A hold sentence when the county owner is a company.
 * The sentence is the send refusal. Both drains dequeue on that code.
 */
export function companyOwnerSendHold(notes: string | null | undefined): string | null {
  const owner = legalEntityOwner(notes)
  if (!owner || !isCompanyOwnedEntity(owner)) return null
  return `County owner is a company (${owner}). Cold outreach stays held.`
}

export function isCompanyOwnerHoldError(error: string | null | undefined): error is string {
  return typeof error === 'string' && error.startsWith('County owner is a company (')
}
