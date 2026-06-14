import { NextRequest, NextResponse } from 'next/server'
import { verifyEmailToken } from '@/lib/email-tracking'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 1x1 transparent GIF.
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

function gif() {
  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(PIXEL.length),
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache',
      Expires: '0',
    },
  })
}

/**
 * Email open pixel. Logs an `email_open` row to crm_timeline, then returns a
 * 1x1 gif. Always returns the pixel even on a bad/forged token so email clients
 * never show a broken image.
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = verifyEmailToken(req.nextUrl.searchParams.get('t'))
    if (ctx && Number.isFinite(ctx.personId)) {
      const sb = createServiceClient()
      const { error } = await sb.from('crm_timeline').insert({
        person_id: ctx.personId,
        kind: 'email_open',
        source: 'email-tracking',
        title: ctx.label || 'Email opened',
        payload: {
          emailKey: ctx.emailKey,
          label: ctx.label ?? null,
          userAgent: req.headers.get('user-agent')?.slice(0, 240) ?? null,
        },
      })
      if (error) console.warn('[track/open] insert error:', error.message)
    }
  } catch (err) {
    console.warn('[track/open] log failed:', err)
  }
  return gif()
}
