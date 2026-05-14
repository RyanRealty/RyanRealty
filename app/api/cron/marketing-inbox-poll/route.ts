/**
 * marketing-brain inbox-poll cron route.
 *
 * Polls marketing@ryan-realty.com every 2 minutes for unread messages,
 * parses each via Haiku, dispatches to the matching producer (or routes
 * for manual triage if confidence is low), and sends a voice-validated
 * confirmation reply on the original thread.
 *
 * Schedule: every 2 minutes — wired in vercel.json.
 *
 * Manual invocation:
 *   GET /api/cron/marketing-inbox-poll
 *     ?maxMessages=5
 *     ?query=is:unread+in:inbox
 *     ?dryReply=true  (skips sending the reply)
 *     ?dryRead=true   (skips marking gmail-side as read)
 *
 * Auth: Authorization: Bearer $CRON_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/marketing-brain/snapshot'
import { pollMarketingInbox } from '@/lib/marketing-brain/inbox-poll'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const maxMessagesParam = url.searchParams.get('maxMessages')
  const queryParam = url.searchParams.get('query')
  const dryReply = url.searchParams.get('dryReply') === 'true'
  const dryRead = url.searchParams.get('dryRead') === 'true'

  const maxMessages = maxMessagesParam ? Math.max(1, Math.min(50, parseInt(maxMessagesParam, 10))) : 10

  try {
    const report = await pollMarketingInbox({
      maxMessages,
      query: queryParam ?? undefined,
      skipReply: dryReply,
      skipMarkAsRead: dryRead,
    })
    // Auth-pending is informational, not an error — return 200 so cron retries
    // do not pile up. Surface the auth_hint in the body for ops review.
    return NextResponse.json(report)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('marketing-inbox-poll:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
