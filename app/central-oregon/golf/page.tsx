// @no-parity — content-engine route, not a Wave-3 mockup.
/**
 * /central-oregon/golf — the golf hub on the v3 barrel.
 *
 * WHY IT EXISTS: 26 indexable /central-oregon/golf/[slug] course pages shipped
 * with no parent. The route returned 404, the site nav pointed "Golf" at
 * /lp/central-oregon-golf (robots noindex,nofollow), and the 26 detail pages
 * therefore had no indexable hub above them. This is that hub.
 *
 * PATTERN: Ledger, opening the page (headingLevel 1). Every row is one course
 * and every row is a door, which is the whole claim of pattern 3. Then Sheet
 * (the free listing alert) and Quiet (the outbound edges). No two adjacent
 * sections share a pattern.
 *
 * CLAUDE.md §0: the only figures published here are holes, par, and back-tee
 * yardage, straight off the canonical registry (data/golf/courses.ts) where
 * they carry the USGA National Course Rating Database as their named source,
 * verified per course on 2026-08-26 and recorded in data/golf/SOURCES.md. No
 * live listing count is published on this page, so nothing here can disagree
 * with the count a detail page prints. `designer` is deliberately NOT rendered:
 * data/golf/courses.ts states 17 of 26 are confirmed, and an unverified fact
 * does not ship.
 *
 * The LP at /lp/central-oregon-golf stays exactly as it is, still linked from
 * here and from every detail page. It is paid-arrival, off the organic graph.
 */

import type { Metadata } from 'next'
import { getGolfCoursesForIndex, getGolfCourseCount } from '@/lib/data'
import { GOLF_ACCESS_LABEL, displayCity } from '@/lib/golf-format'
import { pageMetadata } from '@/lib/site/page-metadata'
import { buildJsonLd, type SchemaInput } from '@/lib/site/json-ld'
import { valuationHref } from '@/lib/site/valuation-href'
import { listingsBrowsePath } from '@/lib/slug'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Ledger,
  V3Quiet,
  V3SectionTracker,
  type V3LedgerFigureRow,
  type V3QuietItem,
} from '@/components/site/v3'
import { RegionalAlertSheet } from '@/app/central-oregon/_v3/RegionalAlertSheet.client'
import resortCommunitiesRegistry from '@/data/resort-communities.json' assert { type: 'json' }

export const revalidate = 3600

/** The section 0 trace for the value column and the par/yardage detail line. */
const LEDGER_TRACE =
  'holes, par, and back-tee yardage from the USGA National Course Rating Database, ' +
  'verified per course on 2026-08-26. Yardage is the longest rated tee.'

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: 'Central Oregon Golf Courses | Bend, Sunriver, Sisters',
    description:
      'Every golf course in Central Oregon, from Bend and Sunriver to Sisters, Redmond, Powell Butte, and Prineville. Holes, par, and back-tee yardage for each one, with the homes for sale nearby.',
    path: '/central-oregon/golf',
  })
}

type RegistryCommunity = { slug: string; label: string }

export default function GolfIndexPage() {
  const courses = getGolfCoursesForIndex()
  const total = getGolfCourseCount()
  const registry = resortCommunitiesRegistry.communities as ReadonlyArray<RegistryCommunity>
  const communityLabel = new Map(registry.map((c) => [c.slug, c.label]))

  const rows: V3LedgerFigureRow[] = []
  for (const course of courses) {
    const name = course.name.trim()
    const slug = course.slug.trim()
    if (!name || !slug) continue
    const detail =
      typeof course.yardsBackTees === 'number'
        ? `Par ${course.par} · ${course.yardsBackTees.toLocaleString('en-US')} yards from the back tees`
        : `Par ${course.par}`
    rows.push({
      id: slug,
      href: `/central-oregon/golf/${slug}`,
      when: v3Text(`${displayCity(course.city)} · ${GOLF_ACCESS_LABEL[course.access]}`),
      what: v3Text(name),
      detail: v3Text(detail),
      value: v3Text(`${course.holes} holes`),
      ariaLabel: v3Text(`${name}, ${displayCity(course.city)} Oregon`),
    })
  }
  const [firstRow, ...restRows] = rows

  /**
   * A door per community built around one of these courses, deduped and in
   * registry order. Only a course that names a `communitySlug` the registry
   * also holds produces a door, so a link cannot point at a community page
   * that does not exist.
   */
  const golfCommunitySlugs = new Set<string>()
  for (const c of courses) {
    if (c.communitySlug) golfCommunitySlugs.add(c.communitySlug)
  }
  const communityDoors: V3QuietItem[] = registry
    .filter((c) => golfCommunitySlugs.has(c.slug))
    .map((c) => ({ label: `${c.label} homes for sale`, href: `/communities/${c.slug}` }))

  const edges: V3QuietItem[] = [
    ...communityDoors,
    { label: 'Homes on a golf course', href: '/lp/central-oregon-golf' },
    { label: 'Every Central Oregon community', href: '/communities' },
    { label: 'Trails', href: '/central-oregon/trails' },
    { label: 'Search homes', href: listingsBrowsePath() },
    { label: 'Value my home', href: valuationHref('/central-oregon/golf') },
  ]
  const [firstEdge, ...restEdges] = edges

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Golf', url: '/central-oregon/golf' },
      ],
    },
    {
      type: 'webPage',
      pageType: 'CollectionPage',
      name: 'Central Oregon golf courses',
      description:
        'Every golf course in Central Oregon, each with its holes, par, and back-tee yardage, and the homes for sale nearby.',
      url: '/central-oregon/golf',
    },
    {
      type: 'itemList',
      name: 'Central Oregon golf courses',
      items: courses.map((c) => ({ name: c.name, url: `/central-oregon/golf/${c.slug}` })),
    },
  ]

  const caption = `${total.toLocaleString('en-US')} courses across Bend, Sunriver, Sisters, Redmond, La Pine, Madras, Powell Butte, Prineville, and Terrebonne. Every row opens the course and the homes for sale near it.`

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />

        {/* JSON-LD inline rather than through components/site/MetadataBlock:
            ci:public-ui fails a NEW public page that imports any non-v3
            register, and that file is the flat legacy register. Same payload,
            same builder. */}
        {schemas.map((schema, i) => (
          <script
            key={`${schema.type}-${i}`}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(schema)) }}
          />
        ))}

        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'Golf' }]} />

        {firstRow ? (
          <V3Ledger
            id="golf-courses"
            headingLevel={1}
            eyebrow={v3Text('Central Oregon')}
            heading={v3Text('Central Oregon golf courses')}
            note={v3Text(caption)}
            rows={[firstRow, ...restRows]}
            source={v3Text(LEDGER_TRACE)}
          />
        ) : (
          <V3Ledger
            id="golf-courses"
            headingLevel={1}
            eyebrow={v3Text('Central Oregon')}
            heading={v3Text('Central Oregon golf courses')}
            rows={[]}
            emptyMessage={v3Text('The golf registry returned no course on this build.')}
          />
        )}

        <RegionalAlertSheet placeLabel="Central Oregon" city="" />

        {firstEdge ? (
          <V3Quiet
            id="edges"
            eyebrow="Next"
            heading="Golf communities, and the rest of Central Oregon"
            items={[firstEdge, ...restEdges]}
          />
        ) : null}
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
