/**
 * charts-tier-1 — verified source data.
 *
 * Every array below is the literal result of the SQL printed in `query`.
 * Queries were run live against Supabase project dwvlophlbvvygjfxcrhm on
 * 2026-08-17. Re-run any `query` string to re-verify the matching `rows`.
 *
 * §0: no figure appears on the page that is not in this file, and no row in
 * this file was typed from memory — each block is a pasted query result.
 */

export const FETCHED_AT = '2026-08-17'
export const PROJECT = 'dwvlophlbvvygjfxcrhm'

/* ── Coverage / existence check ────────────────────────────────────────────
   Broad counter-query run BEFORE any section was built, per the rule that a
   zero-row result is a fact about the query first. All four tables hold data. */
export const COVERAGE = {
  query: `select 'sale_pricing_facts' as t, count(*) as n_rows, min(close_date)::text, max(close_date)::text from sale_pricing_facts
union all select 'sale_pricing_seller_net', count(*), min(close_date)::text, max(close_date)::text from sale_pricing_seller_net
union all select 'pricing_market_index', count(*), min(month)::text, max(month)::text from pricing_market_index
union all select 'market_pulse_live', count(*), min(updated_at)::date::text, max(updated_at)::date::text from market_pulse_live;`,
  rows: [
    { t: 'sale_pricing_facts', n: 149402, min: '1996-08-20', max: '2026-08-13' },
    { t: 'sale_pricing_seller_net', n: 149402, min: '1996-08-20', max: '2026-08-13' },
    { t: 'pricing_market_index', n: 4013, min: '1996-08-01', max: '2026-08-01' },
    { t: 'market_pulse_live', n: 45, min: '2026-08-18', max: '2026-08-18' },
  ],
}

/* concessions_yn coverage. Only 2024+ is fully populated — this is the reason
   every concessions figure on the page starts at 2024Q1 and not earlier. */
export const CONCESSION_COVERAGE = {
  query: `select concessions_yn, count(*) n, min(close_date)::text, max(close_date)::text,
  count(concessions_amount) n_amount, count(*) filter (where concessions_amount > 0) n_pos
from sale_pricing_facts group by 1 order by 2 desc;`,
  rows: [
    { flag: null, n: 121593, first: '1996-08-20', last: '2023-12-29', n_amount: 4715, n_pos: 0 },
    { flag: 'Yes', n: 19018, first: '2013-02-05', last: '2026-08-13', n_amount: 18974, n_pos: 18972 },
    { flag: 'No', n: 8791, first: '2023-03-17', last: '2026-08-13', n_amount: 17, n_pos: 0 },
  ],
  nullFreeFrom: '2024-01-01',
  /* Per-year flag coverage, from:
       select extract(year from close_date)::int yr, count(*) n,
              count(*) filter (where concessions_yn is not null) n_flag
       from sale_pricing_facts where close_date >= '2019-01-01' group by 1 order by 1;
     Pre-2024 is partial, which is why the series starts 2024Q1. */
  byYear: [
    { yr: 2019, n: 6397, flagged: 1755 },
    { yr: 2020, n: 7462, flagged: 2546 },
    { yr: 2021, n: 7542, flagged: 1639 },
    { yr: 2022, n: 5905, flagged: 1645 },
    { yr: 2023, n: 4509, flagged: 3322 },
    { yr: 2024, n: 4830, flagged: 4830 },
    { yr: 2025, n: 5004, flagged: 5004 },
    { yr: 2026, n: 2777, flagged: 2777 },
  ],
}

/* ── §1 SELLER CONCESSIONS ────────────────────────────────────────────────
   seller_net is NOT NULL for every row in this window (verified: 10,341 rows,
   0 nulls, 5,891 'No' + 4,450 'Yes'), so the gross and net medians are taken
   over the SAME row set. That check mattered: seller_net is null on 97k
   pre-2024 rows, which would have made gross and net incomparable. */
export const CONCESSIONS_ALL = {
  query: `select to_char(date_trunc('quarter', close_date),'YYYY"Q"Q') qtr, count(*) n_closed,
  count(*) filter (where concessions_yn='Yes') n_with_conc,
  round(100.0*count(*) filter (where concessions_yn='Yes')/count(*),1) incidence_pct,
  round(percentile_cont(0.5) within group (order by concessions_amount)
        filter (where concessions_yn='Yes' and concessions_amount>0)) median_conc_amt,
  round(percentile_cont(0.5) within group (order by close_price)) median_gross,
  round(percentile_cont(0.5) within group (order by seller_net)) median_net
from sale_pricing_seller_net
where close_date >= '2024-01-01' and close_date <= '2026-08-13' and product_class='detached'
group by 1 order by 1;`,
  rows: [
    { qtr: '2024Q1', n: 770, nc: 285, inc: 37.0, conc: 9000, gross: 650000, net: 646452 },
    { qtr: '2024Q2', n: 1116, nc: 429, inc: 38.4, conc: 7868, gross: 674950, net: 669950 },
    { qtr: '2024Q3', n: 1134, nc: 484, inc: 42.7, conc: 9525, gross: 650000, net: 649950 },
    { qtr: '2024Q4', n: 936, nc: 423, inc: 45.2, conc: 10000, gross: 629450, net: 622502 },
    { qtr: '2025Q1', n: 829, nc: 359, inc: 43.3, conc: 10000, gross: 650000, net: 649900 },
    { qtr: '2025Q2', n: 1110, nc: 471, inc: 42.4, conc: 10000, gross: 649950, net: 647438 },
    { qtr: '2025Q3', n: 1222, nc: 499, inc: 40.8, conc: 10000, gross: 660000, net: 659000 },
    { qtr: '2025Q4', n: 985, nc: 481, inc: 48.8, conc: 10310, gross: 635000, net: 631338 },
    { qtr: '2026Q1', n: 749, nc: 332, inc: 44.3, conc: 10000, gross: 648400, net: 640000 },
    { qtr: '2026Q2', n: 968, nc: 437, inc: 45.1, conc: 10000, gross: 657500, net: 655000 },
    { qtr: '2026Q3', n: 522, nc: 250, inc: 47.9, conc: 10000, gross: 700000, net: 699350, partial: true },
  ],
}

/* Same window, restricted to sellers who actually paid a concession. This is
   where the gross/net wedge is real — the all-sales medians barely separate
   because most sales carry no concession at all. */
export const CONCESSIONS_PAYERS = {
  query: `select to_char(date_trunc('quarter', close_date),'YYYY"Q"Q') qtr, count(*) n_conceding,
  round(percentile_cont(0.5) within group (order by close_price)) med_gross,
  round(percentile_cont(0.5) within group (order by seller_net)) med_net,
  round(percentile_cont(0.5) within group (order by concessions_amount)) med_conc,
  round((percentile_cont(0.5) within group (order by 100.0*concessions_amount/close_price))::numeric,2) med_conc_pct
from sale_pricing_seller_net
where close_date >= '2024-01-01' and close_date <= '2026-08-13'
  and product_class='detached' and concessions_yn='Yes' and concessions_amount > 0
group by 1 order by 1;`,
  rows: [
    { qtr: '2024Q1', n: 285, gross: 590000, net: 580000, conc: 9000, pct: 1.42 },
    { qtr: '2024Q2', n: 429, gross: 619000, net: 608950, conc: 7868, pct: 1.16 },
    { qtr: '2024Q3', n: 484, gross: 599950, net: 594500, conc: 9525, pct: 1.49 },
    { qtr: '2024Q4', n: 422, gross: 597450, net: 586500, conc: 10000, pct: 1.48 },
    { qtr: '2025Q1', n: 359, gross: 600000, net: 593800, conc: 10000, pct: 1.55 },
    { qtr: '2025Q2', n: 471, gross: 594240, net: 584240, conc: 10000, pct: 1.50 },
    { qtr: '2025Q3', n: 499, gross: 599995, net: 591150, conc: 10000, pct: 1.54 },
    { qtr: '2025Q4', n: 480, gross: 588500, net: 576526, conc: 10310, pct: 1.94 },
    { qtr: '2026Q1', n: 332, gross: 599450, net: 586000, conc: 10000, pct: 1.69 },
    { qtr: '2026Q2', n: 437, gross: 599995, net: 593995, conc: 10000, pct: 1.61 },
    { qtr: '2026Q3', n: 250, gross: 615500, net: 607200, conc: 10000, pct: 1.54, partial: true },
  ],
}

/* ── §2 SALE-TO-ORIGINAL-ASK ──────────────────────────────────────────────
   Monthly city path. Bend and Redmond are the two lines; lo/hi is the
   min–max across every city with n >= 5 that month, drawn as a band. */
export const STO_MONTHLY = {
  query: `with m as (
  select month, city_slug, median_sale_to_original v, n from pricing_market_index
  where month >= '2015-01-01' and median_sale_to_original is not null and n >= 5)
select to_char(month,'YYYY-MM') mo,
  round((max(v) filter (where city_slug='bend'))::numeric*100,2) bend,
  round((max(v) filter (where city_slug='redmond'))::numeric*100,2) redmond,
  round((min(v))::numeric*100,2) lo, round((max(v))::numeric*100,2) hi, count(*) n_cities
from m group by month order by month;`,
  // 2026-08 (6 cities, month in progress) is excluded from the drawn series.
  rows: [
    ['2015-01', 96.21, 95.76, 90.38, 97.64], ['2015-02', 97.37, 96.73, 92.31, 98.44],
    ['2015-03', 98.55, 99.09, 93.98, 99.09], ['2015-04', 99.95, 99.72, 86.70, 99.95],
    ['2015-05', 100.00, 98.25, 93.73, 100.00], ['2015-06', 98.52, 99.31, 93.23, 99.31],
    ['2015-07', 99.13, 98.50, 92.00, 99.70], ['2015-08', 98.74, 99.80, 92.13, 99.80],
    ['2015-09', 98.46, 100.00, 92.38, 100.00], ['2015-10', 97.67, 98.24, 86.45, 100.00],
    ['2015-11', 97.44, 98.29, 92.55, 98.29], ['2015-12', 97.79, 97.58, 90.67, 97.79],
    ['2016-01', 98.14, 98.91, 91.64, 98.91], ['2016-02', 98.50, 98.95, 91.93, 100.00],
    ['2016-03', 98.80, 98.68, 91.06, 98.80], ['2016-04', 99.52, 99.31, 88.98, 99.52],
    ['2016-05', 99.36, 100.00, 94.44, 100.00], ['2016-06', 99.43, 100.00, 93.20, 100.00],
    ['2016-07', 99.16, 99.11, 94.38, 100.00], ['2016-08', 98.55, 98.27, 93.55, 100.00],
    ['2016-09', 98.27, 99.47, 85.00, 99.47], ['2016-10', 97.98, 98.08, 94.12, 100.00],
    ['2016-11', 97.57, 97.92, 90.77, 98.53], ['2016-12', 97.70, 98.15, 88.09, 98.15],
    ['2017-01', 97.11, 98.02, 94.18, 98.02], ['2017-02', 98.30, 97.94, 93.94, 100.00],
    ['2017-03', 98.80, 98.35, 95.05, 99.60], ['2017-04', 99.23, 100.00, 96.40, 100.00],
    ['2017-05', 100.00, 100.00, 96.88, 100.00], ['2017-06', 99.60, 100.00, 93.42, 100.00],
    ['2017-07', 99.17, 98.66, 96.35, 99.17], ['2017-08', 98.44, 98.97, 95.60, 98.97],
    ['2017-09', 97.97, 98.21, 95.91, 98.74], ['2017-10', 97.74, 98.00, 95.78, 100.00],
    ['2017-11', 97.53, 96.51, 93.49, 100.50], ['2017-12', 97.95, 96.82, 94.56, 97.95],
    ['2018-01', 97.77, 97.66, 91.16, 98.51], ['2018-02', 97.88, 99.02, 94.04, 99.02],
    ['2018-03', 98.68, 98.27, 92.95, 100.00], ['2018-04', 99.01, 100.00, 94.55, 100.00],
    ['2018-05', 99.46, 100.00, 96.19, 100.00], ['2018-06', 99.43, 99.88, 96.08, 100.00],
    ['2018-07', 98.47, 99.62, 97.54, 100.00], ['2018-08', 97.73, 99.70, 93.12, 100.00],
    ['2018-09', 98.08, 97.85, 93.57, 101.18], ['2018-10', 97.31, 98.25, 94.78, 98.33],
    ['2018-11', 96.43, 97.90, 93.00, 100.00], ['2018-12', 97.05, 98.52, 90.18, 100.00],
    ['2019-01', 96.92, 98.04, 91.30, 98.04], ['2019-02', 97.25, 99.49, 94.94, 99.49],
    ['2019-03', 98.19, 98.92, 95.74, 100.00], ['2019-04', 98.43, 98.47, 95.89, 104.24],
    ['2019-05', 99.16, 99.77, 96.72, 101.96], ['2019-06', 99.51, 99.01, 92.18, 100.00],
    ['2019-07', 99.20, 99.87, 93.08, 99.87], ['2019-08', 98.42, 97.79, 91.93, 100.00],
    ['2019-09', 97.47, 98.30, 94.25, 99.02], ['2019-10', 97.09, 98.41, 93.18, 98.92],
    ['2019-11', 97.35, 98.92, 91.38, 98.92], ['2019-12', 97.40, 97.67, 91.16, 98.08],
    ['2020-01', 97.82, 98.28, 86.75, 98.28], ['2020-02', 98.15, 99.44, 93.66, 99.80],
    ['2020-03', 98.62, 99.98, 95.08, 99.98], ['2020-04', 100.00, 100.00, 97.58, 100.00],
    ['2020-05', 98.63, 100.00, 91.51, 100.00], ['2020-06', 98.00, 100.00, 95.14, 100.00],
    ['2020-07', 99.56, 100.00, 94.28, 100.00], ['2020-08', 100.00, 99.90, 95.84, 100.19],
    ['2020-09', 100.00, 100.00, 94.96, 100.00], ['2020-10', 100.00, 100.00, 97.21, 100.00],
    ['2020-11', 100.00, 100.00, 98.00, 100.00], ['2020-12', 100.00, 100.00, 98.27, 100.50],
    ['2021-01', 100.00, 100.31, 97.72, 100.31], ['2021-02', 100.96, 100.77, 97.80, 101.13],
    ['2021-03', 101.74, 101.34, 94.64, 101.74], ['2021-04', 102.26, 101.61, 100.00, 102.26],
    ['2021-05', 103.16, 101.73, 100.00, 103.16], ['2021-06', 102.60, 101.32, 100.00, 103.85],
    ['2021-07', 100.54, 101.43, 100.00, 101.43], ['2021-08', 100.00, 100.00, 99.47, 100.93],
    ['2021-09', 100.00, 100.00, 98.74, 101.45], ['2021-10', 100.00, 100.00, 97.44, 102.67],
    ['2021-11', 99.40, 100.00, 95.17, 100.00], ['2021-12', 99.18, 100.00, 91.39, 100.00],
    ['2022-01', 100.00, 100.00, 95.78, 100.00], ['2022-02', 100.00, 100.00, 98.74, 100.78],
    ['2022-03', 101.38, 100.24, 97.73, 104.00], ['2022-04', 101.85, 100.02, 99.71, 101.85],
    ['2022-05', 100.00, 100.00, 99.42, 100.90], ['2022-06', 100.00, 100.00, 96.81, 101.40],
    ['2022-07', 99.27, 100.00, 90.91, 100.00], ['2022-08', 98.83, 97.10, 94.87, 100.00],
    ['2022-09', 97.22, 97.46, 93.24, 99.49], ['2022-10', 96.30, 98.26, 89.83, 98.36],
    ['2022-11', 95.41, 93.61, 91.78, 95.74], ['2022-12', 94.68, 92.87, 88.82, 96.59],
    ['2023-01', 95.99, 95.66, 91.57, 95.99], ['2023-02', 95.99, 93.35, 90.10, 96.21],
    ['2023-03', 98.19, 96.53, 94.08, 102.08], ['2023-04', 99.09, 99.31, 95.66, 100.00],
    ['2023-05', 99.61, 98.33, 91.83, 100.00], ['2023-06', 98.69, 98.94, 94.47, 108.39],
    ['2023-07', 100.00, 100.00, 92.65, 100.22], ['2023-08', 98.53, 97.85, 92.34, 98.53],
    ['2023-09', 97.45, 99.77, 95.45, 99.77], ['2023-10', 97.84, 96.76, 91.81, 97.84],
    ['2023-11', 96.13, 97.10, 90.37, 100.00], ['2023-12', 97.12, 95.02, 93.21, 97.95],
    ['2024-01', 96.87, 98.22, 93.58, 100.00], ['2024-02', 97.48, 99.30, 96.36, 100.00],
    ['2024-03', 100.00, 97.13, 93.60, 100.00], ['2024-04', 100.00, 98.67, 89.77, 100.00],
    ['2024-05', 99.51, 100.00, 95.63, 100.00], ['2024-06', 100.00, 98.23, 92.65, 100.00],
    ['2024-07', 98.20, 99.11, 93.87, 99.20], ['2024-08', 98.40, 97.58, 92.81, 99.92],
    ['2024-09', 97.27, 97.33, 92.50, 97.82], ['2024-10', 96.06, 97.21, 93.82, 97.37],
    ['2024-11', 96.23, 98.73, 93.28, 98.73], ['2024-12', 95.85, 97.40, 87.28, 97.40],
    ['2025-01', 95.73, 97.95, 92.93, 100.00], ['2025-02', 97.40, 97.94, 92.33, 100.00],
    ['2025-03', 98.01, 99.93, 93.78, 99.93], ['2025-04', 97.65, 99.12, 94.09, 99.90],
    ['2025-05', 98.23, 100.00, 92.49, 100.00], ['2025-06', 97.28, 99.91, 95.23, 100.00],
    ['2025-07', 97.63, 97.85, 93.68, 97.85], ['2025-08', 95.77, 97.03, 92.09, 99.62],
    ['2025-09', 95.37, 96.66, 89.34, 97.36], ['2025-10', 94.59, 96.47, 90.64, 100.00],
    ['2025-11', 94.52, 97.34, 91.98, 97.66], ['2025-12', 95.40, 97.07, 86.27, 98.65],
    ['2026-01', 93.19, 96.39, 93.19, 97.49], ['2026-02', 95.11, 98.31, 93.16, 99.40],
    ['2026-03', 99.00, 98.24, 95.73, 100.00], ['2026-04', 99.16, 98.00, 89.49, 100.00],
    ['2026-05', 98.32, 99.33, 96.22, 99.33], ['2026-06', 98.18, 97.76, 90.39, 100.00],
    ['2026-07', 97.83, 97.37, 92.07, 100.00],
  ],
}

/* Q2 2026 vs Q2 2025 — the last COMPLETE quarter on both sides. Q3 2026 is six
   weeks old (286 Bend closings vs 514 in Q2) so it is named, not ranked. */
export const STO_QUARTER = {
  label2026: 'Q2 2026', label2025: 'Q2 2025',
  query: `select city_slug,
  count(*) filter (where close_date between '2026-04-01' and '2026-06-30') n_2026,
  round((percentile_cont(0.5) within group (order by sale_to_original)
    filter (where close_date between '2026-04-01' and '2026-06-30'))::numeric*100,2) sto_2026,
  count(*) filter (where close_date between '2025-04-01' and '2025-06-30') n_2025,
  round((percentile_cont(0.5) within group (order by sale_to_original)
    filter (where close_date between '2025-04-01' and '2025-06-30'))::numeric*100,2) sto_2025
from sale_pricing_facts
where product_class='detached' and sale_to_original is not null
  and (close_date between '2026-04-01' and '2026-06-30' or close_date between '2025-04-01' and '2025-06-30')
group by 1 having count(*) filter (where close_date between '2026-04-01' and '2026-06-30') >= 5
order by sto_2026 desc;`,
  rows: [
    { city: 'Redmond', n26: 180, v26: 98.76, n25: 211, v25: 99.91 },
    { city: 'Bend', n26: 514, v26: 98.46, n25: 574, v25: 97.79 },
    { city: 'Madras', n26: 32, v26: 98.41, n25: 56, v25: 97.92 },
    { city: 'Sisters', n26: 40, v26: 98.19, n25: 40, v25: 98.68 },
    { city: 'Culver', n26: 6, v26: 98.01, n25: 9, v25: 98.77 },
    { city: 'Prineville', n26: 73, v26: 98.00, n25: 90, v25: 98.20 },
    { city: 'Sunriver', n26: 21, v26: 97.60, n25: 28, v25: 97.48 },
    { city: 'La Pine', n26: 55, v26: 97.20, n25: 53, v25: 97.14 },
    { city: 'Terrebonne', n26: 15, v26: 97.16, n25: 24, v25: 97.47 },
    { city: 'Powell Butte', n26: 17, v26: 96.44, n25: 18, v25: 95.07 },
    { city: 'Black Butte Ranch', n26: 12, v26: 90.15, n25: 7, v25: 96.00 },
  ],
}

/* ── §3 DAYS-TO-OFFER vs CDOM ─────────────────────────────────────────────
   days_to_offer is on_market_date → pending_date. cdom is the MLS cumulative
   days-on-market carried to close. July is the last complete month on both
   sides (data runs to 2026-08-13, so August would be a 13-day stub). */
export const DTO_JULY = {
  query: `select city_slug,
  count(*) filter (where close_date between '2026-07-01' and '2026-07-31') n_2026,
  percentile_cont(0.5) within group (order by days_to_offer)
    filter (where close_date between '2026-07-01' and '2026-07-31') dto_2026,
  percentile_cont(0.5) within group (order by cdom)
    filter (where close_date between '2026-07-01' and '2026-07-31') cdom_2026,
  count(*) filter (where close_date between '2025-07-01' and '2025-07-31') n_2025,
  percentile_cont(0.5) within group (order by days_to_offer)
    filter (where close_date between '2025-07-01' and '2025-07-31') dto_2025,
  percentile_cont(0.5) within group (order by cdom)
    filter (where close_date between '2025-07-01' and '2025-07-31') cdom_2025
from sale_pricing_facts
where product_class='detached' and days_to_offer is not null and cdom is not null
  and (close_date between '2026-07-01' and '2026-07-31' or close_date between '2025-07-01' and '2025-07-31')
group by 1 having count(*) filter (where close_date between '2026-07-01' and '2026-07-31') >= 5
order by dto_2026 desc;`,
  rows: [
    { city: 'Powell Butte', n26: 6, dto26: 81.5, cdom26: 123, n25: 5, dto25: 83, cdom25: 121 },
    { city: 'Terrebonne', n26: 10, dto26: 81, cdom26: 116.5, n25: 5, dto25: 13, cdom25: 63 },
    { city: 'Madras', n26: 21, dto26: 62, cdom26: 120, n25: 16, dto25: 48.5, cdom25: 86 },
    { city: 'Prineville', n26: 23, dto26: 57, cdom26: 94, n25: 30, dto25: 36, cdom25: 92.5 },
    { city: 'La Pine', n26: 14, dto26: 51.5, cdom26: 82.5, n25: 24, dto25: 51.5, cdom25: 88 },
    { city: 'Redmond', n26: 64, dto26: 35.5, cdom26: 66.5, n25: 76, dto25: 23, cdom25: 57.5 },
    { city: 'Bend', n26: 217, dto26: 23, cdom26: 59, n25: 220, dto25: 20, cdom25: 52 },
    { city: 'Sunriver', n26: 12, dto26: 13.5, cdom26: 44, n25: 9, dto25: 35, cdom25: 64 },
    { city: 'Sisters', n26: 27, dto26: 7, cdom26: 47, n25: 12, dto25: 32, cdom25: 62 },
  ],
}

/* ── §4 PRICE-CUT BEHAVIOUR ───────────────────────────────────────────────
   market_pulse_live snapshot. price_reduction_share is stored as a PERCENT,
   not a fraction — verified against the writer:

     100.0 * COUNT(*) FILTER (WHERE price_drop_count > 0) / NULLIF(COUNT(*),0)
     AVG(price_drop_count) FILTER (WHERE price_drop_count IS NOT NULL)
     FROM listings WHERE "StandardStatus" IN ('Active','Coming Soon','Active Under Contract')
       AND property_sub_type = <SFR> AND "PropertyType" = 'A'

   (supabase/migrations/20260526140535_refresh_market_pulse_advisory_lock.sql:216-218)
   Scaling it by 100 again would have printed Bend as 663% of actives cut. */
export const CUTS = {
  query: `select geo_type, geo_slug, geo_label, active_count, price_reduction_share, avg_price_drops_active,
  months_of_supply, methodology_version, updated_at from market_pulse_live
where price_reduction_share is not null order by geo_type, price_reduction_share desc;`,
  updatedAt: '2026-08-18 05:33:20+00',
  methodology: 'v3-2026-05-07',
  region: { city: 'Central Oregon', actives: 1805, pct: 8.49, drops: 0.13, mos: 5.7 },
  rows: [
    { city: 'Black Butte Ranch', actives: 31, pct: 19.35, drops: 0.35, mos: 11.6 },
    { city: 'Terrebonne', actives: 6, pct: 16.67, drops: 0.33, mos: 36.0 },
    { city: 'Powell Butte', actives: 64, pct: 12.12, drops: 0.23, mos: 12.4 },
    { city: 'La Pine', actives: 172, pct: 8.52, drops: 0.11, mos: 11.2 },
    { city: 'Prineville', actives: 80, pct: 8.43, drops: 0.14, mos: 4.8 },
    { city: 'Redmond', actives: 182, pct: 8.11, drops: 0.15, mos: 4.3 },
    { city: 'Madras', actives: 49, pct: 8.00, drops: 0.16, mos: 5.2 },
    { city: 'Sunriver', actives: 51, pct: 7.84, drops: 0.10, mos: 6.5 },
    { city: 'Bend', actives: 472, pct: 6.63, drops: 0.09, mos: 3.5 },
    { city: 'Sisters', actives: 36, pct: 5.41, drops: 0.11, mos: 4.8 },
    { city: 'Culver', actives: 11, pct: 0.00, drops: 0.00, mos: 6.6 },
    { city: 'Metolius', actives: 7, pct: 0.00, drops: 0.00, mos: 7.0 },
    { city: 'Camp Sherman', actives: 4, pct: 0.00, drops: 0.00, mos: 4.0 },
  ],
}

/** Sample-size floor below which a figure is drawn but flagged. */
export const SMALL_N = 30
