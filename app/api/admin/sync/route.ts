/**
 * POST: trigger initial full sync (super_admin only).
 * Sends Inngest event sync/initial-full-sync.
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { inngest } from '@/lib/inngest'
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
    await inngest.send({
      name: 'sync/initial-full-sync',
      data: {},
    })
    return NextResponse.json({ ok: true, message: 'Initial sync triggered' })
  } catch (e) {
    console.error('POST /api/admin/sync', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Internal error' }, { status: 500 })
  }
}
