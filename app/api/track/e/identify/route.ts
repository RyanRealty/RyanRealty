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
 * Same trust model and the same code path as the React bridge: the id came
 * from a link WE emailed to the contact, is validated against crm_people
 * before anything is cookied, and identification runs through
 * identifyPersonFromEmailClick(Native) — rr_pid cookie + session backfill
 * (identified_via email_click_pid / email_click_fuid).
 *
 * Response is 204 always (even on a bad id): this is a fire-and-forget beacon
 * and must never surface an error into the client document.
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
