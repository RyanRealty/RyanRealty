// @no-static-params — monthly editions are rows the monthly cron publishes, not a finite geo set.
// @no-parity — one report edition on the shared v3 patterns; no bespoke mockup contract.
/**
 * /housing-market/reports/monthly/[month] — one edition of the Central Oregon
 * monthly market report (month = 'YYYY-MM').
 *
 * VISITOR OBJECTIVE: read the month's numbers for the region, every town and
 * Bend and Redmond, then download the full PDF or step to the next month.
 * MACHINE OBJECTIVE: Report (with the PDF as its encoding) + Dataset +
 * BreadcrumbList, canonical on this URL.
 *
 * The sections (Instrument → Ledger → Instrument per monthly city → Doors →
 * Answers) live in ../_v3/EditionSections.tsx; this file owns the reads, the
 * metadata, the structured data, the trail and the footer.
 *
 * THE PAGE RENDERS ONLY FROM THE STORED PAYLOAD, the frozen object the PDF was
 * rendered from, so the two cannot disagree (CLAUDE.md §0). A malformed or
 * unpublished month is a 404. ISR: an edition is a row, so the route renders
 * on first request and revalidates hourly; the publish cron revalidates it.
 */
import { cache } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPublishedEdition, listPublishedEditions } from '@/lib/data/market-report/editions'
import { monthLabel } from '@/lib/market-report/format'
import { formatCalendarDay } from '@/lib/format/date'
import { pageMetadata } from '@/lib/site/page-metadata'
import { getCanonicalSiteUrl } from '@/lib/share-metadata'
import {
  MetadataBlock,
  V3_ROOT_CLASS,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3SectionTracker,
} from '@/components/site/v3'
import { EditionSections } from '../_v3/EditionSections'
import { editionReportSchema, editionSchemas, jsonLdText } from '../_v3/report-schemas'
import {
  MONTHLY_REPORT_PATH,
  editionDescription,
  editionHeading,
  editionPath,
  parseEditionMonth,
} from '../_v3/report-view'

export const revalidate = 3600

type PageProps = { params: Promise<{ month: string }> }

/** One read per request for the metadata and the body. */
const loadEdition = cache(async (key: string) => getPublishedEdition(key))
const loadEditions = cache(async () => listPublishedEditions())

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { month } = await params
  const key = parseEditionMonth(month)
  const edition = key ? await loadEdition(key) : null
  if (!key || !edition) {
    return pageMetadata({
      title: 'Market report not found',
      description: 'We have not published a Central Oregon market report for this month.',
      path: key ? editionPath(key) : MONTHLY_REPORT_PATH,
      noindex: true,
    })
  }
  return pageMetadata({
    title: editionHeading(key),
    description: editionDescription(key, edition.payload.region.kpis),
    path: editionPath(key),
    ogType: 'article',
  })
}

export default async function MonthlyReportEditionPage({ params }: PageProps) {
  const { month } = await params
  const key = parseEditionMonth(month)
  if (!key) notFound()
  const [edition, editions] = await Promise.all([loadEdition(key), loadEditions()])
  if (!edition) notFound()

  const completeThrough = formatCalendarDay(edition.data_complete_through) || edition.data_complete_through

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdText(editionReportSchema(edition, key, getCanonicalSiteUrl())) }}
        />
        <MetadataBlock schemas={editionSchemas(edition, key)} />
        <V3Breadcrumb
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Housing market', href: '/housing-market' },
            { label: 'Market reports', href: '/housing-market/reports' },
            { label: 'Monthly report', href: MONTHLY_REPORT_PATH },
            { label: monthLabel(key) },
          ]}
        />
        <EditionSections editionMonth={key} edition={edition} editions={editions} completeThrough={completeThrough} />
      </main>
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
