import { NextRequest, NextResponse } from 'next/server'

const TIKTOK_AUTH_BASE = 'https://www.tiktok.com/v2/auth/authorize/'

const REQUIRED_SCOPES = [
  'user.info.basic',
  'user.info.profile',
  'video.upload',
  'video.publish',
].join(',')

function validateApiKey(key: string | null): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret?.trim()) return false
  return key === cronSecret
}

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('x-cron-secret')
  if (!validateApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET
  const redirectUri = process.env.TIKTOK_REDIRECT_URI

  const envStatus = {
    TIKTOK_CLIENT_KEY: clientKey ? `SET (${clientKey.length} chars, starts: ${clientKey.slice(0, 4)}***)` : 'MISSING',
    TIKTOK_CLIENT_SECRET: clientSecret ? `SET (${clientSecret.length} chars)` : 'MISSING',
    TIKTOK_REDIRECT_URI: redirectUri ?? 'MISSING',
  }

  let authUrl: string | null = null
  if (clientKey && redirectUri) {
    const params = new URLSearchParams({
      client_key: clientKey,
      scope: REQUIRED_SCOPES,
      redirect_uri: redirectUri,
      response_type: 'code',
      state: 'diagnostic_test',
    })
    authUrl = `${TIKTOK_AUTH_BASE}?${params.toString()}`
  }

  const checklist = [
    'TikTok Developer Portal: https://developers.tiktok.com',
    '1. App → Products → Login Kit: must be ADDED and APPROVED',
    '2. App → Products → Content Posting API: must be ADDED and APPROVED',
    '3. Login Kit → Scopes: enable user.info.basic, user.info.profile, video.upload, video.publish',
    '4. Login Kit → Redirect URI: must be EXACTLY ' + (redirectUri ?? '<TIKTOK_REDIRECT_URI not set>'),
    '5. App Details → Client Key: paste into TIKTOK_CLIENT_KEY in .env.local',
    '6. App Details → Client Secret: paste into TIKTOK_CLIENT_SECRET in .env.local',
    '7. App Status: if sandbox, add the TikTok account as a Tester under App → Testers',
    '8. After updating the portal, restart the dev server to reload env vars',
  ]

  return NextResponse.json({
    envStatus,
    authUrl,
    checklist,
    note: 'Copy authUrl into a browser to test the OAuth page. A "client_key" error from TikTok means the portal config does not match the env vars above.',
  })
}
