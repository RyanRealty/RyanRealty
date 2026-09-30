import { NextRequest, NextResponse } from 'next/server'
import { verifyEmailToken, type EmailTrackContext } from '@/lib/email-tracking'
import { createServiceClient } from '@/lib/supabase/service'
import { recordEmailEvent, sendTypeFromEmailKey } from '@/lib/crm/email-events'
import { recordNewsletterEngagement } from '@/lib/newsletter/track-ledger'
import { channelFromEmailKey, decorateOutboundUrl } from '@/lib/identity/outbound-links'
import { stripIdentityParams, withoutIdentityOnOwnSite } from '@/app/api/visitors/track/strip-identity'
import { classifyAutomation } from '@/lib/analytics/automation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

/**
 * Email click tracker. The destination URL is signed INSIDE the token (never a
 * separate query param), so it cannot be tampered into an open redirect. Logs an
 * `email_click` row to crm_timeline, then 302-redirects to the real target.
 *
 * A click by AUTOMATION is not a click. Email security scanners, link previewers
 * and crawlers follow every link in a message the moment it lands, and each one
 * used to put a "clicked" mark on the recipient: a crm_timeline row, an
 * email_events `click` and a newsletter-ledger click, all read as the contact
 * engaging. The request's user agent is classified (lib/analytics/automation.ts,
 * the classifier the site's own tracker applies). An automated request is still
 * redirected, but it is recorded once, as email_events `click_automated` with
 * meta.automation_reason, and writes no timeline row and no newsletter click. Its
 * redirect carries no person token (withoutIdentityOnOwnSite): a gateway that
 * resolves the link with a library user agent renders the page it was sent to in a
 * sandbox with an ordinary one, and a freshly signed `_pid` there identified the
 * sandbox as the contact (review of 2026-09-30). Scanners that render the link in a
 * real browser with a spoofed user agent are not caught (docs/TRACKING_POLICY.md,
 * "Known limits").
 */
export async function GET(req: NextRequest) {
  const ctx = verifyEmailToken(req.nextUrl.searchParams.get('t'))
  const target = ctx?.url && /^https?:\/\//i.test(ctx.url) ? ctx.url : SITE_URL
  // What we LOG never carries the person token (it names the person the row is
  // already about, and a stored URL is read, exported and joined everywhere).
  const logged = stripIdentityParams(target) ?? target
  if (ctx && Number.isFinite(ctx.personId)) {
    const automation = classifyAutomation({ userAgent: req.headers.get('user-agent') })
    if (automation.automated) {
      await recordAutomatedClick(ctx, logged, automation.reason)
      return NextResponse.redirect(withoutIdentityOnOwnSite(target), 302)
    }
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
 * The one record an automated click leaves: email_events `click_automated`,
 * keyed like a click (person, email, link) so a scanner that hits the same link
 * ten times is one row. No crm_timeline row, no newsletter click. Never throws:
 * the redirect must fire whatever the reporting side does.
 */
async function recordAutomatedClick(ctx: EmailTrackContext, logged: string, reason: string | null): Promise<void> {
  try {
    const res = await recordEmailEvent({
      personId: ctx.personId,
      broker: ctx.broker ?? null,
      sendType: sendTypeFromEmailKey(ctx.emailKey),
      event: 'click_automated',
      emailKey: ctx.emailKey || null,
      subject: ctx.label || null,
      meta: { url: logged, automation_reason: reason },
    })
    if (!res.ok) console.warn('[track/click] automated click not recorded:', res.error)
  } catch (err) {
    console.warn('[track/click] automated click log failed:', err)
  }
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
