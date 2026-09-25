/**
 * GET /api/track/e/identify — email-click identity for raw-HTML client
 * documents (/cma/[slug], /bpo/[slug]).
 *
 * Those routes serve stored HTML, so PersonIdentityBridge (the React
 * component that consumes ?_pid= / ?_fuid= on normal pages) never runs there.
 * The injected public/rr-doc-tracker.js calls this endpoint instead, AFTER it
 * has posted the page_view that creates the visitor session, so the backfill
 * finds the session row.
 *
 * Same trust model and the same code path as the React bridge: `_pid` is the
 * SIGNED person token a link we sent carries (P7 identity loop, 2026-09-23),
 * verified and re-checked against crm_people before anything is cookied, then
 * identifyPersonFromEmailClickNative stamps rr_pid + backfills the session
 * (identified_via tracked_link:<channel>). The track route already identified
 * the visit from the same token on the page_view; this is the second path.
 * `_fuid` (the retired vendor id) is refused: an unsigned id identifies nobody.
 * GPC and a cookie decline are honored inside the action.
 *
 * Response is 204 always (even on a bad id): this is a fire-and-forget tracking
 * ping and must never surface an error into the client document.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  identifyPersonFromEmailClick,
  identifyPersonFromEmailClickNative,
} from '@/app/actions/identity-bridge'

export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const pid = params.get('_pid')?.trim()
    const fuid = params.get('_fuid')?.trim()
    const sid = params.get('sid')?.trim() || undefined

    if (pid) {
      await identifyPersonFromEmailClickNative(pid, sid)
    } else if (fuid) {
      await identifyPersonFromEmailClick(fuid, sid)
    }
  } catch (e) {
    console.warn('[track/e/identify] failed (non-blocking):', e instanceof Error ? e.message : e)
  }
  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
}
