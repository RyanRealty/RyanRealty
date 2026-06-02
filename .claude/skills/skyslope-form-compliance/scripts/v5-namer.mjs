/**
 * v5 filename builder.
 *
 * Format:
 *   {SaleAgreementNumber}_{X}_{Form#}_{FormName}.{ext}
 *
 * Four fields. Underscore-separated. Empty fields collapse the
 * delimiter (no double underscores). Extension preserved verbatim.
 *
 * Examples:
 *   RR06092025-Ordway_X_001_Residential Real Estate Sale Agreement.pdf
 *   RR06092025-Ordway_X_042_Initial Agency Disclosure.pdf
 *   RR06092025-Ordway_X_Earnest Money Receipt.pdf       (no OREF#)
 *   Listing Agreement and SA_X_015.pdf                  (no sale#)
 *
 * v5 supersedes v4 — OREF form number IS in the filename per Matt's
 * 2026-05-20 directive. v4 said no; v5 says yes; latest wins.
 *
 * For archived (non-canonical) docs, see buildArchiveName() below.
 *
 * For image files (PNG / JPEG / etc.) — they do NOT participate in the
 * v5 OREF format. See buildImageName() below: images get descriptive
 * names ("Email Artifact - <description>.png") so Matt can recognize
 * them in the file list without opening each one. Almost every image
 * uploaded into a SkySlope sale folder is an artifact of a forwarded
 * email (Outlook signature block, broker headshot, brokerage logo,
 * wire-fraud warning shield), not a transaction document. They all
 * archive — but with descriptive names instead of "image001 503.jpg".
 *
 * For cross-referenced sale# (saleNumber derived by matching the doc's
 * buyer/seller party names against a known sale#'s parties, NOT
 * extracted from a "Sale Agreement #" field on the document itself):
 * the v5 filename uses the matched sale# directly. The basis of the
 * link (extracted vs party-match) is logged in the manifest, not in
 * the filename. See helpers in cross-ref.mjs.
 */

const MAX_FILENAME = 100
const FORBIDDEN_CHARS = /[\/\\:*?"<>|]/g

function sanitize(s) {
  return String(s || '')
    .replace(FORBIDDEN_CHARS, '')
    // SkySlope rejects en-dash and em-dash in filenames (HTTP 422).
    // Replace with ASCII hyphen-minus. Locked 2026-05-22 after Nordic apply pass.
    .replace(/[–—]/g, '-')
    // SkySlope rejects horizontal ellipsis (HTTP 422). Replace with "etc".
    .replace(/…/g, 'etc')
    // SkySlope rejects ampersand in filenames (HTTP 422). Replace with " and ".
    .replace(/&/g, ' and ')
    .replace(/\s+/g, ' ')
    // SkySlope filename validator rejects internal periods inside the
    // stem ("Form 2.2.pdf" returns HTTP 422 "File Name is invalid").
    // Replace embedded periods with hyphens. The extension is applied
    // by the caller separately, so this only affects stem text.
    .replace(/\./g, '-')
    .trim()
}

/**
 * Build a canonical v5 filename for a fully-executed/canonical document.
 *
 * @param {{
 *   saleNumber: string | null,
 *   executed: boolean,
 *   formNumber: string | null,      // OREF number like "001", "015", "042", or null for non-OREF
 *   formName: string,
 *   extension: string,
 * }} input
 * @returns {string}
 */
export function buildV5Name(input) {
  const { saleNumber, executed, formNumber, formName, extension } = input
  if (!formName) throw new Error('formName is required')
  const ext = String(extension || 'pdf').replace(/^\./, '').toLowerCase()

  // Collapse empty fields — only non-empty fields participate
  const parts = []
  const sale = sanitize(saleNumber)
  if (sale) parts.push(sale)
  if (executed) parts.push('X')
  const formNum = sanitize(formNumber)
  if (formNum) parts.push(formNum)
  parts.push(sanitize(formName))

  let stem = parts.join('_')
  let filename = `${stem}.${ext}`

  // Truncate FormName if over the limit
  if (filename.length > MAX_FILENAME) {
    const overflow = filename.length - MAX_FILENAME
    const fnIdx = parts.length - 1
    const truncated = parts[fnIdx].slice(0, parts[fnIdx].length - overflow - 4) + ' (truncated)'
    parts[fnIdx] = truncated
    stem = parts.join('_')
    filename = `${stem}.${ext}`
  }

  return filename
}

/**
 * Build an archive filename — prefixed with "ARCHIVE - " so Matt can
 * visually separate non-canonical docs from the fully-executed set in
 * any SkySlope file list.
 *
 * Used for:
 *   - Duplicate versions of a form (older offer attempt, partial-signature draft)
 *   - Non-executed mutual instruments (only one side signed)
 *   - Superseded docs (replaced by a later revision)
 *
 * @param {{
 *   saleNumber: string | null,
 *   formNumber: string | null,
 *   formName: string,
 *   reason: 'duplicate' | 'not_executed' | 'superseded' | 'unidentified',
 *   extension: string,
 *   originalName?: string,
 * }} input
 * @returns {string}
 */
export function buildArchiveName(input) {
  const { saleNumber, formNumber, formName, reason, extension, originalName } = input
  const ext = String(extension || 'pdf').replace(/^\./, '').toLowerCase()

  // For identified docs: ARCHIVE - {sale#}_{form#}_{FormName} - <reason>.ext
  // For unidentified docs: ARCHIVE - {original} - <reason>.ext
  let core
  if (formName) {
    const parts = []
    const sale = sanitize(saleNumber)
    if (sale) parts.push(sale)
    const fn = sanitize(formNumber)
    if (fn) parts.push(fn)
    parts.push(sanitize(formName))
    core = parts.join('_')
  } else {
    core = sanitize(originalName || 'unidentified').replace(/\.[a-z0-9]+$/i, '')
  }

  let stem = `ARCHIVE - ${core} - ${reason}`.replace(FORBIDDEN_CHARS, '')
  let filename = `${stem}.${ext}`
  if (filename.length > MAX_FILENAME) {
    const overflow = filename.length - MAX_FILENAME
    core = core.slice(0, core.length - overflow - 4) + ' (truncated)'
    stem = `ARCHIVE - ${core} - ${reason}`.replace(FORBIDDEN_CHARS, '')
    filename = `${stem}.${ext}`
  }
  return filename
}

/**
 * Build a descriptive image filename. Images do NOT participate in the
 * v5 OREF format. Almost every image inside a SkySlope sale folder is
 * an artifact of a forwarded email, not a real transaction document.
 *
 * For canonical images (rare — e.g., an actual signed scan-to-image of
 * a contract page that's not in PDF form), pass `archived: false` and a
 * `formName` describing the doc. The output is `{description}.{ext}`.
 *
 * For archived images (the default — email signature artifacts, broker
 * logos, headshots, wire-fraud warning shields, blank spacers), pass
 * `archived: true` and a `description` field. The output is
 * `ARCHIVE - Email Artifact - {description} - {reason}.{ext}`.
 *
 * `description` is hand-authored by the agent after reading the image:
 *   - "Harcourts Garner Group Lockup"
 *   - "Lisa Smith Outlook Signature Block"
 *   - "Listing Side Headshot"
 *   - "Blank Email Spacer"
 *   - "Western Title Wire Fraud Warning"
 *
 * @param {{
 *   archived: boolean,
 *   description: string,             // human-readable, e.g. "Lisa Smith Outlook Signature Block"
 *   reason?: 'email_artifact' | 'duplicate' | 'unidentified',
 *   extension: string,
 *   originalName?: string,
 * }} input
 * @returns {string}
 */
export function buildImageName(input) {
  const { archived, description, reason, extension, originalName } = input
  const ext = String(extension || 'png').replace(/^\./, '').toLowerCase()
  const desc = sanitize(description || originalName || 'unidentified image')

  if (!archived) {
    // Canonical image (rare). Just descriptive name.
    let filename = `${desc}.${ext}`
    if (filename.length > MAX_FILENAME) {
      const overflow = filename.length - MAX_FILENAME
      const trimmed = desc.slice(0, desc.length - overflow - 4) + ' (truncated)'
      filename = `${trimmed}.${ext}`
    }
    return filename
  }

  // Archived image — convention: ARCHIVE - Email Artifact - <desc> - <reason>.ext
  const reasonStr = reason || 'email_artifact'
  let stem = `ARCHIVE - Email Artifact - ${desc} - ${reasonStr}`.replace(FORBIDDEN_CHARS, '')
  let filename = `${stem}.${ext}`
  if (filename.length > MAX_FILENAME) {
    const overflow = filename.length - MAX_FILENAME
    const trimmed = desc.slice(0, desc.length - overflow - 4) + ' (truncated)'
    stem = `ARCHIVE - Email Artifact - ${trimmed} - ${reasonStr}`.replace(FORBIDDEN_CHARS, '')
    filename = `${stem}.${ext}`
  }
  return filename
}
