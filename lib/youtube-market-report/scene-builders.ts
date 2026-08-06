/**
 * Per-scene data builders. Pure functions that take row arrays from queries.ts
 * and produce the typed scene sub-objects defined in VideoProps.ts.
 *
 * Every builder is testable without Supabase. The orchestrator in
 * generate-props.ts fans the rows out to these builders.
 *
 * Hard rules carried over:
 *   - Median uses PERCENTILE_CONT (median() from aggregations.ts).
 *   - YoY rounded to 1 decimal (yoyPct() from aggregations.ts).
 *   - DOM uses days_to_pending only.
 *   - Sale-to-list ratios apply UF2 before being aggregated (uf2Filter).
 *   - MoS uses Template 11 (monthsOfSupply() from aggregations.ts).
 */

import {
  bandForScene5,
  classifyMarket,
  direction,
  formatPriceCompact,
  groupBy,
  median,
  monthsOfSupply,
  passesUf2,
  percentileCont,
  yoyPct,
} from './aggregations';
import type {
  ActiveInventoryRow,
  ActiveSfrRow,
  ClosedSfrRow,
} from './queries';
import { pacificYmd, uf2Filter } from './queries';
import { CONTACT } from '../brand/contact';
import type {
  AnchorStatName,
  DomByPriceBandRow,
  Market,
  MonthlyInventoryPoint,
  MonthlyMedianPoint,
  PricePerSqFtRow,
  PropertySubType,
  Scene0Hook,
  Scene1Title,
  Scene2MedianPrice,
  Scene3PricePerSqFt,
  Scene4Inventory,
  Scene5DaysToPending,
  Scene6Neighborhoods,
  Scene7Takeaways,
  Scene8Cta,
  VideoPeriod,
  ZipMetricsRow,
} from '../../video/market-report/src/VideoProps';

// ---------------------------------------------------------------------------
// Helpers shared across builders
// ---------------------------------------------------------------------------

/** First-of-month UTC date string for a Pacific-local YYYY-MM-DD. */
function monthBucket(closeDateUtc: string): string | null {
  const ymd = pacificYmd(closeDateUtc);
  if (!ymd) return null;
  return `${ymd.slice(0, 7)}-01`;
}

function nonNullPrices(rows: readonly ClosedSfrRow[]): number[] {
  return rows.map((r) => r.ClosePrice).filter((n): n is number => Number.isFinite(n));
}

function nonNullDtp(rows: readonly ClosedSfrRow[]): number[] {
  return rows
    .map((r) => r.days_to_pending)
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
}

function nonNullPpsf(rows: readonly ClosedSfrRow[]): number[] {
  return rows
    .map((r) => r.close_price_per_sqft)
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0);
}

function nonNullRatios(rows: readonly ClosedSfrRow[]): number[] {
  return rows
    .map((r) => r.sale_to_final_list_ratio)
    .filter((n): n is number => typeof n === 'number' && passesUf2(n));
}

// ---------------------------------------------------------------------------
// Scene 0 — Hook
// ---------------------------------------------------------------------------

export interface Scene0Input {
  currentRows: readonly ClosedSfrRow[];
  priorYearRows: readonly ClosedSfrRow[];
  /** Anchor metric to feature this episode. The orchestrator decides which. */
  anchorStat: AnchorStatName;
  /** Pre-computed MoS to inject when the anchor is months_of_supply. */
  monthsOfSupplyValue?: number;
}

export function buildScene0(input: Scene0Input): Scene0Hook {
  const medianPrice = median(nonNullPrices(input.currentRows));
  const priorMedian = median(nonNullPrices(input.priorYearRows));
  const closedCount = input.currentRows.length;
  const medianDtp = median(nonNullDtp(input.currentRows));

  const yoy = yoyPct(medianPrice, priorMedian);
  const dir = direction(yoy);

  let anchorDisplay = '';
  let anchorValue = NaN;
  switch (input.anchorStat) {
    case 'median_price':
      anchorValue = medianPrice;
      anchorDisplay = formatPriceCompact(medianPrice);
      break;
    case 'median_days_to_pending':
      anchorValue = medianDtp;
      anchorDisplay = `${Math.round(medianDtp)} days`;
      break;
    case 'months_of_supply':
      anchorValue = input.monthsOfSupplyValue ?? NaN;
      anchorDisplay = Number.isFinite(anchorValue) ? `${anchorValue.toFixed(1)} months` : '—';
      break;
    case 'sale_to_list': {
      const r = median(nonNullRatios(input.currentRows));
      anchorValue = Number.isFinite(r) ? Math.round(r * 1000) / 10 : NaN;
      anchorDisplay = Number.isFinite(anchorValue) ? `${anchorValue.toFixed(1)}%` : '—';
      break;
    }
    case 'absorption_rate':
      anchorValue = NaN;
      anchorDisplay = '—';
      break;
    case 'inventory_yoy':
      anchorValue = NaN;
      anchorDisplay = '—';
      break;
  }

  return {
    medianPrice,
    closedCount,
    medianDaysToPending: medianDtp,
    direction: dir,
    characterization: characterize(yoy, medianDtp),
    anchorStatName: input.anchorStat,
    anchorStatDisplay: anchorDisplay,
    anchorStatValue: anchorValue,
  };
}

/** One-word data-derived characterization. Matches storyboard VO template tone. */
function characterize(yoy: number, medianDtp: number): string {
  if (!Number.isFinite(yoy)) return 'shifting';
  if (yoy > 5 && Number.isFinite(medianDtp) && medianDtp < 14) return 'strong';
  if (yoy > 2) return 'firming';
  if (yoy < -5 && Number.isFinite(medianDtp) && medianDtp > 30) return 'soft';
  if (yoy < -2) return 'cooling';
  return 'shifting';
}

// ---------------------------------------------------------------------------
// Scene 1 — Title
// ---------------------------------------------------------------------------

export function buildScene1(period: VideoPeriod): Scene1Title {
  return {
    monthYear: period.label,
    miniAgenda: ['Prices', 'Inventory', 'Days to Pending', 'Neighborhood Breakdown'],
  };
}

// ---------------------------------------------------------------------------
// Scene 2 — Median Price (line chart + YoY)
// ---------------------------------------------------------------------------

export interface Scene2Input {
  currentRows: readonly ClosedSfrRow[];
  priorYearRows: readonly ClosedSfrRow[];
  /** Closed rows across the trailing 24 months for the line chart. */
  trailingRows: readonly ClosedSfrRow[];
  period: VideoPeriod;
}

export function buildScene2(input: Scene2Input): Scene2MedianPrice {
  const monthlySeries = buildMonthlyMedianSeries(input.trailingRows);
  const currentMedian = median(nonNullPrices(input.currentRows));
  const priorYearMedian = median(nonNullPrices(input.priorYearRows));
  const yoy = yoyPct(currentMedian, priorYearMedian);
  const yDir = direction(yoy);

  return {
    monthlySeries,
    currentMedian,
    priorYearMedian,
    yoyPct: yoy,
    yoyDirection: yDir,
    currentMonthLabel: input.period.monthName,
    trendDescription: describeTrend(monthlySeries),
    interpretation: interpretYoy(yoy),
  };
}

function buildMonthlyMedianSeries(rows: readonly ClosedSfrRow[]): MonthlyMedianPoint[] {
  const grouped = groupBy(rows, (r) => monthBucket(r.CloseDate));
  const points: MonthlyMedianPoint[] = [];
  for (const [bucket, bucketRows] of grouped.entries()) {
    if (!bucket) continue;
    const med = median(nonNullPrices(bucketRows));
    if (!Number.isFinite(med)) continue;
    points.push({ month: bucket, medianPrice: Math.round(med), salesCount: bucketRows.length });
  }
  points.sort((a, b) => a.month.localeCompare(b.month));
  return points;
}

function describeTrend(series: readonly MonthlyMedianPoint[]): string {
  if (series.length < 4) return 'Limited monthly data this period.';
  const last = series[series.length - 1]!;
  const prior = series[series.length - 2]!;
  const fourBack = series[series.length - 4]!;
  const mom = yoyPct(last.medianPrice, prior.medianPrice);
  const threeMonth = yoyPct(last.medianPrice, fourBack.medianPrice);
  if (Number.isFinite(threeMonth) && threeMonth > 2 && Number.isFinite(mom) && mom > 0) {
    return 'Prices climbed for the third straight month.';
  }
  if (Number.isFinite(threeMonth) && threeMonth < -2) {
    return 'Prices have eased back from the recent peak.';
  }
  return 'The trend has flattened over the last quarter.';
}

function interpretYoy(yoy: number): string {
  if (!Number.isFinite(yoy)) return 'Year-over-year comparison is unavailable for this period.';
  if (yoy >= 5) return 'Buyers paid noticeably more than they did a year ago.';
  if (yoy >= 0) return 'Prices held within a percent or two of last year.';
  if (yoy >= -5) return 'Prices softened slightly versus last year.';
  return 'Prices have given back a meaningful share of last year\'s gains.';
}

// ---------------------------------------------------------------------------
// Scene 3 — Price per Square Foot
// ---------------------------------------------------------------------------

export interface Scene3Input {
  currentRows: readonly ClosedSfrRow[];
  priorYearRows: readonly ClosedSfrRow[];
}

const COMPARABLE_SUBTYPES: ReadonlyArray<PropertySubType> = [
  'Single Family Residence',
  'Condominium',
  'Townhouse',
  'Manufactured On Land',
  'Manufactured Home',
];

export function buildScene3(input: Scene3Input): Scene3PricePerSqFt {
  const byType: PricePerSqFtRow[] = COMPARABLE_SUBTYPES.map((subType) => {
    const current = input.currentRows.filter((r) => r.property_sub_type === subType);
    const prior = input.priorYearRows.filter((r) => r.property_sub_type === subType);
    const med = median(nonNullPpsf(current));
    const priorMed = median(nonNullPpsf(prior));
    const yoy = yoyPct(med, priorMed);
    return {
      propertySubType: subType,
      medianPpsf: Number.isFinite(med) ? Math.round(med * 100) / 100 : NaN,
      sales: current.length,
      priorYearMedianPpsf: Number.isFinite(priorMed) ? Math.round(priorMed * 100) / 100 : NaN,
      yoyPct: Number.isFinite(yoy) ? yoy : NaN,
    };
  }).filter((row) => row.sales > 0);

  const sfrRow = byType.find((r) => r.propertySubType === 'Single Family Residence');
  const sfrPpsf = sfrRow?.medianPpsf ?? NaN;
  const sfrPct = sfrRow?.yoyPct ?? NaN;
  const sfrDir = direction(sfrPct);

  const condoRow = byType.find((r) => r.propertySubType === 'Condominium');
  const manuRow = byType.find(
    (r) => r.propertySubType === 'Manufactured On Land' || r.propertySubType === 'Manufactured Home',
  );

  return {
    byPropertyType: byType,
    sfrPpsf,
    sfrPct,
    sfrDirection: sfrDir,
    condoComparison: condoRow
      ? `Condos posted ${condoRow.sales} sales at $${Math.round(condoRow.medianPpsf)} per square foot.`
      : 'Condo sales were too thin this period to report.',
    manufacturedComparison: manuRow
      ? `Manufactured homes saw ${manuRow.sales} sales.`
      : 'Manufactured home sales were too thin this period to report.',
  };
}

// ---------------------------------------------------------------------------
// Scene 4 — Inventory + Months of Supply
// ---------------------------------------------------------------------------

export interface Scene4Input {
  activeRows: readonly ActiveSfrRow[];
  priorYearActiveCount: number;
  /** Closed-SFR rows over the lookback window for the velocity denominator. */
  closedLookbackRows: readonly ClosedSfrRow[];
  lookbackDays: number;
  /** Active inventory by sub-type for the stacked area chart (current snapshot). */
  inventoryBySubType?: readonly ActiveInventoryRow[];
}

export function buildScene4(input: Scene4Input): Scene4Inventory {
  const activeCount = input.activeRows.length;
  const closedLookback = input.closedLookbackRows.length;
  const mosResult = monthsOfSupply(activeCount, closedLookback, input.lookbackDays);

  const invYoy = yoyPct(activeCount, input.priorYearActiveCount);

  return {
    monthlySeries: buildInventorySeries(input.inventoryBySubType ?? []),
    activeCount,
    activeCountPriorYear: input.priorYearActiveCount,
    inventoryPct: invYoy,
    inventoryDirection: direction(invYoy),
    closedLookback,
    lookbackDays: input.lookbackDays,
    monthlyCloseRate: mosResult.monthlyCloseRate,
    monthsOfSupply: mosResult.monthsOfSupply,
    marketCondition: mosResult.marketCondition,
    marketConditionExplanation: explainMos(mosResult.monthsOfSupply, mosResult.marketCondition),
  };
}

/**
 * Build monthly inventory points. Counts net new listings entering Active per
 * month, split by sub-type. Mirrors storyboard Scene 4 Part A's simpler intent
 * (a true "active at month-end" series requires a snapshot table we do not
 * yet have).
 */
function buildInventorySeries(rows: readonly ActiveInventoryRow[]): MonthlyInventoryPoint[] {
  const buckets = new Map<string, MonthlyInventoryPoint>();
  for (const r of rows) {
    if (!r.OnMarketDate) continue;
    const ymdPt = pacificYmd(r.OnMarketDate);
    if (!ymdPt) continue;
    const month = `${ymdPt.slice(0, 7)}-01`;
    const point = buckets.get(month) ?? { month, sfrActive: 0, condoActive: 0, landActive: 0 };
    if (r.property_sub_type === 'Single Family Residence') point.sfrActive += 1;
    else if (r.property_sub_type === 'Condominium' || r.property_sub_type === 'Townhouse') {
      point.condoActive += 1;
    } else if (r.PropertyType === 'C' || r.PropertyType === 'D') point.landActive += 1;
    buckets.set(month, point);
  }
  return [...buckets.values()].sort((a, b) => a.month.localeCompare(b.month));
}

function explainMos(mos: number, verdict: string): string {
  if (!Number.isFinite(mos)) return 'Inventory data unavailable for this period.';
  if (mos <= 4.0) return `At ${mos.toFixed(1)} months of supply, sellers still set the pace.`;
  if (mos < 6.0) return `${mos.toFixed(1)} months of supply puts the market in a ${verdict.toLowerCase()}.`;
  return `${mos.toFixed(1)} months of supply means buyers have meaningful selection.`;
}

// ---------------------------------------------------------------------------
// Scene 5 — Days to Pending + Absorption
// ---------------------------------------------------------------------------

export interface Scene5Input {
  /** Closed-SFR rows over the trailing 90 days (or whatever window the orchestrator uses). */
  closedRows: readonly ClosedSfrRow[];
  activeCount: number;
  pendingCount: number;
}

export function buildScene5(input: Scene5Input): Scene5DaysToPending {
  const byBand = buildDomByBand(input.closedRows);
  const allDtp = nonNullDtp(input.closedRows);
  const medAll = median(allDtp);

  const closedCount = input.closedRows.length;
  const totalUniverse = input.activeCount + closedCount;
  const absorptionRatePct = totalUniverse === 0
    ? NaN
    : Math.round((closedCount / totalUniverse) * 1000) / 10;

  const pendingAndClosed = input.pendingCount + closedCount;
  const sellThroughRate90d = pendingAndClosed === 0
    ? NaN
    : Math.round((closedCount / pendingAndClosed) * 1000) / 10;

  return {
    byPriceBand: byBand,
    absorptionRatePct,
    sellThroughRate90d,
    medianDaysToPending: medAll,
    domUnder500k: lookupBand(byBand, 'Under $500K'),
    dom500to700k: lookupBand(byBand, '$500K-$700K'),
    dom700kTo1m: lookupBand(byBand, '$700K-$1M'),
    dom1mPlus: lookupBand(byBand, '$1M+'),
    absorptionInterpretation: interpretAbsorption(absorptionRatePct),
  };
}

function buildDomByBand(rows: readonly ClosedSfrRow[]): DomByPriceBandRow[] {
  const grouped = groupBy(rows, (r) => bandForScene5(r.ClosePrice));
  const out: DomByPriceBandRow[] = [];
  for (const [band, bucket] of grouped.entries()) {
    if (!band) continue;
    const dtp = nonNullDtp(bucket);
    if (dtp.length === 0) continue;
    out.push({
      priceBand: band,
      sales: bucket.length,
      medianDaysToPending: median(dtp),
      dtpP25: percentileCont(dtp, 0.25),
      dtpP75: percentileCont(dtp, 0.75),
    });
  }
  // Sort in display order (ascending price band).
  const order: Record<string, number> = {
    'Under $500K': 1,
    '$500K-$700K': 2,
    '$700K-$1M': 3,
    '$1M+': 4,
  };
  out.sort((a, b) => (order[a.priceBand] ?? 99) - (order[b.priceBand] ?? 99));
  return out;
}

function lookupBand(rows: readonly DomByPriceBandRow[], band: string): number {
  const row = rows.find((r) => r.priceBand === band);
  return row?.medianDaysToPending ?? NaN;
}

function interpretAbsorption(rate: number): string {
  if (!Number.isFinite(rate)) return 'Absorption rate is unavailable for this period.';
  if (rate >= 30) return 'Roughly a third of active inventory clears each month.';
  if (rate >= 20) return 'About one in five active homes is going under contract each month.';
  if (rate >= 10) return 'Sales pace is meaningfully slower than the active count.';
  return 'Inventory is turning over slowly relative to the listed pool.';
}

// ---------------------------------------------------------------------------
// Scene 6 — Neighborhood Breakdown
// ---------------------------------------------------------------------------

/**
 * ZIP centroid + friendly area name for the four Bend ZIPs.
 * Other markets fall back to ZIP code alone (no centroid lookup yet).
 */
const BEND_ZIP_META: Record<string, { areaName: string; centroid: { lat: number; lng: number } }> = {
  '97701': { areaName: 'East Side', centroid: { lat: 44.06, lng: -121.28 } },
  '97702': { areaName: 'South / SW', centroid: { lat: 44.03, lng: -121.33 } },
  '97703': { areaName: 'West Side', centroid: { lat: 44.07, lng: -121.35 } },
  '97708': { areaName: 'North / Tumalo', centroid: { lat: 44.10, lng: -121.30 } },
};

export interface Scene6Input {
  currentRows: readonly ClosedSfrRow[];
  priorYearRows: readonly ClosedSfrRow[];
}

export function buildScene6(input: Scene6Input): Scene6Neighborhoods {
  const currentByZip = groupBy(input.currentRows, (r) => r.PostalCode);
  const priorByZip = groupBy(input.priorYearRows, (r) => r.PostalCode);

  const out: ZipMetricsRow[] = [];
  for (const [zip, rows] of currentByZip.entries()) {
    if (!zip) continue;
    const meta = BEND_ZIP_META[zip] ?? { areaName: `ZIP ${zip}`, centroid: { lat: NaN, lng: NaN } };
    const med = median(nonNullPrices(rows));
    const ppsf = median(nonNullPpsf(rows));
    const dtp = median(nonNullDtp(rows));
    const priorMed = median(nonNullPrices(priorByZip.get(zip) ?? []));
    out.push({
      postalCode: zip,
      areaName: meta.areaName,
      centroid: meta.centroid,
      sales: rows.length,
      medianPrice: Math.round(med),
      medianPpsf: Math.round(ppsf * 100) / 100,
      medianDaysToPending: med && Number.isFinite(dtp) ? Math.round(dtp) : NaN,
      yoyPct: yoyPct(med, priorMed),
    });
  }
  out.sort((a, b) => b.medianPrice - a.medianPrice);

  const hottest = [...out].filter((r) => Number.isFinite(r.yoyPct)).sort((a, b) => b.yoyPct - a.yoyPct)[0];
  const highestPrice = out[0];
  const bestValue = [...out].sort((a, b) => a.medianPrice - b.medianPrice)[0];

  return {
    byZip: out,
    hottestZip: hottest?.postalCode ?? '',
    hottestYoyPct: hottest?.yoyPct ?? NaN,
    highestPriceZip: highestPrice?.postalCode ?? '',
    highestPriceMedian: highestPrice?.medianPrice ?? NaN,
    bestValueZip: bestValue?.postalCode ?? '',
    bestValueMedian: bestValue?.medianPrice ?? NaN,
  };
}

// ---------------------------------------------------------------------------
// Scene 7 — Buyer/Seller Takeaways
// ---------------------------------------------------------------------------

export interface Scene7Input {
  /** Trailing-90-day closed rows for sale-to-list median (UF2-clamped at fetch time). */
  trailing90Rows: readonly ClosedSfrRow[];
  /** Output of buildScene6 — used to surface the best-value ZIP. */
  scene6: Scene6Neighborhoods;
  /** Output of buildScene4 — used to tailor takeaways to current verdict. */
  scene4: Scene4Inventory;
  /** Output of buildScene5 — used for absorption-aware advice. */
  scene5: Scene5DaysToPending;
}

export function buildScene7(input: Scene7Input): Scene7Takeaways {
  const ratios = nonNullRatios(uf2Filter(input.trailing90Rows));
  const med = median(ratios);
  const medPct = Number.isFinite(med) ? Math.round(med * 1000) / 10 : NaN;

  const verdict = input.scene4.marketCondition;
  const buyer: string[] = [];
  const seller: string[] = [];

  // Best-value ZIP
  const bvz = input.scene6.bestValueZip;
  if (bvz) {
    const bvRow = input.scene6.byZip.find((r) => r.postalCode === bvz);
    if (bvRow) {
      buyer.push(
        `Look at ${bvRow.areaName} (${bvz}) for the best price per square foot at $${Math.round(bvRow.medianPpsf)}.`,
      );
    }
  }

  // Sale-to-list interpretation
  if (Number.isFinite(medPct)) {
    if (medPct >= 99) {
      buyer.push('Negotiation room is thin — sellers are holding price.');
      seller.push('Price within two percent of comparable sales.');
    } else if (medPct >= 96) {
      buyer.push(`Median sale is ${medPct.toFixed(1)} percent of asking — modest room to negotiate.`);
      seller.push('Price within three percent of recent comps to capture serious buyers.');
    } else {
      buyer.push(`Median sale is ${medPct.toFixed(1)} percent of asking — buyers have leverage.`);
      seller.push('Price aggressively to comps. Stretched listings are sitting longer.');
    }
  }

  // DOM-aware advice
  if (Number.isFinite(input.scene5.dom1mPlus) && input.scene5.dom1mPlus > 30) {
    buyer.push('Days on market widen sharply above one million — patient offers can win.');
  }
  if (verdict === "Buyer's Market") {
    seller.push('Inventory has built — first impressions matter more than ever.');
  } else if (verdict === "Seller's Market") {
    seller.push('Strong demand. Tighten staging, photos, and price discipline.');
  }

  return {
    medianSaleToListPct: medPct,
    buyerTakeaways: buyer.slice(0, 3),
    sellerTakeaways: seller.slice(0, 3),
    bestValueZip: bvz,
    bestValueZipPpsf: input.scene6.byZip.find((r) => r.postalCode === bvz)?.medianPpsf ?? NaN,
  };
}

// ---------------------------------------------------------------------------
// Scene 8 — CTA / Outro
// ---------------------------------------------------------------------------

export interface Scene8Input {
  nextReportDate: string;
}

export function buildScene8(input: Scene8Input): Scene8Cta {
  return {
    nextReportDate: input.nextReportDate,
    url: 'ryan-realty.com',
    phone: CONTACT.phoneDirect,
  };
}

// Re-export so the orchestrator can import the verdict classifier alongside builders.
export { classifyMarket } from './aggregations';

// suppress unused-warning false-positive when `Market` is used only at type level
export type _MarketTypeOnly = Market;
