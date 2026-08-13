/**
 * /schools/[slug] — school detail on the v3 barrel.
 *
 * Places open on Instrument then Field. Order: Breadcrumb, Instrument (feeding
 * homes), Field (attendance polygon + list), Sheet (city SFR alerts), Quiet
 * (academic facts, nearby schools, edges), Footer outside main.
 *
 * THE PAGE CONTRACT: generateStaticParams from CO_SCHOOLS, dynamicParams false,
 * revalidate 300, generateMetadata from the registry only, School subtype +
 * BreadcrumbList JSON-LD, KbSectionTracker pageType="schools". getSchoolDetail
 * degrades on a listings timeout so prerender cannot 500 the deploy
 * (check-prerender-db-safety). Academic stats print only when the registry
 * carries a cited value.
 *
 * KB-era deletions: KbHero, KbListingMap, KbBreadcrumb, KbFooter,
 * SmoothScrollProvider, kb.css, SchoolDetailStyles, contact CTA band (Meet the
 * team and the phone are Quiet edges). Academic stats stay in Quiet so the
 * Instrument trace covers only the MLS feeding-home pull.
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getSchoolDetail, getBoundaryGeoJSON } from '@/lib/data'
import { CO_SCHOOLS, getSchoolBySlug, slugifySchoolName, type SchoolLevel } from '@/data/co-schools'
import { pageMetadata } from '@/lib/site/page-metadata'
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
  type V3InstrumentFigure,
  type V3QuietItem,
} from '@/components/site/v3'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import { RegionalAlertSheet } from '@/app/central-oregon/_v3/RegionalAlertSheet.client'
import { PlaceFieldMap } from '@/app/central-oregon/_v3/PlaceFieldMap.client'
import {
  nearbyFieldItems,
  fieldMapPins,
  medianListLabel,
} from '@/app/central-oregon/_v3/nearby-field-items'

export const dynamicParams = false
export const revalidate = 300

const LEVEL_LABEL: Record<SchoolLevel, string> = {
  high: 'High school',
  middle: 'Middle school',
  elementary: 'Elementary school',
}

const SCHOOL_SCHEMA_TYPE: Record<SchoolLevel, 'ElementarySchool' | 'MiddleSchool' | 'HighSchool'> = {
  high: 'HighSchool',
  middle: 'MiddleSchool',
  elementary: 'ElementarySchool',
}

type Props = { params: Promise<{ slug: string }> }

export function generateStaticParams(): Array<{ slug: string }> {
  return CO_SCHOOLS.map((s) => ({ slug: s.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const school = getSchoolBySlug(slug)
  if (!school) notFound()

  const levelLabel = LEVEL_LABEL[school.level].toLowerCase()
  const desc = `${school.name} is a ${levelLabel} in ${school.city}, part of ${school.district}. See the homes for sale that feed this school.`

  return pageMetadata({
    title: `${school.name} | Central Oregon Schools`,
    description: desc,
    path: `/schools/${slug}`,
  })
}

export default async function SchoolDetailPage({ params }: Props) {
  const { slug } = await params

  // Registry content never needs the DB. A listings timeout must not fail the
  // static build: all 55 schools pre-render (dynamicParams = false). Degrade to
  // zero homes and let ISR retry. getSchoolDetail returns null for an unknown
  // slug and throws on a DB error; the registry lookup tells the two apart.
  const detail = await getSchoolDetail(slug).catch(() => null)
  const school = detail?.school ?? getSchoolBySlug(slug)
  if (!school) notFound()

  const homes = detail?.homes ?? []
  const stats = detail?.stats ?? { count: 0, medianListPrice: null }
  const nearby =
    detail?.nearby ??
    CO_SCHOOLS.filter(
      (s) => s.slug !== school.slug && s.districtSlug === school.districtSlug && s.level === school.level,
    )

  const citySlug = slugifySchoolName(school.city)
  const schoolBoundary = await getBoundaryGeoJSON({ geoType: 'school', geoSlug: school.slug }).catch(
    () => null,
  )
  const usingAttendanceArea = schoolBoundary != null
  const polygon =
    schoolBoundary ??
    (await getBoundaryGeoJSON({ geoType: 'city', geoSlug: citySlug }).catch(() => null))

  const fieldItems = nearbyFieldItems(homes)
  const pins = fieldMapPins(fieldItems)
  const seeAllHref = `/search?city=${encodeURIComponent(school.city)}&keywords=${encodeURIComponent(
    school.name,
  )}`
  const levelLabel = LEVEL_LABEL[school.level]
  const schoolName = school.name.trim()
  const medianLabel = medianListLabel(stats.medianListPrice)

  const figures: V3InstrumentFigure[] = [
    {
      value: v3Text(stats.count.toLocaleString('en-US')),
      label: v3Text('homes for sale that feed this school'),
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

  const additionalProperty: Array<{ name: string; value: string | number; unitText?: string }> = [
    { name: 'Homes for sale that feed this school', value: stats.count },
  ]
  if (stats.medianListPrice != null) {
    additionalProperty.push({
      name: 'Median list price of feeding homes',
      value: stats.medianListPrice,
      unitText: 'USD',
    })
  }

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Schools', url: '/schools' },
        { name: school.name, url: `/schools/${slug}` },
      ],
    },
    {
      type: 'place',
      placeType: SCHOOL_SCHEMA_TYPE[school.level],
      name: school.name,
      description: `${school.name}, a ${levelLabel.toLowerCase()} in ${school.city}, ${school.district}.`,
      url: `/schools/${slug}`,
      address: { city: school.city, state: 'OR', country: 'US' },
      containedInPlace: school.district,
      additionalProperty,
    },
  ]

  const quietItems: V3QuietItem[] = []
  if (school.blurb?.trim()) {
    quietItems.push({ kind: 'prose', term: schoolName, body: school.blurb.trim() })
  }
  if (school.grades?.trim()) {
    quietItems.push({ kind: 'prose', term: 'Grades', body: school.grades.trim() })
  }
  if (typeof school.enrollment === 'number') {
    quietItems.push({
      kind: 'prose',
      term: 'Enrollment',
      body: `${school.enrollment.toLocaleString('en-US')} students, from GreatSchools and NCES.`,
    })
  }
  if (typeof school.studentTeacherRatio === 'number') {
    quietItems.push({
      kind: 'prose',
      term: 'Student-teacher ratio',
      body: `${school.studentTeacherRatio}:1, from GreatSchools and NCES.`,
    })
  }
  if (typeof school.greatSchoolsRating === 'number') {
    quietItems.push({
      kind: 'prose',
      term: 'GreatSchools rating',
      body: `${school.greatSchoolsRating} out of 10.`,
    })
  }
  quietItems.push({
    kind: 'prose',
    term: 'School district',
    body: `${school.name} is one of the ${school.district} schools.`,
  })
  if (school.sourceUrl?.trim()) {
    quietItems.push({ label: 'View source', href: school.sourceUrl.trim() })
  }
  for (const s of nearby) {
    const n = s.name.trim()
    const nearbySlug = s.slug.trim()
    if (!n || !nearbySlug) continue
    quietItems.push({ label: n, href: `/schools/${nearbySlug}` })
  }
  quietItems.push({ label: 'All Central Oregon schools', href: '/schools' })
  quietItems.push({ label: `Homes in ${school.city}`, href: `/search?city=${encodeURIComponent(school.city)}` })
  quietItems.push({ label: 'Value my home', href: valuationHref(`/schools/${slug}`) })
  quietItems.push({ label: 'Meet the team', href: '/contact' })
  quietItems.push({ label: `Call ${CONTACT.phoneDirect}`, href: `tel:${CONTACT.phoneDirectTel}` })

  const [firstFigure, ...restFigures] = figures

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <KbSectionTracker pageType="schools" />
        <MetadataBlock schemas={schemas} />
        <V3Breadcrumb
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Schools', href: '/schools' },
            { label: schoolName },
          ]}
        />

        {firstFigure ? (
          <V3Instrument
            id="school"
            level={1}
            eyebrow={v3Text(`${levelLabel} · ${school.city}`)}
            headline={v3Text(schoolName)}
            figures={[firstFigure, ...restFigures]}
            source={v3Text(
              'active single-family listings (PropertyType A) whose MLS school field matches this school, from the MLS. A listings timeout renders this school with a zero count and lets ISR retry.',
            )}
            action={{
              label: v3Text('Value my home'),
              href: valuationHref(`/schools/${slug}`),
            }}
          />
        ) : null}

        <V3Field
          id="homes"
          ariaLabel={`Homes for sale that feed ${schoolName}`}
          items={fieldItems}
          count={{
            value: stats.count.toLocaleString('en-US'),
            label: `homes for sale that feed ${schoolName}`,
            source:
              'active single-family listings whose MLS school field matches this school, from the MLS. The rows below are a slice of that set.',
          }}
          mapSlot={
            <PlaceFieldMap
              pins={pins}
              boundary={polygon ?? undefined}
              placeName={schoolName}
            />
          }
          mapNote={
            usingAttendanceArea
              ? 'School attendance area plus active single-family homes that feed this school.'
              : `${school.city} city frame plus active single-family homes that feed this school.`
          }
          footNote={
            stats.count > fieldItems.length
              ? `Showing ${fieldItems.length} of ${stats.count.toLocaleString('en-US')} homes. The count above is the full feeding set.`
              : undefined
          }
          emptyMessage={`No active single-family listings tied to ${schoolName} in the latest pull.`}
        />

        <RegionalAlertSheet placeLabel={school.city} city={school.city} />

        <V3Quiet id="about" eyebrow="This school" heading={`${schoolName} details`} items={quietItems} />
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
