/**
 * CMA subject → pricing subject. Pure. The matcher and the live-rival
 * filter both start here so display cannot invent a second house.
 */

import { isRuralAcreage } from '@/lib/cma/comp-tiers'
import { resolveMarketArea } from '@/lib/cma/market-area'
import type { CmaSubject } from '@/lib/cma/types'
import {
  classifyHoa,
  classifyLot,
  classifyProduct,
  classifySewer,
  classifyStory,
  classifyWater,
  citySlug,
  normSubdivision,
  type StoryClass,
} from '@/lib/pricing/classes'
import type { PricingSubject } from '@/lib/pricing/match'

export function cmaSubjectToPricing(
  subject: CmaSubject,
  extras: { waterRaw?: unknown; sewerRaw?: unknown; levelsRaw?: unknown; storyClass?: StoryClass } = {},
): PricingSubject {
  const area = resolveMarketArea(subject.latitude, subject.longitude)
  return {
    listingKey: subject.listingKey,
    streetAddress: subject.streetAddress,
    city: subject.city,
    citySlug: citySlug(subject.city),
    subdivision: subject.subdivision,
    subdivisionNorm: normSubdivision(subject.subdivision),
    latitude: subject.latitude,
    longitude: subject.longitude,
    beds: subject.beds,
    baths: subject.baths,
    sqft: subject.sqft ?? 0,
    lotAcres: subject.lotAcres,
    yearBuilt: subject.yearBuilt,
    storyClass: extras.storyClass ?? classifyStory(extras.levelsRaw ?? subject.levelsRaw, null),
    productClass: classifyProduct(subject.propertySubType),
    waterClass: classifyWater(extras.waterRaw ?? subject.waterRaw),
    sewerClass: classifySewer(extras.sewerRaw ?? subject.sewerRaw),
    hoaClass: classifyHoa(subject.associationYn ?? null, subject.associationFee ?? subject.hoaMonthly ?? null),
    lotClass: classifyLot(subject.lotAcres),
    ruralAcreage: isRuralAcreage(subject, area),
    marketArea: area,
    newConstruction: subject.newConstructionYn ?? null,
  }
}
