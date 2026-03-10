/**
 * GET: return latest sync_checkpoints record (admin role).
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const role = await getAdminRoleForEmail(user.email)
    if (!role) {
      return NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403 })
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url?.trim() || !key?.trim()) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 503 })
    }
    const service = createClient(url, key)
    const { data, error } = await service
      .from('sync_checkpoints')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data ?? null)
  } catch (e) {
    console.error('GET /api/admin/sync/status', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Internal error' }, { status: 500 })
  }
}
