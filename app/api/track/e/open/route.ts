import { NextRequest, NextResponse } from 'next/server'
import { verifyEmailToken } from '@/lib/email-tracking'
import { createServiceClient } from '@/lib/supabase/service'
import { recordEmailEvent, sendTypeFromEmailKey } from '@/lib/crm/email-events'
import { recordNewsletterEngagement } from '@/lib/newsletter/track-ledger'

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
      // De-duped (edge case T-4): a pixel can fire on every render/forward. The
      // dedupe_key collapses repeat opens of the same email to ONE timeline row
      // (matches the email_events store), so the comms chain never floods with
      // hundreds of identical "Email opened" entries. ignoreDuplicates makes the
      // repeat a no-op instead of an error.
      const { error } = await sb.from('crm_timeline').upsert(
        {
          person_id: ctx.personId,
          kind: 'email_open',
          source: 'email-tracking',
          broker: ctx.broker ?? null,
          title: ctx.label || 'Email opened',
          payload: {
            emailKey: ctx.emailKey,
            label: ctx.label ?? null,
            userAgent: req.headers.get('user-agent')?.slice(0, 240) ?? null,
          },
          dedupe_key: `track:open:${ctx.personId}:${ctx.emailKey}`,
        },
        { onConflict: 'dedupe_key', ignoreDuplicates: true },
      )
      if (error) console.warn('[track/open] insert error:', error.message)

      // Also record into the unified email_events store (the single source the
      // engagement reporting reads from). The token carries personId + emailKey
      // but no recipient email — recordEmailEvent resolves the recipient
      // best-effort from the person and anchors the dedupe key on the person, so
      // a pixel that fires many times collapses to ONE open row. Non-blocking:
      // a reporting-side failure must never break the pixel response.
      const res = await recordEmailEvent({
        personId: ctx.personId,
        sendType: sendTypeFromEmailKey(ctx.emailKey),
        event: 'open',
        emailKey: ctx.emailKey || null,
        subject: ctx.label || null,
      })
      if (!res.ok) console.warn('[track/open] email_events error:', res.error)

      // Newsletter ledger (spec §3.1/H1): a `newsletter:<id>` open ALSO lands on
      // newsletter_recipient_events, the deduped source every per-issue stat
      // derives from. Recipient-scoped dedupe collapses pixel refires + webhook
      // duplicates to one row. Non-blocking — the pixel always returns.
      try {
        await recordNewsletterEngagement({
          personId: ctx.personId,
          emailKey: ctx.emailKey,
          broker: ctx.broker ?? null,
          event: 'open',
        })
      } catch (err) {
        console.warn('[track/open] newsletter ledger error:', err)
      }
    }
  } catch (err) {
    console.warn('[track/open] log failed:', err)
  }
  return gif()
}
