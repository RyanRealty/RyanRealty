// @no-parity — content-engine route, not a Wave-3 mockup.
/**
 * /central-oregon/trails/[slug] — trail detail on the v3 barrel.
 *
 * Places open on Instrument then Field. Order: Breadcrumb, Instrument (nearby
 * homes), Field (trail line + trailhead pin + list), Sheet (city SFR alerts),
 * Quiet (facts, FAQ, related, edges), Footer outside main.
 *
 * THE PAGE CONTRACT: generateStaticParams from CO_TRAILS, dynamicParams false,
 * revalidate 300, generateMetadata from the registry, Place + FAQPage +
 * breadcrumb via MetadataBlock, V3SectionTracker pageType="trails".
 * getTrailDetail and getTrailLineGeoJSON degrade on a timeout
 * (check-prerender-db-safety). Trail linework comes from public.trail_lines.
 *
 * KB-era deletions: photo hero / TRAIL_HERO_CREDITS, VenueMap, KbFeatured,
 * AreaMarketBand, KbBreadcrumb, KbFooter, SmoothScrollProvider, kb.css,
 * events.css, contact CTA band.
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTrailDetail, getTrailLineGeoJSON } from '@/lib/data'
import {
  CO_TRAILS,
  getTrailBySlug,
  TRAIL_USE_LABEL,
  TRAIL_DIFFICULTY_LABEL,
  type CoTrail,
} from '@/data/co-trails'
import { buildTrailFaq } from '@/lib/trails-format'
import { pageMetadata } from '@/lib/site/page-metadata'
import { publishNearbyListingsSource } from '@/lib/site/publish-nearby-listings-source'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import type { SchemaInput } from '@/lib/site/json-ld'
import { valuationHref } from '@/lib/site/valuation-href'
import { CONTACT } from '@/lib/brand/contact'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Instrument,
  V3Field,
  V3Quiet,
  V3SectionTracker,
  type V3InstrumentFigure,
  type V3QuietItem,
} from '@/components/site/v3'
import { RegionalAlertSheet } from '@/app/central-oregon/_v3/RegionalAlertSheet.client'
import { PlaceFieldMap } from '@/app/central-oregon/_v3/PlaceFieldMap.client'
import {
  nearbyFieldItems,
  fieldMapPins,
  medianListLabel,
  faqQuietItems,
} from '@/app/central-oregon/_v3/nearby-field-items'

export const dynamicParams = false
export const revalidate = 300

type Props = { params: Promise<{ slug: string }> }

export function generateStaticParams(): Array<{ slug: string }> {
  return CO_TRAILS.map((t) => ({ slug: t.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const trail = getTrailBySlug(slug)
  if (!trail) notFound()
  const useWord =
    trail.use === 'mtb' ? 'mountain-bike trail' : trail.use === 'both' ? 'hiking and biking trail' : 'hiking trail'
  const desc = `${trail.name}, a ${useWord} near ${trail.city}, Central Oregon. What it is, where the trailhead is, and the homes for sale nearby, from Ryan Realty.`
  return pageMetadata({
    title: `${trail.name} | Central Oregon Trails`,
    description: desc,
    path: `/central-oregon/trails/${slug}`,
  })
}

function distanceLabel(trail: CoTrail): string | null {
  if (typeof trail.lengthMiles !== 'number') return null
  const unit = trail.lengthMiles === 1 ? 'mile' : 'miles'
  return `${trail.lengthMiles} ${unit}${trail.distanceNote ? ` ${trail.distanceNote}` : ''}`
}

export default async function TrailDetailPage({ params }: Props) {
  const { slug } = await params

  const detail = await getTrailDetail(slug).catch(() => null)
  const trail = detail?.trail ?? getTrailBySlug(slug)
  if (!trail) notFound()

  const trailLine = await getTrailLineGeoJSON(slug).catch(() => null)

  const homes = detail?.homes ?? []
  const stats = detail?.stats ?? { count: 0, medianListPrice: null }
  const relatedTrails =
    detail?.relatedTrails ?? CO_TRAILS.filter((t) => t.slug !== trail.slug && t.city === trail.city)
  const cityMarket = detail?.cityMarket ?? null

  const fieldItems = nearbyFieldItems(homes)
  const pins = fieldMapPins(fieldItems)
  const seeAllHref = `/search?city=${encodeURIComponent(trail.city)}`
  const hasGeo = typeof trail.lat === 'number' && typeof trail.lng === 'number'
  const dist = distanceLabel(trail)
  const trailName = trail.name.trim()
  const medianLabel = medianListLabel(stats.medianListPrice)
  const faq = buildTrailFaq(trail, { count: stats.count, medianLabel, cityMarket })

  const figures: V3InstrumentFigure[] = [
    {
      value: v3Text(stats.count.toLocaleString('en-US')),
      label: v3Text('homes for sale nearby'),
      href: seeAllHref,
    },
  ]
  if (medianLabel) {
    figures.push({
      value: v3Text(medianLabel),
      label: v3Text('median list price of those homes'),
      href: seeAllHref,
    })
  }
  const [firstFigure, ...restFigures] = figures

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Trails', url: '/central-oregon/trails' },
        { name: trail.name, url: `/central-oregon/trails/${slug}` },
      ],
    },
    {
      type: 'place',
      placeType: 'TouristAttraction',
      name: trail.name,
      description: trail.blurb,
      url: `/central-oregon/trails/${slug}`,
      address: { city: trail.city, state: 'OR', country: 'US' },
      geo: hasGeo ? { lat: trail.lat as number, lng: trail.lng as number } : undefined,
    },
    { type: 'faqPage', items: faq },
  ]

  const quietItems: V3QuietItem[] = []
  if (trail.blurb.trim()) {
    quietItems.push({ kind: 'prose', term: trailName, body: trail.blurb.trim() })
  }
  quietItems.push({ kind: 'prose', term: 'Use', body: TRAIL_USE_LABEL[trail.use] })
  if (dist) {
    quietItems.push({ kind: 'prose', term: 'Distance', body: dist })
  }
  if (trail.difficulty) {
    quietItems.push({ kind: 'prose', term: 'Difficulty', body: TRAIL_DIFFICULTY_LABEL[trail.difficulty] })
  }
  if (trail.fee?.trim()) {
    quietItems.push({ kind: 'prose', term: 'Parking', body: trail.fee.trim() })
  }
  quietItems.push({
    kind: 'prose',
    term: 'Land manager',
    body: `${trail.landManager}, near ${trail.city}, Oregon.`,
  })
  quietItems.push(...faqQuietItems(faq))
  if (trail.officialUrl.trim()) {
    quietItems.push({ label: 'Official trail and conditions', href: trail.officialUrl.trim() })
  }
  if (trail.communitySlug?.trim()) {
    quietItems.push({ label: 'Community near this trail', href: `/communities/${trail.communitySlug.trim()}` })
  }
  quietItems.push({ label: `${trail.city} market`, href: `/cities/${trail.geoSlug}` })
  for (const t of relatedTrails) {
    const n = t.name.trim()
    const s = t.slug.trim()
    if (!n || !s) continue
    quietItems.push({ label: n, href: `/central-oregon/trails/${s}` })
  }
  quietItems.push({ label: 'All Central Oregon trails', href: '/central-oregon/trails' })
  quietItems.push({ label: `Homes in ${trail.city}`, href: seeAllHref })
  quietItems.push({ label: 'Value my home', href: valuationHref(`/central-oregon/trails/${slug}`) })
  quietItems.push({ label: 'Meet the team', href: '/contact' })
  quietItems.push({ label: `Call ${CONTACT.phoneDirect}`, href: `tel:${CONTACT.phoneDirectTel}` })

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <MetadataBlock schemas={schemas} />
        <V3Breadcrumb
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Trails', href: '/central-oregon/trails' },
            { label: trailName },
          ]}
        />

        {firstFigure ? (
          <V3Instrument
            id="trail"
            level={1}
            eyebrow={v3Text(`${TRAIL_USE_LABEL[trail.use]} · ${trail.city}`)}
            headline={v3Text(trailName)}
            figures={[firstFigure, ...restFigures]}
            source={v3Text(
              publishNearbyListingsSource({
                grain: 'trail',
                scope: 'within about 1.5 miles of the trailhead',
                listingCount: stats.count,
              }),
            )}
            action={{
              label: v3Text('Value my home'),
              href: valuationHref(`/central-oregon/trails/${slug}`),
            }}
          />
        ) : null}

        <V3Field
          id="homes"
          ariaLabel={`Homes for sale near ${trailName}`}
          items={fieldItems}
          count={{
            value: stats.count.toLocaleString('en-US'),
            label: `homes for sale near ${trailName}`,
            source:
              'active single-family listings within about 1.5 miles of the trailhead, from the MLS. The rows below are a slice of that set.',
          }}
          mapSlot={
            hasGeo || trailLine ? (
              <PlaceFieldMap
                pins={pins}
                boundary={trailLine ?? undefined}
                placeName={trailName}
                centerLonLat={hasGeo ? [trail.lng as number, trail.lat as number] : undefined}
                placePin={
                  hasGeo
                    ? { lat: trail.lat as number, lng: trail.lng as number, title: `${trailName} trailhead` }
                    : undefined
                }
              />
            ) : undefined
          }
          mapNote={
            trailLine
              ? `The line is the ${trailName} route from ${trail.landManager} trail data. The marked point is the trailhead. Pins are active single-family homes near it.`
              : hasGeo
                ? 'The marked point is the trailhead. Pins are active single-family homes within about 1.5 miles.'
                : undefined
          }
          footNote={
            stats.count > fieldItems.length
              ? `Showing ${fieldItems.length} of ${stats.count.toLocaleString('en-US')} homes. The count above is the full nearby set.`
              : undefined
          }
          emptyMessage={`No active single-family listings within about 1.5 miles of the ${trailName} trailhead in the latest pull.`}
        />

        <RegionalAlertSheet placeLabel={trail.city} city={trail.city} />

        <V3Quiet id="about" eyebrow="This trail" heading={`${trailName} details`} items={quietItems} />
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo only
          when it is NOT nested in sectioning content, and <main> is sectioning
          content, so inside it the element is a generic and the page ships no
          contentinfo landmark. ci:default-chrome-footer counts footers without
          checking placement. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
