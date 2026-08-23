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

export function partyNamesFromJson(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (typeof item === 'string' && item.trim()) out.push(item.trim())
    else if (item && typeof item === 'object') {
      const n = (item as { name?: unknown }).name
      if (typeof n === 'string' && n.trim()) out.push(n.trim())
    }
  }
  return out
}

/** Sale packet: OREF 001 + disclosures. */
export const SALE_STANDARD_FORM_NUMBERS = ['001', '020', '042', '043', '015'] as const
/** Listing packet: exclusive listing + agency + EFA + SPDS. Not the sale agreement. */
export const LISTING_STANDARD_FORM_NUMBERS = ['015', '042', '043', '020'] as const

export function duplicatedDocumentPath(newCycleId: string, filename: string, n: number): string {
  const safe = (filename.replace(/[^\w.\-]+/g, '_').replace(/^_+|_+$/g, '') || 'document.pdf').slice(0, 80)
  return `inbox/${newCycleId}/dup-${n}-${safe}`
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
