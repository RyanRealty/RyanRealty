import { NextRequest, NextResponse } from 'next/server'
import { verifyEmailToken } from '@/lib/email-tracking'
import { createServiceClient } from '@/lib/supabase/service'
import { recordEmailEvent, sendTypeFromEmailKey } from '@/lib/crm/email-events'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

/**
 * Email click tracker. The destination URL is signed INSIDE the token (never a
 * separate query param), so it cannot be tampered into an open redirect. Logs an
 * `email_click` row to crm_timeline, then 302-redirects to the real target.
 */
export async function GET(req: NextRequest) {
  const ctx = verifyEmailToken(req.nextUrl.searchParams.get('t'))
  const target = ctx?.url && /^https?:\/\//i.test(ctx.url) ? ctx.url : SITE_URL
  if (ctx && Number.isFinite(ctx.personId)) {
    try {
      const sb = createServiceClient()
      const { error } = await sb.from('crm_timeline').insert({
        person_id: ctx.personId,
        kind: 'email_click',
        source: 'email-tracking',
        title: ctx.label ? `Clicked a link in: ${ctx.label}` : 'Clicked an email link',
        body: target,
        payload: { emailKey: ctx.emailKey, label: ctx.label ?? null, url: target },
      })
      if (error) console.warn('[track/click] insert error:', error.message)

      // Also record into the unified email_events store (the single source the
      // engagement reporting reads from). Token carries personId + emailKey but
      // no recipient email — recordEmailEvent resolves the recipient best-effort
      // and anchors the dedupe key on the person, so repeat clicks of the same
      // link collapse to ONE click row. Non-blocking: a reporting-side failure
      // must never break the 302 redirect.
      const res = await recordEmailEvent({
        personId: ctx.personId,
        sendType: sendTypeFromEmailKey(ctx.emailKey),
        event: 'click',
        emailKey: ctx.emailKey || null,
        subject: ctx.label || null,
        meta: { url: target },
      })
      if (!res.ok) console.warn('[track/click] email_events error:', res.error)
    } catch (err) {
      console.warn('[track/click] log failed:', err)
    }
  }
  return NextResponse.redirect(target, 302)
}
