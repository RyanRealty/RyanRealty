import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const RATE_LIMIT_COOKIE = 'listing_track'
const RATE_LIMIT_HOURS = 1

function getVisitorId(request: NextRequest): string {
  const cookie = request.cookies.get(RATE_LIMIT_COOKIE)?.value
  if (cookie) return cookie
  return `anon_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

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

  const visitorId = getVisitorId(_request)
  const cookieKey = `${RATE_LIMIT_COOKIE}_${key}`
  const last = _request.cookies.get(cookieKey)?.value
  if (last) {
    const lastTime = parseInt(last, 10)
    if (!Number.isNaN(lastTime) && Date.now() - lastTime < RATE_LIMIT_HOURS * 60 * 60 * 1000) {
      return NextResponse.json({ ok: true, skipped: 'rate_limit' })
    }
  }

  const supabase = createClient(url, serviceKey)
  const { data: row } = await supabase
    .from('engagement_metrics')
    .select('view_count')
    .eq('listing_key', key)
    .maybeSingle()

  if (row) {
    await supabase
      .from('engagement_metrics')
      .update({ view_count: (row as { view_count: number }).view_count + 1, updated_at: new Date().toISOString() })
      .eq('listing_key', key)
  } else {
    await supabase.from('engagement_metrics').insert({
      listing_key: key,
      view_count: 1,
      like_count: 0,
      save_count: 0,
      share_count: 0,
    })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(cookieKey, String(Date.now()), {
    path: '/',
    maxAge: RATE_LIMIT_HOURS * 60 * 60,
    httpOnly: true,
    sameSite: 'lax',
  })
  return res
}
