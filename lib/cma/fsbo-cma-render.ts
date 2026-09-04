/**
 * Wire fsbo-cma templates into print/web CMA surfaces.
 * Pure HTML fragments — miss omits, never invents.
 */

import {
  CMA_COVER_INTRO_V1,
  buildCmaProductBar,
  cmaProductBarHtml,
  composeCmaBottomWhyList,
  composeCmaCoverIntro,
  formatFsboCmaUsd,
  type CmaProductBar,
  type FsboCmaMergeFacts,
  emptyFsboCmaMergeFacts,
} from '@/lib/cma/fsbo-cma-templates'
import { primaryCmaPlaceLink, resolveCmaPlaceLinks, type CmaPlaceLink } from '@/lib/cma/cma-place-links'
import { escapeHtml, usd } from '@/lib/cma/render-blocks'
import type { CmaPricing, CmaSubject } from '@/lib/cma/types'

const esc = escapeHtml

export function factsFromCmaSurface(input: {
  subject: CmaSubject
  pricing: CmaPricing
  clientName?: string | null
  generatedAtIso?: string | null
  broker?: {
    displayName?: string | null
    phone?: string | null
    email?: string | null
  } | null
  calendarLink?: string | null
  leadType?: 'fsbo' | 'expired' | null
}): FsboCmaMergeFacts {
  const street = input.subject.streetAddress?.trim() || null
  const city = input.subject.city?.trim() || null
  const postal = input.subject.postalCode?.trim() || null
  const address = [street, city && postal ? `${city}, OR ${postal}` : city, !postal && city ? 'OR' : null]
    .filter(Boolean)
    .join(', ')
  const reportDate = input.generatedAtIso
    ? new Date(input.generatedAtIso).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'America/Los_Angeles',
      })
    : null

  return {
    ...emptyFsboCmaMergeFacts(),
    ownerFirstName: input.clientName?.trim().split(/\s+/)[0] || null,
    ownerFullName: input.clientName?.trim() || null,
    propertyAddress: address || street,
    propertyStreet: street,
    propertyCity: city,
    priceRangeLow: formatFsboCmaUsd(input.pricing.conservative),
    priceRangeHigh: formatFsboCmaUsd(input.pricing.highEnd),
    suggestedListPrice: formatFsboCmaUsd(input.pricing.recommended),
    currentAskPrice: formatFsboCmaUsd(input.pricing.currentAsk),
    reportDate,
    calendarLink: input.calendarLink?.trim() || null,
    agentName: input.broker?.displayName?.trim() || null,
    agentPhone: input.broker?.phone?.trim() || null,
    agentEmail: input.broker?.email?.trim() || null,
    brokerageDisclosureLine: 'Licensed in Oregon · Ryan Realty',
    leadType: input.leadType ?? null,
  }
}

/** Cover masthead label — pricing report, not bare CMA. */
export function cmaCoverLabelHtml(): string {
  return `<div class="cover-label" data-template="${CMA_COVER_INTRO_V1}">Pricing report</div>`
}

export function cmaCoverIntroBlurbHtml(facts: FsboCmaMergeFacts): string {
  const intro = composeCmaCoverIntro(facts)
  return `
  <div class="cover-intro" data-template="${CMA_COVER_INTRO_V1}">
    <p class="cover-intro-body">${esc(intro.body)}</p>
  </div>`.trim()
}

export function cmaWhyListPageBody(facts: FsboCmaMergeFacts): string {
  return composeCmaBottomWhyList(facts).bodyHtml
}

/** Hyperlink a place label when we have a resolved public href. */
export function placeLabelHtml(label: string | null | undefined, href: string | null | undefined): string {
  const t = (label ?? '').trim()
  if (!t || /^(n\/?a|none|null|undefined|—|-|other|not available)$/i.test(t)) return ''
  const h = (href ?? '').trim()
  if (!h) return esc(t)
  return `<a class="cma-place-link" href="${esc(h)}">${esc(t)}</a>`
}

export function resolveSubjectPlaceLinks(input: {
  subject: Pick<CmaSubject, 'city' | 'subdivision'>
  neighborhoodSlug?: string | null
  neighborhoodName?: string | null
  communitySlug?: string | null
  communityName?: string | null
  inMappedNeighborhood?: boolean | null
}): CmaPlaceLink[] {
  return resolveCmaPlaceLinks({
    city: input.subject.city,
    subdivisionName: input.subject.subdivision,
    neighborhoodSlug: input.neighborhoodSlug,
    neighborhoodName: input.neighborhoodName,
    communitySlug: input.communitySlug,
    communityName: input.communityName,
    inMappedNeighborhood: input.inMappedNeighborhood,
  })
}

export function cmaProductBarFromExtras(input: {
  marketGeoLabel?: string | null
  marketPresent: boolean
  placeLinks?: CmaPlaceLink[] | null
  nearbyActiveCount?: number | null
  nearbyActiveLabels?: readonly string[] | null
  recentSoldCount?: number | null
  bandLo?: number | null
  bandHi?: number | null
  bandActiveCount?: number | null
  closedSalePrices?: readonly number[] | null
}): { bar: CmaProductBar; html: string } {
  const bar = buildCmaProductBar({
    marketDataPresent: input.marketPresent,
    marketGeoLabel: input.marketGeoLabel,
    placeLinks: input.placeLinks ?? [],
    nearbyActiveCount: input.nearbyActiveCount,
    nearbyActiveLabels: input.nearbyActiveLabels,
    recentSoldCount: input.recentSoldCount,
    priceBandLo: input.bandLo != null ? usd(input.bandLo) : null,
    priceBandHi: input.bandHi != null ? usd(input.bandHi) : null,
    priceBandActiveCount: input.bandActiveCount,
    closedSalePrices: input.closedSalePrices,
  })
  return { bar, html: cmaProductBarHtml(bar) }
}

export { primaryCmaPlaceLink, resolveCmaPlaceLinks }
