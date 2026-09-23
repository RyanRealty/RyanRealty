import { NextRequest, NextResponse } from 'next/server'
import { verifyEmailToken } from '@/lib/email-tracking'
import { createServiceClient } from '@/lib/supabase/service'
import { recordEmailEvent, sendTypeFromEmailKey } from '@/lib/crm/email-events'
import { recordNewsletterEngagement } from '@/lib/newsletter/track-ledger'
import { channelFromEmailKey, decorateOutboundUrl } from '@/lib/identity/outbound-links'
import { stripIdentityParams } from '@/app/api/visitors/track/strip-identity'

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
  // What we LOG never carries the person token (it names the person the row is
  // already about, and a stored URL is read, exported and joined everywhere).
  const logged = stripIdentityParams(target) ?? target
  if (ctx && Number.isFinite(ctx.personId)) {
    try {
      const sb = createServiceClient()
      // De-duped (edge case T-4): the dedupe_key includes the target URL, so
      // repeat clicks of the SAME link collapse to one timeline row while a click
      // on a DIFFERENT link still records (matches the email_events click grain).
      const { error } = await sb.from('crm_timeline').upsert(
        {
          person_id: ctx.personId,
          kind: 'email_click',
          source: 'email-tracking',
          broker: ctx.broker ?? null,
          title: ctx.label ? `Clicked a link in: ${ctx.label}` : 'Clicked an email link',
          body: logged,
          payload: { emailKey: ctx.emailKey, label: ctx.label ?? null, url: logged },
          dedupe_key: `track:click:${ctx.personId}:${ctx.emailKey}:${logged}`,
        },
        { onConflict: 'dedupe_key', ignoreDuplicates: true },
      )
      if (error) console.warn('[track/click] insert error:', error.message)

      // Also record into the unified email_events store (the single source the
      // engagement reporting reads from). Token carries personId + emailKey but
      // no recipient email — recordEmailEvent resolves the recipient best-effort
      // and anchors the dedupe key on the person, so repeat clicks of the same
      // link collapse to ONE click row. Non-blocking: a reporting-side failure
      // must never break the 302 redirect.
      const res = await recordEmailEvent({
        personId: ctx.personId,
        // Same omission as the open pixel: the signed token knows the broker,
        // and dropping it here left email_events.broker null on every click.
        broker: ctx.broker ?? null,
        sendType: sendTypeFromEmailKey(ctx.emailKey),
        event: 'click',
        emailKey: ctx.emailKey || null,
        subject: ctx.label || null,
        meta: { url: logged },
      })
      if (!res.ok) console.warn('[track/click] email_events error:', res.error)

      // Newsletter ledger (spec §3.1/H1): a `newsletter:<id>` click ALSO lands on
      // newsletter_recipient_events with a URL-inclusive recipient-scoped dedupe
      // key — repeat clicks of the same link collapse, a distinct link still
      // records. Non-blocking — the redirect always fires.
      await recordNewsletterEngagement({
        personId: ctx.personId,
        emailKey: ctx.emailKey,
        broker: ctx.broker ?? null,
        event: 'click',
        url: logged,
      })
    } catch (err) {
      console.warn('[track/click] log failed:', err)
    }
  }
  return NextResponse.redirect(ctx ? identityCarryingTarget(target, ctx) : target, 302)
}

/**
 * The redirect is where every email link already in an inbox becomes a SIGNED
 * identity link (P7 identity loop, 2026-09-23). The click token is HMAC-verified
 * and names the recipient, so an our-domain target gets a fresh signed `_pid`
 * token (and any unsigned `_pid` / `_fuid` a pre-signing send baked in is
 * dropped). Third-party targets are returned untouched: a person token never
 * leaves ryan-realty.com. The logged URL above stays token-free.
 */
function identityCarryingTarget(target: string, ctx: { personId: number; emailKey: string; broker?: string }): string {
  try {
    const host = new URL(target).hostname.toLowerCase().replace(/^www\./, '')
    if (host !== 'ryan-realty.com') return target
    if (/\/(?:api\/|admin)/.test(new URL(target).pathname)) return target
    return decorateOutboundUrl(target, {
      brokerSlug: ctx.broker ?? null,
      personId: Number.isInteger(ctx.personId) && ctx.personId > 0 ? ctx.personId : null,
      channel: channelFromEmailKey(ctx.emailKey),
    })
  } catch {
    return target
  }
}
