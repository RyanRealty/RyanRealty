import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getOrRefreshGoogleBusinessProfileAccessToken } from '@/lib/google-business-profile'

const cronSecret = process.env.CRON_SECRET

function isActiveStatus(value: string | null | undefined): boolean {
  const s = String(value || '').toLowerCase()
  return s.includes('active') || s.includes('for sale') || s.includes('coming soon')
}

function isAuthorized(request: NextRequest): boolean {
  if (!cronSecret?.trim()) return false
  const byHeader = request.headers.get('x-cron-secret')
  const byBearer = request.headers.get('authorization')
  return byHeader === cronSecret || byBearer === `Bearer ${cronSecret}`
}

async function fetchActiveMattListings(limit: number) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl?.trim() || !serviceRoleKey?.trim()) {
    throw new Error('Supabase not configured')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const officeName = process.env.GBP_BROKER_OFFICE_NAME || 'Ryan Realty LLC'
  const { data, error } = await supabase
    .from('listings')
    .select(
      'ListNumber,StreetNumber,StreetName,City,State,StandardStatus,ListAgentName,ListOfficeName,PhotoURL,ModificationTimestamp'
    )
    .eq('ListOfficeName', officeName)
    .limit(200)

  if (error) throw new Error(error.message)
  return (data ?? [])
    .filter((r) => isActiveStatus(r.StandardStatus))
    .filter((r) => String(r.ListAgentName || '').toLowerCase().includes('matt'))
    .filter((r) => Boolean(r.PhotoURL))
    .sort((a, b) => String(b.ModificationTimestamp || '').localeCompare(String(a.ModificationTimestamp || '')))
    .slice(0, limit)
}

async function uploadPhotoToGbp(accessToken: string, sourceUrl: string) {
  const accountId = process.env.GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID
  const locationId = process.env.GOOGLE_BUSINESS_PROFILE_LOCATION_ID
  if (!accountId?.trim() || !locationId?.trim()) {
    throw new Error('GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID or GOOGLE_BUSINESS_PROFILE_LOCATION_ID missing')
  }

  const endpoint = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/media`
  const payload = {
    mediaFormat: 'PHOTO',
    sourceUrl,
    locationAssociation: { category: 'ADDITIONAL' },
  }
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const json = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, json }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const requested = Number.parseInt(request.nextUrl.searchParams.get('count') || '6', 10)
    const limit = Number.isFinite(requested) ? Math.max(1, Math.min(requested, 20)) : 6
    const listings = await fetchActiveMattListings(limit)
    const accessToken = await getOrRefreshGoogleBusinessProfileAccessToken()

    const uploads = []
    for (const listing of listings) {
      const result = await uploadPhotoToGbp(accessToken, String(listing.PhotoURL))
      uploads.push({
        listNumber: listing.ListNumber,
        ok: result.ok,
        status: result.status,
        mediaName: result.json?.name || null,
        googleUrl: result.json?.googleUrl || null,
        error: result.ok ? null : (result.json?.error?.message || JSON.stringify(result.json)),
      })
    }

    return NextResponse.json({
      startedAt: new Date().toISOString(),
      refreshed: uploads.length,
      succeeded: uploads.filter((x) => x.ok).length,
      failed: uploads.filter((x) => !x.ok).length,
      uploads,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
