/**
 * publishLeaseTerms — a commercial lease's terms as its listing files them,
 * in the words a card prints (2026-09-25: the lease dial printed the rent and
 * the size and nothing that tells one lease from another; the portals print
 * the lease type and who pays what).
 *
 * THE SOURCE. The MLS payload, `listings.details`, read by getLeaseTerms:
 *   - the lease type is filed as a top-level flag set to true: "NNN", "NN",
 *     "Modified Gross" or "Gross" (row reads 2026-09-25: 20260823210358661794
 *     NNN with TenantPays taxes, insurance, repairs and CAM; 20260416233549976737
 *     Gross with OwnerPays taxes, insurance and repairs; 20260615183255283415
 *     NN with TenantPays taxes and insurance);
 *   - "TenantPays", an object of expense names set to true;
 *   - "Zoning", the jurisdiction's zone as the listing states it;
 *   - "# of Parking Spaces", a count.
 * A flag that is not exactly true, an empty object, a zone that is blank or a
 * count that is not a positive whole number prints nothing. Two lease-type
 * flags on one listing contradict each other, so neither prints (§0: a term
 * that cannot be stated without a guess is cut).
 */

export type LeaseTermsInput = {
  nnn?: unknown
  nn?: unknown
  modifiedGross?: unknown
  gross?: unknown
  tenantPays?: unknown
  zoning?: unknown
  parking?: unknown
}

/** The expenses a reader weighs first, in that order; the rest follow as filed. */
const EXPENSE_ORDER = ['Taxes', 'Insurance', 'Common Area Maintenance', 'Repairs', 'Utilities', 'Electricity', 'Water', 'Sewer', 'Gas']

/** How many expenses a card names before "and N more". */
const EXPENSES_NAMED = 3

const truthy = (v: unknown) => v === true || v === 'true'

function expenseWord(name: string): string {
  if (name === 'Common Area Maintenance') return 'CAM'
  return name.toLowerCase()
}

function joinWords(words: readonly string[]): string {
  if (words.length <= 1) return words[0] ?? ''
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

/** "NNN lease", "Tenant pays taxes, insurance and CAM", "Zoning IL", "15 parking spaces". */
export function publishLeaseTerms(input: LeaseTermsInput): string[] {
  const out: string[] = []

  const types = [
    truthy(input.nnn) ? 'NNN' : null,
    truthy(input.nn) ? 'NN' : null,
    truthy(input.modifiedGross) ? 'Modified gross' : null,
    truthy(input.gross) ? 'Gross' : null,
  ].filter((t): t is string => t !== null)
  if (types.length === 1) out.push(`${types[0]} lease`)

  const pays = input.tenantPays
  if (pays && typeof pays === 'object' && !Array.isArray(pays)) {
    const names = Object.entries(pays as Record<string, unknown>)
      .filter(([, v]) => truthy(v))
      .map(([k]) => k.trim())
      .filter(Boolean)
    const ranked = [
      ...EXPENSE_ORDER.filter((name) => names.includes(name)),
      ...names.filter((name) => !EXPENSE_ORDER.includes(name)),
    ]
    if (ranked.length > 0) {
      const named = ranked.slice(0, EXPENSES_NAMED).map(expenseWord)
      const rest = ranked.length - named.length
      out.push(
        rest > 0
          ? `Tenant pays ${named.join(', ')} and ${rest} more`
          : `Tenant pays ${joinWords(named)}`,
      )
    }
  }

  const zone = typeof input.zoning === 'string' ? input.zoning.trim() : ''
  if (zone) out.push(`Zoning ${zone}`)

  const spaces = typeof input.parking === 'number' ? input.parking : Number(String(input.parking ?? '').trim())
  if (input.parking != null && String(input.parking).trim() !== '' && Number.isInteger(spaces) && spaces > 0) {
    out.push(`${spaces.toLocaleString('en-US')} parking ${spaces === 1 ? 'space' : 'spaces'}`)
  }

  return out
}
