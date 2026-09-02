// cron: nightly. Asks each county what parcels it edited since our last clean
// run and pulls only those — measured churn is single digits a day against
// 109,505 lots, so this is a small job that keeps the lot lines current
// without ever re-reading a county.
import { NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { refreshTaxlots, TAXLOT_COUNTIES } from '@/lib/taxlots/refresh'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const { searchParams } = new URL(request.url)
  const only = searchParams.get('county')?.trim().toLowerCase() || null
  // A backfill passes an explicit date; the nightly run does not, and takes
  // its cutoff from the ledger.
  const since = searchParams.get('since')?.trim() || undefined

  const counties = Object.keys(TAXLOT_COUNTIES).filter((c) => !only || c === only)
  if (counties.length === 0) {
    return NextResponse.json({ ok: false, error: `unknown county "${only}"` }, { status: 400 })
  }

  const results = []
  for (const county of counties) {
    try {
      results.push(await refreshTaxlots(county, since))
    } catch (error) {
      results.push({
        ok: false,
        county,
        since: since ?? null,
        changed: null,
        written: null,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const ok = results.every((r) => r.ok)
  return NextResponse.json({ ok, results }, { status: ok ? 200 : 500 })
}
