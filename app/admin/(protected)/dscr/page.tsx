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
 * Rent comes from `dscr_rent_estimates` — Zillow rentZestimate at property
 * level, which also supplies measured tax, HOA and insurance. Listings without
 * a rent estimate still show the rent they would need to clear DSCR 1.00, which
 * is exact and needs no rent source at all.
 */

import { requireAdminPage } from '@/lib/admin/require-admin'
import { getDscrScreen, DSCR_DEFAULTS } from '@/lib/data/dscr/screen'
import { DscrScreen } from '@/components/admin/dscr/DscrScreen.client'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export default async function DscrPage() {
  await requireAdminPage('financials.view')
  const rows = await getDscrScreen()

  const priced = rows.filter((r) => r.rent != null)
  const zillow = priced.filter((r) => r.rentSource === 'zillow-rentzestimate').length

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">DSCR acquisition screen</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {rows.length.toLocaleString()} active listings a DSCR lender would finance, ranked best first.
          {' '}<strong>Buy at</strong> is the price that would put the property at DSCR 1.00 on its own rent,
          and <strong>Delta</strong> is how far that sits from asking. DSCR is the lender&apos;s test and
          ignores operating costs, so a property can clear 1.00 and still lose money each month. Cash flow
          is the honest number.
        </p>
        <p className="text-xs text-muted-foreground">
          Rent priced on {priced.length.toLocaleString()} of {rows.length.toLocaleString()} listings
          ({zillow.toLocaleString()} from Zillow rentZestimate). Property tax uses the reported bill, which
          under Oregon Measure 50 does not reset on sale. The DSCR rate is an assumption pending a lender
          term sheet.
        </p>
      </header>

      <DscrScreen rows={rows} assumptions={{ ...DSCR_DEFAULTS }} />
    </div>
  )
}
