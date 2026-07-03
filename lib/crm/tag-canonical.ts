/**
 * tag-canonical — the go-forward auto-tagger (streamline v2, Phase 4).
 *
 * PURE + ADDITIVE. Given a contact's tags + custom + addresses + stage, returns the
 * canonical segment/realtor/occupancy/location tags that SHOULD be present. It only
 * ever RETURNS ADDITIONS — it never removes a tag, and never touches compliance — so
 * it is safe to union onto any lead at creation / enrichment / address-change without
 * risking the suppression footprint.
 *
 * This keeps the one-time cleanup (scripts/lib/tag-streamline.mjs) from decaying: the
 * new smart lists key on segment:* / realtor:* tags, so a fresh buyer-LP lead that
 * only carries `audience:buyer` would be invisible to the Buyers list until this adds
 * `segment:buyer`. Mirrors the migration's taxonomy; go-forward it also lets
 * `audience:seller` imply `segment:seller` (a tagged seller is a seller — new leads
 * land in Nurture/Engaged, not the retired Seller Prospect stage).
 *
 * NO Supabase, NO server-only — unit-tested and importable from any layer.
 */

const CENTRAL_OR_CITIES = new Set([
  'bend', 'redmond', 'sisters', 'la pine', 'sunriver', 'terrebonne', 'tumalo',
  'prineville', 'madras', 'culver', 'powell butte', 'crooked river ranch',
  'black butte ranch', 'camp sherman', 'alfalfa', 'brothers',
])
const NON_MAILING_TYPES = new Set(['mobile', 'landline', 'phone', 'fax'])

export type CanonicalInput = {
  tags?: string[] | null
  custom?: Record<string, unknown> | null
  addresses?: Array<{ type?: string | null; street?: string | null; city?: string | null; state?: string | null }> | null
  stage?: string | null
}

const isCityRealtorTag = (low: string): boolean => low !== 'realtor' && low.endsWith(' realtor')

function isExpiredSignal(low: string): boolean {
  if ([
    'expired', 'expired listings', 'intent:expired-listing', 'status:expired',
    'expired-status:expired', 'seller:expired-untouched',
    'source:expired-listing-cron', 'source:expired-listing-mls',
  ].includes(low)) return true
  return /^expiredwave\d+$/.test(low)
}
const isFsboSignal = (low: string): boolean => low === 'fsbo' || low === 'intent:fsbo' || low.startsWith('source:fsbo')
const isBuyerSignal = (low: string): boolean => low === 'buyer' || low === 'buyer intent' || low === 'audience:buyer' || low.startsWith('buyer:')
const isSellerSignal = (low: string): boolean => low === 'audience:seller' || low.startsWith('seller:')
const isRealtorIdentity = (low: string): boolean =>
  low === 'industry:realtor' || low === 'realtor' || low === 'audience:broker-recruit' ||
  isCityRealtorTag(low) || low === 'migration broker'
const isMigrationRealtorTag = (low: string): boolean => isCityRealtorTag(low) || low === 'migration broker'

/** Address-derived occupancy + location (hardened: phone entries are not a mailing). */
export function deriveOccupancyLocation(
  addresses: CanonicalInput['addresses'],
): { tags: string[]; occ: string; location: string | null } {
  const arr = Array.isArray(addresses) ? addresses : []
  if (arr.length === 0) return { tags: [], occ: 'unknown', location: null }
  const isRealMailing = (a: NonNullable<typeof arr>[number]): boolean =>
    !!a && a.type !== 'Property' && !NON_MAILING_TYPES.has(String(a.type || '').toLowerCase()) &&
    String(a.street || '').trim() !== ''
  const prop = arr.find((a) => a && a.type === 'Property') || null
  const mail = arr.find(isRealMailing) ||
    arr.find((a) => a && a.type !== 'Property' && !NON_MAILING_TYPES.has(String(a.type || '').toLowerCase())) || null

  if (prop && mail) {
    const st = String(mail.state || '').trim().toUpperCase()
    const city = String(mail.city || '').trim().toLowerCase()
    let location: string | null = null
    if (st && st !== 'OR') location = 'location:out-of-state'
    else if (st === 'OR') location = CENTRAL_OR_CITIES.has(city) ? 'location:local' : 'location:out-of-area'
    const tags = ['owner:absentee', ...(location ? [location] : [])]
    return { tags, occ: 'absentee', location }
  }
  if (!prop && mail && String(mail.state || '').trim().toUpperCase() === 'OR' &&
      CENTRAL_OR_CITIES.has(String(mail.city || '').trim().toLowerCase())) {
    return { tags: ['owner:occupied', 'location:local'], occ: 'occupied', location: 'location:local' }
  }
  return { tags: [], occ: prop ? 'unknown-no-mailing' : 'unknown', location: null }
}

/**
 * The canonical tags that SHOULD be on this contact — additions only. Union the
 * result onto crm_people.tags. Deterministic + idempotent (running it on an
 * already-canonical contact adds nothing new).
 */
export function canonicalTagsToAdd(input: CanonicalInput): string[] {
  const tags = Array.isArray(input.tags) ? input.tags.filter((t) => typeof t === 'string' && t) : []
  const add = new Set<string>()
  let expired = false, fsbo = false, buyer = false, seller = false, realtor = false, migration = false

  for (const t of tags) {
    const low = t.toLowerCase()
    if (isExpiredSignal(low)) expired = true
    if (isFsboSignal(low)) fsbo = true
    if (isBuyerSignal(low)) buyer = true
    if (isSellerSignal(low)) seller = true
    if (isRealtorIdentity(low)) realtor = true
    if (isMigrationRealtorTag(low)) migration = true
  }
  const cls = String(input.custom?.customClassification ?? '').trim().toUpperCase()
  if (cls === 'EXPIRED') expired = true
  if (cls === 'FSBO') fsbo = true

  const stage = String(input.stage || '')
  if (stage === 'Seller Prospect') seller = true
  if (stage === 'Real Estate Agent') realtor = true

  if (expired) add.add('segment:expired')
  if (fsbo) add.add('segment:fsbo')
  if (buyer) add.add('segment:buyer')
  if (seller) add.add('segment:seller')
  if (realtor) { add.add('industry:realtor'); add.add(migration ? 'realtor:migration' : 'realtor:local') }

  const d = deriveOccupancyLocation(input.addresses)
  for (const dt of d.tags) add.add(dt)
  if (d.occ === 'absentee' && (d.location === 'location:out-of-area' || d.location === 'location:out-of-state')) {
    add.add('segment:out-of-area')
  }

  // additions only — drop any that are already present
  const present = new Set(tags.map((t) => t.toLowerCase()))
  return [...add].filter((t) => !present.has(t.toLowerCase()))
}
