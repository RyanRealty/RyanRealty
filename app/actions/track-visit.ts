'use server'

import { createClient } from '@supabase/supabase-js'
import { trackUserEvent } from './track-user-event'

export async function trackVisit(params: {
  visitId: string
  path: string
  referrer?: string | null
  userAgent?: string | null
  userId?: string | null
}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) return
  const supabase = createClient(url, anonKey)
  await supabase.from('visits').insert({
    visit_id: params.visitId,
    path: params.path.slice(0, 2048),
    referrer: params.referrer?.slice(0, 2048) ?? null,
    user_agent: params.userAgent?.slice(0, 512) ?? null,
    user_id: params.userId ?? null,
  })
  await trackUserEvent({
    eventType: 'page_view',
    sessionId: params.visitId,
    pagePath: params.path,
    payload: { referrer: params.referrer ?? undefined },
  })

  const webhook = process.env.CRM_WEBHOOK_URL
  if (!webhook?.trim()) return
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'ryan_realty',
        event: 'visit',
        visit_id: params.visitId,
        path: params.path,
        referrer: params.referrer ?? undefined,
        user_id: params.userId ?? undefined,
        created_at: new Date().toISOString(),
      }),
    })
  } catch {
    // ignore
  }
}
