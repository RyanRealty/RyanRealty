import { NextResponse } from 'next/server'
import { getSession } from '@/app/actions/auth'

/**
 * GET /api/auth/me
 *
 * Returns the current session for the cookie holder. Client-side fetch
 * target for the Header / SignInPrompt / VisitTracker chrome components
 * so the root layout no longer needs to call `getSession()` on the server
 * (which forces `Cache-Control: private, no-store` on every route response
 * and blocks CDN caching). SITE_SPEC §45-47 fix.
 *
 * Response always carries `Cache-Control: private, no-store` so user state
 * is never cached at the edge. The page HTML itself is cacheable; only this
 * endpoint is private.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  const session = await getSession()
  return NextResponse.json(
    { user: session?.user ?? null },
    {
      headers: {
        'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
      },
    },
  )
}
