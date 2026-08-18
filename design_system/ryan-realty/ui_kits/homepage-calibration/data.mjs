/**
 * homepage-calibration — verified source data (§0 record).
 *
 * Every figure on index.html appears in this file, and every row below is the
 * literal result of the query printed beside it. Queries ran live against
 * Supabase project dwvlophlbvvygjfxcrhm on 2026-08-18 via supabase-js
 * (scripts/_tmp equivalent: select on the named table with the named filters).
 * Re-run any query to re-verify the matching rows.
 */

export const FETCHED_AT = '2026-08-18T22:45:00Z snapshot, pulled 2026-08-18'
export const PROJECT = 'dwvlophlbvvygjfxcrhm'

/* ── Coverage counts (counter-query rule, run FIRST) ──────────────────────
   select geo_type, count(*) shape before any exact-key read. */
export const COVERAGE = {
  market_pulse_live: {
    query: `from('market_pulse_live').select('geo_type, geo_slug, methodology_version, updated_at, property_type')`,
    rows: 45,
    by_geo_type: { city: 16, neighborhood: 28, region: 1 },
    methodology_version: ['v3-2026-05-07'],
    property_type: ['A'],
    updated_at: '2026-08-18T22:45:00.140585+00:00',
  },
  analytics_mart_market_annual: {
    query: `from('analytics_mart_market_annual').select('geo_slug, year, sold_count, median_close, methodology, computed_at').eq('geo_type','region').eq('type_scope','sfr').order('year')`,
    rows: 28,
    years: '1998..2025',
    geo_slug: ['central-oregon'],
    methodology: ['closed_cte+service_area_v1'],
    computed_at: '2026-08-10 and 2026-08-15 batches',
  },
}

/* ── Hero + instrument + close: the one region row ────────────────────────
   from('market_pulse_live').select(...).eq('geo_type','region')            */
export const REGION = {
  geo_slug: 'central-oregon',
  geo_label: 'Central Oregon',
  active_count: 1801,
  pending_count: 619,
  new_count_7d: 123,
  median_list_price: 729425,
  median_days_to_pending: 24,
  months_of_supply: 5.66, // displayed 5.7 · balanced (4 <= 5.66 < 6)
  sold_count_30d: 360,
  sold_count_90d: 1164,
  median_close_price_90d: 675000,
  property_type: 'A',
  methodology_version: 'v3-2026-05-07',
  updated_at: '2026-08-18T22:45:00.140585+00:00',
}

/* ── Story chart + ledger: the 16 city rows (13 with actives shown) ───────
   from('market_pulse_live').select(...).eq('geo_type','city')
   Verdict classifier matches lib/area-market.ts marketClass():
     mos <= 4 seller's · < 6 balanced · else buyer's
   disp = round half up to 1 decimal · width = min(mos/12, 1)
   thin = sold_count_30d < 5.
   Ledger days-to-pending displays round half up to whole days
   (Powell Butte 37.5 -> 38); null displays as n/a.
   Crooked River Ranch, Warm Springs, Tumalo carry active_count 0 and are
   not drawn (CRR and Tumalo are not MLS cities; they file under
   Terrebonne / Bend).                                                      */
export const CITIES = [
  { name: 'Bend',              active: 472, medList: 757950,  dtp: 18,   mos: 3.45,  disp: '3.5',  cls: 'sell', width: 28.8,  sold30: 165 },
  { name: 'Redmond',           active: 182, medList: 535000,  dtp: 19,   mos: 4.33,  disp: '4.3',  cls: 'bal',  width: 36.1,  sold30: 28 },
  { name: 'La Pine',           active: 172, medList: 499000,  dtp: 52,   mos: 11.34, disp: '11.3', cls: 'buy',  width: 94.5,  sold30: 20 },
  { name: 'Camp Sherman',      active: 4,   medList: 945000,  dtp: 18,   mos: 4.0,   disp: '4.0',  cls: 'sell', width: 33.3,  sold30: 2, thin: true },
  { name: 'Sisters',           active: 34,  medList: 699000,  dtp: 10,   mos: 4.43,  disp: '4.4',  cls: 'bal',  width: 36.9,  sold30: 11 },
  { name: 'Prineville',        active: 80,  medList: 450000,  dtp: 60,   mos: 4.8,   disp: '4.8',  cls: 'bal',  width: 40.0,  sold30: 21 },
  { name: 'Madras',            active: 49,  medList: 399900,  dtp: 34,   mos: 5.07,  disp: '5.1',  cls: 'bal',  width: 42.3,  sold30: 15 },
  { name: 'Sunriver',          active: 51,  medList: 899450,  dtp: 17,   mos: 6.65,  disp: '6.7',  cls: 'buy',  width: 55.4,  sold30: 5 },
  { name: 'Metolius',          active: 7,   medList: 346950,  dtp: null, mos: 7.0,   disp: '7.0',  cls: 'buy',  width: 58.3,  sold30: 0, thin: true },
  { name: 'Culver',            active: 12,  medList: 414925,  dtp: 47,   mos: 7.2,   disp: '7.2',  cls: 'buy',  width: 60.0,  sold30: 1, thin: true },
  { name: 'Black Butte Ranch', active: 30,  medList: 995000,  dtp: 31,   mos: 11.25, disp: '11.3', cls: 'buy',  width: 93.8,  sold30: 2, thin: true },
  { name: 'Powell Butte',      active: 63,  medList: 1360000, dtp: 37.5, mos: 12.19, disp: '12.2', cls: 'buy',  width: 100, offScale: true, sold30: 3, thin: true },
  { name: 'Terrebonne',        active: 6,   medList: 685000,  dtp: null, mos: 36.0,  disp: '36',   cls: 'buy',  width: 100, offScale: true, sold30: 0, thin: true },
]

/* Population check for the ledger label (never a regional total under a
   town-list label): sum of the 13 town actives = 1,162. Region row active
   = 1,801. Remainder outside tracked town buckets = 639. */
export const LEDGER_SUM = 1162
export const REGION_REMAINDER = 639

/* ── 28-year line: analytics_mart_market_annual region/sfr ────────────────
   [year, sold_count, median_close]                                         */
export const ANNUAL = [
  [1998, 3525, 123000], [1999, 3703, 128000], [2000, 3672, 144900], [2001, 3826, 149950],
  [2002, 4185, 160000], [2003, 4814, 174500], [2004, 6224, 192000], [2005, 7769, 234900],
  [2006, 5870, 298662.5], [2007, 3784, 310000], [2008, 2745, 257500], [2009, 3661, 180000],
  [2010, 4371, 157500], [2011, 4348, 155000], [2012, 4908, 177975], [2013, 5324, 226370.5],
  [2014, 5542, 245000], [2015, 6316, 275000], [2016, 6560, 304000], [2017, 6344, 340000],
  [2018, 6533, 360000], [2019, 6421, 380000], [2020, 7484, 420000], [2021, 7575, 530000],
  [2022, 5925, 600000], [2023, 4531, 589000], [2024, 4850, 608000], [2025, 5021, 615000],
]

/* Drawdown math, recomputed: 155000 / 310000 - 1 = -0.500 exactly.
   Peak median 2007 = $310,000 · trough 2011 = $155,000 · down 50%.
   Volume peaks: 2005 = 7,769 closed · 2021 = 7,575 closed.
   SVG y-scale: y = 296 - price * 0.000415 · x = 8 + (year-1998)/27 * 984. */
export const DRAWDOWN = { peakYear: 2007, peak: 310000, troughYear: 2011, trough: 155000, pct: -50.0 }
