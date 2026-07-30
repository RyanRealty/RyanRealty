/**
 * CustomFields subsystem for the listing mapper (pure extraction from
 * lib/listing-mapper.ts, file-size budget split): the Flexmls CustomFields
 * flattener, the confidential-key list (RESO + CF spellings), and the
 * redact/extract/merge helpers built on it. Every symbol is re-exported from
 * lib/listing-mapper.ts so existing importers keep working.
 */

/**
 * Agent-only confidential MLS keys that must NEVER land in the anon-readable
 * listings.details (attack finding 2026-07-11; CF expansion audit 2026-07-29).
 * Single source of truth mirrored by the SQL rr_private_keys() in migrations
 * 20260712000000 + 20260730010000. The sync mapper strips these from `details`
 * (redactPublicDetails) and the sync route diverts them into the
 * service-role-only listing_private table (extractPrivateDetails).
 *
 * Two spelling families:
 *  - RESO StandardFields spellings (camelCase, the original 11)
 *  - Flexmls CustomFields spellings (SPACED dictionary names, from the
 *    `_expand=CustomFields` ingest — verified live 2026-07-29 that the CF
 *    payload carries Owner Name / Occupant Name / Phone to Show / escrow data)
 */
export const PRIVATE_DETAIL_KEYS = [
  // RESO StandardFields spellings
  'PrivateRemarks', 'PrivateOfficeRemarks', 'ShowingInstructions',
  'ShowingContactName', 'ShowingContactPhone', 'ShowingPhoneNumber',
  'OwnerName', 'OwnerPhone', 'OccupantName', 'OccupantPhone',
  'ContingencyRemarks',
  // Flexmls CustomFields spellings (spaced field names).
  // EVERY camelCase key above needs its spaced twin here: the CF flatten emits
  // the MLS display name, so 'PrivateRemarks' and 'Private Remarks' are two
  // distinct jsonb keys. Missing the spaced twins leaked broker-private remarks
  // and showing instructions to the anon key on ~2,500 on-market listings
  // (found 2026-07-30 adversarial audit). check-private-key-parity.mjs (G58)
  // now fails the build if a spelling pair goes missing again.
  'Owner Name', 'Occupant Name', 'Phone to Show', 'Phone to Show Number',
  'Preferred Escrow Company & Officer',
  'Private Remarks', 'Private Office Remarks', 'Showing Instructions',
  'Showing Contact Name', 'Showing Contact Phone', 'Showing Phone Number',
  'Owner Phone', 'Occupant Phone', 'Contingency Remarks',
  'Semi Private Remarks', 'SemiPrivateRemarks',
] as const

/**
 * Prefix applied to a CustomFields key that collides (with a DIFFERENT value)
 * with an existing StandardFields-derived details key. See
 * mergeCustomFieldsIntoDetails for the collision policy.
 */
export const CF_COLLISION_PREFIX = 'CF '

/** `details` with every confidential key removed — safe for the anon-readable column.
 *  Also removes the `CF `-prefixed variant of each key (belt-and-suspenders: a
 *  confidential CF key must never survive redaction via collision renaming). */
export function redactPublicDetails(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...fields }
  for (const k of PRIVATE_DETAIL_KEYS) {
    delete out[k]
    delete out[`${CF_COLLISION_PREFIX}${k}`]
  }
  return out
}

/**
 * The confidential keys pulled out for the service-role-only listing_private
 * table; null when none present. When `customFields` (the raw Spark
 * `Results[].CustomFields` structure) is provided, its flattened fields are
 * merged over StandardFields first so the CF confidential spellings
 * ("Owner Name", "Phone to Show Number", …) divert too.
 */
export function extractPrivateDetails(
  fields: Record<string, unknown>,
  customFields?: unknown,
): Record<string, unknown> | null {
  const source: Record<string, unknown> = customFields != null
    ? { ...fields, ...flattenCustomFields(customFields) }
    : fields
  const priv: Record<string, unknown> = {}
  for (const k of PRIVATE_DETAIL_KEYS) {
    const v = source[k]
    if (v != null && !(typeof v === 'string' && (v.trim() === '' || /^\*+$/.test(v)))) priv[k] = v
  }
  return Object.keys(priv).length > 0 ? priv : null
}

// ---------------------------------------------------------------------------
// CustomFields flattening (Flexmls field dictionary via _expand=CustomFields)
// ---------------------------------------------------------------------------

/**
 * Flatten the Spark CustomFields structure into a single flat object of
 * { "<Field Name>": value }. Verified live shape (2026-07-29):
 *
 *   Results[].CustomFields = [
 *     { "Main": [
 *         { "<Group Name>": [ { "<Field Name>": <value> }, ... ] },
 *         ...
 *     ] }
 *   ]
 *
 * Group names ("General Property Information", "Location, Tax, and Legal",
 * "Flood", "Government Overlay", …) are dropped; all groups merge into one flat
 * namespace (a duplicate field name across groups keeps the LAST occurrence).
 * Masked values ("********") and empty strings are dropped entirely. The
 * output contains BOTH public and confidential CF fields — callers must route
 * it through redactPublicDetails / extractPrivateDetails.
 */
export function flattenCustomFields(customFields: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const containers = Array.isArray(customFields)
    ? customFields
    : customFields != null ? [customFields] : []
  for (const container of containers) {
    if (container == null || typeof container !== 'object' || Array.isArray(container)) continue
    // container: { "Main": [ ...groups ] } (container name dropped)
    for (const groups of Object.values(container as Record<string, unknown>)) {
      const groupList = Array.isArray(groups) ? groups : [groups]
      for (const group of groupList) {
        if (group == null || typeof group !== 'object' || Array.isArray(group)) continue
        // group: { "<Group Name>": [ { "<Field Name>": value }, ... ] }
        for (const fieldEntries of Object.values(group as Record<string, unknown>)) {
          const fieldList = Array.isArray(fieldEntries) ? fieldEntries : [fieldEntries]
          for (const entry of fieldList) {
            if (entry == null || typeof entry !== 'object' || Array.isArray(entry)) continue
            for (const [name, value] of Object.entries(entry as Record<string, unknown>)) {
              if (value == null) continue
              if (typeof value === 'string' && (value.trim() === '' || /^\*+$/.test(value.trim()))) continue
              out[name] = value
            }
          }
        }
      }
    }
  }
  return out
}

/**
 * Merge flattened CustomFields into a StandardFields-derived details object.
 *
 * COLLISION POLICY — THE DECISION LIVES HERE (2026-07-29, CF ingest build):
 * CF field names are the spaced Flexmls dictionary names ("Accessory Dwelling
 * Unit YN") while StandardFields keys are RESO camelCase
 * ("AccessoryDwellingUnitYN"), so collisions are rare — only one-word fields
 * like "Zoning" can overlap. When a CF field name already exists in details:
 *   - IDENTICAL value (JSON-normalized) → skip the CF copy (no duplication)
 *   - DIFFERENT value → store under `CF <Field Name>` so neither is lost and
 *     the StandardFields value (which typed columns + rr_feature_keys() already
 *     depend on) keeps its key.
 * Non-colliding CF fields land under their exact spaced names, reachable by
 * downstream rr_feature_keys()/MV logic like any other details key.
 */
export function mergeCustomFieldsIntoDetails(
  details: Record<string, unknown>,
  cfFlat: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...details }
  for (const [name, value] of Object.entries(cfFlat)) {
    if (!(name in out)) {
      out[name] = value
      continue
    }
    const same = JSON.stringify(out[name]) === JSON.stringify(value)
    if (!same) out[`${CF_COLLISION_PREFIX}${name}`] = value
    // identical → skip
  }
  return out
}
