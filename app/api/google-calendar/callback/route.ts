import { NextRequest, NextResponse } from 'next/server'
import { exchangeGcalCode, upsertGcalToken } from '@/lib/google-calendar'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')?.trim()
  const state = searchParams.get('state')?.trim()
  const error = searchParams.get('error')?.trim()

  if (error) {
    const reason = encodeURIComponent(error)
    return NextResponse.redirect(`${origin}/admin/broker-dashboard?gcal=error&reason=${reason}`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/admin/broker-dashboard?gcal=error&reason=missing_params`)
  }

  // State format: "<stateToken>:<brokerId>"
  const colonIdx = state.lastIndexOf(':')
  const brokerId = colonIdx > 0 ? state.slice(colonIdx + 1) : null

  if (!brokerId) {
    return NextResponse.redirect(`${origin}/admin/broker-dashboard?gcal=error&reason=invalid_state`)
  }

  try {
    const redirectUri = `${origin}/api/google-calendar/callback`
    const tokenData = await exchangeGcalCode(code, redirectUri)
    await upsertGcalToken(brokerId, tokenData)
    return NextResponse.redirect(`${origin}/admin/broker-dashboard?gcal=connected`)
  } catch (err) {
    console.error('GCal callback error:', err)
    const reason = encodeURIComponent(err instanceof Error ? err.message : 'unknown')
    return NextResponse.redirect(`${origin}/admin/broker-dashboard?gcal=error&reason=${reason}`)
  }
}
