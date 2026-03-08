/**
 * Build highlights from listing fields: first 3–5 sentences of PublicRemarks, or top 3 derived features.
 * Kept in a server-safe module so the listing page (Server Component) can call it.
 */
export function buildListingHighlights(fields: Record<string, unknown>): {
  highlights: string[]
  featureTags: string[]
} {
  const remarks = (fields.PublicRemarks ?? fields.PrivateRemarks ?? '') as string
  const sentences = remarks
    ? remarks
        .trim()
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 5)
    : []

  const tags: string[] = []
  const lotAcres = fields.LotSizeAcres != null ? Number(fields.LotSizeAcres) : null
  if (lotAcres != null && lotAcres > 0) {
    tags.push(lotAcres >= 1 ? `${lotAcres} acre lot` : `${(lotAcres * 43560).toLocaleString()} sq ft lot`)
  }
  const garage = fields.GarageSpaces ?? fields.Garage ?? fields.AttachedGarageYN
  if (garage != null && String(garage).toLowerCase() !== 'no' && String(garage) !== '0') {
    const n = typeof garage === 'number' ? garage : parseInt(String(garage), 10)
    tags.push(Number.isFinite(n) && n > 0 ? `${n}-car garage` : 'Garage')
  }
  const sub = (fields.SubdivisionName ?? '') as string
  if (sub.trim()) tags.push(`${sub.trim()} community`)
  const sqft = fields.BuildingAreaTotal ?? fields.LivingArea
  if (sqft != null && Number(sqft) > 0) {
    tags.push(`${Number(sqft).toLocaleString()} sq ft`)
  }
  const year = fields.YearBuilt
  if (year != null) tags.push(`Built ${year}`)

  return {
    highlights: sentences,
    featureTags: tags.slice(0, 5),
  }
}
