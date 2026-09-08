'use server'

/**
 * The /sell address step, server side (site queue SITE-02, Matt 2026-09-07).
 *
 * WHAT CHANGED. The address step used to advance straight to "where should we
 * send it?" — the visitor typed their house and the page showed them nothing,
 * then asked for their email. This action is what the address step now buys
 * them: their own place's verdict, how fast homes there go under contract, and
 * how many comparable closes the CMA engine already found for their address.
 * Ungated, no contact asked, no dollar figure (Matt's ruling for a typed
 * address on a public page — the figure is in the written CMA).
 *
 * NOTHING NEW IS FETCHED. Every read here already exists and already ships:
 *   · getPlaceValueAnswer  — the SITE-01 place answer (Market Truth verdict,
 *     pace, cash share), which composes the reads the place pages make.
 *   · selectCompsPreferringFacts — the same comp ladder buildCma runs, stopped
 *     before the LLM judge and the audit, so an ungated public field costs
 *     database reads and nothing else. It returns the comps themselves, which
 *     the answer shows WITHOUT prices so the count is checkable.
 *   · resolveCmaSubject + resolvePlaceContextFromListing — the existing address
 *     and place resolvers. THERE IS NO NEW GEOCODER HERE and there must not be:
 *     the address arrives already validated by Google Places on the field, and
 *     the place ladder is resolved from the MLS row the address matched.
 *
 * WHICH GRAIN ANSWERS. The finest grain that actually publishes figures. A Bend
 * address inside a neighborhood or a curated community gets that place's
 * verdict; everything else gets the city's. The fallback is driven by
 * `hasFigures`, not by a guess about which slugs exist — a neighborhood whose
 * sample is below the publishing floor falls back to the city rather than
 * printing a verdict Market Truth declined to publish (§0).
 *
 * G68: months of supply is classified by marketVerdict and printed by
 * formatMonthsOfSupply, both here, from the one raw value the DAL returned.
 * Nothing downstream of this file does arithmetic on that figure.
 */

import { headers } from 'next/headers'
import { getStrictLimiter } from '@/lib/rate-limit'
import { getPlaceValueAnswer, type PlaceValueAnswer } from '@/lib/data/places/getPlaceValueAnswer'
import { resolveCmaSubject } from '@/lib/cma/subject'
import { selectCompsPreferringFacts } from '@/lib/pricing/select'
import { formatMonthYear } from '@/lib/format/date'
import { resolvePlaceContextFromListing } from '@/lib/data/geo/resolvePlaceContext'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { formatDate } from '@/lib/format/date'
import { slugify } from '@/lib/slug'
import { splitSellAddress, type SellAnswerData, type SellComp } from './sell-answer'

export type SellAnswerInput = {
  address: string
  /** Honeypot. A non-empty value means a bot filled the form. */
  company?: string
}

export type SellAnswerResult = { ok: true; answer: SellAnswerData } | { ok: false; error: string }

/**
 * Per-IP throttle on the strict tier (10/min), the same tier the place-page
 * answer uses and for the same reason: this step runs the comp ladder, and a
 * visitor legitimately retypes an address a few times. Fails closed in
 * production when the limiter is unavailable.
 */
async function overLimit(): Promise<string | null> {
  const isProd = process.env.NODE_ENV === 'production'
  try {
    const limiter = getStrictLimiter()
    if (!limiter) return isProd ? 'Too many requests. Please try again later.' : null
    const h = await headers()
    const ip =
      h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      h.get('x-real-ip') ||
      h.get('cf-connecting-ip') ||
      '127.0.0.1'
    const { success } = await limiter.limit(`sell-answer:${ip}`)
    return success ? null : 'Too many requests. Please try again in a minute.'
  } catch {
    return isProd ? 'Too many requests. Please try again later.' : null
  }
}

function cleanAddress(raw: string): string | null {
  const address = raw.replace(/\s+/g, ' ').trim()
  if (address.length < 5 || address.length > 200) return null
  if (!/\d/.test(address)) return null
  return address
}

/** The candidate market grains for an address, finest first. */
type GrainCandidate = { geoType: 'neighborhood' | 'city'; geoSlug: string; label: string; href: string | null }

/**
 * Resolve the place ladder for an address from the MLS row it matched.
 *
 * Market Truth keys resort communities AND city neighborhoods at the
 * `neighborhood` grain with the bare slug (`northwest-crossing`,
 * `brasada-ranch`) — the same key the community and neighborhood pages use — so
 * both curated communities and GIS neighborhoods become neighborhood
 * candidates here.
 */
function grainCandidates(input: {
  city: string | null
  subdivisionName: string | null
}): GrainCandidate[] {
  const ctx = resolvePlaceContextFromListing({
    city: input.city,
    subdivisionName: input.subdivisionName,
  })
  const out: GrainCandidate[] = []
  if (ctx.curatedCommunity) {
    out.push({
      geoType: 'neighborhood',
      geoSlug: ctx.curatedCommunity.slug,
      label: ctx.curatedCommunity.label,
      href: ctx.curatedCommunity.href,
    })
  }
  if (ctx.neighborhood && !out.some((c) => c.geoSlug === ctx.neighborhood?.slug)) {
    out.push({
      geoType: 'neighborhood',
      geoSlug: ctx.neighborhood.slug,
      label: ctx.neighborhood.label,
      href: ctx.neighborhood.href,
    })
  }
  if (ctx.city) {
    out.push({
      geoType: 'city',
      geoSlug: ctx.city.slug,
      label: ctx.city.label,
      href: `/housing-market/${ctx.city.slug}`,
    })
  } else if (input.city) {
    const slug = slugify(input.city)
    if (slug) {
      out.push({
        geoType: 'city',
        geoSlug: slug,
        label: input.city.trim(),
        href: `/housing-market/${slug}`,
      })
    }
  }
  return out
}

/**
 * Homes that go under contract in a typical month — the denominator months of
 * supply divides by, recovered from the two figures Market Truth published.
 *
 * MOS = active / (closed in six months / 6), so active / MOS IS that monthly
 * pace, exactly, not a second estimate of it. Recovering it is what lets the
 * page DRAW months of supply as two bars instead of printing "3.9" and making
 * the reader do the division (DATA_GRAPHICS.md). The trace says so.
 */
function salesPerMonthFrom(activeCount: number | null, mos: number | null): number | null {
  if (activeCount == null || mos == null || !Number.isFinite(mos) || mos <= 0) return null
  const pace = activeCount / mos
  return Number.isFinite(pace) ? pace : null
}

export async function answerSellValue(input: SellAnswerInput): Promise<SellAnswerResult> {
  // Honeypot: a bot gets the same shape as a bad address, and no database read.
  if (typeof input.company === 'string' && input.company.trim() !== '') {
    return { ok: false, error: 'We could not read that address.' }
  }
  const limited = await overLimit()
  if (limited) return { ok: false, error: limited }

  const address = cleanAddress(String(input.address ?? ''))
  if (!address) {
    return { ok: false, error: 'Start with the street number, like 2732 NW Ordway Ave.' }
  }
  const { street, city, postalCode } = splitSellAddress(address)

  // ONE subject resolve, then the ladder. This used to call
  // countCompsForAddress (which resolves the subject again internally) beside
  // its own resolveCmaSubject, so an ungated public field ran the resolver
  // twice per submit. It also only ever returned a COUNT, and a count with no
  // way to check it is half the transparency (evaluator, 2026-09-08).
  const resolved = await resolveCmaSubject({ rawAddress: address, city, postalCode }).catch(
    () => null,
  )
  const subject = resolved?.subject ?? null
  const selection = subject
    ? await selectCompsPreferringFacts(subject).catch(() => null)
    : null
  const candidates = grainCandidates({
    city: subject?.city ?? city,
    subdivisionName: subject?.subdivision ?? null,
  })

  // WHICH GRAIN ANSWERS, and why the verdict decides it.
  //
  // The finest grain is not automatically the best answer. 2732 NW Ordway Ave
  // resolves to NorthWest Crossing, which publishes pace and cash share but
  // NOT months of supply: market_metric holds the cell (1.25 over 24 closes)
  // with is_publishable=false, withheld_reason=below_min_n. Market Truth is
  // declining to publish a verdict there, and §0 says we honour that rather
  // than print one anyway.
  //
  // An earlier pass took the first grain with ANY figure, which handed the
  // visitor a headline-less answer for a neighborhood whose city had a perfectly
  // good verdict. So: the finest grain that publishes a VERDICT wins; failing
  // that, the finest with any figures; failing that, the first candidate, which
  // still names the place and carries the comp count. One grain answers, and
  // every figure on screen belongs to that one place — never a neighborhood's
  // pace under a city's verdict.
  const pulls: { candidate: GrainCandidate; answer: PlaceValueAnswer | null }[] = []
  for (const candidate of candidates) {
    pulls.push({
      candidate,
      answer: await getPlaceValueAnswer({
        geoType: candidate.geoType,
        geoSlug: candidate.geoSlug,
      }).catch(() => null),
    })
  }
  const chosen =
    pulls.find((p) => p.answer?.verdict != null) ??
    pulls.find((p) => p.answer?.hasFigures) ??
    pulls[0] ??
    null
  const picked = chosen?.candidate ?? null
  const answer = chosen?.answer ?? null

  if (!picked) {
    return {
      ok: false,
      error: 'We could not place that address in a market we publish. Try it with the city and state.',
    }
  }

  const mos = answer?.monthsOfSupply ?? null
  const activeCount = answer?.activeCount ?? null
  const salesPerMonth = salesPerMonthFrom(activeCount, mos)
  const compRows = selection?.comps ?? []
  const compCount = subject ? compRows.length : null

  // The comps themselves, WITHOUT prices (Matt's ruling), so the count above is
  // checkable rather than asserted. Four is enough to show the ladder's reach
  // without turning the answer into a table.
  const comps: SellComp[] = compRows.slice(0, 4).map((c) => ({
    id: c.listingKey,
    street: c.address.split(',')[0]?.trim() || c.address,
    where: c.subdivision?.trim() || c.city,
    facts: [
      c.beds != null ? `${c.beds} bed` : null,
      c.baths != null ? `${c.baths} bath` : null,
      c.sqft ? `${Math.round(c.sqft).toLocaleString('en-US')} sq ft` : null,
      c.yearBuilt != null ? `built ${c.yearBuilt}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    when: `Closed ${formatMonthYear(c.closeDate)}`,
    proximity: c.proximity?.trim() || null,
  }))

  const subjectSummary = subject
    ? [
        subject.beds != null ? `${subject.beds} bed` : null,
        subject.baths != null ? `${subject.baths} bath` : null,
        subject.sqft != null ? `${Math.round(subject.sqft).toLocaleString('en-US')} sq ft` : null,
        subject.yearBuilt != null ? `built ${subject.yearBuilt}` : null,
      ]
        .filter(Boolean)
        .join(', ') || null
    : null

  const trace: string[] = [...(answer?.trace ?? [])]
  if (salesPerMonth != null && activeCount != null && mos != null) {
    trace.push(
      `homes under contract in a typical month ${Math.round(salesPerMonth)} — derived as homes for sale ÷ months of supply, which recovers the six-month close pace the months-of-supply formula divides by; market_metric ${picked.geoType}:${picked.geoSlug}`,
    )
  }
  if (subject) {
    trace.push(
      `comparable closes ${compCount ?? 'unmatched'} — Ryan Realty CMA comp ladder (the same ladder the written valuation runs), tiers ${selection?.tiersUsed?.join(' → ') || 'none'}; subject resolved from ${resolved?.trace ?? 'MLS history and county assessor facts'}`,
    )
  } else {
    trace.push(`comparable closes unmatched — ${resolved?.trace ?? 'the address did not resolve to a property record'}`)
  }

  const data: SellAnswerData = {
    address,
    street,
    placeLabel: picked.label,
    grain: picked.geoType,
    placeHref: picked.href,
    verdictLabel: answer?.verdict?.label ?? null,
    monthsOfSupply: mos != null ? formatMonthsOfSupply(mos) : null,
    activeCount,
    salesPerMonth,
    daysToPending: answer?.daysToPending ?? null,
    cashSharePct: answer?.cashShare != null ? answer.cashShare * 100 : null,
    compCount,
    subjectFound: Boolean(subject),
    subjectSummary,
    comps,
    asOfLabel: answer?.asOf ? formatDate(answer.asOf) : null,
    trace,
  }

  return { ok: true, answer: data }
}
