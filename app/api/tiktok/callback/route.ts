import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { exchangeCodeForToken, validateStateFromRedis } from '@/lib/tiktok'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function getSupabase() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase not configured')
  }
  return createClient(supabaseUrl, serviceRoleKey)
}

function redirectUrl(request: NextRequest, path: string): string {
  const origin = new URL(request.url).origin
  return `${origin}${path}`
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')?.trim()
  const state = searchParams.get('state')?.trim()
  const error = searchParams.get('error')?.trim()
  const errorDescription = searchParams.get('error_description')?.trim()

  if (error) {
    const reason = encodeURIComponent(errorDescription || error)
    return NextResponse.redirect(redirectUrl(request, `/admin/social?tiktok=error&reason=${reason}`))
  }

  if (!code || !state) {
    return NextResponse.redirect(redirectUrl(request, '/admin/social?tiktok=error&reason=Missing+code+or+state'))
  }

  try {
    const isValidState = await validateStateFromRedis(state)
    if (!isValidState) {
      return NextResponse.redirect(redirectUrl(request, '/admin/social?tiktok=error&reason=Invalid+state'))
    }

    const tokenData = await exchangeCodeForToken(code)

    const supabase = getSupabase()
    const { error: upsertError } = await supabase
      .from('tiktok_auth')
      .upsert({
        id: 'default',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'id',
      })

    if (upsertError) {
      console.error('Supabase upsert error:', upsertError)
      return NextResponse.redirect(
        redirectUrl(request, '/admin/social?tiktok=error&reason=Failed+to+save+token')
      )
    }

    return NextResponse.redirect(redirectUrl(request, '/admin/social?tiktok=connected'))
  } catch (err) {
    console.error('TikTok callback error:', err)
    const reason = err instanceof Error ? encodeURIComponent(err.message) : 'Unknown+error'
    return NextResponse.redirect(redirectUrl(request, `/admin/social?tiktok=error&reason=${reason}`))
  }
}
