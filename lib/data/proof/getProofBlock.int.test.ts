/**
 * getProofBlock against LIVE Supabase. Read-only: this file issues no write of
 * any kind, so it needs no int-scope marker row.
 *
 * It exists to satisfy CLAUDE.md section 0 rule 3, "print the raw result" — the
 * run prints every closing the block will draw, the window, the row counts, and
 * the published context cells with their sample sizes, so a reviewer can audit
 * the shipped numbers against this output.
 *
 * Assertions are INVARIANTS, not the values of the day. The brokerage closes
 * homes and the market moves; a test pinned to "7 closings" would fail for
 * being correct. What must never drift is the arithmetic and the trace.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { createServiceClient } from '@/lib/data/client'
import { getProofBlock } from './getProofBlock'
import { daysToContract, medianCont, saleToOriginalList } from './outcomes'
import type { ProofBlock } from './getProofBlock'

const pct = (v: number | null) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`)
const days = (v: number | null) => (v == null ? '—' : String(Math.round(v)))

/**
 * ONE pull, shared by every assertion below.
 *
 * Each test used to call getProofBlock() itself, which re-ran the all-time
 * closed-sales scan every time (`getBrokerageTrackRecord`, an unindexed
 * ILIKE over 385k closed rows, ~24s) and pushed all three past the 60s
 * timeout on a loaded machine. Pulling once is also the more honest shape:
 * the rows this file PRINTS and the rows it ASSERTS on are then provably the
 * same pull, which is what section 0 rule 3 is asking for.
 */
let block: ProofBlock

beforeAll(async () => {
  block = await getProofBlock()
}, 180_000)

describe('getProofBlock (live)', () => {
  it('pulls the record fresh and every figure reconciles to its own rows', async () => {

    /* ---- section 0: print the raw result -------------------------------- */
    console.log('\n=== SITE-11 proof block, live pull ===')
    console.log(
      `window: ${block.window.start} .. ${block.window.end} (${block.window.months} months)`,
    )

    if (block.record) {
      console.log(
        `closed-sales line (all time): ${block.record.homesSold} homes, volume $${block.record.totalVolume.toLocaleString('en-US')}, avg $${block.record.avgSalePrice.toLocaleString('en-US')}`,
      )
    } else {
      console.log('closed-sales line: NONE')
    }

    const o = block.outcomes
    console.log(
      `outcomes: ${o.closings} closings in window · sale-to-original on ${o.saleToOriginalN} · days-to-contract on ${o.daysToContractN} (${o.daysExcludedN} dropped) · cities ${o.cities.join(', ') || 'none'}`,
    )
    console.log('  ListNumber   city        closed      sale/orig   days')
    for (const r of o.rows) {
      console.log(
        `  ${r.id.padEnd(12)} ${(r.city ?? '—').padEnd(11)} ${r.closeDate}  ${pct(r.saleToOriginal).padStart(8)}  ${days(r.daysToContract).padStart(5)}`,
      )
    }
    console.log(
      `  MEDIAN Ryan Realty: sale/orig ${pct(o.medianSaleToOriginal)} (n=${o.saleToOriginalN}) · days ${days(o.medianDaysToContract)} (n=${o.daysToContractN})`,
    )

    if (block.context) {
      console.log(
        `  MEDIAN ${block.context.label} detached: sale/orig ${pct(block.context.medianSaleToOriginal)} (n=${block.context.medianSaleToOriginalN}) · days ${days(block.context.medianDaysToContract)} (n=${block.context.medianDaysToContractN}) · closed ${block.context.closedCount} · def ${block.context.definitionId} · computed ${block.context.computedAt}`,
      )
    } else {
      console.log('  context: WITHHELD')
    }

    if (block.reviews) {
      console.log(
        `reviews: ${block.reviews.averageRating.toFixed(1)} from ${block.reviews.count} ${block.reviews.source} reviews, ${block.reviews.quotes.length} quotes carried`,
      )
    }

    console.log('\n--- trace ---')
    for (const t of block.trace) {
      console.log(
        `  ${t.figure}\n      source: ${t.source}\n      ${t.table} | ${t.filter}\n      window: ${t.window} | rows: ${t.rows} | fetched: ${t.fetchedAt}`,
      )
    }
    console.log('=== end ===\n')

    /* ---- invariants ------------------------------------------------------ */

    // The window is the stated one, twelve months wide, and closes on today.
    expect(block.window.months).toBe(12)
    expect(block.window.start).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(block.window.end).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(block.window.start < block.window.end).toBe(true)

    // Every drawn row really is inside the window it claims.
    for (const r of o.rows) {
      expect(r.closeDate >= block.window.start).toBe(true)
      expect(r.closeDate <= block.window.end).toBe(true)
    }

    // Counts reconcile to the rows, not to a separate query.
    expect(o.closings).toBe(o.rows.length)
    expect(o.saleToOriginalN).toBe(o.rows.filter((r) => r.saleToOriginal != null).length)
    expect(o.daysToContractN).toBe(o.rows.filter((r) => r.daysToContract != null).length)
    expect(o.daysExcludedN).toBe(o.closings - o.daysToContractN)

    // The medians are the medians of the printed rows. If this fails, the
    // section is printing a number its own table does not support.
    expect(o.medianSaleToOriginal).toBe(
      medianCont(o.rows.map((r) => r.saleToOriginal).filter((v): v is number => v != null)),
    )
    expect(o.medianDaysToContract).toBe(
      medianCont(o.rows.map((r) => r.daysToContract).filter((v): v is number => v != null)),
    )

    // No negative day count ever reaches the drawing.
    for (const r of o.rows) {
      if (r.daysToContract != null) expect(r.daysToContract).toBeGreaterThanOrEqual(0)
      if (r.saleToOriginal != null) expect(r.saleToOriginal).toBeGreaterThan(0)
    }

    // The all-time line is a superset of the window, never smaller than it.
    if (block.record) {
      expect(block.record.homesSold).toBeGreaterThanOrEqual(o.closings)
      expect(block.record.totalVolume).toBeGreaterThan(0)
    }

    // The context cell is the SAME window as our rows, or it is not shown.
    if (block.context) {
      const contextTraces = block.trace.filter((t) => t.table === 'public.market_metric')
      expect(contextTraces.length).toBeGreaterThan(0)
      for (const t of contextTraces) {
        expect(t.window).toContain('12 months')
        expect(t.rows).toBeGreaterThan(0)
      }
    }

    // Every figure the block can print carries a trace entry with real
    // provenance. A trace row with an empty table or a zero fetchedAt is the
    // failure section 0 exists to catch.
    expect(block.trace.length).toBeGreaterThan(0)
    for (const t of block.trace) {
      // The scope decides whether the view may publish this line at all, so an
      // untagged entry would silently reach a disclosure it does not belong in.
      expect(['always', 'outcomes']).toContain(t.scope)
      expect(t.figure.length).toBeGreaterThan(0)
      expect(t.table.length).toBeGreaterThan(0)
      expect(t.filter.length).toBeGreaterThan(0)
      expect(t.window.length).toBeGreaterThan(0)
      expect(Number.isFinite(t.rows)).toBe(true)
      expect(Date.parse(t.fetchedAt)).toBeGreaterThan(0)
    }

    // Reviews are real rows with real ratings, and no quote is truncated.
    if (block.reviews) {
      expect(block.reviews.count).toBeGreaterThan(0)
      expect(block.reviews.averageRating).toBeGreaterThan(0)
      expect(block.reviews.averageRating).toBeLessThanOrEqual(5)
      for (const q of block.reviews.quotes) {
        expect(q.text.trim().length).toBeGreaterThan(0)
        expect(q.text.endsWith('…')).toBe(false)
        expect(q.rating).toBeGreaterThanOrEqual(1)
        expect(q.rating).toBeLessThanOrEqual(5)
      }
    }
  }, 120_000)

  it('publishes ratios, not percentages, and reads newest close first', async () => {
    const o = block.outcomes

    // A units error is the failure mode that survives every other check: 93.7
    // and 0.937 both "look like a number". Every ratio the block returns —
    // ours and the market's — must sit in the band a real sale-to-list falls
    // in, so a stray *100 anywhere fails here rather than on the page.
    const ratios = [
      ...o.rows.map((r) => r.saleToOriginal),
      o.medianSaleToOriginal,
      block.context?.medianSaleToOriginal ?? null,
    ].filter((v): v is number => v != null)
    expect(ratios.length).toBeGreaterThan(0)
    for (const v of ratios) {
      expect(v).toBeGreaterThan(0.5)
      expect(v).toBeLessThan(1.5)
    }

    // Day counts are whole days in a plausible band, never a millisecond count
    // and never "DaysOnMarket" (list-to-close) smuggled in.
    for (const r of o.rows) {
      if (r.daysToContract == null) continue
      expect(Number.isInteger(r.daysToContract)).toBe(true)
      expect(r.daysToContract).toBeLessThan(2000)
    }

    // Newest close first.
    const closeDates = o.rows.map((r) => r.closeDate)
    expect(closeDates).toEqual([...closeDates].sort().reverse())

    // The exported formulas are what produced them.
    expect(daysToContract('2026-01-11', '2026-01-01')).toBe(10)
    expect(saleToOriginalList(661_000, 829_000)).toBeCloseTo(0.797346, 6)
  }, 120_000)

  it('agrees with market_fact_sale, the table the context medians are built from', async () => {
    // THE cross-check (CLAUDE.md section 0 rule 4). Our marks and the market's
    // median only belong on one scale if they are the same arithmetic. The
    // fact table stores its own `days_to_contract` and `sale_to_orig_list` for
    // every closed sale; this asserts that what the block draws equals what
    // the median was built from, row for row. A drift fails here rather than
    // shipping a comparison that quietly is not one.
    const ids = block.outcomes.rows.map((r) => r.id).filter(Boolean)
    if (ids.length === 0) return

    const sb = createServiceClient()
    const { data, error } = await sb
      .from('market_fact_sale')
      .select('list_number, segment, days_to_contract, sale_to_orig_list, is_publishable, exclusion_reasons')
      .in('list_number', ids)
    expect(error).toBeNull()

    const byId = new Map(
      ((data ?? []) as Array<Record<string, unknown>>).map((r) => [String(r.list_number), r]),
    )

    console.log('\n--- market_fact_sale cross-check ---')
    let compared = 0
    for (const row of block.outcomes.rows) {
      const fact = byId.get(row.id)
      if (!fact) {
        console.log(`  ${row.id}: not in market_fact_sale (skipped)`)
        continue
      }
      const factDays = fact.days_to_contract == null ? null : Number(fact.days_to_contract)
      const factRatio = fact.sale_to_orig_list == null ? null : Number(fact.sale_to_orig_list)
      const reasons = (fact.exclusion_reasons as string[] | null) ?? []
      console.log(
        `  ${row.id}: days ours=${row.daysToContract} fact=${factDays} | ratio ours=${row.saleToOriginal?.toFixed(8) ?? null} fact=${factRatio?.toFixed(8) ?? null} | segment=${fact.segment} publishable=${fact.is_publishable} reasons=[${reasons.join(',')}]`,
      )

      expect(row.daysToContract).toBe(factDays)
      if (row.saleToOriginal == null || factRatio == null) {
        expect(row.saleToOriginal).toBe(factRatio)
      } else {
        expect(row.saleToOriginal).toBeCloseTo(factRatio, 10)
      }
      compared += 1
    }
    console.log(`  compared ${compared} of ${block.outcomes.rows.length} rows\n`)
    expect(compared).toBeGreaterThan(0)
  }, 120_000)
})
