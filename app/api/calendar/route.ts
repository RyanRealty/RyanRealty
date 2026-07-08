import { NextRequest } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { generateICS } from '@/lib/ics'
import { listingDetailPath } from '@/lib/slug'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com'

function getSupabase() {
  if (!url?.trim() || !anonKey?.trim()) throw new Error('Supabase not configured')
  return createClient(url, anonKey)
}

/**
 * GET /api/calendar?listingKey=...&openHouseId=...
 * Returns .ics file for the open house event.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const listingKey = searchParams.get('listingKey')?.trim()
  const openHouseId = searchParams.get('openHouseId')?.trim()

  if (!listingKey || !openHouseId) {
    return new Response('Missing listingKey or openHouseId', { status: 400 })
  }

  const supabase = getSupabase()
  const { getOpenHouseById, getListingTiles } = await import('@/lib/data')
  const oh = await getOpenHouseById(openHouseId, listingKey)
  if (!oh) {
    return new Response('Open house not found', { status: 404 })
  }

  // DAL: resolve canonical listing key + address from listing_tile_mv.
  const [byKey, byNum] = await Promise.all([
    getListingTiles({ listingKeys: [listingKey], status: 'all', limit: 1 }),
    getListingTiles({ listNumbers: [listingKey], status: 'all', limit: 1 }),
  ])
  const tile = byKey[0] ?? byNum[0] ?? null
  const key = tile?.listingKey ?? listingKey
  const listingUrl = `${siteUrl.replace(/\/$/, '')}${listingDetailPath(key)}`
  void supabase
  const address = tile
    ? [tile.streetNumber, tile.streetName, tile.streetSuffix].filter(Boolean).join(' ') +
      (tile.city ? `, ${tile.city}` : '') +
      (tile.postalCode ? ` ${tile.postalCode}` : '')
    : ''

  const startTime = (oh.start_time ?? '09:00:00').toString().slice(0, 8)
  const endTime = (oh.end_time ?? '12:00:00').toString().slice(0, 8)
  const description = [
    listingUrl,
    oh.host_agent_name ? `Host: ${oh.host_agent_name}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const ics = generateICS({
    title: `Open House at ${address || 'Property'}`,
    description,
    location: address || 'See listing',
    startDate: oh.event_date,
    endDate: oh.event_date,
    startTime: startTime.replace(/(\d{2}):(\d{2})(?::(\d{2}))?/, (_: string, h: string, m: string, s?: string) => `${h}:${m}${s ? `:${s}` : ':00'}`),
    endTime: endTime.replace(/(\d{2}):(\d{2})(?::(\d{2}))?/, (_: string, h: string, m: string, s?: string) => `${h}:${m}${s ? `:${s}` : ':00'}`),
    url: listingUrl,
  })

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="open-house-${oh.event_date}.ics"`,
    },
  })
}

// getAddress was the legacy listings→properties join. Address now reads
// from listing_tile_mv via the DAL in the GET handler above.
