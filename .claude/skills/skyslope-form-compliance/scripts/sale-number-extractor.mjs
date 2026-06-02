/**
 * Sale Agreement Number extraction.
 *
 * Pulls the value of the "Sale Agreement #" / "Sale Agreement Number"
 * field from page 1 of an OREF form's OCR text.
 *
 * Hard rules:
 *   - Return whatever the broker typed there. No substitution.
 *   - Reject blank-field echoes ("Buyer", "Seller", "Residential", etc.)
 *   - Reject punctuation-only strings.
 *   - Length 3-40 chars.
 *   - Must contain at least one digit OR letter.
 */

const BLANK_FIELD_ECHOES = new Set([
  'buyer', 'buyers', 'seller', 'sellers',
  'residential', 'commercial', 'sale', 'agreement', 'number',
  'addendum', 'counter', 'offer', 'disclosure',
  'page', 'date', 'n/a', 'na', 'tbd', 'none', 'unknown',
])

/**
 * Extract the Sale Agreement # from a single document's OCR text.
 *
 * Look ONLY at this document. No inheritance, no fallbacks to sibling
 * docs in the folder. Per Matt's 2026-05-20 directive: every form has
 * its own sale agreement number; you find it by opening the form and
 * looking. No shortcuts.
 *
 * @param {string} pdfText  Full OCR text of the document (page 1 carries the field)
 * @returns {string | null}  Extracted sale agreement number, or null if genuinely blank/absent
 */
export function extractSaleAgreementNumber(pdfText) {
  if (!pdfText) return null
  const text = String(pdfText)

  // Pattern variants — ordered most-specific to least-specific.
  // We look on PAGE 1 only (first 4000 chars approximately).
  const page1 = text.slice(0, 5000)

  const patterns = [
    // "Sale Agreement #: ABC123"
    /sale\s+agreement\s*#\s*[:.]?\s*([A-Za-z0-9][A-Za-z0-9.\-\/]{2,39})/i,
    // "Sale Agreement Number: ABC123"
    /sale\s+agreement\s+number\s*[:.]?\s*([A-Za-z0-9][A-Za-z0-9.\-\/]{2,39})/i,
    // OREF forms sometimes label it just "Agreement #: ABC123"
    /(?:^|\n)\s*agreement\s*#\s*[:.]?\s*([A-Za-z0-9][A-Za-z0-9.\-\/]{2,39})/im,
  ]

  for (const re of patterns) {
    const m = page1.match(re)
    if (!m) continue
    const candidate = m[1].trim()
    if (!isValidSaleNumber(candidate)) continue
    return candidate
  }
  return null
}

/**
 * @param {string} s
 * @returns {boolean}
 */
function isValidSaleNumber(s) {
  if (!s) return false
  if (s.length < 3 || s.length > 40) return false
  if (BLANK_FIELD_ECHOES.has(s.toLowerCase())) return false
  // Must contain at least one alphanumeric (not just punctuation)
  if (!/[A-Za-z0-9]/.test(s)) return false
  return true
}
