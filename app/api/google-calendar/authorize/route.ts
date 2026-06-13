import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { buildGcalAuthUrl } from '@/lib/google-calendar'
import { createClient } from '@supabase/supabase-js'

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export async function GET(request: NextRequest) {
  const session = await getSession()
  const email = session?.user?.email?.trim()
  if (!email) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  const role = await getAdminRoleForEmail(email)
  if (!role?.brokerId) {
    return NextResponse.json({ error: 'Not a broker account' }, { status: 403 })
  }

  // Store a short-lived state token mapping to brokerId
  const stateToken = crypto.randomUUID()
  // Best-effort: store state in kv_store if available; the brokerId is also embedded in the state param itself
  try {
    await getServiceSupabase().from('kv_store').upsert({
      key: `gcal_oauth_state:${stateToken}`,
      value: JSON.stringify({ brokerId: role.brokerId, email }),
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    })
  } catch {
    // kv_store may not exist — brokerId is embedded in state param as fallback
  }

  const origin = new URL(request.url).origin
  const redirectUri = `${origin}/api/google-calendar/callback`
  const authUrl = buildGcalAuthUrl(redirectUri, `${stateToken}:${role.brokerId}`)

  return NextResponse.redirect(authUrl)
}
