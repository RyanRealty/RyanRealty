/**
 * A3 person-header WHO labels — closed set, multiple OK.
 *
 * Dual-intent is two labels on one person, not a sixth type. The broker does
 * not type the label. Unknown tags are ignored.
 *
 * Source = tags + live work (stage / prospect story) + latest listing_view.
 */

export const PERSON_WHO_LABELS = [
  'Expired listing',
  'FSBO',
  'Buyer',
  'Seller',
  'Client',
] as const

export type PersonWhoLabel = (typeof PERSON_WHO_LABELS)[number]

export type PersonWhoInput = {
  tags?: string[] | null
  stage?: string | null
  /** From getContactProspectStory — expired / FSBO listing on this person. */
  prospectKinds?: ReadonlyArray<'expired' | 'fsbo'> | null
  /** True when the latest identified listing_view is live or within 24h. */
  hasRecentListingView?: boolean
}

const EXPIRED_EXACT = new Set([
  'expired',
  'expired listings',
  'intent:expired-listing',
  'status:expired',
  'expired-status:expired',
  'seller:expired',
  'seller:expired-untouched',
  'source:expired-listing-cron',
  'source:expired-listing-mls',
  'segment:expired',
])

function labelFromTag(low: string): PersonWhoLabel | null {
  if (
    EXPIRED_EXACT.has(low) ||
    low.startsWith('seller:expired') ||
    low.startsWith('source:expired') ||
    /^expiredwave\d+$/.test(low)
  ) {
    return 'Expired listing'
  }
  if (low === 'fsbo' || low === 'intent:fsbo' || low === 'seller:fsbo' || low === 'segment:fsbo' || low.startsWith('source:fsbo')) {
    return 'FSBO'
  }
  if (low === 'buyer' || low === 'buyer intent' || low === 'audience:buyer' || low === 'segment:buyer' || low.startsWith('buyer:')) {
    return 'Buyer'
  }
  if (low === 'audience:seller' || low === 'segment:seller' || (low.startsWith('seller:') && low !== 'seller:fsbo' && !low.startsWith('seller:expired'))) {
    return 'Seller'
  }
  if (low === 'client' || low === 'audience:client' || low === 'segment:client') {
    return 'Client'
  }
  return null
}

function labelFromStage(stage: string): PersonWhoLabel | null {
  if (stage === 'Seller Prospect') return 'Seller'
  if (stage === 'Renter - future buyer') return 'Buyer'
  if (stage === 'Active Client' || stage === 'Past Client' || stage === 'Pending') return 'Client'
  return null
}

/**
 * Map tags + prospect story + recent listing_view + stage onto the closed
 * who-label set. Order is the closed-set order. Unknown tags are ignored.
 */
export function mapPersonWhoLabels(input: PersonWhoInput): PersonWhoLabel[] {
  const found = new Set<PersonWhoLabel>()

  for (const raw of input.tags ?? []) {
    if (typeof raw !== 'string' || !raw.trim()) continue
    const label = labelFromTag(raw.trim().toLowerCase())
    if (label) found.add(label)
  }

  for (const kind of input.prospectKinds ?? []) {
    if (kind === 'expired') found.add('Expired listing')
    if (kind === 'fsbo') found.add('FSBO')
  }

  if (input.hasRecentListingView) found.add('Buyer')

  const stageLabel = labelFromStage(String(input.stage ?? '').trim())
  if (stageLabel) found.add(stageLabel)

  return PERSON_WHO_LABELS.filter((label) => found.has(label))
}
