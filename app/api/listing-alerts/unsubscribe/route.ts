/**
 * GET /api/listing-alerts/unsubscribe?token=<unsubscribe_token>
 *
 * One-click unsubscribe handler. Validates the token against
 * public.listing_alerts.unsubscribe_token, marks the subscriber as
 * `unsubscribed`, tags the matching FUB person, and renders a branded
 * confirmation HTML page with a CTA to resubscribe via the LP.
 *
 * No auth: the token IS the auth. Tokens are 32 chars of UUID hex per the
 * migration default and cannot be guessed in a reasonable time.
 *
 * Spec: marketing_brain_skills/producers/listing-alerts/SKILL.md §4.1 Step 9
 */
import { NextRequest, NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabase/service'
import { addPersonTags } from '@/lib/followupboss'

export const dynamic = 'force-dynamic'

const NAVY = '#102742'
const CREAM = '#faf8f4'
const MUTED = '#5d6470'

function html(message: string, subtitle: string, ctaHref: string): string {
  // Inline styles — emails strip <head>, but this is a regular browser response.
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Listing alerts — Ryan Realty</title>
    <style>
      :root { color-scheme: light; }
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Geist", "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: ${CREAM}; color: ${NAVY}; }
      .wrap { max-width: 540px; margin: 0 auto; padding: 64px 24px; text-align: center; }
      .panel { background: #fff; border: 1px solid rgba(16,39,66,0.08); border-radius: 14px; padding: 40px 28px; }
      h1 { font-size: 24px; line-height: 1.25; margin: 0 0 12px 0; font-weight: 600; }
      p { color: ${MUTED}; line-height: 1.55; margin: 0 0 18px 0; font-size: 15px; }
      .btn { display: inline-block; background: ${NAVY}; color: ${CREAM}; padding: 12px 22px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px; }
      footer { margin-top: 28px; color: ${MUTED}; font-size: 12px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="panel">
        <h1>${message}</h1>
        <p>${subtitle}</p>
        <a class="btn" href="${ctaHref}">Back to ryan-realty.com</a>
      </div>
      <footer>Ryan Realty &middot; Bend &middot; Oregon &middot; 541.213.6706</footer>
    </div>
  </body>
</html>`
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')?.trim()
  const email = url.searchParams.get('email')?.trim().toLowerCase()
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
  const home = `${siteUrl}/`

  if (!token) {
    return new NextResponse(
      html(
        'Missing unsubscribe token',
        'This unsubscribe link is incomplete. Open the most recent digest email and click the unsubscribe link at the bottom.',
        home,
      ),
      { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }

  const supabase = createServiceClient()
  const lookup = supabase
    .from('listing_alerts')
    .select('id, email, fub_lead_id, status')
    .eq('unsubscribe_token', token)
  const { data: row, error } = email ? await lookup.eq('email', email).maybeSingle() : await lookup.maybeSingle()

  if (error) {
    console.error('[listing-alerts/unsubscribe] lookup failed:', error)
    return new NextResponse(
      html(
        'Something went wrong',
        'We had trouble processing that link. Try again or email matt@ryan-realty.com directly.',
        home,
      ),
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }

  if (!row) {
    return new NextResponse(
      html(
        'Link not recognized',
        'This unsubscribe link has expired or is no longer valid. If you keep getting emails you don\'t want, reply to one and we\'ll handle it directly.',
        home,
      ),
      { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }

  if (row.status === 'unsubscribed') {
    return new NextResponse(
      html(
        'You\'re already unsubscribed',
        'No further emails will be sent. If anything changes and you want to opt back in, the Custom Alerts form on any community page will resubscribe you.',
        home,
      ),
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }

  const { error: updateError } = await supabase
    .from('listing_alerts')
    .update({
      status: 'unsubscribed',
      unsubscribed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)

  if (updateError) {
    console.error('[listing-alerts/unsubscribe] update failed:', updateError)
    return new NextResponse(
      html(
        'Something went wrong',
        'We could not process the unsubscribe just now. Try again or email matt@ryan-realty.com directly.',
        home,
      ),
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }

  // Tag the FUB person (best-effort; do not fail the response if FUB is down).
  const fubId = Number(row.fub_lead_id ?? '')
  if (Number.isFinite(fubId) && fubId > 0) {
    addPersonTags(fubId, ['listing-alerts-unsubscribed']).catch((err) => {
      console.warn('[listing-alerts/unsubscribe] FUB tag failed:', err)
    })
  }

  return new NextResponse(
    html(
      'You\'re unsubscribed',
      'You will not get any more listing-alert emails. Thank you for letting us know. If anything changes, the Custom Alerts form on any community page will resubscribe you.',
      home,
    ),
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}
