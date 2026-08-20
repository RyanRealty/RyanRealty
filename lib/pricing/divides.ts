/**
 * Hard geographic divides for Bend CMAs. GIS same-polygon is not enough:
 * US-97 / Bend Parkway and the Deschutes split buyer pools even when a
 * subdivision name or neighborhood mesh would otherwise keep a sale.
 *
 * Unknown / missing area fails OPEN — do not invent a bank.
 */

import sides from '@/data/cma/bend-divide-sides.json'

const parkwayWest = new Set(sides.parkwayWest)
const parkwayEast = new Set(sides.parkwayEast)
const deschutesWest = new Set(sides.deschutesWest)
const deschutesEast = new Set(sides.deschutesEast)

function bank(area: string, west: Set<string>, east: Set<string>): 'west' | 'east' | null {
  if (west.has(area)) return 'west'
  if (east.has(area)) return 'east'
  return null
}

export function crossesMajorDivide(
  subjectArea: string | null | undefined,
  saleArea: string | null | undefined,
): boolean {
  const subject = subjectArea?.trim() || ''
  const sale = saleArea?.trim() || ''
  if (!subject || !sale) return false

  const parkSubject = bank(subject, parkwayWest, parkwayEast)
  const parkSale = bank(sale, parkwayWest, parkwayEast)
  if (parkSubject && parkSale && parkSubject !== parkSale) return true

  const riverSubject = bank(subject, deschutesWest, deschutesEast)
  const riverSale = bank(sale, deschutesWest, deschutesEast)
  if (riverSubject && riverSale && riverSubject !== riverSale) return true

  return false
}
