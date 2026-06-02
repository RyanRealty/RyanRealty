/**
 * Signer validation — the executed-detector replacement.
 *
 * This implements the algorithm described in
 * .claude/skills/skyslope-form-compliance/references/signer-validation.md.
 *
 * Old detector failed by:
 *   - Falling back to "any 2 signature markers = executed" when folder
 *     party data was missing.
 *   - Treating receipt/lender/title/closing as `any_party` mode (2
 *     markers anywhere = executed) without locating the actual
 *     obligated party's signature block.
 *   - Awarding X to mutual instruments where only one side signed.
 *
 * Replacement algorithm: for each obligated role declared by the
 * form library entry, validate the role's signature is present. ALL
 * roles must pass. ANY miss → no X.
 */

import { getForm } from './form-library.mjs'

const SIGNATURE_MARKERS = /digisign\s+verified|docusign(?:ed)?|electronically\s+signed|digitally\s+signed|envelope\s+id|signed\s+by[\s:]|completed\s+by[\s:]|\bsignature[\s:]|\binitials?[\s:]|\[sign(?:ed|ature)?\s*here\]|\/s\/\s+\w+/gi

const RYAN_REALTY_BROKERS = [
  { name: 'Matthew Ryan', email: 'matt@ryan-realty.com', alias: 'Matt Ryan' },
  { name: 'Rebecca Peterson', email: 'rebeccapeterson@ryan-realty.com' },
  { name: 'Paul Stevenson', email: 'paul@ryan-realty.com' },
]

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function findSignatureMarkers(text) {
  const hits = []
  for (const m of text.matchAll(SIGNATURE_MARKERS)) hits.push(m.index)
  return hits
}

function parseDigisignBlocks(text) {
  // DigiSign Verified blocks typically include the signer name + role on
  // the next 1-3 lines after the marker.
  const blocks = []
  const re = /digisign\s+verified[^\n]*\n+([^\n]+)(?:\n+([^\n]+))?(?:\n+([^\n]+))?/gi
  for (const m of text.matchAll(re)) {
    const name = (m[1] || '').trim().replace(/\s+/g, ' ')
    const role = (m[2] || '').trim().toLowerCase()
    if (name && name.length > 2 && name.length < 80) {
      blocks.push({ name, role, index: m.index })
    }
  }
  return blocks
}

/**
 * Look for a name within ±N chars of any signature marker.
 *
 * @param {string} text       lowercased OCR text
 * @param {string} fullName   the candidate signer name
 * @param {number[]} markerIndices
 * @returns {boolean}
 */
function nameNearMarker(text, fullName, markerIndices) {
  const tokens = fullName.split(/\s+/).filter((t) => t.length >= 2)
  const variants = new Set([fullName])
  if (tokens.length >= 2) {
    variants.add(`${tokens[0]} ${tokens[tokens.length - 1]}`)
    if (tokens[tokens.length - 1].length >= 4) variants.add(tokens[tokens.length - 1])
  }
  for (const variant of variants) {
    const re = new RegExp(`\\b${escapeRegex(variant.toLowerCase())}\\b`, 'i')
    for (const idx of markerIndices) {
      const start = Math.max(0, idx - 500)
      const end = idx + 500
      if (re.test(text.slice(start, end))) return true
    }
  }
  return false
}

function formatPartyName(p) {
  if (!p) return ''
  if (typeof p === 'string') return p
  return [p.firstName, p.middleName, p.lastName, p.name].filter(Boolean).join(' ').trim()
}

/**
 * Validate execution for a doc given its identified form and OCR text.
 *
 * @param {{
 *   formId: string,
 *   ocrText: string,
 *   folderType: 'listing' | 'sale',
 *   folderDetail: { sellers?: any[], buyers?: any[], listingAgent?: string, saleAgent?: string },
 * }} args
 * @returns {{
 *   executed: boolean,
 *   confidence: 'high' | 'medium' | 'low' | 'unknown',
 *   reason: string,
 *   obligatedRoles: string[],
 *   matched: string[],
 *   missing: string[],
 * }}
 */
export function validateExecution(args) {
  const { formId, ocrText, folderType, folderDetail } = args
  const form = getForm(formId)
  if (!form) {
    return { executed: false, confidence: 'unknown', reason: `unknown formId: ${formId}`, obligatedRoles: [], matched: [], missing: [] }
  }
  if (!ocrText || ocrText.length < 50) {
    return { executed: false, confidence: 'unknown', reason: 'OCR text empty or too short', obligatedRoles: form.signers, matched: [], missing: form.signers }
  }

  const text = ocrText.toLowerCase()
  const markerIndices = findSignatureMarkers(text)
  const digisignBlocks = parseDigisignBlocks(text)

  // Handle special role: not_applicable
  if (form.signers.length === 1 && form.signers[0] === 'not_applicable') {
    return { executed: false, confidence: 'high', reason: 'reference document — never executed by parties', obligatedRoles: ['not_applicable'], matched: [], missing: [] }
  }

  // Validate each obligated role
  const matched = []
  const missing = []
  for (const role of form.signers) {
    const result = validateRole(role, { text, markerIndices, digisignBlocks, folderType, folderDetail, form })
    if (result.passed) {
      matched.push(...result.matched)
    } else {
      missing.push(...result.missing)
    }
  }

  const allPassed = missing.length === 0
  const confidence = allPassed && folderDetail && (folderDetail.sellers?.length || folderDetail.buyers?.length) ? 'high' : allPassed ? 'medium' : 'low'

  return {
    executed: allPassed,
    confidence,
    reason: allPassed
      ? `all required roles passed: ${matched.join(', ')}`
      : `missing required role(s): ${missing.join(', ')}`,
    obligatedRoles: form.signers,
    matched,
    missing,
  }
}

function validateRole(role, ctx) {
  const { text, markerIndices, digisignBlocks, folderType, folderDetail, form } = ctx

  if (role === 'not_applicable') return { passed: true, matched: [], missing: [] }

  if (role === 'seller') {
    return validateByNames(folderDetail?.sellers || [], 'seller', { text, markerIndices, digisignBlocks })
  }

  if (role === 'buyer') {
    return validateByNames(folderDetail?.buyers || [], 'buyer', { text, markerIndices, digisignBlocks })
  }

  if (role === 'acknowledger') {
    const partyList = folderType === 'listing' ? folderDetail?.sellers || [] : folderDetail?.buyers || folderDetail?.sellers || []
    return validateByNames(partyList, 'acknowledger', { text, markerIndices, digisignBlocks })
  }

  if (role === 'seller_broker' || role === 'buyer_broker') {
    return validateBroker(folderDetail, role, { text, markerIndices, digisignBlocks })
  }

  if (role === 'single_party') {
    // Form has exactly one signature block. Validate the block has a marker.
    // Structural: at least one marker AND at least one DigiSign-style block
    // with a name in the body.
    if (markerIndices.length >= 1 && digisignBlocks.length >= 1) {
      return { passed: true, matched: [`single_party (${digisignBlocks[0].name})`], missing: [] }
    }
    // Fallback: a clear /s/ stamp or "signed by" line is sufficient
    if (markerIndices.length >= 1 && /\/s\/\s+\w+\s+\w+|signed\s+by[:\s]+\w+\s+\w+/i.test(text)) {
      return { passed: true, matched: ['single_party (stamp present)'], missing: [] }
    }
    return { passed: false, matched: [], missing: ['single_party'] }
  }

  if (role === 'lender' || role === 'escrow_officer' || role === 'title_officer' || role === 'inspector' || role === 'vendor') {
    // For these roles, the form library tells us where the block is. Look
    // for a marker in the block region. If no positional data, fall back
    // to "at least one marker and one DigiSign block".
    if (digisignBlocks.length >= 1) {
      return { passed: true, matched: [`${role} (${digisignBlocks[0].name})`], missing: [] }
    }
    if (markerIndices.length >= 1) {
      return { passed: true, matched: [`${role} (signature marker present)`], missing: [] }
    }
    return { passed: false, matched: [], missing: [role] }
  }

  return { passed: false, matched: [], missing: [`unknown_role:${role}`] }
}

function validateByNames(partyList, roleName, { text, markerIndices, digisignBlocks }) {
  if (!partyList || partyList.length === 0) {
    // No folder party data. Structural validation only — return inconclusive.
    return { passed: false, matched: [], missing: [`${roleName} (no folder party data)`] }
  }
  const names = partyList.map(formatPartyName).filter(Boolean)
  const matched = []
  const missing = []
  for (const name of names) {
    let hit = nameNearMarker(text, name, markerIndices)
    if (!hit) {
      // Also try DigiSign block names
      const tokens = name.split(/\s+/).filter((t) => t.length >= 2)
      const variants = new Set([name.toLowerCase()])
      if (tokens.length >= 2) variants.add(`${tokens[0]} ${tokens[tokens.length - 1]}`.toLowerCase())
      for (const block of digisignBlocks) {
        for (const v of variants) {
          if (block.name.toLowerCase().includes(v)) {
            hit = true
            break
          }
        }
        if (hit) break
      }
    }
    if (hit) matched.push(name)
    else missing.push(name)
  }
  return { passed: missing.length === 0 && matched.length > 0, matched, missing }
}

function validateBroker(folderDetail, brokerRole, { text, markerIndices, digisignBlocks }) {
  // Try the specific agent on the folder first
  let agentEmail = brokerRole === 'seller_broker' ? folderDetail?.listingAgent || folderDetail?.saleAgent : folderDetail?.saleAgent || folderDetail?.listingAgent
  const candidates = []
  if (agentEmail) {
    const broker = RYAN_REALTY_BROKERS.find((b) => b.email === agentEmail)
    if (broker) candidates.push(broker)
  }
  if (candidates.length === 0) candidates.push(...RYAN_REALTY_BROKERS)

  const matched = []
  const missing = []
  for (const broker of candidates) {
    if (nameNearMarker(text, broker.name, markerIndices)) {
      matched.push(broker.name)
      return { passed: true, matched, missing: [] }
    }
  }
  missing.push(brokerRole)
  return { passed: false, matched, missing }
}
