/**
 * The archive page's sections, from the rows the page read. Patterns, no two
 * adjacent alike: the archive's front (what the page holds, the latest report
 * and its PDF, the year index, a tile of the latest figures) → the archive
 * calendar → Answers (how the report is built, and the outbound doors). With
 * nothing published, one honest Quiet.
 *
 * THE ARCHIVE DOES NOT OPEN ON THE EDITION'S HERO (second taste evaluator,
 * 2026-09-29). It opened on a copy of the latest edition's Instrument, the
 * same object the edition page opens on, with the read door and the calendar
 * far under the fold. The front (ArchiveFront) puts the page's job in the
 * first screen at 1440 and at 375, and the latest figures shrink to a tile.
 * The download band that followed the hero is gone with it: its door is the
 * front's second button now, and its "previous report" is the calendar's
 * first row.
 *
 * Pure: the page owns the reads (lib/data/market-report/editions) and hands
 * the list and the latest edition here. Every figure is the stored payload's,
 * formatted by the PDF's own helpers (CLAUDE.md §0).
 */
import type { EditionListItem, EditionRow } from '@/lib/data/market-report/editions'
import { monthLabel } from '@/lib/market-report/format'
import { valuationHref } from '@/lib/site/valuation-href'
import { V3Answers, V3Quiet } from '@/components/site/v3'
import { ArchiveFront } from './ArchiveFront'
import { MonthlyArchive } from './MonthlyArchive'
import { PdfLinkNavigation } from './PdfLinkNavigation.client'
import { methodQuestions } from './report-schemas'
import {
  MONTHLY_REPORT_NAME,
  MONTHLY_REPORT_PATH,
  REPORT_SOURCE_NAME,
  archiveSentence,
  archiveYearId,
  archiveYears,
  downloadLabel,
  editionKey,
  editionPath,
  editionPdfHref,
  hasPdf,
  marketFigures,
  medianSpark,
  sectionSource,
} from './report-view'

export type ArchiveSectionsProps = {
  editions: readonly EditionListItem[]
  /** The newest edition, with its payload. */
  edition: EditionRow | null
  /** data_complete_through of the newest edition, formatted for a reader. */
  completeThrough: string | null
}

export function ArchiveSections({ editions, edition, completeThrough }: ArchiveSectionsProps) {
  const latest = editions[0]
  if (!latest) {
    return (
      <V3Quiet
        id="latest"
        heading={MONTHLY_REPORT_NAME}
        headingLevel={1}
        items={[
          {
            kind: 'prose',
            body: 'No monthly report has been published here yet. The live numbers for Central Oregon and each town are on the market hub.',
          },
          { label: 'Live market', href: '/housing-market' },
          { label: 'Months of supply', href: '/months-of-supply' },
          { label: 'Market reports', href: '/housing-market/reports' },
        ]}
      />
    )
  }

  const latestKey = editionKey(latest)
  const oldestKey = editionKey(editions[editions.length - 1]!)
  const latestLabel = monthLabel(latestKey)
  const latestHref = editionPath(latestKey)
  const payload = edition?.payload ?? null
  const k = payload?.region.kpis ?? null
  const years = archiveYears(editions)
  const spark = payload ? medianSpark(payload.region.series) : null

  return (
    <>
      <ArchiveFront
        id="latest"
        heading={MONTHLY_REPORT_NAME}
        sentence={archiveSentence(editions)}
        latest={{
          readLabel: `Read the ${latestLabel} report`,
          href: latestHref,
          ...(hasPdf(latest) ? { pdf: { label: downloadLabel(latestKey, latest), href: editionPdfHref(latestKey) } } : {}),
        }}
        years={years.map((y) => ({ year: y.year, href: `#${archiveYearId(y.year)}` }))}
        {...(k
          ? {
              tile: {
                heading: `Central Oregon, ${latestLabel}`,
                figures: marketFigures(k, { href: latestHref, supplyHref: '/months-of-supply' }),
                ...(spark ? { spark } : {}),
                source: sectionSource('Central Oregon', latestKey, completeThrough ?? latest.data_complete_through),
                sourceName: REPORT_SOURCE_NAME,
                asOf: latest.data_complete_through,
              },
            }
          : {})}
      />

      <MonthlyArchive
        id="archive"
        eyebrow={oldestKey === latestKey ? latestLabel : `${monthLabel(oldestKey)} to ${latestLabel}`}
        heading="Every report, by year"
        lede="Each edition reads Central Oregon, Bend and Redmond by month and the smaller towns over three months, with the full tables in its PDF."
        legend="Under each month: the Central Oregon median sale price, single-family homes on less than an acre. The darker the bar, the higher that month's median against every month here."
        holdHint="Press and hold a month to read the opening line of its report."
        years={years}
        source={`${REPORT_SOURCE_NAME}. Each month links to that edition's page and its PDF. The line a month reveals is the first sentence of that edition's summary, and the figure under it is that edition's Central Oregon median, both exactly as published.`}
        sourceName={REPORT_SOURCE_NAME}
      />

      <V3Answers
        id="methods"
        heading="How the report is built"
        questionHeadings
        questions={methodQuestions(completeThrough)}
        doors={[
          { label: 'Live market', href: '/housing-market' },
          { label: 'Months of supply', href: '/months-of-supply' },
          { label: 'Value my home', href: valuationHref(MONTHLY_REPORT_PATH) },
          { label: 'All market reports', href: '/housing-market/reports' },
          { label: 'Oregon Data Share', href: 'https://www.oregondatashare.com' },
        ]}
      />
      <PdfLinkNavigation />
    </>
  )
}
