/**
 * WESTSIDE PARCEL STRIP — shared rules (2026-07-02)
 *
 * Single source of truth shared by the backup, strip, and restore scripts so
 * all three agree on exactly WHAT is county-import-stamped (removable) vs.
 * WHAT is the contact's real pre-import identity / Matt's own research (KEPT).
 *
 * Context: the 2026-05-27 westside CSV import update-matched pre-existing CRM
 * contacts and stamped county deed-owner parcel data onto them. The Hoffman
 * case (#13014) proved the skip-trace can staple the WRONG household's parcel
 * onto a real lead. This strip removes ONLY the import-stamped parcel data from
 * the 67 high-confidence wrong-household contacts, preserving everything Matt
 * wrote and every real contact point / relationship / stage.
 *
 * MAXIMUM REVERSIBILITY: the strip only ever REMOVES county-stamped fields; the
 * full pre-strip state is backed up first (out/westside-strip-backup.json) and
 * scripts/_westside-parcel-restore.mjs restores any/all contacts byte-for-byte.
 */

// ---- Tag namespaces the county import stamped (removable) -------------------
// A tag is stripped IFF it is one of the exact tags OR matches one of the
// parcel-derived prefixes below. Everything else (real tags: Import, Bend,
// audience:*, seller:*, compliance:*, contact:*, email:*, city:*, state:*,
// Expired*, industry:*, brokerage:*, Matt Ryan, …) is KEPT.
export const STRIP_EXACT_TAGS = new Set([
  'import:westside-2026-05',
  'source:county-assessor',
  'area:bend-westside',
  'fb-audience:westside-all',
  'owner-occupied', // legacy un-namespaced owner-occupied stamp (see id 3989)
  'absentee', // legacy un-namespaced absentee stamp
  'long-term', // legacy un-namespaced tenure stamp
  'recent-purchase', // legacy un-namespaced tenure stamp
  'high-equity', // legacy un-namespaced equity stamp
  'high-lead-score', // legacy un-namespaced score stamp
  'source:farm-merge-2026-06', // the westside farm-merge provenance tag
])

// Prefix namespaces that are entirely parcel/county-derived → strip any tag
// starting with one of these. (These describe the STAMPED parcel, which on a
// wrong-household record is not this contact's home.)
export const STRIP_TAG_PREFIXES = [
  'owner:', // owner:occupied / owner:absentee / owner:absentee-outofstate / owner:entity
  'equity:', // equity:high / equity:medium / equity:low / equity:very-high
  'tenure:', // tenure:0-2yr … tenure:25plus / tenure:long-term / tenure:recent
  'seller-score:', // seller-score:cold/cool/warm/hot
  'neighborhood:', // county-assigned geo of the stamped parcel
  'subdivision:', // county-assigned subdivision of the stamped parcel
  'geo:', // geo:local / geo:out-of-state / geo:out-of-area (derived from parcel vs contact)
  'lifecycle:', // lifecycle:rate-locked / lifecycle:likely-retirement-age (score-model derived)
]

// ---- Custom (jsonb) keys the county import stamped (removable) --------------
// Empirically every custom key present on the 75 flagged contacts is
// county/enrichment-derived parcel data (verified 2026-07-02: zero Matt-authored
// custom keys on any target). We strip by an explicit allow-list of county keys
// so an unexpected NEW key on a contact is KEPT (fail-safe toward preservation).
export const STRIP_CUSTOM_KEYS = new Set([
  // property facts of the stamped parcel
  'customAPN', 'customBaths', 'customBedrooms', 'customYearBuilt', 'customBuildingSqft',
  'customLotAcres', 'customSubdivision', 'customNeighborhood', 'customPlannedCommunity',
  'customSellerPropertyAddress',
  // ownership / valuation of the stamped parcel
  'customPurchasePrice', 'customPurchaseYear', 'customPurchaseDate', 'customLastPurchaseDate',
  'customHomeAnniversary', 'customMarketValue', 'customEstimatedMarketValue', 'customEquityPct',
  'customYearsOwned',
  // scoring / campaign flags derived from the parcel
  'customSellerScore', 'customSellerScoreBand', 'customLeadScore', 'customLeadTier',
  'customClassification', 'customIncludeInFBCAS', 'customOpenHouseAddress',
  // enrichment provenance
  'customPhoneType', 'customEnrichmentProvider',
])

// NOTE: listing/realtor custom keys (customMLSNumber, customListingStatus,
// customListingExpiredDate, customBrokerage, customRealtorLicense, …) are NOT in
// the strip set — contacts carrying them are SKIPPED entirely for manual review
// (they overlap Matt's expired-listing / broker-recruit pipelines). See
// SKIP_IDS below.

// ---- Contacts to SKIP (leave fully intact; hand to Matt for manual review) --
// (a) 7 carry expired-listing / realtor-recruit signals = Matt's OTHER pipeline
//     gold overlapping the county stamp; (b) 1 is mid-split with the sibling
//     couple-split agent (split_agent_overlap=YES). We do not auto-strip these.
export const SKIP_IDS = new Set([
  2401, // Patrick Acton — Real Estate Agent / broker-recruit
  5173, // Peter Mccaffrey — realtor (brokerage + license custom)
  6729, // Thomas Howard — Real Estate Agent / sphere
  8036, // Marx Wein — Expired listing (MLS + listing custom + Expired tags)
  8161, // Sian Heyworth — Expired/canceled listing (MLS + listing custom)
  11727, // Jonathan Gemme — intent:expired-listing pipeline
  12362, // David Moore — realtor (brokerage + license custom)
  12099, // Diana Robinson — split_agent_overlap=YES (may be mid couple-split)
])

// ---- Background: is this the county-brief template, or Matt's own notes? -----
// The stamped brief starts with a fixed header and always carries a NEXT STEPS
// block. If the background matches the template we remove it. If it does NOT
// match (Matt wrote it, or it's mixed), we KEEP it and flag for manual review.
const BG_TEMPLATE_HEAD = /^\s*(WESTSIDE HOMEOWNER|INDUSTRY REALTOR|ABSENTEE OWNER|OWNER-OCCUPANT)/i
export function backgroundIsStampedTemplate(bg) {
  const s = String(bg || '')
  if (!s.trim()) return false
  return BG_TEMPLATE_HEAD.test(s) && /NEXT STEPS/i.test(s)
}

// ---- Address: which address rows are the stamped parcel (removable)? --------
// The westside import stamps the parcel address in TWO shapes, BOTH removable:
//   (1) a blank-type row whose street === custom.customSellerPropertyAddress
//       (the parcel from the westside CSV), and
//   (2) a type:"Property" row (the Zillow-enrich geo-match of the same parcel;
//       its street can differ from customSellerPropertyAddress, e.g. an adjacent
//       APN the enrich step matched — verified 2026-07-02: 25 such rows).
// Every OTHER address — a BLANK-type row NOT matching the stamped street — is
// the contact's real pre-import mailing address (the out-of-state identity
// signal that flagged the mismatch) and is KEPT. NOTE: zpid is NOT a reliable
// stamped-marker (21 of 24 real-identity rows also carry a zpid), so the rule
// keys on address TYPE + street match, never on zpid.
export function streetKey(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** True if this address row is import-stamped parcel data (removable). */
export function isStampedAddress(addr, stampStreetKey) {
  const isProperty = String(addr?.type || '').toLowerCase() === 'property'
  if (isProperty) return true
  return Boolean(stampStreetKey) && streetKey(addr?.street) === stampStreetKey
}

/**
 * Compute the stripped state for one person. Pure function — no I/O.
 * Returns { changed, tags, custom, addresses, background, removed } where the
 * first four are the NEW values and `removed` describes what was taken out.
 */
export function computeStrip(person) {
  const origTags = Array.isArray(person.tags) ? person.tags : []
  const origCustom = person.custom && typeof person.custom === 'object' ? person.custom : {}
  const origAddrs = Array.isArray(person.addresses) ? person.addresses : []
  const origBg = person.background ?? null

  // tags
  const keptTags = []
  const removedTags = []
  for (const t of origTags) {
    const isStrip = STRIP_EXACT_TAGS.has(t) || STRIP_TAG_PREFIXES.some((p) => String(t).startsWith(p))
    if (isStrip) removedTags.push(t)
    else keptTags.push(t)
  }

  // custom
  const nextCustom = {}
  const removedCustomKeys = []
  for (const [k, v] of Object.entries(origCustom)) {
    if (STRIP_CUSTOM_KEYS.has(k)) removedCustomKeys.push(k)
    else nextCustom[k] = v
  }

  // addresses — remove both stamped shapes (blank-type stamped-street + Property-type)
  const stampStreet = streetKey(String(origCustom.customSellerPropertyAddress || '').split(',')[0])
  const keptAddrs = []
  const removedAddrs = []
  for (const a of origAddrs) {
    if (isStampedAddress(a, stampStreet)) removedAddrs.push(a)
    else keptAddrs.push(a)
  }

  // background — only if it matches the stamped template
  const bgIsTemplate = backgroundIsStampedTemplate(origBg)
  const nextBg = bgIsTemplate ? null : origBg
  const bgRemoved = bgIsTemplate

  const changed =
    removedTags.length > 0 ||
    removedCustomKeys.length > 0 ||
    removedAddrs.length > 0 ||
    bgRemoved

  return {
    changed,
    tags: keptTags,
    custom: nextCustom,
    addresses: keptAddrs,
    background: nextBg,
    removed: {
      tags: removedTags,
      customKeys: removedCustomKeys,
      addresses: removedAddrs,
      backgroundRemoved: bgRemoved,
      backgroundKeptForReview: !bgIsTemplate && Boolean(String(origBg || '').trim()),
    },
  }
}
