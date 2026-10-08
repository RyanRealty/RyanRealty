import { describe, expect, it } from 'vitest'
import { checkCitations, extractInternalLinks } from '@/lib/newsletter/pre-send-gates'
import { buildEditionEmail } from './edition-email'
import { marketReportCampaign } from '@/lib/analytics/utm'
import type { EditionPayload, Fig, Kpis, MarketSection } from './types'

/**
 * The August 2026 edition's own figures, read from
 * market_report_editions.payload (edition_month 2026-08-01, definition mr-v1)
 * on 2026-09-30. Only the fields the email reads are real; the rest are
 * placeholders the builder never prints.
 */
const fig = (v: number | null, n: number): Fig => ({ v, n })
const blank = fig(null, 0)

function kpis(k: Partial<Kpis>): Kpis {
  return {
    period: { kind: 'month', start: '2026-08-01', end: '2026-08-31' },
    median: blank,
    medianPrior: blank,
    medianYoY: null,
    sales: 0,
    salesPrior: 0,
    salesYoY: null,
    dtc: blank,
    dtcPrior: blank,
    ppsf: blank,
    stl: blank,
    stol: blank,
    priceCutShare: blank,
    concessionShare: blank,
    concessionMedian: blank,
    cashShare: blank,
    active: 0,
    activeAssumed: 0,
    closed6: 0,
    mos: null,
    verdict: null,
    newListings: 0,
    pendings: 0,
    medianActiveList: blank,
    ...k,
  }
}

function section(slug: string, label: string, type: string, k: Kpis): MarketSection {
  return {
    geo: { slug, label, type } as MarketSection['geo'],
    segment: 'sfr',
    cadence: 'monthly',
    kpis: k,
    kpis12: k,
    summary: [],
  }
}

const REGION = kpis({
  median: fig(640000, 291),
  medianYoY: -0.022900763358778664,
  sales: 291,
  salesPrior: 329,
  salesYoY: -0.11550151975683887,
  dtc: fig(38, 279),
  active: 1261,
  closed6: 1882,
  mos: 4.020191285866099,
  verdict: 'balanced',
})
const BEND = kpis({ median: fig(727500, 172), medianYoY: -0.05519480519480524, sales: 172, salesPrior: 185, dtc: fig(32.5, 164) })
const REDMOND = kpis({ median: fig(495000, 51), medianYoY: -0.09174311926605505, sales: 51, salesPrior: 76, dtc: fig(23, 49) })

function edition(over: { region?: Kpis; monthly?: MarketSection[]; pdf_path?: string | null } = {}) {
  const payload = {
    version: 1,
    definitionId: 'mr-v1',
    editionMonth: '2026-08-01',
    title: 'Central Oregon Market Report: August 2026',
    generatedAt: '2026-09-25T13:48:04.422Z',
    dataCompleteThrough: '2026-09-24',
    region: section('central-oregon', 'Central Oregon', 'region', over.region ?? REGION),
    headline: [],
    overview: [],
    monthly: over.monthly ?? [section('bend', 'Bend', 'city', BEND), section('redmond', 'Redmond', 'city', REDMOND)],
    towns: [],
    quadrants: [],
    districts: [],
    communities: [],
    condoTownhome: [],
    acreage: [],
    condoSeries: null,
    citations: [],
  } as unknown as EditionPayload
  return {
    edition_month: '2026-08-01',
    payload,
    pdf_path: over.pdf_path === undefined ? 'central-oregon/2026/ryan-realty-central-oregon-market-report-2026-08.pdf' : over.pdf_path,
    // As PostgREST returns a timestamptz; every citation records it as an ISO instant.
    generated_at: '2026-09-25T13:48:04.422+00:00',
  }
}

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&middot;/g, '·').replace(/&rarr;/g, '→').replace(/\s+/g, ' ')

describe('buildEditionEmail', () => {
  const email = buildEditionEmail(edition())

  it('names the month and the place, and prints the edition figures as the report prints them', () => {
    expect(email.subject).toBe('Central Oregon market report: August 2026')
    const body = text(email.bodyHtml)
    expect(body).toContain('$640,000 median sale price, down 2% from August 2025')
    expect(body).toContain('291 homes sold, 38 fewer than August 2025')
    expect(body).toContain('38 days median time to go under contract')
    // 4.02 prints 4.1: the site-wide rule never lets the digits cross a verdict line.
    expect(body).toContain('4.1 months of supply, a balanced market')
    expect(body).toContain('1,261 homes for sale at the end of August, against 1,882 sales over the past six months.')
    expect(body).toContain('Single-family homes on less than an acre')
  })

  it('carries the Bend and Redmond lines exactly as the edition cover prints them', () => {
    const body = text(email.bodyHtml)
    expect(body).toContain('Bend: 172 sales at a median of $727,500 (−6% from a year earlier), and the typical home went under contract in 33 days.')
    expect(body).toContain('Redmond: 51 sales at a median of $495,000 (−9% from a year earlier), and the typical home went under contract in 23 days.')
    expect(body).toContain('BEND AND REDMOND')
  })

  it('passes the R-2 figure check the schedule button runs: every printed figure is cited', () => {
    const r2 = checkCitations(email.bodyHtml, email.citations)
    expect(r2.failures).toEqual([])
    expect(r2.ok).toBe(true)
    expect(r2.checked).toBeGreaterThanOrEqual(15)
  })

  it('cites a half-dollar median as printed, so its month still passes R-2', () => {
    // Real: January 2026 Redmond 512,786.5; October 2025 region 628,497.5. A median
    // of an even count can end in .5, and money() prints whole dollars.
    const half = buildEditionEmail(
      edition({
        region: kpis({ ...REGION, median: fig(628497.5, 301) }),
        monthly: [section('bend', 'Bend', 'city', BEND), section('redmond', 'Redmond', 'city', kpis({ ...REDMOND, median: fig(512786.5, 60) }))],
      }),
    )
    expect(text(half.bodyHtml)).toContain('$628,498 median sale price')
    expect(text(half.bodyHtml)).toContain('Redmond: 51 sales at a median of $512,787')
    expect(checkCitations(half.bodyHtml, half.citations).failures).toEqual([])
    expect(half.citations.find((c) => c.figure.startsWith('Central Oregon median sale price'))?.filter).toContain('628497.5')
  })

  it('fails R-2 when a printed figure loses its citation (the check has teeth here)', () => {
    const withoutMedian = email.citations.filter((c) => c.value !== 640000)
    expect(checkCitations(email.bodyHtml, withoutMedian).ok).toBe(false)
  })

  it('links the edition page, its PDF and the archive on our domain', () => {
    const campaign = marketReportCampaign('2026-08')
    const q = `utm_source=newsletter&utm_medium=email&utm_campaign=${campaign}`
    expect(extractInternalLinks(email.bodyHtml)).toEqual([
      `https://ryan-realty.com/housing-market/reports/monthly/2026-08?${q}`,
      `https://ryan-realty.com/housing-market/reports/monthly/2026-08/pdf?${q}`,
      `https://ryan-realty.com/housing-market/reports/monthly?${q}`,
    ])
    expect(email.bodyText).toContain('Download the PDF: https://ryan-realty.com/housing-market/reports/monthly/2026-08/pdf\n')
    expect(email.bodyText).toContain('Every monthly report since January 2006')
  })

  it('leaves the PDF link out when the edition has no stored file', () => {
    const noPdf = buildEditionEmail(edition({ pdf_path: null }))
    expect(noPdf.bodyHtml).not.toContain('/pdf')
    expect(noPdf.bodyText).not.toContain('Download the PDF')
  })

  it('never fills a withheld figure', () => {
    const thin = buildEditionEmail(
      edition({
        region: kpis({ ...REGION, median: fig(null, 7), medianYoY: null, dtc: fig(null, 7), mos: null, verdict: null }),
        monthly: [section('bend', 'Bend', 'city', kpis({ ...BEND, median: fig(null, 8) })), section('redmond', 'Redmond', 'city', REDMOND)],
      }),
    )
    const body = text(thin.bodyHtml)
    expect(body).not.toContain('median sale price')
    expect(body).not.toContain('months of supply')
    expect(body).not.toContain('Bend:')
    expect(body).toContain('Redmond: 51 sales')
    expect(body).toContain('REDMOND')
    expect(body).not.toContain('–')
    expect(checkCitations(thin.bodyHtml, thin.citations).ok).toBe(true)
    expect(thin.previewText).toBe('The Central Oregon market in August, from our monthly report.')
  })

  it('writes a preheader that matches the body figures', () => {
    expect(email.previewText).toBe(
      'The median single-family home on less than an acre in Central Oregon sold for $640,000 in August. 4.1 months of supply: a balanced market.',
    )
  })

  it('uses no em dash anywhere a reader sees (VOICE, ci:no-public-em-dash)', () => {
    for (const s of [email.subject, email.previewText, email.bodyHtml, email.bodyText]) {
      expect(s).not.toContain('—')
      expect(s).not.toMatch(/ -- /)
    }
  })

  it('puts the printed direction of every change in its figure, so a sign flip is a different figure', () => {
    const figures = email.citations.map((c) => `${c.figure} = ${c.value}`)
    expect(figures).toContain('Central Oregon median change from August 2025: down (percent, as printed) = 2')
    expect(figures).toContain('Central Oregon change in homes sold from August 2025: fewer = 38')
    expect(figures).toContain('Bend median change from a year earlier: down (percent, as printed) = 6')
    const up = buildEditionEmail(edition({ region: kpis({ ...REGION, medianYoY: 0.0229 }) }))
    expect(up.citations.map((c) => c.figure)).toContain('Central Oregon median change from August 2025: up (percent, as printed)')
  })

  it('stamps every citation with the edition it came from', () => {
    for (const c of email.citations) {
      expect(c.source).toContain('market_report_editions, edition 2026-08')
      expect(c.filter).toContain('definition mr-v1')
      expect(c.fetched_at).toBe('2026-09-25T13:48:04.422Z')
    }
  })
})
