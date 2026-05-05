import { NextRequest, NextResponse } from 'next/server'
import {
  getOrRefreshGoogleBusinessProfileAccessToken,
  listGoogleBusinessAccounts,
} from '@/lib/google-business-profile'

const cronSecret = process.env.CRON_SECRET

function validateApiKey(key: string | null): boolean {
  if (!cronSecret?.trim()) return false
  return key === cronSecret
}

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('x-cron-secret')

  if (!validateApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const accessToken = await getOrRefreshGoogleBusinessProfileAccessToken()
    const accounts = await listGoogleBusinessAccounts(accessToken)
    return NextResponse.json({ success: true, accounts })
  } catch (error) {
    console.error('Google Business Profile test error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load Google Business accounts',
      },
      { status: 500 }
    )
  }
}
