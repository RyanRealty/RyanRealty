// @no-parity — internal admin surface, no public mockup contract.
/**
 * /admin/dscr — DSCR acquisition screen.
 *
 * Every active listing a DSCR lender would finance, scored on debt-service
 * coverage and on true cash flow after operating costs, ranked best-first.
 *
 * Admin-only on purpose: this renders MLS listing data with investment analysis
 * layered on top. Keeping it behind auth avoids the IDX/ODS display obligations
 * (attribution, opt-outs) that a public surface would trigger.
 *
 * 11D: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * Carried over verbatim: requireAdminPage('financials.view'), getDscrScreen(),
 * `dynamic = 'force-dynamic'`, `maxDuration = 120`, and the DscrScreen mount with
 * both props (rows + the spread DSCR_DEFAULTS) unchanged.
 *
 * Shape changed, data did not: ConsoleShell owns the <main> so this page opens
 * none, the page-title chrome is gone (the nav names it — "DSCR screen" under
 * Reports, lib/admin/nav.ts), and the paragraph block became a verdict line plus
 * one method note.
 *
 * EVERY FIGURE IN THE COPY IS COUNTED FROM THE ROWS ON SCREEN, not asserted:
 *   - rows.length ......... the screen's own row count
 *   - priced / zillow / hud  counted off DscrRow.rentSource, whose two live
 *     values are 'zillow-rentzestimate' (2,952 rows) and 'hud-fmr' (277),
 *     verified against public.dscr_rent_estimates 2026-08-07
 *   - taxMeasured ......... DscrRow.taxMeasured, true when a reported bill was
 *     found on the estimate row or the MLS tax_annual_amount field
 *
 * Two claims were CORRECTED, not carried:
 *   1. "Property tax uses the reported bill" was unconditional; getDscrScreen
 *      falls back to `price × taxRatePct` when no bill is reported, so the line
 *      now prints the measured count and only names the fallback when it is used.
 *   2. "The DSCR rate is an assumption pending a lender term sheet" — the second
 *      half is a claim about the world this page cannot verify. Cut. What is
 *      provable is that the rate, down payment, term and operating-cost figures
 *      are DSCR_DEFAULTS, printed on the assumptions strip above the table.
 */

import { requireAdminPage } from '@/lib/admin/require-admin'
import { getDscrScreen, DSCR_DEFAULTS } from '@/lib/data/dscr/screen'
import { DscrScreen } from '@/components/admin/dscr/DscrScreen.client'
import { VerdictLine } from '@/components/admin/v2'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export default async function DscrPage() {
  await requireAdminPage('financials.view')
  const rows = await getDscrScreen()

  const priced = rows.filter((r) => r.rent != null)
  const zillow = priced.filter((r) => r.rentSource === 'zillow-rentzestimate').length
  const hud = priced.filter((r) => r.rentSource === 'hud-fmr').length
  const taxMeasured = rows.filter((r) => r.taxMeasured).length
  const taxAssumed = rows.length - taxMeasured

  const n = (v: number) => v.toLocaleString('en-US')

  return (
    <div className="av2-scope" style={{ padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={rows.length === 0 ? 'attention' : 'ok'}>
          {rows.length === 0 ? (
            <>
              <b>The screen returned no listings.</b> Nothing below is a measurement.
            </>
          ) : (
            <>
              <b>
                {n(rows.length)} active Central Oregon{' '}
                {rows.length === 1 ? 'listing' : 'listings'} a DSCR lender would finance
              </b>
              , ranked best first. Deschutes, Crook, Jefferson.
            </>
          )}
        </VerdictLine>
      </div>

      <p
        style={{
          fontSize: 'var(--a-text-sm)',
          color: 'var(--a-text-2)',
          margin: '0 0 12px',
          maxWidth: 760,
        }}
      >
        <strong style={{ color: 'var(--a-text)' }}>Buy at</strong> is the price that would put a
        property at DSCR 1.00 on its own rent, and <strong style={{ color: 'var(--a-text)' }}>Delta</strong> is
        how far that sits from asking. DSCR divides rent by PITIA, so it ignores operating costs;
        cash flow subtracts them.
      </p>

      <p
        style={{
          fontSize: 'var(--a-text-xs)',
          color: 'var(--a-text-2)',
          margin: '0 0 20px',
          maxWidth: 760,
        }}
      >
        Rent priced on {n(priced.length)} of {n(rows.length)} listings — {n(zillow)} from Zillow
        rentZestimate, {n(hud)} from HUD Fair Market Rent. The rest show the rent they would need
        to clear DSCR 1.00, which is exact and needs no rent source. Property tax is the reported
        bill on {n(taxMeasured)} of {n(rows.length)}
        {taxAssumed > 0 ? ` and ${DSCR_DEFAULTS.taxRatePct}% of price on the other ${n(taxAssumed)}` : ''};
        Buy at holds that tax constant, because under Oregon Measure 50 assessed value does not
        reset on sale. The rate, down payment, term and operating-cost percentages on the strip
        below are assumptions, not quotes.
      </p>

      <DscrScreen rows={rows} assumptions={{ ...DSCR_DEFAULTS }} />
    </div>
  )
}
