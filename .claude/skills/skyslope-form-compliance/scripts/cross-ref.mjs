/**
 * Cross-reference logic: link a document to a known sale agreement
 * number by matching the buyer/seller party names on the doc against
 * the parties on each known sale#'s RSA.
 *
 * Why this exists (Matt directive 2026-05-21):
 *
 *   "When we do not have a sale agreement number (for example, in the
 *   seller's property disclosure statement you posted above, or in a
 *   png or jpeg), we need to identify who the buyers and sellers are.
 *   If they match the buyers and sellers from a known sale agreement
 *   number, we should append that sale agreement number so we can
 *   confirm those are the correct parties.  We will apply this same
 *   logic across the board.  For any fully executed document, we will
 *   compare it to the buyers and sellers associated with a known sale
 *   agreement number."
 *
 * The match is name-based, not metadata-based.  Two normalizations:
 *
 *   - Lowercase + strip whitespace + strip punctuation
 *   - Collapse first-middle-last variants ("Stephen Graham" ==
 *     "Stephen J Graham" if last names match and first initials match)
 *
 * Match strength tiers:
 *
 *   exact    — all buyer + seller surnames + first names match
 *   strong   — all surnames match + at least one first name matches
 *              (covers spouse-only-on-some-docs edge case)
 *   weak     — only surnames match
 *   none     — no overlap
 *
 * Resolution rule when a doc's parties match MULTIPLE sale#s in the
 * same folder (typical for SPDs, advisories, EM receipts — the same
 * buyers made 3 offers, so SPD parties match all 3 RSAs):
 *
 *   ⇒ Attach to the CLOSING sale# (the sale# of the RSA that actually
 *     closed at title).  Identification of the closing sale# happens
 *     upstream — typically from the Final Buyer's Statement, which
 *     references the closing escrow number, or from a transaction
 *     summary written into the folder.
 *
 *   ⇒ If no closing sale# is known (folder still active / pending /
 *     pre-closing), attach to the most-recent fully-buyer-signed
 *     RSA's sale#.
 *
 *   ⇒ If neither rule fires, attach to no sale# and flag for review.
 *
 * The link basis is logged in the manifest for audit, but does NOT
 * appear in the v5 filename — the filename only shows the resolved
 * sale#.  Auditing happens against the manifest.
 */

function normalizeName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function nameTokens(s) {
  return normalizeName(s).split(' ').filter(Boolean)
}

function surnameOf(s) {
  const t = nameTokens(s)
  return t.length ? t[t.length - 1] : ''
}

function firstNameOf(s) {
  const t = nameTokens(s)
  return t.length ? t[0] : ''
}

/**
 * Compare the parties on a candidate doc against the parties on a
 * known sale#.  Returns one of: 'exact' | 'strong' | 'weak' | 'none'.
 *
 * @param {{ buyers: string[], sellers: string[] }} docParties
 * @param {{ buyers: string[], sellers: string[] }} salesParties
 */
export function partyMatchStrength(docParties, salesParties) {
  const docB = (docParties.buyers || []).map(nameTokens)
  const docS = (docParties.sellers || []).map(nameTokens)
  const saB = (salesParties.buyers || []).map(nameTokens)
  const saS = (salesParties.sellers || []).map(nameTokens)

  if (!docB.length && !docS.length) return 'none'

  // surname overlap check
  const docBSurnames = new Set(docB.map((t) => t[t.length - 1] || ''))
  const docSSurnames = new Set(docS.map((t) => t[t.length - 1] || ''))
  const saBSurnames = new Set(saB.map((t) => t[t.length - 1] || ''))
  const saSSurnames = new Set(saS.map((t) => t[t.length - 1] || ''))

  const buyerSurnameMatch = [...docBSurnames].every((s) => saBSurnames.has(s)) && docBSurnames.size > 0
  const sellerSurnameMatch = [...docSSurnames].every((s) => saSSurnames.has(s)) && docSSurnames.size > 0

  // If neither side has a doc party, downgrade
  const sidesPresent = (docBSurnames.size > 0 ? 1 : 0) + (docSSurnames.size > 0 ? 1 : 0)
  const sidesMatched =
    (docBSurnames.size > 0 && buyerSurnameMatch ? 1 : 0) +
    (docSSurnames.size > 0 && sellerSurnameMatch ? 1 : 0)

  if (sidesMatched < sidesPresent) return 'none'

  // first-name check
  const docBFirsts = new Set(docB.map((t) => t[0] || ''))
  const docSFirsts = new Set(docS.map((t) => t[0] || ''))
  const saBFirsts = new Set(saB.map((t) => t[0] || ''))
  const saSFirsts = new Set(saS.map((t) => t[0] || ''))

  const buyerFirstAll = [...docBFirsts].every((f) => saBFirsts.has(f)) && docBFirsts.size > 0
  const sellerFirstAll = [...docSFirsts].every((f) => saSFirsts.has(f)) && docSFirsts.size > 0
  const buyerFirstAny = [...docBFirsts].some((f) => saBFirsts.has(f))
  const sellerFirstAny = [...docSFirsts].some((f) => saSFirsts.has(f))

  if (sidesPresent === 2) {
    if (buyerFirstAll && sellerFirstAll) return 'exact'
    if (buyerFirstAny && sellerFirstAny) return 'strong'
    return 'weak'
  }
  if (sidesPresent === 1) {
    const oneSideFirstAll =
      (docBFirsts.size > 0 && buyerFirstAll) || (docSFirsts.size > 0 && sellerFirstAll)
    if (oneSideFirstAll) return 'strong'
    return 'weak'
  }
  return 'none'
}

/**
 * Resolve a doc-without-sale# to a sale# in the same folder by
 * matching parties.  See file header for the resolution rules.
 *
 * @param {{ buyers: string[], sellers: string[] }} docParties
 * @param {Array<{ saleNumber: string, buyers: string[], sellers: string[], isClosing?: boolean, signedDate?: string }>} knownSales
 * @returns {{ saleNumber: string|null, basis: string, reason: string }}
 */
export function resolveSaleNumber(docParties, knownSales) {
  if (!knownSales || !knownSales.length) {
    return { saleNumber: null, basis: 'none', reason: 'no_known_sales_in_folder' }
  }

  const scored = knownSales.map((s) => ({
    sale: s,
    strength: partyMatchStrength(docParties, { buyers: s.buyers, sellers: s.sellers }),
  }))

  const matches = scored.filter((m) => m.strength !== 'none')
  if (matches.length === 0) {
    return { saleNumber: null, basis: 'none', reason: 'no_party_overlap' }
  }
  if (matches.length === 1) {
    return {
      saleNumber: matches[0].sale.saleNumber,
      basis: `parties_match:${matches[0].strength}`,
      reason: 'unique_party_match',
    }
  }

  // Ambiguous — multiple sale#s match.  Apply the closing-sale tiebreaker.
  const closing = matches.find((m) => m.sale.isClosing)
  if (closing) {
    return {
      saleNumber: closing.sale.saleNumber,
      basis: `parties_match:${closing.strength}+closing_tiebreaker`,
      reason: 'multi_match_resolved_by_closing',
    }
  }

  // No closing flag — fall back to most-recent buyer-signed RSA.
  const sorted = [...matches]
    .filter((m) => m.sale.signedDate)
    .sort((a, b) => String(b.sale.signedDate).localeCompare(String(a.sale.signedDate)))
  if (sorted.length) {
    return {
      saleNumber: sorted[0].sale.saleNumber,
      basis: `parties_match:${sorted[0].strength}+most_recent_tiebreaker`,
      reason: 'multi_match_resolved_by_recency',
    }
  }

  return {
    saleNumber: null,
    basis: `parties_match:ambiguous(${matches.length})`,
    reason: 'multi_match_no_tiebreaker',
  }
}

export default { partyMatchStrength, resolveSaleNumber }
