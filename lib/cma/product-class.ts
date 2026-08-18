/**
 * Who this house actually competes with.
 * Beds ± 1 with no bath filter is a city dump: a 3-bed 1-bath reads as
 * "2 to 4 bedroom" and pulls almost every SFR. The scarce amenity is the
 * limiter. A 1-bath house stays in 1-bath stock even when we widen beds.
 */

export type ProductClass = {
  bedsLo: number
  bedsHi: number
  bathsLo: number | null
  bathsHi: number | null
  label: string
  tight: boolean
}

function finite(n: number | null | undefined): n is number {
  return n != null && Number.isFinite(n) && n > 0
}

function bathWindow(baths: number): { lo: number; hi: number } {
  if (baths <= 1) return { lo: 1, hi: 1.5 }
  if (baths <= 1.5) return { lo: 1, hi: 2 }
  return { lo: Math.max(1, baths - 0.5), hi: baths + 0.5 }
}

function bedsLabel(lo: number, hi: number): string {
  return lo === hi ? `${lo}-bedroom` : `${lo} to ${hi} bedroom`
}

function bathsLabel(lo: number | null, hi: number | null): string | null {
  if (lo == null || hi == null) return null
  if (lo === hi) return `${lo}-bath`
  if (lo === 1 && hi <= 1.5) return '1-bath'
  return `${lo} to ${hi} bath`
}

function labelOf(bedsLo: number, bedsHi: number, bathsLo: number | null, bathsHi: number | null): string {
  const baths = bathsLabel(bathsLo, bathsHi)
  return baths ? `${bedsLabel(bedsLo, bedsHi)}, ${baths}` : bedsLabel(bedsLo, bedsHi)
}

export function similarProductClass(
  beds: number | null,
  baths: number | null,
): ProductClass | null {
  if (!finite(beds)) return null
  const bath = finite(baths) ? bathWindow(baths) : null
  return {
    bedsLo: beds,
    bedsHi: beds,
    bathsLo: bath?.lo ?? null,
    bathsHi: bath?.hi ?? null,
    label: labelOf(beds, beds, bath?.lo ?? null, bath?.hi ?? null),
    tight: true,
  }
}

/** Widen beds by one on each side. Keep the bath limiter. */
export function widenProductClass(cls: ProductClass): ProductClass {
  const bedsLo = Math.max(1, cls.bedsLo - 1)
  const bedsHi = cls.bedsHi + 1
  return {
    ...cls,
    bedsLo,
    bedsHi,
    label: labelOf(bedsLo, bedsHi, cls.bathsLo, cls.bathsHi),
    tight: false,
  }
}

export function matchesProductClass(
  cls: ProductClass,
  beds: number | null,
  baths: number | null,
): boolean {
  if (!finite(beds) || beds < cls.bedsLo || beds > cls.bedsHi) return false
  if (cls.bathsLo == null || cls.bathsHi == null) return true
  if (!finite(baths)) return false
  return baths >= cls.bathsLo && baths <= cls.bathsHi
}
