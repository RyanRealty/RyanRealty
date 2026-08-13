/**
 * /schools — Central Oregon schools index, on the v3 barrel.
 *
 * Places open on Instrument. Order: Breadcrumb, Instrument (registry count),
 * Ledger (every school), Sheet (SFR alerts), Quiet, Footer outside main.
 *
 * THE PAGE CONTRACT: pageMetadata, revalidate 3600, breadcrumb + webPage
 * JSON-LD via MetadataBlock, KbSectionTracker pageType="schools". Data through
 * @/lib/data. Academic stats stay nullable. Capture: submitSearchAlertSignup
 * with city="" and propertyType A.
 *
 * KB-era deletions: KbHero, KbBreadcrumb, KbFooter, SmoothScrollProvider,
 * kb.css, SchoolsIndexStyles card grid, RegionalSfrAlertsBand, per-district H2
 * sections (district grouping moved to the Ledger when column).
 */

import type { Metadata } from 'next'
import { getSchools, getSchoolsCount } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { listingsBrowsePath } from '@/lib/slug'
import { valuationHref } from '@/lib/site/valuation-href'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Instrument,
  V3Ledger,
  V3Quiet,
  type V3LedgerFigureRow,
} from '@/components/site/v3'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import { RegionalAlertSheet } from '@/app/central-oregon/_v3/RegionalAlertSheet.client'
import type { SchoolLevel } from '@/data/co-schools'

export const revalidate = 3600

const LEVEL_LABEL: Record<SchoolLevel, string> = {
  high: 'High school',
  middle: 'Middle school',
  elementary: 'Elementary school',
}

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: 'Central Oregon Schools',
    description:
      'Central Oregon schools by district. Homes for sale that feed each elementary, middle, and high school across Bend, Redmond, Sisters, and the towns around them.',
    path: '/schools',
  })
}

export default function SchoolsIndexPage() {
  const districts = getSchools()
  const total = getSchoolsCount()

  const rows: V3LedgerFigureRow[] = []
  for (const district of districts) {
    const districtName = district.district.trim()
    if (!districtName) continue
    for (const level of ['high', 'middle', 'elementary'] as const) {
      for (const school of district.byLevel[level]) {
        const name = school.name.trim()
        const slug = school.slug.trim()
        if (!name || !slug) continue
        const city = school.city.trim()
        const detail = [LEVEL_LABEL[level], city, school.grades].filter(Boolean).join(' · ')
        const rating =
          typeof school.greatSchoolsRating === 'number'
            ? `${school.greatSchoolsRating}/10`
            : LEVEL_LABEL[level]
        rows.push({
          href: `/schools/${slug}`,
          when: v3Text(districtName),
          what: v3Text(name),
          detail: detail ? v3Text(detail) : undefined,
          value: v3Text(rating),
          id: slug,
        })
      }
    }
  }
  const [firstRow, ...restRows] = rows

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <KbSectionTracker pageType="schools" />
        <MetadataBlock
          schemas={[
            {
              type: 'breadcrumb',
              items: [
                { name: 'Home', url: '/' },
                { name: 'Schools', url: '/schools' },
              ],
            },
            {
              type: 'webPage',
              name: 'Central Oregon Schools',
              description:
                'Central Oregon schools by district, with the homes for sale that feed each one.',
              url: '/schools',
            },
          ]}
        />

        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'Schools' }]} />

        <V3Instrument
          id="schools"
          level={1}
          eyebrow={v3Text('Central Oregon')}
          headline={v3Text('Schools by district, and the homes that feed them')}
          figures={[
            {
              value: v3Text(total.toLocaleString('en-US')),
              label: v3Text('schools in the registry'),
              href: '#school-list',
            },
            {
              value: v3Text(districts.length.toLocaleString('en-US')),
              label: v3Text('districts'),
              href: '#school-list',
            },
          ]}
          source={v3Text(
            'verified school registry (data/co-schools.ts). Academic stats print only when the registry carries a cited value. Nothing here is a live MLS figure.',
          )}
          action={{
            label: v3Text('Value my home'),
            href: valuationHref('/schools'),
          }}
        />

        {firstRow ? (
          <V3Ledger
            id="school-list"
            eyebrow={v3Text('By district')}
            heading={v3Text('Central Oregon schools')}
            rows={[firstRow, ...restRows]}
            source={v3Text(
              'the same verified school registry as the count above. GreatSchools ratings print only when the registry carries a number.',
            )}
            action={{
              label: v3Text('Search homes'),
              href: listingsBrowsePath(),
              variant: 'ghost',
            }}
          />
        ) : (
          <V3Ledger
            id="school-list"
            heading={v3Text('Central Oregon schools')}
            rows={[]}
            emptyMessage={v3Text('The school registry is being updated. See cities or search homes in the meantime.')}
          />
        )}

        <RegionalAlertSheet placeLabel="Central Oregon" city="" />

        <V3Quiet
          id="explore"
          eyebrow="Next"
          heading="Keep exploring Central Oregon"
          items={[
            { label: 'Cities', href: '/cities' },
            { label: 'Search homes', href: listingsBrowsePath() },
            { label: 'Value my home', href: valuationHref('/schools') },
          ]}
        />
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
