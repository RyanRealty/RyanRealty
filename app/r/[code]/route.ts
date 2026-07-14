/**
 * GET /r/<code> — outbound-SMS short-link redirect + click tracker.
 *
 * Resolves the code (lib/data/crm/shortLinks), logs an `sms_click` engagement
 * event to the person's timeline, then 302s to the real target. The target
 * comes from OUR database (written when the text was composed), never from a
 * query param, so this can't be turned into an open redirect. Fails open to the
 * homepage on any unknown/invalid code so a mistyped link never dead-ends.
 */
import { NextRequest, NextResponse } from 'next/server'
import { resolveAndLogShortLinkClick, isLikelyBotUserAgent } from '@/lib/data/crm/shortLinks'

export const runtime = 'nodejs'
export const revalidate = 0

const HOME = 'https://ryan-realty.com'

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const clean = (code ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 16)
  // Redirect ALWAYS; only RECORD the click for a real human. A link-preview
  // prefetch (iMessage/WhatsApp/social) must not inflate the count.
  const log = !isLikelyBotUserAgent(req.headers.get('user-agent'))
  let target = HOME
  if (clean) {
    try {
      const resolved = await resolveAndLogShortLinkClick(clean, { log })
      if (resolved?.targetUrl && /^https?:\/\//i.test(resolved.targetUrl)) target = resolved.targetUrl
    } catch (err) {
      console.warn('[r/code] resolve error:', err)
    }
  }
  return NextResponse.redirect(target, 302)
}
