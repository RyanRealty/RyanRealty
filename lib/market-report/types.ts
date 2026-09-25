/**
 * The frozen payload of one monthly edition. The PDF and the web page both
 * render from this object and nothing else, so the two can never disagree, and
 * an edition keeps the figures that were true when it was built.
 *
 * Every figure carries its sample size. A figure whose sample falls under the
 * registry floor is stored with `v: null` and never printed; the page prints
 * a dash and the reason instead of a number no floor supports.
 */
import type { ReportGeo } from './geos'

export type Verdict = 'seller' | 'balanced' | 'buyer'

/** A published figure: value (null = withheld or no data) and the sales behind it. */
export type Fig = { v: number | null; n: number }

/** One point of a series: period key (YYYY-MM for months, YYYY-MM-DD quarter end for quarters). */
export type Pt = { k: string; v: number | null; n: number }

export type PeriodRef = {
  kind: 'month' | 'trailing3' | 'trailing12' | 'quarter'
  start: string
  end: string
}

export type Kpis = {
  period: PeriodRef
  median: Fig
  medianPrior: Fig
  /** Change in median against the same window a year earlier; null when either side is under the delta floor. */
  medianYoY: number | null
  sales: number
  salesPrior: number
  salesYoY: number | null
  dtc: Fig
  dtcPrior: Fig
  ppsf: Fig
  stl: Fig
  stol: Fig
  priceCutShare: Fig
  concessionShare: Fig
  concessionMedian: Fig
  cashShare: Fig
  /** Homes for sale on the last day of the period. */
  active: number
  /** Of those, homes whose first on-market date was reconstructed rather than recorded. */
  activeAssumed: number
  /** Sales in the six months ending on the period's last day (the months-of-supply base). */
  closed6: number
  /** active / (closed6 / 6); null when closed6 is under the floor. */
  mos: number | null
  verdict: Verdict | null
  newListings: number
  pendings: number
  medianActiveList: Fig
}

export type MonthlySeries = {
  months: string[]
  median: Pt[]
  sales: Pt[]
  dtc: Pt[]
  ppsf: Pt[]
  mos: Pt[]
  active: Pt[]
  newListings: Pt[]
  pendings: Pt[]
  cash: Pt[]
  conventional: Pt[]
  government: Pt[]
  stl: Pt[]
  priceCutShare: Pt[]
  concessionShare: Pt[]
}

export type QuarterlySeries = {
  quarters: string[]
  median: Pt[]
  sales: Pt[]
  dtc: Pt[]
  /** The 12 months ending each quarter: the read for a town too small to hold a quarterly median. */
  median12: Pt[]
  dtc12: Pt[]
}

export type BandRowOut = {
  idx: number
  label: string
  short: string
  salesMonth: number
  sales12: number
  sales6: number
  active: number
  /** Months of supply inside the band; null when its six-month sales are under the floor. */
  mos: number | null
  verdict: Verdict | null
}

export type TierRowOut = {
  key: string
  label: string
  sales6: number
  active: number
  mos: number | null
  verdict: Verdict | null
}

export type SegmentKey = 'sfr' | 'acreage' | 'condo_townhome' | 'detached'

export type MarketSection = {
  geo: ReportGeo
  segment: SegmentKey
  cadence: 'monthly' | 'quarterly'
  /** Month (monthly markets) or trailing three months (quarterly markets). */
  kpis: Kpis
  kpis12: Kpis
  series?: MonthlySeries
  quarterly?: QuarterlySeries
  bands?: BandRowOut[]
  tiers?: TierRowOut[]
  summary: string[]
}

export type TableRow = {
  geo: ReportGeo
  segment: SegmentKey
  kpis: Kpis
}

export type Citation = {
  figure: string
  value: string
  source: string
  filter: string
  rows: number
  computedAt: string
}

export type EditionPayload = {
  version: 1
  definitionId: string
  editionMonth: string
  title: string
  generatedAt: string
  dataCompleteThrough: string
  region: MarketSection
  headline: string[]
  overview: TableRow[]
  monthly: MarketSection[]
  towns: MarketSection[]
  quadrants: TableRow[]
  districts: (TableRow & { quadrant: string })[]
  communities: (TableRow & { near: string })[]
  condoTownhome: TableRow[]
  acreage: TableRow[]
  condoSeries: { geo: ReportGeo; series: MonthlySeries } | null
  citations: Citation[]
}
