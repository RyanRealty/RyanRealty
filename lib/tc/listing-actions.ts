/** Pure helpers for listing-file actions (SkySlope Manage Listings kebab). */

export function duplicatePropertyKey(key: string): string {
  const base = key.replace(/-copy(?:-\d+)?$/, '')
  return `${base}-copy`
}

export function nextDuplicatePropertyKey(existing: readonly string[], sourceKey: string): string {
  const base = sourceKey.replace(/-copy(?:-\d+)?$/, '')
  const taken = new Set(existing)
  const first = `${base}-copy`
  if (!taken.has(first)) return first
  for (let n = 2; n < 100; n++) {
    const k = `${base}-copy-${n}`
    if (!taken.has(k)) return k
  }
  return `${base}-copy-${Date.now()}`
}

export function todayIsoDate(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/** Write A Listing radios we support: Seller = listing file, Buyer = sale file. */
export type FileRepresentation = 'seller' | 'buyer'

export function fileShapeForRepresentation(rep: FileRepresentation): {
  stage: 'active_listing' | 'pending'
  stageDetail: string
  kind: 'listing' | 'sale'
  status: string
  checklistType: string | null
  partyRole: 'seller' | 'buyer'
} {
  if (rep === 'seller') {
    return {
      stage: 'active_listing',
      stageDetail: 'Active listing',
      kind: 'listing',
      status: 'Active',
      checklistType: 'Residential — Standard',
      partyRole: 'seller',
    }
  }
  return {
    stage: 'pending',
    stageDetail: 'Accepted offer',
    kind: 'sale',
    status: 'Pending',
    checklistType: null,
    partyRole: 'buyer',
  }
}
