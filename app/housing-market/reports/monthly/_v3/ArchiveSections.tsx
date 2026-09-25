/**
 * The archive page's sections, from the rows the page read. Patterns, no two
 * adjacent alike: Instrument (the latest edition, answered) → Doors (its PDF,
 * the one reach control) → the archive calendar → Answers (how the report is
 * built, and the outbound doors). With nothing published, one honest Quiet.
 *
 * Pure: the page owns the reads (lib/data/market-report/editions) and hands
 * the list and the latest edition here. Every figure is the stored payload's,
 * formatted by the PDF's own helpers (CLAUDE.md §0).
 */
import type { EditionListItem, EditionRow } from '@/lib/data/market-report/editions'
import { monthLabel } from '@/lib/market-report/format'
import { valuationHref } from '@/lib/site/valuation-href'
import {
  v3Text,
  V3Answers,
  V3Doors,
  V3Instrument,
  V3Quiet,
} from '@/components/site/v3'
import { MonthlyArchive } from './MonthlyArchive'
import { PdfLinkNavigation } from './PdfLinkNavigation.client'
import { methodQuestions } from './report-schemas'
import {
  MONTHLY_REPORT_NAME,
  MONTHLY_REPORT_PATH,
  REPORT_SOURCE_NAME,
  archiveYears,
  editionKey,
  editionPath,
  editionPdfHref,
  hasPdf,
  marketFigures,
  medianTrendChart,
  pdfFacts,
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
  const previous = editions[1] ?? null
  const oldestKey = editionKey(editions[editions.length - 1]!)
  const latestLabel = monthLabel(latestKey)
  const latestHref = editionPath(latestKey)
  const payload = edition?.payload ?? null
  const k = payload?.region.kpis ?? null
  const brief = (payload?.headline ?? []).map((s) => s.trim()).filter((s) => s.length > 0)
  const reportCount = editions.length === 1 ? '1 report' : `${editions.length.toLocaleString('en-US')} reports`

  return (
    <>
      {k && payload ? (
        <V3Instrument
          id="latest"
          level={1}
          eyebrow={v3Text(`Latest report · ${latestLabel}`)}
          headline={v3Text(MONTHLY_REPORT_NAME)}
          {...(brief.length ? { note: v3Text(brief.join(' ')) } : {})}
          figures={marketFigures(k, { href: latestHref, supplyHref: '/months-of-supply' })}
          chart={medianTrendChart(payload.region.series, 'Central Oregon')}
          source={v3Text(sectionSource('Central Oregon', latestKey, completeThrough ?? latest.data_complete_through))}
          sourceName={v3Text(REPORT_SOURCE_NAME)}
          asOf={latest.data_complete_through}
          action={{ label: v3Text(`Read the ${latestLabel} report`), href: latestHref, variant: 'primary' }}
        />
      ) : (
        <V3Quiet
          id="latest"
          heading={MONTHLY_REPORT_NAME}
          headingLevel={1}
          eyebrow={`Latest report · ${latestLabel}`}
          items={[
            ...(latest.summary ? [{ kind: 'prose' as const, body: latest.summary }] : []),
            { label: `Read the ${latestLabel} report`, href: latestHref, lead: true },
          ]}
        />
      )}

      {hasPdf(latest) ? (
        <V3Doors
          id="download"
          name={v3Text(`Download the ${latestLabel} report`)}
          doors={[
            {
              kicker: v3Text('Free PDF'),
              label: v3Text(`Download the ${latestLabel} report`),
              fact: v3Text(pdfFacts(latest)),
              href: editionPdfHref(latestKey),
              primary: true,
            },
            ...(previous
              ? [
                  {
                    kicker: v3Text('Previous report'),
                    label: v3Text(monthLabel(editionKey(previous))),
                    href: editionPath(editionKey(previous)),
                  },
                ]
              : []),
          ]}
        />
      ) : null}

      <MonthlyArchive
        id="archive"
        eyebrow={`Archive · ${reportCount}`}
        heading={`Every report since ${monthLabel(oldestKey)}`}
        lede="Each edition reads Central Oregon, Bend and Redmond by month and the smaller towns over three months, with the full tables in its PDF."
        years={archiveYears(editions)}
        source={`${REPORT_SOURCE_NAME}. Each month links to that edition's page and its PDF. The line a month reveals is the first sentence of that edition's summary, exactly as published.`}
        sourceName={REPORT_SOURCE_NAME}
      />

      <V3Answers
        id="methods"
        eyebrow="How the report is built"
        heading="About the numbers"
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
