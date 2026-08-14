/**
 * Stamp one active listing's public read. Cron-only. The listing page reads
 * the row and does not walk the ladder.
 */

import { rowToSubject } from '@/lib/cma/subject'
import { findCmaSubjectByMls } from '@/lib/data/cma/builderReads'
import { countSalePricingFacts } from '@/lib/data/pricing/facts'
import {
  LISTING_PRICING_CONTRACT_VERSION,
  listingPricingReadsDue,
  upsertListingPricingRead,
  type ListingPricingReadRow,
} from '@/lib/data/pricing/reads'
import { classifyProduct, isNewBuild } from '@/lib/pricing/classes'
import { sameSubdivisionTight } from '@/lib/cma/public-read-from-build'
import { publicListingRead, type PublicListingRead } from '@/lib/pricing/public-contract'
import { priceSubjectFromFacts } from '@/lib/pricing/select'

const SKIP_PRODUCT = new Set(['attached', 'manufactured', 'leased-land', 'coop'])

function rowFromRead(
  listingKey: string,
  read: PublicListingRead,
  extra: {
    factsReady: boolean
    newConstruction: boolean
    subdivision: string | null
    sameSubdivisionTight: boolean
    listPrice: number | null
  },
): ListingPricingReadRow {
  const now = new Date().toISOString()
  if (read.kind === 'refuse') {
    return {
      listingKey,
      kind: 'refuse',
      refuseReason: read.reason,
      listPrice: extra.listPrice,
      compsClose: null,
      deltaPct: null,
      rangeLow: null,
      rangeHigh: null,
      n: 0,
      factsReady: extra.factsReady,
      newConstruction: extra.newConstruction,
      subdivision: extra.subdivision,
      sameSubdivisionTight: extra.sameSubdivisionTight,
      computedAt: now,
      contractVersion: LISTING_PRICING_CONTRACT_VERSION,
    }
  }
  if (read.kind === 'listed-over-under') {
    return {
      listingKey,
      kind: 'listed-over-under',
      refuseReason: null,
      listPrice: read.listPrice,
      compsClose: read.compsClose,
      deltaPct: read.deltaPct,
      rangeLow: read.rangeLow,
      rangeHigh: read.rangeHigh,
      n: read.n,
      factsReady: extra.factsReady,
      newConstruction: extra.newConstruction,
      subdivision: extra.subdivision,
      sameSubdivisionTight: extra.sameSubdivisionTight,
      computedAt: now,
      contractVersion: LISTING_PRICING_CONTRACT_VERSION,
    }
  }
  return {
    listingKey,
    kind: 'unlisted-range',
    refuseReason: null,
    listPrice: extra.listPrice,
    compsClose: read.compsClose,
    deltaPct: null,
    rangeLow: read.rangeLow,
    rangeHigh: read.rangeHigh,
    n: read.n,
    factsReady: extra.factsReady,
    newConstruction: extra.newConstruction,
    subdivision: extra.subdivision,
    sameSubdivisionTight: extra.sameSubdivisionTight,
    computedAt: now,
    contractVersion: LISTING_PRICING_CONTRACT_VERSION,
  }
}

export async function stampOneListingPricingRead(
  listingKey: string,
  factsReadyKnown?: boolean,
): Promise<'stamped' | 'skipped'> {
  const rows = await findCmaSubjectByMls(listingKey)
  const raw = rows[0]
  if (!raw) return 'skipped'
  const subject = rowToSubject(raw)
  if (!subject.listingKey) return 'skipped'
  const product = classifyProduct(subject.propertySubType)
  if (SKIP_PRODUCT.has(product)) return 'skipped'

  const asOfYear = new Date().getFullYear()
  const newConstruction = isNewBuild(subject.yearBuilt, asOfYear, subject.newConstructionYn) === true
  const factsReady = factsReadyKnown ?? (await countSalePricingFacts()) >= 1000

  if (!factsReady) {
    const read = publicListingRead({
      factsReady: false,
      n: 0,
      compsClose: null,
      listPrice: subject.lastListPrice,
      sqft: subject.sqft,
      newConstruction,
      subdivision: subject.subdivision,
      sameSubdivisionTight: false,
    })
    const { error } = await upsertListingPricingRead(
      rowFromRead(subject.listingKey, read, {
        factsReady: false,
        newConstruction,
        subdivision: subject.subdivision,
        sameSubdivisionTight: false,
        listPrice: subject.lastListPrice,
      }),
    )
    return error ? 'skipped' : 'stamped'
  }

  const priced = await priceSubjectFromFacts(subject)
  const tight = sameSubdivisionTight(priced.match.tiersUsed)
  const read = publicListingRead({
    factsReady: priced.match.factsReady,
    n: priced.match.comps.length,
    compsClose: priced.compsImpliedClose,
    listPrice: subject.lastListPrice,
    sqft: subject.sqft,
    newConstruction,
    subdivision: subject.subdivision,
    sameSubdivisionTight: tight,
  })
  const { error } = await upsertListingPricingRead(
    rowFromRead(subject.listingKey, read, {
      factsReady: priced.match.factsReady,
      newConstruction,
      subdivision: subject.subdivision,
      sameSubdivisionTight: tight,
      listPrice: subject.lastListPrice,
    }),
  )
  return error ? 'skipped' : 'stamped'
}

export async function stampListingPricingReadsBatch(limit = 24): Promise<{
  stamped: number
  skipped: number
  due: number
}> {
  const keys = await listingPricingReadsDue(limit)
  const factsReady = (await countSalePricingFacts()) >= 1000
  let stamped = 0
  let skipped = 0
  for (const key of keys) {
    try {
      const out = await stampOneListingPricingRead(key, factsReady)
      if (out === 'stamped') stamped += 1
      else skipped += 1
    } catch (err) {
      console.error('[stampListingPricingReadsBatch]', key, err)
      skipped += 1
    }
  }
  return { stamped, skipped, due: keys.length }
}
