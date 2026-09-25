/**
 * One edition's sections. Patterns, no two adjacent alike: Instrument (the
 * region) → Ledger (market by market) → Instrument once per monthly city (an
 * enumeration: one template, one eyebrow, the data picks the members) → Doors
 * (the PDF, the months either side, the year) → Answers.
 *
 * Pure: the page owns the reads and hands over the edition and the published
 * list. Everything renders from the stored payload, the object the PDF was
 * rendered from, with the PDF's own formatters, so the two cannot disagree
 * (CLAUDE.md §0). Nothing here recomputes a statistic.
 */
import type { EditionListItem, EditionRow } from '@/lib/data/market-report/editions'
import { monthLabel, monthName } from '@/lib/market-report/format'
import { VERDICT_LABEL, VERDICT_RULE } from '@/lib/market-report/narrative'
import { valuationHref } from '@/lib/site/valuation-href'
import {
  v3Text,
  V3Answers,
  V3Doors,
  V3Instrument,
  V3Ledger,
  type V3Door,
} from '@/components/site/v3'
import { PdfLinkNavigation } from './PdfLinkNavigation.client'
import {
  METHODS_HREF,
  REPORT_SOURCE_NAME,
  archiveYearHref,
  downloadLabel,
  editionHeading,
  editionKey,
  editionNeighbors,
  editionPath,
  editionPdfHref,
  floorsSentence,
  hasPdf,
  marketFigures,
  marketLedgerRows,
  medianTrendChart,
  overviewNote,
  overviewSource,
  pdfFacts,
  publishedVerdict,
  supplyTrendChart,
  sectionSource,
} from './report-view'

export type EditionSectionsProps = {
  /** 'YYYY-MM' */
  editionMonth: string
  edition: EditionRow
  editions: readonly EditionListItem[]
  /** data_complete_through, formatted for a reader. */
  completeThrough: string
}

/** "Bend and Redmond" */
function namesJoined(names: readonly string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** The closing band: the PDF, the months either side, and this edition's year in the archive. */
function editionDoors(key: string, edition: EditionRow, editions: readonly EditionListItem[]): V3Door[] {
  const when = monthLabel(key)
  const { older, newer } = editionNeighbors(editions, key)
  const yearCount = editions.filter((item) => editionKey(item).slice(0, 4) === key.slice(0, 4)).length
  const doors: V3Door[] = []
  if (hasPdf(edition)) {
    doors.push({
      kicker: v3Text('Free PDF'),
      label: v3Text(`Download the full ${when} report`),
      fact: v3Text(pdfFacts(edition)),
      href: editionPdfHref(key),
      primary: true,
    })
  }
  if (older) {
    doors.push({ kicker: v3Text('Previous report'), label: v3Text(monthLabel(editionKey(older))), href: editionPath(editionKey(older)) })
  }
  if (newer) {
    doors.push({ kicker: v3Text('Next report'), label: v3Text(monthLabel(editionKey(newer))), href: editionPath(editionKey(newer)) })
  }
  doors.push({
    kicker: v3Text('Archive'),
    label: v3Text(`Every ${key.slice(0, 4)} report`),
    ...(yearCount > 0 ? { fact: v3Text(yearCount === 1 ? '1 report' : `${yearCount} reports`) } : {}),
    href: archiveYearHref(key),
  })
  return doors
}

export function EditionSections({ editionMonth: key, edition, editions, completeThrough }: EditionSectionsProps) {
  const payload = edition.payload
  const k = payload.region.kpis
  const when = monthLabel(key)
  const path = editionPath(key)
  const brief = payload.headline.map((s) => s.trim()).filter((s) => s.length > 0)
  const rows = marketLedgerRows(payload)
  const [firstRow, ...restRows] = rows
  const cities = payload.monthly.filter((s) => s.series)
  const cityRun = namesJoined(cities.map((s) => s.geo.label))
  const [firstDoor, ...restDoors] = editionDoors(key, edition, editions)
  const note = overviewNote(payload)

  return (
    <>
      <V3Instrument
        id="report"
        level={1}
        eyebrow={v3Text('Monthly market report')}
        headline={v3Text(editionHeading(key))}
        {...(brief.length ? { note: v3Text(brief.join(' ')) } : {})}
        figures={marketFigures(k, { href: '#markets', supplyHref: '/months-of-supply' })}
        chart={medianTrendChart(payload.region.series, 'Central Oregon')}
        chartSecondary={supplyTrendChart(payload.region.series, 'Central Oregon', k)}
        source={v3Text(sectionSource('Central Oregon', key, completeThrough))}
        sourceName={v3Text(REPORT_SOURCE_NAME)}
        asOf={edition.data_complete_through}
        {...(hasPdf(edition)
          ? { action: { label: v3Text(downloadLabel(key, edition)), href: editionPdfHref(key), variant: 'primary' as const } }
          : {})}
      />

      {firstRow ? (
        <V3Ledger
          id="markets"
          eyebrow={v3Text('Central Oregon at a glance')}
          heading={v3Text('Market by market')}
          {...(note ? { note: v3Text(note) } : {})}
          rows={[firstRow, ...restRows]}
          encode="bar"
          source={v3Text(overviewSource(payload, completeThrough))}
          footnote={`${floorsSentence()} ${VERDICT_RULE}`}
        />
      ) : (
        <V3Ledger
          id="markets"
          eyebrow={v3Text('Central Oregon at a glance')}
          heading={v3Text('Market by market')}
          rows={[]}
          emptyMessage={v3Text('This edition carries no market-by-market table.')}
        />
      )}

      {cities.map((section) => {
        const place = section.geo.label
        const verdict = publishedVerdict(section.kpis)
        const monthWord = monthName(key)
        return (
          <V3Instrument
            key={section.geo.slug}
            id={section.geo.slug}
            level={2}
            eyebrow={v3Text(`${cityRun} · ${when}`)}
            headline={v3Text(verdict ? `${place} in ${monthWord}: ${VERDICT_LABEL[verdict]}` : `${place} in ${monthWord}`)}
            {...(section.summary.length ? { note: v3Text(section.summary.join(' ')) } : {})}
            figures={marketFigures(section.kpis, { supplyHref: '/months-of-supply' })}
            chart={medianTrendChart(section.series, place)}
            source={v3Text(sectionSource(place, key, completeThrough))}
            sourceName={v3Text(REPORT_SOURCE_NAME)}
            asOf={edition.data_complete_through}
            action={{ label: v3Text(`${place} market today`), href: `/housing-market/${section.geo.slug}`, variant: 'ghost' }}
          />
        )
      })}

      {firstDoor ? <V3Doors id="more" name={v3Text(`More from the ${when} report`)} doors={[firstDoor, ...restDoors]} /> : null}

      <V3Answers
        id="about-numbers"
        eyebrow="About the numbers"
        heading="How to read this report"
        questions={[
          {
            question: 'Where do these numbers come from?',
            body: `${REPORT_SOURCE_NAME}. This edition counts closed sales and listings recorded through ${completeThrough}, and it is kept as published.`,
            open: true,
          },
          {
            question: 'Why do some figures show a dash?',
            body: `${floorsSentence()} When a market falls short, the report prints a dash instead of an estimate.`,
          },
          { question: 'How is months of supply figured?', body: VERDICT_RULE },
        ]}
        doors={[
          { label: 'How the report is built', href: METHODS_HREF },
          { label: 'Live market', href: '/housing-market' },
          { label: 'Months of supply', href: '/months-of-supply' },
          { label: 'Value my home', href: valuationHref(path) },
          { label: 'Oregon Data Share', href: 'https://www.oregondatashare.com' },
        ]}
      />
      <PdfLinkNavigation />
    </>
  )
}
