export type InventoryPropertyBucket =
  | 'single_family'
  | 'condo_townhome'
  | 'manufactured_mobile'
  | 'land_lot'
  | 'commercial'
  | 'other'

export function isActiveForSaleStatus(status: string | null | undefined): boolean {
  const s = (status ?? '').toLowerCase()
  if (!s) return true
  return s.includes('active') || s.includes('for sale') || s.includes('coming soon')
}

/**
 * Every real caller passes listing_tile_mv's `property_type` / `PropertyType`
 * — a raw single-letter MLS code (A-H), NOT a spelled-out string. The
 * substring matching below only ever matched a spelled-out value, so a code
 * like "D" (land/lot) never hit any branch and silently fell through to
 * 'other' — which isResidentialInventoryType() treats as residential. That
 * mixed land parcels into "active homes" counts and medians site-wide (the
 * bug that produced Pronghorn's "$180,000 median" for a $1M+ community,
 * design-audit P2, CLAUDE.md §0). Code mapping verified against the live MV
 * (lib/property-type.ts, 2026-06-08): A=residential dwellings, B=manufactured
 * in park, C=multi-family/income, D=land/lots, E-H=commercial+other.
 */
export function classifyInventoryPropertyType(propertyType: string | null | undefined): InventoryPropertyBucket {
  const raw = (propertyType ?? '').trim().toLowerCase()
  if (!raw) return 'other'
  if (raw === 'a') return 'single_family'
  if (raw === 'b') return 'manufactured_mobile'
  if (raw === 'c') return 'condo_townhome'
  if (raw === 'd') return 'land_lot'
  if (raw === 'e' || raw === 'f' || raw === 'g' || raw === 'h') return 'commercial'
  if (
    raw.includes('single family') ||
    raw.includes('single-family') ||
    raw.includes('detached') ||
    raw === 'residential'
  ) {
    return 'single_family'
  }
  if (raw.includes('condo') || raw.includes('townhome') || raw.includes('town house') || raw.includes('townhouse')) {
    return 'condo_townhome'
  }
  if (raw.includes('manufactured') || raw.includes('mobile')) {
    return 'manufactured_mobile'
  }
  if (raw.includes('land') || raw.includes('lot') || raw.includes('acreage') || raw.includes('vacant')) {
    return 'land_lot'
  }
  if (raw.includes('commercial') || raw.includes('business')) {
    return 'commercial'
  }
  return 'other'
}

export function isResidentialInventoryType(propertyType: string | null | undefined): boolean {
  const bucket = classifyInventoryPropertyType(propertyType)
  return bucket === 'single_family' || bucket === 'condo_townhome' || bucket === 'manufactured_mobile' || bucket === 'other'
}
