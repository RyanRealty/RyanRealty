import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const RATE_LIMIT_HOURS = 1

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ listingKey: string }> }
) {
  const { listingKey } = await params
  const key = String(listingKey ?? '').trim()
  if (!key) return NextResponse.json({ error: 'Missing listing key' }, { status: 400 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !serviceKey?.trim()) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const cookieKey = `listing_track_${key}`
  const last = _request.cookies.get(cookieKey)?.value
  if (last) {
    const lastTime = parseInt(last, 10)
    if (!Number.isNaN(lastTime) && Date.now() - lastTime < RATE_LIMIT_HOURS * 60 * 60 * 1000) {
      return NextResponse.json({ ok: true, skipped: 'rate_limit' })
    }
  }

  void createClient
  // DAL: incrementListingViewCount handles ensure-row + atomic bump.
  const { incrementListingViewCount } = await import('@/lib/data')
  await incrementListingViewCount(key)

  const res = NextResponse.json({ ok: true })
  res.cookies.set(cookieKey, String(Date.now()), {
    path: '/',
    maxAge: RATE_LIMIT_HOURS * 60 * 60,
    httpOnly: true,
    sameSite: 'lax',
  })
  return res
}
