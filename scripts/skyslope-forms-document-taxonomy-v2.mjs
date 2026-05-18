/**
 * SkySlope Forms — v2 naming taxonomy (Matt's 2026-05-16 rule).
 *
 *   {YYYY-MM-DD} {seq3} [X ]{[sale# ]}{[OREF# ]}{Form Name}.pdf
 *
 * Rules:
 *   - X prefix only when the per-document execution heuristic confirms every
 *     obligated signer for the form type has a name match near a signature
 *     marker in the PDF text (pdf.js + OCR via skyslope-pdf-insight.mjs).
 *   - "Sale agreement number" = the transaction MLS number for the folder.
 *     Resolved from the listing or sale detail JSON, or via the linked listing
 *     for sale folders. Omitted for listing agreements and buyer
 *     representation agreements (Matt's explicit exemption 2026-05-16).
 *   - OREF# extracted from the source filename when present, else omitted.
 *   - Form Name is a canonical OREF title where known, else cleaned from the
 *     source filename.
 *   - Spaces between fields. SkySlope UI shows them as spaces.
 */

import { parseDate } from './skyslope-forms-document-taxonomy.mjs'

export { parseDate, fmtDate } from './skyslope-forms-document-taxonomy.mjs'

/**
 * Canonical OREF titles grounded in the actual filenames present in this
 * brokerage's SkySlope library. Verified against `dry-run-rename.jsonl`
 * 2026-05-16. Unknown numbers stay null and we fall back to filename
 * cleanup for the title.
 */
export const OREF_TITLES = {
  '000B': 'Advisory for Buyers and Sellers of Real Estate',
  '001': 'Residential Real Estate Sale Agreement',
  '002': 'Addendum to Sale Agreement',
  '003': 'Counteroffer',
  '004': 'Buyers Counter Offer',
  '009': 'Back Up Offer Addendum',
  '015': 'Listing Agreement Exclusive',
  '018': 'Advisory to Seller Regarding Lead-Based Paint',
  '020': 'Sellers Property Disclosure Statement',
  '021': 'Sellers Property Disclosure Statement Exemption',
  '022': 'Sellers Property Disclosure',
  '023': 'Closing Date Addendum',
  '024': 'Earnest Money Receipt',
  '025': 'Earnest Money Release',
  '028': 'Inspection Notice',
  '040': 'Buyer Representation Agreement Non Exclusive',
  '041': 'Buyer Service Agreement',
  '042': 'Initial Agency Disclosure Pamphlet',
  '043': 'Advisory Regarding Electronic Funds',
  '046': 'Notice of Final Agreement',
  '047': 'Advisory Regarding Real Estate Compensation',
  '048': 'Notice to Buyer',
  '050': 'Buyer Representation Agreement Exclusive',
  '053': 'Agreement to Occupy Before Closing',
  '054': 'Agreement to Occupy After Closing',
  '056': 'Sale Agreement Amendment',
  '057': 'Counteroffer to Final Agreement',
  '058': 'Advisory to Buyer Regarding Due Diligence',
  '059': 'Counter Offer Form',
  '060': 'Notice of Termination',
  '071': 'Bill of Sale',
  '080': 'Advisory Regarding Smoke and Carbon Monoxide Alarms',
  '081': 'Advisory to Seller Regarding Title',
  '082': 'Advisory Regarding Survey',
  '083': 'Advisory Regarding Home Warranty',
  '091': 'Advisory Regarding Septic Wells',
  '092': 'Advisory Regarding FIRPTA Tax',
  '093': 'Advisory Regarding Property Tax',
  '097': 'Advisory Regarding Manufactured Home',
  '103': 'Advisory Regarding Title Insurance',
  '104': 'Advisory Regarding Fair Housing',
  '105': 'Advisory Regarding Earnest Money',
  '108': 'Advisory and Instructions Regarding Real Estate Purchase and Sale Forms',
  '109': 'Advisory Regarding Wire Fraud',
  '110': 'Advisory Regarding Buyer Inspections',
}

/**
 * Required signer roles per inferKind() category. Drives the X-prefix
 * execution heuristic. Empty array = the category isn't signed by deal parties
 * (lender/title/closing docs), so we never assert "fully executed" on it.
 *
 *   sellers          = every party in folder.sellers
 *   buyers           = every party in folder.buyers
 *   listing_agent    = folder.agentGuid resolves via /api/users (listing side)
 *   buyer_agent      = folder.agentGuid (sale side) or /api/users
 *   acknowledger     = receiver of the form, depends on folder type
 */
export const REQUIRED_SIGNERS_BY_CATEGORY = {
  listing_agreement: ['sellers'],
  buyer_representation_agreement: ['buyers'],
  agency_disclosure_pamphlet: ['acknowledger'],
  sale_agreement_or_rsa: ['sellers', 'buyers'],
  buyer_offer_or_package: ['buyers'],
  counter_or_counteroffer: ['sellers', 'buyers'],
  numbered_counter: ['sellers', 'buyers'],
  addendum: ['sellers', 'buyers'],
  seller_property_disclosure: ['sellers', 'buyers'],
  inspection_or_repair: ['sellers', 'buyers'],
  // Receipts / lender / title / closing-adjacent docs can still be signed
  // (e.g. earnest money receipt has the buyer + escrow signatures;
  //  pre-approval has lender signature, etc.). Treat them as ANY-signed —
  //  the detector accepts a signature block in the PDF as sufficient
  //  evidence of execution. (See `executedAnyParty` branch in detectExecuted.)
  lender_financing: ['any_party'],
  earnest_or_wire: ['any_party'],
  title_or_hoa: ['any_party'],
  termination_or_release: ['sellers', 'buyers'],
  amendment_or_notice: ['sellers', 'buyers'],
  closing_adjacent: ['any_party'],
  other_pdf: ['any_party'],
  other: ['any_party'],
}

/**
 * Categories that do NOT carry a sale agreement number in the filename
 * (Matt's 2026-05-16 directive: "every OREF form, unless it's a listing
 * agreement or a buyer agreement, should pertain to a sale agreement
 * number").
 */
export const CATEGORIES_WITHOUT_SALE_NUMBER = new Set([
  'listing_agreement',
  'buyer_representation_agreement',
])

/**
 * Extract OREF form number from a filename. Returns the 3-digit string or ''.
 * Patterns observed in the live SkySlope library:
 *   "Listing Agreement - Exclusive - 015 OREF.pdf"          → 015
 *   "Listing Agreement - Exclusive - 015 OREF_2.pdf"        → 015
 *   "Residential_Real_Estate_Sale_Agreement_-_001_OREF.pdf" → 001
 *   "Counteroffer No. 1 - OREF-003.pdf"                     → 003
 *   "Advisory_for_Buyers_-_000B_OREF.pdf"                   → 000B
 *
 * `\b` (word boundary) treats underscore as a word character, so it fails
 * around `_001_OREF`. Use explicit non-alnum lookarounds instead.
 *
 * @param {string} fileName
 * @returns {string}
 */
export function extractOrefNumber(fileName) {
  const s = String(fileName || '')
  const m1 = s.match(/(?<![A-Za-z0-9])(\d{3}[A-Za-z]?)\s*[-_ ]\s*OREF(?![A-Za-z0-9])/i)
  if (m1?.[1]) return m1[1].toUpperCase()
  const m2 = s.match(/(?<![A-Za-z0-9])OREF\s*[-_ ]\s*(\d{3}[A-Za-z]?)(?![A-Za-z0-9])/i)
  if (m2?.[1]) return m2[1].toUpperCase()
  return ''
}

/**
 * Default form name per inferKind() category when no OREF# is parseable from
 * the filename and we can still identify a sensible canonical title from the
 * category alone. Falls through to filename-cleanup when not in this map.
 */
export const CATEGORY_DEFAULT_FORM_NAME = {
  listing_agreement: 'Listing Agreement Exclusive',
  buyer_representation_agreement: 'Buyer Representation Agreement',
  agency_disclosure_pamphlet: 'Initial Agency Disclosure Pamphlet',
  sale_agreement_or_rsa: 'Residential Real Estate Sale Agreement',
  seller_property_disclosure: 'Sellers Property Disclosure Statement',
  earnest_or_wire: 'Earnest Money Receipt',
}

/**
 * Derive a clean form title for the filename. Order of preference:
 *   1. Canonical title from OREF_TITLES if we have the form number.
 *   2. Title extracted from the source filename minus the OREF# tail.
 *   3. Source filename minus extension and underscores.
 *
 * Pass `category` when you also want a category-based fallback (e.g. an
 * unstructured "Sale_Agreement.pdf" → "Residential Real Estate Sale
 * Agreement").
 *
 * @param {string} fileName
 * @param {string} orefNum
 * @param {string} [category]   inferKind() result, optional
 * @returns {string}
 */
export function deriveFormName(fileName, orefNum, category) {
  if (orefNum && OREF_TITLES[orefNum]) return OREF_TITLES[orefNum]

  const stem = String(fileName || '').replace(/\.pdf$/i, '')

  // Strip OREF# tail patterns: " - 015 OREF", "_015_OREF", "OREF-015"
  let cleaned = stem
    .replace(/\s*[-_]\s*\d{3}[A-Za-z]?\s*[-_]?\s*OREF\b.*$/i, '')
    .replace(/\s*OREF\s*[-_ ]\s*\d{3}[A-Za-z]?\b.*$/i, '')
    .replace(/_\d{3}[A-Za-z]?_OREF[^_]*$/i, '')

  // Normalize separators
  cleaned = cleaned
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim()

  // Strip trailing junk like "(1)", "_2", "_2025-09-09 09_13_16", and
  // SkySlope internal storage IDs (e.g. "_646", "-820") attached after the
  // human-readable form title.
  for (let i = 0; i < 3; i++) {
    const before = cleaned
    cleaned = cleaned
      .replace(/\s*\(\d+\)\s*$/, '')
      .replace(/\s*[-_]\s*\d{4}-\d{2}-\d{2}.*$/, '')
      .replace(/\s*[-_]\s*\d{2}_\d{2}_\d{2}.*$/, '')
      .replace(/\s+\d{2,4}$/, '')
      .replace(/\s*-\s*\d{2,4}$/, '')
      .replace(/\s+-\s*$/, '')
      .replace(/\s+_+\s*$/, '')
      .trim()
    if (cleaned === before) break
  }

  // If the cleanup left behind a thin or junky stem, prefer the
  // category-based default when one exists.
  if (category && CATEGORY_DEFAULT_FORM_NAME[category]) {
    const looksThin =
      cleaned.length < 8 ||
      /^[0-9_\-\s.]+$/.test(cleaned) ||
      /^\d+\s/.test(cleaned) ||
      cleaned.toLowerCase() === 'sale agreement' ||
      cleaned.toLowerCase() === 'listing agreement' ||
      cleaned.toLowerCase() === 'buyer representation agreement' ||
      cleaned.toLowerCase() === 'spd'
    if (looksThin) return CATEGORY_DEFAULT_FORM_NAME[category]
  }

  return cleaned || (category && CATEGORY_DEFAULT_FORM_NAME[category]) || stem
}

/**
 * Augmented document classifier. Wraps v1 inferKind with extra patterns for
 * filenames v1 misses (Salesforce/Dotloop-styled long titles with dashes).
 * Keeping v1's logic intact so other scripts aren't affected.
 *
 * @param {string} fileName
 * @param {string} [name]
 * @returns {string}
 */
import { inferKind as inferKindV1 } from './skyslope-forms-document-taxonomy.mjs'
export function inferKindV2(fileName, name) {
  const v1 = inferKindV1(fileName, name)
  if (v1 !== 'other_pdf' && v1 !== 'other') return v1

  const t = `${fileName || ''} ${name || ''}`.toLowerCase()
  if (/residential[-\s_]+real[-\s_]+estate.*sale[-\s_]+agreement/.test(t)) {
    return 'sale_agreement_or_rsa'
  }
  if (/oregon[-\s_]+residential[-\s_]+real[-\s_]+estate/.test(t)) {
    return 'sale_agreement_or_rsa'
  }
  return v1
}

/**
 * Read the "Sale Agreement #" value out of the OCRed PDF text. Per the
 * 2026-05-17 SKILL.md, every OREF / OR form that pertains to a specific
 * sale agreement has this field at the top corner of the document (e.g.
 * "Sale Agreement # 20702Beaumont" or "SALE AGREEMENT # RRP05132026").
 * The value is free-form — typed by the agent or TC when drafting the
 * form. We pull it verbatim.
 *
 * Returns empty string when no field is found (typical for listing
 * agreements, BBC, pamphlets — they don't pertain to a sale agreement).
 *
 * @param {string} pdfText  merged pdf.js + OCR text from the doc
 * @returns {string}
 */
export function extractSaleAgreementNumber(pdfText) {
  if (!pdfText) return ''
  const text = String(pdfText)
  // Words that mean the field was BLANK (the underscored form line
  // rendered through OCR and then the regex bled into the next section
  // header). If the captured value matches any of these, reject.
  const blankFieldWords = new Set([
    'addendum',
    'residential',
    'commercial',
    'buyer',
    'seller',
    'agent',
    'page',
    'date',
    'name',
    'final',
    'amendment',
    'counter',
    'counteroffer',
    'notice',
    'rsa',
    'oref',
    'disclosure',
    'acknowledgement',
    'acknowledgment',
    'agreement',
    'number',
    'no',
  ])

  // Allow whitespace OR `_` between `#` and the value (form underscores
  // are common in OCR). Require the value to contain at least one digit
  // (Matt's two examples — `20702Beaumont`, `RRP05132026` — both do, and
  // it's a strong signal that we matched the typed value rather than a
  // form-section header). 2-40 chars.
  const patterns = [
    /sale\s+agreement\s*#[\s_]*([A-Za-z0-9][A-Za-z0-9.\-]{1,39})/i,
    /sale\s+agreement\s+number[:\s_]*([A-Za-z0-9][A-Za-z0-9.\-]{1,39})/i,
  ]

  for (const re of patterns) {
    for (const m of text.matchAll(new RegExp(re.source, re.flags + 'g'))) {
      let v = (m[1] || '').replace(/^[_\-\s]+|[_\-\s]+$/g, '')
      if (!v) continue
      if (v.length < 3) continue
      if (!/\d/.test(v)) continue // sale# must contain a digit
      if (blankFieldWords.has(v.toLowerCase())) continue
      if (/^\d{1,3}$/.test(v)) continue // line numbers like "1", "12"
      return v
    }
  }
  return ''
}

/**
 * Pure formatter for the v2 filename. Caller supplies the verified pieces.
 *
 * @param {object} p
 * @param {string} p.date       'YYYY-MM-DD' (or '' to omit)
 * @param {number} p.seq        positive integer (1-indexed within folder)
 * @param {boolean} p.executed  true when the X prefix applies
 * @param {string} [p.saleNumber]  MLS number, only included when applicable
 * @param {string} [p.orefNumber]  3-digit OREF code (with optional letter)
 * @param {string} p.formName   canonical or cleaned title
 * @param {string} [p.extension] source file extension WITHOUT the dot
 *                               (default 'pdf'). SkySlope rejects PATCHes that
 *                               attempt to change the extension, so the apply
 *                               path must preserve it. Pass the raw source
 *                               extension (e.g. 'jpg', 'png', 'zip'). Empty
 *                               or missing → '' (no extension) so an extension
 *                               can't be added.
 * @returns {string}
 */
export function suggestStandardNameV2(p) {
  // 2026-05-17 SKILL.md format (v3, LOCKED):
  //   {SaleAgreementNumber}_{Date}_{OREF#}_{FormName}_X.{ext}
  //
  // - Underscores between fields
  // - X is the SUFFIX (last field before extension), only when executed
  // - Sale# omitted entirely (no leading underscore) for listing
  //   agreements, BBC, pamphlets — anything the PDF didn't declare
  // - OREF# omitted entirely for non-OREF docs
  // - Spaces allowed INSIDE the form name (only `_` is a separator)
  const parts = []
  if (p.saleNumber) parts.push(p.saleNumber)
  if (p.date) parts.push(p.date)
  if (p.orefNumber) parts.push(p.orefNumber)
  if (p.formName) parts.push(p.formName)
  if (p.executed) parts.push('X')
  const ext = p.extension == null ? 'pdf' : String(p.extension || '').replace(/^\./, '').toLowerCase()
  return parts.join('_') + (ext ? '.' + ext : '')
}

/**
 * SkySlope sometimes returns "documents" that are actually checklist
 * placeholders or trash/admin pseudo-rows, not real files. PATCHing these
 * returns 422 "Unable to find document with guid". Detect them so the
 * apply path can skip cleanly.
 *
 * Signals (any one is enough):
 *   - fileSize is -1 (no real bytes)
 *   - pages is null AND fileName has no extension
 *   - documentServiceKey is empty string AND no extension
 *   - modifiedDate is the SQL-zero sentinel '0001-01-01T00:00:00' AND fileSize -1
 *
 * @param {object} doc
 * @returns {boolean}
 */
export function isUnpatchablePseudoDoc(doc) {
  if (!doc || typeof doc !== 'object') return true
  if (doc.fileSize === -1) return true
  const fn = String(doc.fileName || '')
  const hasExt = /\.[A-Za-z0-9]{1,5}$/.test(fn)
  if (doc.pages == null && !hasExt) return true
  if ((doc.documentServiceKey === '' || doc.documentServiceKey == null) && !hasExt) return true
  return false
}

/**
 * Pull the lowercase extension off a filename, without the dot. Empty string
 * when there isn't one. Strips an extra trailing dot if SkySlope returned
 * something like "Foo.pdf." (rare but seen).
 *
 * @param {string} fileName
 * @returns {string}
 */
export function fileExtension(fileName) {
  const fn = String(fileName || '').replace(/\.+$/, '')
  const m = fn.match(/\.([A-Za-z0-9]{1,8})$/)
  return m ? m[1].toLowerCase() : ''
}

/**
 * Format a SkySlope contact object as "First Last" (or company if no name).
 *
 * @param {object | null | undefined} contact
 * @returns {string}
 */
export function formatPartyName(contact) {
  if (!contact) return ''
  if (typeof contact === 'string') return contact.trim()
  const fn = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim()
  if (fn) return fn
  if (contact.fullName) return String(contact.fullName).trim()
  if (contact.company) return String(contact.company).trim()
  return ''
}

function escapeRegex(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Decide whether a document looks "fully executed" by matching every required
 * obligated party name against signature markers in the merged PDF text.
 *
 * This is a HEURISTIC. The repo's own SkySlope reference (.cursor/skills/
 * skyslope-api/reference.md) is explicit that fully-executed status cannot be
 * certified by API metadata or PDF text extraction alone. Matt asked for this
 * heuristic on 2026-05-16; the X prefix it produces is a working signal, not
 * a compliance audit. Borderline results surface in the per-doc log so a
 * human can override.
 *
 * @param {object} args
 * @param {string} args.category               inferKind() result
 * @param {'listing'|'sale'} args.folderType
 * @param {object | null} args.folderDetail    listing or sale detail payload
 * @param {string | null} args.pdfText         merged pdf.js + OCR text (or null)
 * @returns {{
 *   executed: boolean,
 *   confidence: 'high' | 'medium' | 'low',
 *   reason: string,
 *   obligated: string[],
 *   matched: string[],
 *   missing: string[],
 * }}
 */
export function detectExecuted(args) {
  const { category, folderType, folderDetail, pdfText } = args
  const required = REQUIRED_SIGNERS_BY_CATEGORY[category] || []

  if (!pdfText) {
    return {
      executed: false,
      confidence: 'low',
      reason: 'no PDF text available (skipped, errored, or empty)',
      obligated: [],
      matched: [],
      missing: [],
    }
  }

  const text = String(pdfText).toLowerCase()

  const sigMarkerRe =
    /digisign\s+verified|docusign(?:ed)?|electronically\s+signed|digitally\s+signed|envelope\s+id|signed\s+by[\s:]|completed\s+by[\s:]|\bsignature[\s:]|\binitials?[\s:]/gi
  const markerHits = []
  for (const m of text.matchAll(sigMarkerRe)) markerHits.push(m.index || 0)

  // DigiSign Verified blocks typically include the signer name on the next
  // line. Pull those names out so we can count signers independently.
  const digisignSigners = []
  const digisignRe = /digisign\s+verified[^\n]*(?:\n+([^\n]+))?/gi
  for (const m of text.matchAll(digisignRe)) {
    const name = (m[1] || '').trim().replace(/\s+/g, ' ')
    if (name && name.length > 2 && name.length < 80) digisignSigners.push(name)
  }

  // "any_party" mode: a signature block anywhere is sufficient evidence the
  // document was executed (used for receipts, lender, title, closing,
  // other). Matches Matt's 2026-05-17 directive that every doc should be
  // evaluated, not just those with a strict obligated-party pattern.
  if (required.length === 1 && required[0] === 'any_party') {
    if (markerHits.length >= 2 || digisignSigners.length >= 1) {
      return {
        executed: true,
        confidence: markerHits.length >= 4 ? 'high' : 'medium',
        reason: `any-party mode: ${markerHits.length} signature markers, ${digisignSigners.length} DigiSign signer blocks`,
        obligated: ['any_party'],
        matched: digisignSigners.length ? digisignSigners : ['signature_block_present'],
        missing: [],
      }
    }
    return {
      executed: false,
      confidence: 'low',
      reason: `any-party mode: no signature evidence (markers=${markerHits.length})`,
      obligated: ['any_party'],
      matched: [],
      missing: ['any_party'],
    }
  }

  if (required.length === 0) {
    return {
      executed: false,
      confidence: 'low',
      reason: `category ${category} has no required-signer pattern`,
      obligated: [],
      matched: [],
      missing: [],
    }
  }

  /** @type {string[]} */
  const obligated = []

  for (const role of required) {
    if (role === 'sellers') {
      for (const s of folderDetail?.sellers || []) {
        const n = formatPartyName(s)
        if (n) obligated.push(n)
      }
    } else if (role === 'buyers') {
      for (const b of folderDetail?.buyers || []) {
        const n = formatPartyName(b)
        if (n) obligated.push(n)
      }
    } else if (role === 'acknowledger') {
      const candidates =
        folderType === 'listing'
          ? folderDetail?.sellers || []
          : folderDetail?.buyers || folderDetail?.sellers || []
      for (const c of candidates) {
        const n = formatPartyName(c)
        if (n) obligated.push(n)
      }
    }
  }

  const dedup = [...new Set(obligated.map((n) => n.toLowerCase()))]

  if (dedup.length === 0) {
    // Folder has no party data. Fall back to DigiSign-block heuristic: if
    // the doc has at least 2 DigiSign-style signers, treat as executed
    // (medium confidence). Matt's directive: read every doc and decide.
    if (digisignSigners.length >= 2 || markerHits.length >= 4) {
      return {
        executed: true,
        confidence: 'medium',
        reason: `no folder parties, but ${digisignSigners.length} DigiSign blocks and ${markerHits.length} sig markers present`,
        obligated: [],
        matched: digisignSigners,
        missing: [],
      }
    }
    return {
      executed: false,
      confidence: 'low',
      reason: 'no obligated-party names on the folder and no DigiSign evidence',
      obligated: [],
      matched: [],
      missing: [],
    }
  }

  if (markerHits.length === 0) {
    return {
      executed: false,
      confidence: 'medium',
      reason: 'no signature markers detected in PDF text',
      obligated: dedup,
      matched: [],
      missing: dedup,
    }
  }

  /** @type {string[]} */
  const matched = []
  /** @type {string[]} */
  const missing = []

  for (const fullName of dedup) {
    // Build a set of name tokens to search: full name, first+last, last only.
    const tokens = fullName.split(/\s+/).filter((t) => t.length >= 2)
    const variants = new Set([fullName])
    if (tokens.length >= 2) {
      variants.add(`${tokens[0]} ${tokens[tokens.length - 1]}`)
      // Last name alone, but only if it's >= 4 chars (avoid noise on "Lee").
      const lastName = tokens[tokens.length - 1]
      if (lastName.length >= 4) variants.add(lastName)
    }

    let hit = false

    // Step 1: name appears within 500 chars of any signature marker.
    for (const v of variants) {
      const reV = new RegExp(`\\b${escapeRegex(v)}\\b`, 'i')
      for (const idx of markerHits) {
        const start = Math.max(0, idx - 500)
        const end = idx + 500
        if (reV.test(text.slice(start, end))) {
          hit = true
          break
        }
      }
      if (hit) break
    }

    // Step 2: name appears in a DigiSign signer block.
    if (!hit) {
      for (const v of variants) {
        const reV = new RegExp(`\\b${escapeRegex(v)}\\b`, 'i')
        for (const signer of digisignSigners) {
          if (reV.test(signer)) {
            hit = true
            break
          }
        }
        if (hit) break
      }
    }

    if (hit) matched.push(fullName)
    else missing.push(fullName)
  }

  const allMatched = matched.length === dedup.length
  const someMatched = matched.length > 0

  return {
    executed: allMatched,
    confidence: allMatched ? 'high' : someMatched ? 'medium' : 'low',
    reason: allMatched
      ? `${matched.length}/${dedup.length} required parties matched (markers=${markerHits.length}, digisign=${digisignSigners.length})`
      : `${matched.length}/${dedup.length} required parties matched; missing: ${missing.join(', ')}`,
    obligated: dedup,
    matched,
    missing,
  }
}

/** v2 callers should prefer inferKindV2 (declared above). v1 is kept exported
 * for back-compat with other scripts importing `inferKind` by name. */
export { inferKind } from './skyslope-forms-document-taxonomy.mjs'

/**
 * Build the v2 filename for a single document.
 *
 * @param {object} args
 * @param {string} args.fileName       source filename
 * @param {string} args.uploadDateIso  ISO date string
 * @param {number} args.seq            1-indexed seq within folder
 * @param {string} args.category       inferKind() result
 * @param {string} args.mls            MLS number (or '')
 * @param {boolean} args.executed      X prefix flag
 * @returns {string}
 */
export function suggestV2FromInputs(args) {
  const { fileName, uploadDateIso, seq, category, mls, executed } = args

  const orefNumber = extractOrefNumber(fileName)
  const formName = deriveFormName(fileName, orefNumber, category)

  const t = parseDate(uploadDateIso)
  const date = t ? new Date(t).toISOString().slice(0, 10) : ''

  const useSale = !CATEGORIES_WITHOUT_SALE_NUMBER.has(category)
  const saleNumber = useSale && mls ? String(mls).replace(/[^\w.-]/g, '') : ''

  return suggestStandardNameV2({
    date,
    seq,
    executed: Boolean(executed),
    saleNumber,
    orefNumber,
    formName,
  })
}
