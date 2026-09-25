/**
 * Structured data for the monthly report pages. Pure: every value is read from
 * the same list rows and payload the page renders, so the markup and the
 * screen carry one number per fact (CLAUDE.md §0).
 */
import type { EditionListItem, EditionRow } from '@/lib/data/market-report/editions'
import { monthLabel } from '@/lib/market-report/format'
import { VERDICT_RULE } from '@/lib/market-report/narrative'
import type { SchemaInput } from '@/lib/site/json-ld'
import {
  MONTHLY_REPORT_NAME,
  MONTHLY_REPORT_PATH,
  REPORT_SOURCE_NAME,
  archiveDescription,
  datasetVariables,
  editionDescription,
  editionHeading,
  editionKey,
  editionPath,
  editionPdfFilename,
  editionPdfHref,
  floorsSentence,
  hasPdf,
  pdfSize,
} from './report-view'

export type MethodQuestion = { question: string; body: string | readonly string[]; open?: boolean }

/**
 * How the report is built, as questions: rendered by V3Answers on the archive
 * and emitted once as FAQPage from the same array. Nothing here is a market
 * figure; the floors and thresholds are the report's rules, read from the
 * modules that apply them.
 */
export function methodQuestions(completeThrough: string | null): MethodQuestion[] {
  return [
    {
      question: 'What homes does the report cover?',
      body: [
        'The main series is single-family homes on less than one acre, across Central Oregon and in Bend and Redmond each month. Terrebonne, Culver, Powell Butte and Camp Sherman are read on single-family homes of any lot size, since most homes there sit on acreage.',
        'Condos and townhomes, and homes on an acre or more, have their own tables in each PDF.',
      ],
      open: true,
    },
    {
      question: 'Why do some figures show a dash?',
      body: `${floorsSentence()} When a market falls short, the report prints a dash instead of an estimate. The smaller towns are read over three months so their medians have enough sales to stand on.`,
    },
    {
      question: 'How is months of supply figured?',
      body: VERDICT_RULE,
    },
    {
      question: 'Where do the numbers come from?',
      body: `${REPORT_SOURCE_NAME}. Each edition is built once from the closed sales and listings recorded in the MLS, then kept as published, so a report always shows the figures it went out with.${completeThrough ? ` The latest edition counts records through ${completeThrough}.` : ''}`,
    },
  ]
}

export const ARCHIVE_BREADCRUMB = [
  { name: 'Home', url: '/' },
  { name: 'Housing market', url: '/housing-market' },
  { name: 'Market reports', url: '/housing-market/reports' },
  { name: 'Monthly report', url: MONTHLY_REPORT_PATH },
]

/** The archive: breadcrumb, CollectionPage, the latest figures, the latest editions, the methods. */
export function archiveSchemas(
  editions: readonly EditionListItem[],
  edition: EditionRow | null,
  completeThrough: string | null,
): SchemaInput[] {
  const latest = editions[0]
  if (!latest) return [{ type: 'breadcrumb', items: ARCHIVE_BREADCRUMB }]
  const latestKey = editionKey(latest)
  const oldestKey = editionKey(editions[editions.length - 1]!)
  const k = edition?.payload.region.kpis ?? null
  const latestLabel = monthLabel(latestKey)
  const out: SchemaInput[] = [
    { type: 'breadcrumb', items: ARCHIVE_BREADCRUMB },
    {
      type: 'webPage',
      pageType: 'CollectionPage',
      name: MONTHLY_REPORT_NAME,
      description: archiveDescription(oldestKey, latestKey, k),
      url: MONTHLY_REPORT_PATH,
    },
  ]
  if (k) {
    out.push({
      type: 'dataset',
      name: `Central Oregon housing market, ${latestLabel}`,
      description: `Median sale price, homes sold, median days to pending, homes for sale and months of supply for single-family homes on less than one acre in Central Oregon, from the ${latestLabel} edition of the Ryan Realty monthly market report. ${REPORT_SOURCE_NAME}.`,
      url: editionPath(latestKey),
      ...(latest.published_at ? { dateModified: latest.published_at } : {}),
      temporalCoverage: `${oldestKey}/${latestKey}`,
      spatialCoverageName: 'Central Oregon, OR',
      variableMeasured: datasetVariables(k, latestKey),
    })
  }
  out.push({
    type: 'itemList',
    name: 'Central Oregon monthly market reports',
    items: editions.slice(0, 12).map((item) => ({
      name: editionHeading(editionKey(item)),
      url: editionPath(editionKey(item)),
    })),
  })
  out.push({
    type: 'faqPage',
    items: methodQuestions(completeThrough).map((q) => ({
      question: q.question,
      answer: typeof q.body === 'string' ? q.body : q.body.join(' '),
    })),
  })
  return out
}

/** One edition: breadcrumb and the region's figures as a Dataset. */
export function editionSchemas(edition: EditionRow, key: string): SchemaInput[] {
  const when = monthLabel(key)
  const path = editionPath(key)
  return [
    {
      type: 'breadcrumb',
      items: [...ARCHIVE_BREADCRUMB, { name: when, url: path }],
    },
    {
      type: 'dataset',
      name: `Central Oregon housing market, ${when}`,
      description: `Median sale price, homes sold, median days to pending, homes for sale and months of supply for single-family homes on less than one acre in Central Oregon, ${when}, from the Ryan Realty monthly market report. ${REPORT_SOURCE_NAME}.`,
      url: path,
      ...(edition.published_at ? { dateModified: edition.published_at } : {}),
      temporalCoverage: key,
      spatialCoverageName: 'Central Oregon, OR',
      variableMeasured: datasetVariables(edition.payload.region.kpis, key),
    },
  ]
}

/**
 * The edition as a schema.org Report, with the PDF as its encoding. The site
 * JSON-LD builder has no Report type, so the page emits this object itself.
 */
export function editionReportSchema(edition: EditionRow, key: string, site: string): Record<string, unknown> {
  const canonical = `${site}${editionPath(key)}`
  const size = pdfSize(edition.pdf_bytes)
  const organization = { '@type': 'Organization', '@id': `${site}#organization`, name: 'Ryan Realty', url: site }
  return {
    '@context': 'https://schema.org',
    '@type': 'Report',
    '@id': `${canonical}#report`,
    name: edition.title,
    headline: editionHeading(key),
    description: editionDescription(key, edition.payload.region.kpis),
    url: canonical,
    inLanguage: 'en-US',
    ...(edition.published_at ? { datePublished: edition.published_at } : {}),
    temporalCoverage: key,
    spatialCoverage: { '@type': 'Place', name: 'Central Oregon, OR' },
    about: { '@type': 'Place', name: 'Central Oregon' },
    author: organization,
    publisher: organization,
    isPartOf: { '@type': 'CollectionPage', name: MONTHLY_REPORT_NAME, url: `${site}${MONTHLY_REPORT_PATH}` },
    ...(hasPdf(edition)
      ? {
          encoding: {
            '@type': 'MediaObject',
            name: editionPdfFilename(key),
            contentUrl: `${site}${editionPdfHref(key)}`,
            encodingFormat: 'application/pdf',
            ...(size ? { contentSize: size } : {}),
          },
        }
      : {}),
  }
}

/** A JSON-LD body that cannot close its own script element. */
export function jsonLdText(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}
