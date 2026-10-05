import { NextResponse } from 'next/server'
import { markInternalBrowser } from '@/app/actions/internal-browser'

export const dynamic = 'force-dynamic'

/**
 * POST: refresh the `rr_internal` cookie for a signed-in admin (Matt 2026-10-05,
 * GA4 counts only outside visitors). A route, not a server action, for the
 * per-page-load refresh: a server action that sets a cookie makes Next re-render
 * the page it was called from, and the admin pages are not cheap to render
 * twice. The check (session + admin_roles row) lives in markInternalBrowser; a
 * caller who is not an admin gets `{ marked: false }` and no cookie.
 */
export async function POST() {
  const result = await markInternalBrowser()
  return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } })
}
