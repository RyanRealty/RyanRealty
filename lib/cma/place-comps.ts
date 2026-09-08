/**
 * Comparable-close count for an address a visitor typed on a place page (SITE-01).
 *
 * This is the light path: resolve the subject the way the CMA engine does (MLS history
 * first, county assessor facts second), then run the same comp ladder buildCma runs,
 * and return the count. It stops there. Nothing here calls lib/grok: the judge and the
 * audit run only inside buildCma, after a person has asked for the written document,
 * so an ungated public field costs database reads and nothing else.
 */
import { resolveCmaSubject } from '@/lib/cma/subject'
import { selectCompsPreferringFacts } from '@/lib/pricing/select'

/**
 * One comparable close as a public surface may DRAW it (site queue SITE-02b).
 *
 * NO ADDRESS AND NO PRICE. The count alone could not be drawn — a dot strip
 * needs each comp's own position — so the ladder's rows now reach the page, but
 * only the facts a drawing needs: when it closed, how big it was, how alike it
 * is, and how far away. Matt's standing ruling is that a typed address on a
 * public page gets no dollar figure, and the street line is the one field that
 * would let a reader look the price up, so neither field is on this type at all
 * rather than being dropped by whoever renders it.
 */
export type PlaceCompMark = {
  /** Stable key for React. The MLS listing key, never rendered. */
  id: string
  /** ISO close date — the strip's x axis. */
  closeDate: string
  /** Finished square feet. */
  sqft: number
  beds: number | null
  baths: number | null
  /** "0.4 miles NW" when the ladder reported it. */
  proximity: string | null
}

export type PlaceCompCount = {
  /** False when neither the MLS history nor the assessor could place the address. */
  subjectFound: boolean
  /** Comparable closes the ladder kept, or null when the subject did not resolve. */
  count: number | null
  /** Every kept comp as a drawable mark, address-free and price-free. */
  marks: PlaceCompMark[]
  /** The ladder tiers the comps came from, in order. */
  tiersUsed: string[]
  /** "4 bed, 3 bath, 2,410 sq ft, built 2006" when the subject has those facts. */
  subjectSummary: string | null
  /** The resolver's own trace plus the comp count, for the §0 line. */
  trace: string
}

export async function countCompsForAddress(input: {
  rawAddress: string
  city: string
  postalCode?: string | null
}): Promise<PlaceCompCount> {
  const resolved = await resolveCmaSubject({
    rawAddress: input.rawAddress,
    city: input.city,
    postalCode: input.postalCode ?? null,
  })
  if (!resolved.subject) {
    return {
      subjectFound: false,
      count: null,
      marks: [],
      tiersUsed: [],
      subjectSummary: null,
      trace: resolved.trace,
    }
  }
  const subject = resolved.subject
  const selection = await selectCompsPreferringFacts(subject)
  const parts = [
    subject.beds != null ? `${subject.beds} bed` : null,
    subject.baths != null ? `${subject.baths} bath` : null,
    subject.sqft != null ? `${Math.round(subject.sqft).toLocaleString('en-US')} sq ft` : null,
    subject.yearBuilt != null ? `built ${subject.yearBuilt}` : null,
  ].filter((p): p is string => Boolean(p))
  const tiersUsed = Array.isArray(selection.tiersUsed) ? selection.tiersUsed.map(String) : []
  return {
    subjectFound: true,
    count: selection.comps.length,
    marks: selection.comps.map((c) => ({
      id: c.listingKey,
      closeDate: c.closeDate,
      sqft: c.sqft,
      beds: c.beds,
      baths: c.baths,
      proximity: c.proximity?.trim() || null,
    })),
    tiersUsed,
    subjectSummary: parts.length ? parts.join(', ') : null,
    trace: `${resolved.trace}; comps ${selection.comps.length} via ${tiersUsed.join(' > ') || 'sale_pricing_facts'}`,
  }
}
