import { NextRequest, NextResponse } from 'next/server'

/**
 * Token Heartbeat Cron
 *
 * Runs daily to exercise every connected social platform's token-getter,
 * which transparently triggers OAuth refresh if the access_token has expired.
 * For platforms whose refresh_tokens rotate (X, LinkedIn, Pinterest, TikTok),
 * each lib persists the new refresh_token back to Supabase, keeping the chain
 * forever-valid as long as we run at least once per inactivity window.
 *
 * Inactivity windows by platform (the longest a token can sit idle before dying):
 * - Meta Page token: never expires (no heartbeat needed, but we ping for status)
 * - YouTube / GBP: 6 months (Google refresh_token inactivity)
 * - LinkedIn: 365 days (rolling refresh)
 * - TikTok: 365 days (rolling refresh)
 * - X: continuous (refresh_token rotates each call)
 * - Threads: 60 days (long-lived token, refresh extends)
 * - Pinterest: 30-60 days depending on tier
 * - Nextdoor: ~365 days (gated API, refresh_token rotates per OAuth 2.0 spec)
 *
 * Daily cadence is well under every window. Anything connected stays alive.
 *
 * Security: protected by CRON_SECRET header, identical to other cron routes.
 */

interface PlatformResult {
  platform: string
  status: 'ok' | 'skipped' | 'failed'
  message?: string
}

const cronSecret = process.env.CRON_SECRET

function validateApiKey(key: string | null): boolean {
  if (!cronSecret) return false
  return key === cronSecret
}

async function pingMeta(): Promise<PlatformResult> {
  const token = process.env.META_PAGE_ACCESS_TOKEN
  if (!token) return { platform: 'meta', status: 'skipped', message: 'No META_PAGE_ACCESS_TOKEN configured' }
  try {
    const r = await fetch(`https://graph.facebook.com/v25.0/me?fields=id,name&access_token=${encodeURIComponent(token)}`)
    const d = (await r.json()) as { id?: string; name?: string; error?: { message: string } }
    if (d.id) return { platform: 'meta', status: 'ok', message: `Page "${d.name}" (${d.id})` }
    return { platform: 'meta', status: 'failed', message: d.error?.message ?? 'Unknown error' }
  } catch (err) {
    return { platform: 'meta', status: 'failed', message: err instanceof Error ? err.message : 'fetch failed' }
  }
}

async function pingYoutube(): Promise<PlatformResult> {
  try {
    const { getYouTubeAccessToken } = await import('@/lib/youtube')
    const token = await getYouTubeAccessToken()
    return { platform: 'youtube', status: 'ok', message: `access_token len ${token.length}` }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    if (msg.includes('not connected') || msg.includes('not configured')) {
      return { platform: 'youtube', status: 'skipped', message: msg }
    }
    return { platform: 'youtube', status: 'failed', message: msg }
  }
}

async function pingLinkedIn(): Promise<PlatformResult> {
  try {
    const { getLinkedInAccessToken } = await import('@/lib/linkedin')
    const token = await getLinkedInAccessToken()
    return { platform: 'linkedin', status: 'ok', message: `access_token len ${token.length}` }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    if (msg.includes('not connected') || msg.includes('not configured')) {
      return { platform: 'linkedin', status: 'skipped', message: msg }
    }
    return { platform: 'linkedin', status: 'failed', message: msg }
  }
}

async function pingX(): Promise<PlatformResult> {
  try {
    const { getXAccessToken } = await import('@/lib/x')
    const token = await getXAccessToken()
    return { platform: 'x', status: 'ok', message: `access_token len ${token.length}` }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    if (msg.includes('not connected') || msg.includes('not configured')) {
      return { platform: 'x', status: 'skipped', message: msg }
    }
    return { platform: 'x', status: 'failed', message: msg }
  }
}

async function pingGoogleBusinessProfile(): Promise<PlatformResult> {
  try {
    const { getOrRefreshGoogleBusinessProfileAccessToken } = await import(
      '@/lib/google-business-profile'
    )
    const token = await getOrRefreshGoogleBusinessProfileAccessToken()
    return { platform: 'google_business_profile', status: 'ok', message: `access_token len ${token.length}` }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    if (msg.includes('not connected') || msg.includes('not configured')) {
      return { platform: 'google_business_profile', status: 'skipped', message: msg }
    }
    return { platform: 'google_business_profile', status: 'failed', message: msg }
  }
}

async function pingTikTok(): Promise<PlatformResult> {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return { platform: 'tiktok', status: 'skipped', message: 'Supabase not configured' }
    const supabase = createClient(url, key)
    const { data } = await supabase
      .from('tiktok_auth')
      .select('access_token, refresh_token, expires_at')
      .eq('id', 'default')
      .maybeSingle()
    if (!data) return { platform: 'tiktok', status: 'skipped', message: 'No tiktok_auth row — OAuth not connected yet' }
    const expiresAt = new Date((data as { expires_at: string }).expires_at)
    if (Date.now() < expiresAt.getTime() - 60_000) {
      return { platform: 'tiktok', status: 'ok', message: 'access_token still fresh' }
    }
    const { refreshAccessToken } = await import('@/lib/tiktok')
    const refreshed = await refreshAccessToken((data as { refresh_token: string }).refresh_token)
    await supabase
      .from('tiktok_auth')
      .update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', 'default')
    return { platform: 'tiktok', status: 'ok', message: 'refreshed and persisted new tokens' }
  } catch (err) {
    return {
      platform: 'tiktok',
      status: 'failed',
      message: err instanceof Error ? err.message : 'unknown',
    }
  }
}

async function pingThreads(): Promise<PlatformResult> {
  try {
    const { getThreadsAccessToken } = await import('@/lib/threads')
    const { accessToken } = await getThreadsAccessToken()
    return { platform: 'threads', status: 'ok', message: `access_token len ${accessToken.length}` }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    if (msg.includes('not connected') || msg.includes('not configured')) {
      return { platform: 'threads', status: 'skipped', message: msg }
    }
    return { platform: 'threads', status: 'failed', message: msg }
  }
}

async function pingPinterest(): Promise<PlatformResult> {
  try {
    const { getPinterestAccessToken } = await import('@/lib/pinterest')
    const token = await getPinterestAccessToken()
    return { platform: 'pinterest', status: 'ok', message: `access_token len ${token.length}` }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    if (msg.includes('not connected') || msg.includes('not configured')) {
      return { platform: 'pinterest', status: 'skipped', message: msg }
    }
    return { platform: 'pinterest', status: 'failed', message: msg }
  }
}

async function pingNextdoor(): Promise<PlatformResult> {
  try {
    const { getNextdoorAccessToken } = await import('@/lib/nextdoor')
    const token = await getNextdoorAccessToken()
    return { platform: 'nextdoor', status: 'ok', message: `access_token len ${token.length}` }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    if (msg.includes('not connected') || msg.includes('not configured') || msg.includes('apply for Nextdoor API access')) {
      return { platform: 'nextdoor', status: 'skipped', message: msg }
    }
    return { platform: 'nextdoor', status: 'failed', message: msg }
  }
}

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('x-cron-secret')
  if (!validateApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = new Date().toISOString()

  const results = await Promise.all([
    pingMeta(),
    pingYoutube(),
    pingLinkedIn(),
    pingX(),
    pingGoogleBusinessProfile(),
    pingTikTok(),
    pingThreads(),
    pingPinterest(),
    pingNextdoor(),
  ])

  const summary = {
    ok: results.filter((r) => r.status === 'ok').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    failed: results.filter((r) => r.status === 'failed').length,
  }

  const failed = results.filter((r) => r.status === 'failed')

  return NextResponse.json(
    {
      startedAt,
      finishedAt: new Date().toISOString(),
      summary,
      results,
      anyFailed: failed.length > 0,
    },
    { status: failed.length > 0 ? 207 : 200 }
  )
}
