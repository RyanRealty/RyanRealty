// @no-parity — report archive on the shared v3 patterns; no bespoke mockup contract.
/**
 * /housing-market/reports/monthly — the Central Oregon monthly market report:
 * the latest edition first, then every edition since the first, by year.
 *
 * VISITOR OBJECTIVE: read this month's report or download its PDF, or find any
 * earlier month and read or download that one.
 * MACHINE OBJECTIVE: CollectionPage + ItemList of editions, a Dataset of the
 * latest figures, FAQPage for the methods, BreadcrumbList; canonical here.
 *
 * The sections (Instrument → Doors → archive calendar → Answers) live in
 * ./_v3/ArchiveSections.tsx; this file owns the reads, the metadata, the
 * structured data, the trail and the footer.
 *
 * DATA (CLAUDE.md §0). Every figure is read from a published edition's frozen
 * payload through lib/data/market-report/editions (anon, RLS: published rows
 * only) and formatted with the helpers the PDF uses, so this page, the edition
 * page and the PDF print one number per fact. Nothing here computes a market
 * statistic. With nothing published the page says so and is noindex.
 */
import { cache } from 'react'
import type { Metadata } from 'next'
import {
  getPublishedEdition,
  listPublishedEditions,
  type EditionListItem,
} from '@/lib/data/market-report/editions'
import { formatCalendarDay } from '@/lib/format/date'
import { pageMetadata } from '@/lib/site/page-metadata'
import {
  MetadataBlock,
  V3_ROOT_CLASS,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3SectionTracker,
} from '@/components/site/v3'
import { ArchiveSections } from './_v3/ArchiveSections'
import { archiveSchemas } from './_v3/report-schemas'
import { MONTHLY_REPORT_NAME, MONTHLY_REPORT_PATH, archiveDescription, editionKey } from './_v3/report-view'

export const revalidate = 3600

/** One read per request for the metadata and the body. */
const loadEditions = cache(async (): Promise<EditionListItem[]> => listPublishedEditions())
const loadEdition = cache(async (key: string) => getPublishedEdition(key))

export async function generateMetadata(): Promise<Metadata> {
  const editions = await loadEditions()
  const latest = editions[0]
  if (!latest) {
    return pageMetadata({
      title: MONTHLY_REPORT_NAME,
      description: 'The Central Oregon monthly market report from Ryan Realty. No edition has been published here yet.',
      path: MONTHLY_REPORT_PATH,
      noindex: true,
    })
  }
  const latestKey = editionKey(latest)
  const oldestKey = editionKey(editions[editions.length - 1]!)
  const edition = await loadEdition(latestKey)
  return pageMetadata({
    title: MONTHLY_REPORT_NAME,
    description: archiveDescription(oldestKey, latestKey, edition?.payload.region.kpis ?? null),
    path: MONTHLY_REPORT_PATH,
  })
}

export default async function MonthlyReportArchivePage() {
  const editions = await loadEditions()
  const latest = editions[0]
  const edition = latest ? await loadEdition(editionKey(latest)) : null
  const completeThrough = latest ? formatCalendarDay(latest.data_complete_through) || null : null

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <MetadataBlock schemas={archiveSchemas(editions, edition, completeThrough)} />
        <V3Breadcrumb
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Housing market', href: '/housing-market' },
            { label: 'Market reports', href: '/housing-market/reports' },
            { label: 'Monthly report' },
          ]}
        />
        <ArchiveSections editions={editions} edition={edition} completeThrough={completeThrough} />
      </main>
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
