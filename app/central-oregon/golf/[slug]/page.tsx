// @no-parity — content-engine route, not a Wave-3 mockup.
/**
 * /central-oregon/golf/[slug] — per-course detail on the v3 barrel.
 *
 * Places open on Instrument then Field. Order: Breadcrumb, Instrument (nearby
 * homes), Field (clubhouse pin + list), Sheet (city SFR alerts), Quiet (facts,
 * FAQ, tee-time outbound, LP golf hub, related, edges), Footer outside main.
 *
 * THE PAGE CONTRACT: generateStaticParams from GOLF_COURSES, dynamicParams
 * false, revalidate 300, generateMetadata from the registry, Place + FAQPage +
 * breadcrumb via MetadataBlock, V3SectionTracker pageType="golf". getGolfDetail
 * degrades on a listings timeout (check-prerender-db-safety). One registry with
 * /lp/central-oregon-golf. The LP hub stays a Quiet edge, not a smashed SEO
 * substitute.
 *
 * KB-era deletions: photo hero / golfHeroFor, VenueMap, KbFeatured,
 * AreaMarketBand, KbBreadcrumb, KbFooter, SmoothScrollProvider, kb.css,
 * events.css, contact CTA band.
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getGolfDetail } from '@/lib/data'
import { GOLF_COURSES, type GolfCourse } from '@/data/golf/courses'
import { GOLF_ACCESS_LABEL, buildGolfFaq, cityToGeoSlug, displayCity } from '@/lib/golf-format'
import { getCourseMap } from '@/lib/golf/course-map-registry'
import { courseMapKind } from '@/lib/golf/course-map'
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
  V3CourseMap,
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

function courseBySlug(slug: string): GolfCourse | undefined {
  return GOLF_COURSES.find((c) => c.slug === slug)
}

export function generateStaticParams(): Array<{ slug: string }> {
  return GOLF_COURSES.map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const course = courseBySlug(slug)
  if (!course) notFound()
  const city = displayCity(course.city)
  const desc = `${course.name}, a ${GOLF_ACCESS_LABEL[course.access].toLowerCase()} ${course.holes}-hole golf course in ${city}, Central Oregon. Course facts and the active homes for sale nearby.`
  return pageMetadata({
    title: `${course.shortName} | Central Oregon Golf`,
    description: desc,
    path: `/central-oregon/golf/${slug}`,
  })
}

export default async function GolfDetailPage({ params }: Props) {
  const { slug } = await params

  const detail = await getGolfDetail(slug).catch(() => null)
  // A committed geometry file, not a query — the catch is the prerender
  // contract, not a real failure mode.
  const courseMap = await getCourseMap(slug).catch(() => null)
  const course = detail?.course ?? courseBySlug(slug)
  if (!course) notFound()

  const geoSlug = detail?.geoSlug ?? cityToGeoSlug(course.city)
  const city = displayCity(course.city)
  const homes = detail?.homes ?? []
  const stats = detail?.stats ?? { count: 0, medianListPrice: null }
  const relatedCourses =
    detail?.relatedCourses ??
    GOLF_COURSES.filter((c) => c.slug !== course.slug && cityToGeoSlug(c.city) === geoSlug)
  const cityMarket = detail?.cityMarket ?? null

  const fieldItems = nearbyFieldItems(homes)
  const pins = fieldMapPins(fieldItems)
  const seeAllHref = `/search?city=${encodeURIComponent(city)}`
  const hasGeo = typeof course.lat === 'number' && typeof course.lng === 'number'
  const courseName = course.name.trim()
  const shortName = course.shortName.trim()
  const medianLabel = medianListLabel(stats.medianListPrice)
  const faq = buildGolfFaq(course, { count: stats.count, medianLabel, cityMarket })

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
        { name: 'Golf', url: '/lp/central-oregon-golf' },
        { name: course.shortName, url: `/central-oregon/golf/${slug}` },
      ],
    },
    {
      type: 'place',
      placeType: 'TouristAttraction',
      name: course.name,
      description: course.signature,
      url: `/central-oregon/golf/${slug}`,
      address: { city, state: 'OR', country: 'US' },
      geo: hasGeo ? { lat: course.lat, lng: course.lng } : undefined,
    },
    { type: 'faqPage', items: faq },
  ]

  const quietItems: V3QuietItem[] = []
  if (course.signature.trim()) {
    quietItems.push({ kind: 'prose', term: courseName, body: course.signature.trim() })
  }
  quietItems.push({ kind: 'prose', term: 'Access', body: GOLF_ACCESS_LABEL[course.access] })
  quietItems.push({
    kind: 'prose',
    term: 'Holes',
    body:
      typeof course.yardsBackTees === 'number'
        ? `${course.holes} holes, par ${course.par}, ${course.yardsBackTees.toLocaleString('en-US')} yards from the back tees.`
        : `${course.holes} holes, par ${course.par}.`,
  })
  quietItems.push({
    kind: 'prose',
    term: 'Designer',
    body: course.yearOpened
      ? `${course.designer}. Opened ${course.yearOpened}.`
      : `${course.designer}.`,
  })
  quietItems.push({
    kind: 'prose',
    term: 'Where',
    body: `${shortName} in ${city}, Oregon.`,
  })
  quietItems.push(...faqQuietItems(faq))
  if (course.teeTimeUrl?.trim()) {
    quietItems.push({ label: 'Tee times and course info', href: course.teeTimeUrl.trim() })
  }
  quietItems.push({ label: 'Central Oregon golf guide', href: '/lp/central-oregon-golf' })
  if (course.communitySlug?.trim()) {
    quietItems.push({ label: 'Community around this course', href: `/communities/${course.communitySlug.trim()}` })
  }
  quietItems.push({ label: `${city} market`, href: `/cities/${geoSlug}` })
  for (const c of relatedCourses) {
    const n = c.shortName.trim()
    const s = c.slug.trim()
    if (!n || !s) continue
    quietItems.push({ label: n, href: `/central-oregon/golf/${s}` })
  }
  quietItems.push({ label: `Homes in ${city}`, href: seeAllHref })
  quietItems.push({ label: 'Value my home', href: valuationHref(`/central-oregon/golf/${slug}`) })
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
            { label: 'Golf', href: '/lp/central-oregon-golf' },
            { label: shortName },
          ]}
        />

        {firstFigure ? (
          <V3Instrument
            id="course"
            level={1}
            eyebrow={v3Text(`${GOLF_ACCESS_LABEL[course.access]} · ${city}`)}
            headline={v3Text(courseName)}
            figures={[firstFigure, ...restFigures]}
            source={v3Text(
              publishNearbyListingsSource({
                grain: 'course',
                scope: 'within about 1.5 miles of the clubhouse',
                listingCount: stats.count,
              }),
            )}
            action={{
              label: v3Text('Value my home'),
              href: valuationHref(`/central-oregon/golf/${slug}`),
            }}
          />
        ) : null}

        {courseMap ? (
          <V3CourseMap
            id="holes"
            data={courseMap}
            heading={v3Text(
              // 'hole by hole' promises numbered OSM holes. Unnumbered
              // routings are drawn from the air. A plate is the club's own
              // published card, not a survey.
              courseMapKind(courseMap) === 'plate'
                ? `${shortName}, as the club prints it`
                : courseMapKind(courseMap) === 'unnumbered'
                  ? `${shortName}, drawn from the air`
                  : `${shortName}, hole by hole`,
            )}
          />
        ) : null}

        <V3Field
          id="homes"
          ariaLabel={`Homes for sale near ${shortName}`}
          items={fieldItems}
          count={{
            value: stats.count.toLocaleString('en-US'),
            label: `homes for sale near ${shortName}`,
            source:
              'active single-family listings within about 1.5 miles of the clubhouse, from the MLS. The rows below are a slice of that set.',
          }}
          mapSlot={
            hasGeo ? (
              <PlaceFieldMap
                pins={pins}
                placeName={shortName}
                centerLonLat={[course.lng, course.lat]}
                placePin={{ lat: course.lat, lng: course.lng, title: shortName }}
              />
            ) : undefined
          }
          mapNote={
            hasGeo
              ? 'The marked point is the course. Pins are active single-family homes within about 1.5 miles.'
              : undefined
          }
          footNote={
            stats.count > fieldItems.length
              ? `Showing ${fieldItems.length} of ${stats.count.toLocaleString('en-US')} homes. The count above is the full nearby set.`
              : undefined
          }
          emptyMessage={`No active single-family listings within about 1.5 miles of ${shortName} in the latest pull.`}
        />

        <RegionalAlertSheet placeLabel={city} city={city} />

        <V3Quiet id="about" eyebrow="This course" heading={`${shortName} details`} items={quietItems} />
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
