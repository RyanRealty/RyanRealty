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
  // (found 2026-07-30 adversarial audit). check-private-key-parity.mjs (G60)
  // now fails the build if a spelling pair goes missing again.
  'Owner Name', 'Occupant Name', 'Phone to Show', 'Phone to Show Number',
  'Preferred Escrow Company & Officer',
  'Private Remarks', 'Private Office Remarks', 'Showing Instructions',
  'Showing Contact Name', 'Showing Contact Phone', 'Showing Phone Number',
  'Owner Phone', 'Occupant Phone', 'Contingency Remarks',
  'Semi Private Remarks', 'SemiPrivateRemarks',
  // Second adversarial pass, 2026-07-30, run with the PUBLIC ANON key against
  // production AFTER the spaced-twin fix deployed. The twin fix was correct but
  // incomplete: these three keys are not twins of anything already listed, so
  // nothing caught them. Measured on 400 active rows read anonymously:
  //   ShowingRequirements  399/400  appointment-only / call-listing-agent /
  //                                  pets-on-premises flags — showing logistics
  //   Tenant Name            6/400  real occupant names, e.g. a named church
  //   Call Owner             2/400  routes a buyer around the listing broker
  // Tenant Name is third-party PII that no one consented to publish. The other
  // two are agent-only showing logistics. All three are confidential under the
  // same rule the keys above enforce.
  'ShowingRequirements', 'Showing Requirements',
  'ShowingConsiderations', 'Showing Considerations',
  'TenantName', 'Tenant Name',
  'CallOwner', 'Call Owner',
  'LockBoxLocation', 'LockBoxNumber', 'LockBoxSerialNumber',
  'Lock Box Location', 'Lock Box Number', 'Lock Box Serial Number',
  'AccessCode', 'Access Code',
] as const

/**
 * Prefix applied to a CustomFields key that collides (with a DIFFERENT value)
 * with an existing StandardFields-derived details key. See
 * mergeCustomFieldsIntoDetails for the collision policy.
 */
export const CF_COLLISION_PREFIX = 'CF '

/**
 * CustomFields GROUPS whose member fields are agent-only, redacted by GROUP at
 * flatten time rather than by key afterwards.
 *
 * Why group-scoped and not another key list (census finding, 2026-07-31): the
 * MLS flattens a multi-select group into one boolean field per member, so
 * 'Showing Requirements' arrives as { "Appointment Only": true,
 * "Combination Lock Box": true, ... }. Those member keys were never in
 * PRIVATE_DETAIL_KEYS, so they stayed anon-readable — measured with the public
 * key on 400 on-market rows: Call Listing Agent 290, Appointment Only 226,
 * Pet(s) on Premises 39, Combination Lock Box 10, Security System 10.
 *
 * Redacting those LABELS blindly would destroy real public data, because the
 * flat namespace collides: 'Vacant' is a Showing/Occupancy signal in one group
 * and a legitimate public 'Current Use' value for land in another (verified in
 * the raw payload: Current Use > Fields > Vacant). The group name is present
 * in the payload and was simply being discarded, so the fix keeps it and
 * decides there.
 */
export const CONFIDENTIAL_CF_GROUPS: ReadonlySet<string> = new Set([
  'Showing Requirements',
])

/**
 * Members of a confidential group that are NOT confidential. The MLS files
 * construction status inside Showing Requirements; a buyer is entitled to know
 * a home is under construction, and hiding it would be a data loss, not a
 * privacy win.
 */
export const PUBLIC_MEMBERS_IN_CONFIDENTIAL_GROUPS: ReadonlySet<string> = new Set([
  'To Be Built',
  'Under Construction',
])

/**
 * The confidential MEMBER LABELS of CONFIDENTIAL_CF_GROUPS, redacted BY KEY,
 * independent of which group they arrive in. Exact mirror of the SQL
 * rr_showing_member_keys() (migration 20260731160000); G60 fails the build if
 * the two lists drift.
 *
 * WHY THIS EXISTS ON TOP OF THE GROUP CHECK (root cause, 2026-07-31):
 * group-scoped redaction is PROVENANCE-based, and the flattened namespace is
 * not partitioned by provenance — the same label can arrive a second time from
 * a group that is not confidential, and that copy lands in the public half
 * under the identical key. A live Spark census over 800 on-market listings
 * found exactly one such cross-group collision:
 *
 *   'Call Listing Agent'   Showing Requirements = 576   Existing Lease Type = 1
 *
 * The Showing Requirements copy diverted correctly to listing_private; the
 * 'Existing Lease Type' copy was written into the anon-readable
 * listings.details on ListNumber 220226199 (Active, Medford) and was readable
 * with the PUBLIC ANON KEY. One row, because only one listing in the sample
 * carries that lease field — but every future sync of any such listing would
 * re-leak it, and any new MLS group reusing a showing label would open the
 * same hole silently.
 *
 * So the group check decides DIVERSION (what earns a listing_private row) and
 * this list decides EXCLUSION (what may never reach `details`). Exclusion is
 * unconditional, which is what makes the class unable to recur.
 *
 * The three deliberate publics are absent by construction: 'To Be Built' and
 * 'Under Construction' (PUBLIC_MEMBERS_IN_CONFIDENTIAL_GROUPS) and 'Vacant',
 * which the census confirms lives only in the public 'Current Use' group
 * (64/800) and never inside Showing Requirements. Over-redaction is a defect
 * too, so this list is the measured member set, not a blanket label sweep.
 */
export const CONFIDENTIAL_CF_MEMBER_KEYS = [
  '24 Hour Notice',
  'Appointment Only',
  'Call Listing Agent',
  'Call Owner',
  'Call Tenant',
  'Combination Lock Box',
  'Day Sleeper',
  'Key In Office',
  'Listing Agent Must Accompany',
  'Lockbox',
  'Lockbox CBS Code Required',
  'No Appointment/Call Needed',
  'Pet(s) on Premises',
  'Security System',
  'See Showing Instructions',
  'Text Listing Agent',
] as const

const CONFIDENTIAL_CF_MEMBER_SET: ReadonlySet<string> = new Set(CONFIDENTIAL_CF_MEMBER_KEYS)

/**
 * Everything that must never appear in the anon-readable `details`, whatever
 * its provenance: the RESO/CF confidential keys plus the confidential group
 * members. Mirrors the SQL rr_private_keys() (= rr_private_keys_base() ||
 * rr_showing_member_keys()) one-for-one.
 */
export const REDACTED_DETAIL_KEYS: readonly string[] = [
  ...PRIVATE_DETAIL_KEYS,
  ...CONFIDENTIAL_CF_MEMBER_KEYS,
]

/**
 * Strip Spark's masked-field markers from a StandardFields object.
 *
 * Spark masks fields our feed access level does not license by returning the
 * literal string "********" (any run of asterisks). The CustomFields flatten
 * has always dropped these (flattenCustomFields), but the StandardFields path
 * stored them verbatim into `details` and typed text columns — measured
 * 2026-07-30: `direction_faces` carried the mask on 9,407 of 9,648 MV rows,
 * `school_district` on all 1,596 non-null rows, and 7,539 active rows carried
 * masked SpaYN/CarportYN/StoriesTotal/WalkScore/... keys. Nine search filters
 * were built on top of those fields before anyone noticed the source never
 * provides them. A masked value carries zero information: drop the key.
 *
 * Scalars matching /^\*+$/ (trimmed) are dropped. String arrays are filtered
 * of masked elements and dropped entirely when nothing survives. Everything
 * else passes through untouched.
 */
export function stripMaskedValues(fields: Record<string, unknown>): Record<string, unknown> {
  const masked = (v: unknown): boolean =>
    typeof v === 'string' && /^\*+$/.test(v.trim()) && v.trim() !== ''
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fields)) {
    if (masked(v)) continue
    if (Array.isArray(v)) {
      const kept = v.filter((el) => !masked(el))
      if (kept.length === 0 && v.length > 0) continue
      out[k] = kept.length === v.length ? v : kept
      continue
    }
    out[k] = v
  }
  return out
}

/** `details` with every confidential key removed — safe for the anon-readable column.
 *  Also removes the `CF `-prefixed variant of each key (belt-and-suspenders: a
 *  confidential CF key must never survive redaction via collision renaming). */
export function redactPublicDetails(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...fields }
  for (const k of REDACTED_DETAIL_KEYS) {
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
  const parts = customFields != null ? partitionCustomFields(customFields) : null
  const source: Record<string, unknown> = parts ? { ...fields, ...parts.public } : fields
  const priv: Record<string, unknown> = {}
  for (const k of REDACTED_DETAIL_KEYS) {
    const v = source[k]
    if (v != null && !(typeof v === 'string' && (v.trim() === '' || /^\*+$/.test(v)))) priv[k] = v
  }
  // Confidential GROUP members carry no shared key list — they are private by
  // provenance, so they divert wholesale.
  if (parts) {
    for (const [k, v] of Object.entries(parts.confidential)) priv[k] = v
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
  return partitionCustomFields(customFields).public
}

/**
 * The confidential half: member fields belonging to a CONFIDENTIAL_CF_GROUPS
 * group. Diverted to listing_private, never merged into the public details.
 */
export function flattenConfidentialCustomFields(customFields: unknown): Record<string, unknown> {
  return partitionCustomFields(customFields).confidential
}

/**
 * One pass over the payload, splitting fields by their GROUP. The group name is
 * only available here — every later stage sees a flat namespace where
 * confidential and public members are indistinguishable by key.
 */
export function partitionCustomFields(
  customFields: unknown,
): { public: Record<string, unknown>; confidential: Record<string, unknown> } {
  const out: Record<string, unknown> = {}
  const confidential: Record<string, unknown> = {}
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
        for (const [groupName, fieldEntries] of Object.entries(group as Record<string, unknown>)) {
          const groupIsConfidential = CONFIDENTIAL_CF_GROUPS.has(groupName.trim())
          const fieldList = Array.isArray(fieldEntries) ? fieldEntries : [fieldEntries]
          for (const entry of fieldList) {
            if (entry == null || typeof entry !== 'object' || Array.isArray(entry)) continue
            for (const [name, value] of Object.entries(entry as Record<string, unknown>)) {
              if (value == null) continue
              if (typeof value === 'string' && (value.trim() === '' || /^\*+$/.test(value.trim()))) continue
              // Two independent reasons a field is confidential. The LABEL test
              // runs first and has no escape hatch: a confidential member label
              // is confidential no matter which group carried it, which is what
              // closes the cross-group collision (see CONFIDENTIAL_CF_MEMBER_KEYS).
              // The GROUP test is what earns the listing_private diversion for
              // members we have not enumerated, and it alone honors the
              // deliberate-public carve-out.
              const confidentialByLabel = CONFIDENTIAL_CF_MEMBER_SET.has(name)
              const confidentialByGroup =
                groupIsConfidential && !PUBLIC_MEMBERS_IN_CONFIDENTIAL_GROUPS.has(name)
              if (confidentialByLabel || confidentialByGroup) {
                confidential[name] = value
                continue
              }
              out[name] = value
            }
          }
        }
      }
    }
  }
  return { public: out, confidential }
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
