/**
 * POST /api/admin/sync used to send an Inngest event (`sync/initial-full-sync`).
 * There is no in-repo Inngest worker, so that call returned success and did
 * nothing. Live operator start is GET /api/cron/start-sync (CRON_SECRET).
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { isSuperuserAdmin } from '@/lib/admin'

export async function POST() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!isSuperuserAdmin(user.email)) {
      return NextResponse.json({ error: 'Forbidden: super_admin only' }, { status: 403 })
    }
    return NextResponse.json(
      {
        ok: false,
        error:
          'This path is retired. Kick the live full/terminal/delta lanes with GET /api/cron/start-sync (CRON_SECRET).',
      },
      { status: 410 },
    )
  } catch (e) {
    console.error('POST /api/admin/sync', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Internal error' }, { status: 500 })
  }
}
