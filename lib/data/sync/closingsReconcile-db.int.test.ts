/**
 * Real-DB checks for the deletion of MLS-removed sales (Matt 2026-09-30,
 * "Delete it automatically"). Nothing here leaves a row behind:
 *
 *   1. delete_mls_removed_sales_selftest (migrations 20260930230000 to
 *      20260930250000) runs the destructive functions on synthetic rows inside
 *      a block it rolls back and returns what it saw: sightings counted once
 *      per 12 hours; over the budget nothing deleted and the due sales held;
 *      the hold standing on a later run with room, and against a NULL approval;
 *      an empty key list still reporting it; an approval by name deleting that
 *      sale only, whole row logged first and its derived rows gone, even with
 *      a stale confirmation; a held sale no longer confirmed missing no longer
 *      holding; the MLS serving it again putting the saved row back, frozen as
 *      saved, and its CMA comp rebuilt by key. It clears any real hold inside
 *      the block first, so its answers are exact. Its rolled-back inserts spend
 *      log ids.
 *   2. delete_mls_removed_sales and restore_mls_removed_sales are callable with
 *      the argument names the DAL sends; a key with no listing is left alone.
 *   3. The notice read parses the saved row's mixed-case keys, and the three
 *      deleted by hand on 2026-09-30 are not waiting to be texted again.
 *
 * Skips itself when SUPABASE_SERVICE_ROLE_KEY is absent.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { config } from 'dotenv'

config({ path: '.env.local' })

const HAVE_DB = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL)
const run = HAVE_DB ? describe : describe.skip

/** Matches no listing: ListingKeys are 26 digits. */
const NO_SUCH_KEY = 'int-probe-not-a-listing-key'

run('deleting MLS-removed sales against the real DB', () => {
  let sb: import('@supabase/supabase-js').SupabaseClient

  beforeAll(async () => {
    const { createServiceClient } = await import('@/lib/supabase/service')
    sb = createServiceClient()
  })

  it('the rolled-back self-test sees every rule hold', async () => {
    const { data, error } = await sb.rpc('delete_mls_removed_sales_selftest')
    expect(error).toBeNull()
    const t = data as Record<string, Record<string, unknown>> & { rolled_back: boolean; restored_again: number }
    expect(t.sightings).toEqual({ k2: 3, k6: 1, k2_list_number_kept: 'selftest-ln-2' })
    // The self-test clears any real hold inside its rolled-back block, so these answers are exact.
    expect(t.comp_before).toBe(true)
    expect(t.over_budget).toMatchObject({ refused: true, reason: 'budget', due: 2, waiting: 2, deleted: 0, k1_still_there: true })
    expect(t.over_budget!.held_keys).toEqual(['selftest-mls-removed-1', 'selftest-mls-removed-2'])
    expect(t.while_held).toMatchObject({ refused: true, reason: 'hold', due: 2, deleted: 0 })
    expect(t.null_approval).toMatchObject({ refused: true, reason: 'hold', deleted: 0 })
    expect(t.empty_keys).toMatchObject({ refused: false, due: 0, deleted: 0, held: 2 })
    expect(t.approved).toMatchObject({
      refused: false,
      due: 1,
      deleted: 1,
      listing_gone: true,
      comp_left: false,
      membership_left: false,
      report_listing_left: false,
      span_left: false,
      report_span_left: false,
      k3_membership_kept: true,
      k2_still_held: true,
      log: {
        source: 'absent-from-mls-delete',
        outcome: 'repaired',
        reasons: ['absent_from_mls'],
        window_from: '2025-08-01',
        before_list_number: 'selftest-ln-1',
        before_has_details: true,
        mls_approved: true,
        mls_confirmations: 3,
        reported_at: null,
      },
      row: { listing_key: 'selftest-mls-removed-1', close_date: '2026-03-10', close_price: 735000, street_number: '15714' },
    })
    expect(String(t.approved!.absent_note)).toMatch(/on approval, whole row in listing_mls_repair_log id \d+$/)
    expect(t.approved_stale).toMatchObject({ refused: false, due: 1, deleted: 1 })
    expect(t.stale_hold).toMatchObject({ refused: false, due: 1, deleted: 1 })
    expect(t.restored).toMatchObject({
      count: 1,
      failed: [],
      key: 'selftest-mls-removed-1',
      close_date: '2026-03-10',
      row: { status: 'Closed', close_price: 735000, like_count: 7, street: 'Selftest Turn', is_finalized: true, media_finalized: true },
      absent_released: true,
      restore_log: { source: 'absent-from-mls-restore', reasons: ['served_again'], city: 'Bend', reported_at: null },
    })
    expect(t.comp_rebuilt).toMatchObject({
      refreshed: ['selftest-mls-removed-1'],
      skipped: ['selftest-mls-removed-4'],
      comp_back: true,
      cursors_left: false,
    })
    expect(t.restored_again).toBe(0)
    expect(t.rolled_back).toBe(true)
  })

  it('calls the deletion by the names the DAL sends, and a key with no listing is left alone', async () => {
    const { data, error } = await sb.rpc('delete_mls_removed_sales', {
      p_keys: [NO_SUCH_KEY],
      p_max_delete: 10,
      p_window_from: null,
      p_window_to: null,
      p_approve: false,
    })
    expect(error).toBeNull()
    expect(data).toMatchObject({ ok: true, refused: false, due: 0, waiting: 0, deleted: 0, rows: [] })

    const { deleteMlsRemovedSales, restoreMlsRemovedSales } = await import('./closingsReconcile')
    const r = await deleteMlsRemovedSales([NO_SUCH_KEY], { maxDelete: 10, window: { from: '2025-08-01', to: '2026-09-30' } })
    expect(r).toMatchObject({ removed: [], refused: null, due: 0, waiting: 0 })
    expect(typeof r.held).toBe('number')
    expect(await restoreMlsRemovedSales([NO_SUCH_KEY])).toEqual({ restored: [], failed: [] })
  })

  it('reads notices from the saved rows, and the three deleted by hand are not waiting to be told', async () => {
    const { getUnreportedMlsRemovalNotices } = await import('./closingsReconcile')
    const notices = await getUnreportedMlsRemovalNotices()
    expect(notices.map((n) => n.logId)).not.toEqual(expect.arrayContaining([3634]))
    const { data, error } = await sb
      .from('listing_mls_repair_log')
      .select('id, street:before_row->>StreetName, city:before_row->>City, reported_at')
      .eq('id', 3634)
      .maybeSingle()
    expect(error).toBeNull()
    expect(data).toMatchObject({ id: 3634, street: 'Tumble Weed Turn', city: 'Sisters' })
    expect((data as { reported_at: string | null }).reported_at).not.toBeNull()
  })
})
